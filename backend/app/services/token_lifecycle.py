"""
Token cache for Teams client credentials token.
Stores the token encrypted in DB and refreshes it when expired.
"""
import uuid
import httpx
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.integration import IntegrationToken
from app.core.crypto import encrypt, decrypt
from app.config import get_settings

settings = get_settings()

_REFRESH_MARGIN_SECONDS = 300  # refresh 5 minutes before expiry


async def store_token(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    integration_type: str,
    token_type: str,
    token_value: str,
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

    if existing:
        existing.encrypted_value = enc_value
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

    if token.expires_at:
        margin = timedelta(seconds=_REFRESH_MARGIN_SECONDS)
        if datetime.utcnow() >= token.expires_at - margin:
            # Token near expiry — let caller re-fetch via client credentials
            return None

    return decrypt(token.encrypted_value)
