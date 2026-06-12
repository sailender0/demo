"""
Token Lifecycle Service

Proactively refreshes integration tokens 15 minutes before expiry.
Uses Redis distributed locks to prevent concurrent refresh races.
All token values are Fernet-encrypted at rest.
"""
import base64
import time
import uuid
import httpx
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.integration import IntegrationToken
from app.core.crypto import encrypt, decrypt
from app.core.redis_client import acquire_lock, release_lock
from app.config import get_settings

settings = get_settings()


async def store_token(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    integration_type: str,
    token_type: str,
    token_value: str,
    refresh_value: str | None = None,
    expires_at: datetime | None = None,
) -> IntegrationToken:
    result = await db.execute(
        select(IntegrationToken).where(
            and_(
                IntegrationToken.tenant_id == tenant_id,
                IntegrationToken.integration_type == integration_type,
                IntegrationToken.token_type == token_type,
            )
        )
    )
    existing = result.scalar_one_or_none()

    enc_value = encrypt(token_value)
    enc_refresh = encrypt(refresh_value) if refresh_value else None

    if existing:
        existing.encrypted_value = enc_value
        existing.encrypted_refresh = enc_refresh
        existing.expires_at = expires_at
        existing.last_refreshed_at = datetime.utcnow()
        existing.is_valid = True
        existing.refresh_failure_count = 0
        return existing

    token = IntegrationToken(
        tenant_id=tenant_id,
        integration_type=integration_type,
        token_type=token_type,
        encrypted_value=enc_value,
        encrypted_refresh=enc_refresh,
        expires_at=expires_at,
    )
    db.add(token)
    await db.flush()
    return token


async def get_token(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    integration_type: str,
    token_type: str,
) -> str | None:
    result = await db.execute(
        select(IntegrationToken).where(
            and_(
                IntegrationToken.tenant_id == tenant_id,
                IntegrationToken.integration_type == integration_type,
                IntegrationToken.token_type == token_type,
                IntegrationToken.is_valid == True,
            )
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        return None

    # Proactive refresh if within safety margin
    if token.expires_at:
        margin = timedelta(seconds=settings.token_refresh_margin_seconds)
        if datetime.utcnow() >= token.expires_at - margin:
            refreshed = await _refresh_token(db, token)
            if refreshed:
                return refreshed
            return None

    return decrypt(token.encrypted_value)


async def _refresh_token(db: AsyncSession, token: IntegrationToken) -> str | None:
    lock_name = f"token_refresh:{token.tenant_id}:{token.integration_type}"
    acquired = await acquire_lock(lock_name, timeout=30)
    if not acquired:
        # Another worker is refreshing — wait briefly and return current value
        return decrypt(token.encrypted_value)

    try:
        if token.integration_type == "github":
            return await _refresh_github_installation_token(db, token)
        elif token.integration_type == "jira":
            return await _refresh_oauth_token(db, token, settings.jira_token_url, settings.jira_client_id, settings.jira_client_secret)
        elif token.integration_type == "teams":
            teams_token_url = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/token"
            return await _refresh_oauth_token(db, token, teams_token_url, settings.teams_client_id, settings.teams_client_secret)
    finally:
        await release_lock(lock_name)

    return None


async def _refresh_github_installation_token(db: AsyncSession, token: IntegrationToken) -> str | None:
    """GitHub App installation tokens are generated fresh using the App's JWT."""
    from app.services.github_service import generate_app_jwt, get_installation_id

    installation_id = await get_installation_id(db, token.tenant_id)
    if not installation_id:
        return None

    app_jwt = generate_app_jwt()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
            },
        )
        if resp.status_code != 201:
            await _mark_token_failed(db, token)
            return None

        data = resp.json()
        new_value = data["token"]
        expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00")).replace(tzinfo=None)

        token.encrypted_value = encrypt(new_value)
        token.expires_at = expires_at
        token.last_refreshed_at = datetime.utcnow()
        token.refresh_failure_count = 0
        await db.flush()
        return new_value


async def _refresh_oauth_token(
    db: AsyncSession,
    token: IntegrationToken,
    token_url: str,
    client_id: str,
    client_secret: str,
) -> str | None:
    if not token.encrypted_refresh:
        await _mark_token_failed(db, token)
        return None

    refresh_value = decrypt(token.encrypted_refresh)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_value,
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        if resp.status_code != 200:
            await _mark_token_failed(db, token)
            return None

        data = resp.json()
        new_access = data["access_token"]
        new_refresh = data.get("refresh_token", refresh_value)
        expires_in = data.get("expires_in", 3600)

        token.encrypted_value = encrypt(new_access)
        token.encrypted_refresh = encrypt(new_refresh)
        token.expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        token.last_refreshed_at = datetime.utcnow()
        token.refresh_failure_count = 0
        await db.flush()
        return new_access


async def _mark_token_failed(db: AsyncSession, token: IntegrationToken) -> None:
    token.refresh_failure_count = (token.refresh_failure_count or 0) + 1
    if token.refresh_failure_count >= 3:
        token.is_valid = False
    await db.flush()


async def check_expiring_tokens(db: AsyncSession) -> list[dict]:
    """Called by background worker every 45 minutes."""
    horizon = datetime.utcnow() + timedelta(seconds=settings.token_refresh_margin_seconds)
    result = await db.execute(
        select(IntegrationToken).where(
            and_(
                IntegrationToken.is_valid == True,
                IntegrationToken.expires_at <= horizon,
            )
        )
    )
    tokens = result.scalars().all()
    report = []
    for t in tokens:
        refreshed = await _refresh_token(db, t)
        report.append({
            "tenant_id": str(t.tenant_id),
            "integration": t.integration_type,
            "success": refreshed is not None,
        })
    return report
