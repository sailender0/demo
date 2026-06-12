import base64
import time
import uuid
import httpx
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.config import get_settings
from app.models.integration import IntegrationConfig
from app.services.token_lifecycle import store_token, get_token

settings = get_settings()

GITHUB_API = "https://api.github.com"


def _load_pem() -> str:
    """
    Accept the private key in either format:
      1. Raw PEM with literal \\n  →  -----BEGIN RSA PRIVATE KEY-----\\nMI...\\n-----END...
      2. Base64-encoded PEM        →  LS0tLS1CRUdJTi...
    """
    raw = settings.github_app_private_key.strip()
    if raw.startswith("-----"):
        # Raw PEM — replace literal \n with real newlines
        return raw.replace("\\n", "\n")
    # Base64-encoded PEM
    return base64.b64decode(raw).decode()


def generate_app_jwt() -> str:
    """Generate a short-lived JWT signed with the GitHub App private key."""
    pem = _load_pem()
    now = int(time.time())
    payload = {
        "iat": now - 60,   # 60s clock skew buffer
        "exp": now + 540,  # 9 minutes (max 10)
        "iss": settings.github_app_id,
    }
    return jose_jwt.encode(payload, pem, algorithm="RS256")


async def get_installation_id(db: AsyncSession, tenant_id: uuid.UUID) -> str | None:
    result = await db.execute(
        select(IntegrationConfig).where(
            and_(
                IntegrationConfig.tenant_id == tenant_id,
                IntegrationConfig.integration_type == "github",
                IntegrationConfig.status == "connected",
            )
        )
    )
    config = result.scalar_one_or_none()
    return config.config_data.get("installation_id") if config else None


async def get_client(db: AsyncSession, tenant_id: uuid.UUID) -> httpx.AsyncClient:
    token = await get_token(db, tenant_id, "github", "installation")
    if not token:
        raise RuntimeError(f"No valid GitHub token for tenant {tenant_id}")
    return httpx.AsyncClient(
        base_url=GITHUB_API,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30.0,
    )


async def sync_pull_requests(db: AsyncSession, tenant_id: uuid.UUID, org: str, since: datetime | None = None) -> list[dict]:
    async with await get_client(db, tenant_id) as client:
        repos_resp = await client.get(f"/orgs/{org}/repos", params={"per_page": 100, "type": "all"})
        repos_resp.raise_for_status()
        repos = repos_resp.json()

        prs = []
        for repo in repos:
            params = {"state": "all", "per_page": 100}
            if since:
                params["since"] = since.isoformat() + "Z"
            resp = await client.get(f"/repos/{org}/{repo['name']}/pulls", params=params)
            if resp.status_code == 200:
                prs.extend(resp.json())
    return prs


async def sync_commits(db: AsyncSession, tenant_id: uuid.UUID, org: str, repo: str, since: datetime | None = None) -> list[dict]:
    async with await get_client(db, tenant_id) as client:
        params = {"per_page": 100}
        if since:
            params["since"] = since.isoformat() + "Z"
        resp = await client.get(f"/repos/{org}/{repo}/commits", params=params)
        resp.raise_for_status()
        return resp.json()


async def handle_app_install_callback(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    installation_id: str,
    org_name: str,
) -> IntegrationConfig:
    """Called after GitHub App install redirect. Fetches first installation token."""
    app_jwt = generate_app_jwt()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00")).replace(tzinfo=None)
    await store_token(db, tenant_id, "github", "installation", data["token"], expires_at=expires_at)

    result = await db.execute(
        select(IntegrationConfig).where(
            and_(
                IntegrationConfig.tenant_id == tenant_id,
                IntegrationConfig.integration_type == "github",
            )
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        config = IntegrationConfig(
            tenant_id=tenant_id,
            integration_type="github",
        )
        db.add(config)

    config.status = "connected"
    config.config_data = {"installation_id": installation_id, "org_name": org_name}
    config.webhook_active = True
    await db.flush()
    return config
