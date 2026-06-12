import uuid
import httpx
from datetime import datetime, timedelta
from urllib.parse import urlencode
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.config import get_settings
from app.models.integration import IntegrationConfig
from app.services.token_lifecycle import store_token, get_token

settings = get_settings()

JIRA_API_BASE = "https://api.atlassian.com"
JIRA_SCOPES = [
    "read:issue:jira",
    "read:user:jira",
    "read:sprint:jira",
    "read:worklog:jira",
    "read:project:jira",
    "write:webhook:jira",
    "offline_access",
]


def build_jira_auth_url(state: str) -> str:
    params = {
        "audience": "api.atlassian.com",
        "client_id": settings.jira_client_id,
        "scope": " ".join(JIRA_SCOPES),
        "redirect_uri": settings.jira_redirect_uri,
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    }
    return f"{settings.jira_auth_url}?{urlencode(params)}"


async def exchange_jira_code(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    code: str,
) -> IntegrationConfig:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.jira_token_url,
            json={
                "grant_type": "authorization_code",
                "client_id": settings.jira_client_id,
                "client_secret": settings.jira_client_secret,
                "code": code,
                "redirect_uri": settings.jira_redirect_uri,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    access_token = data["access_token"]
    refresh_token = data.get("refresh_token")
    expires_in = data.get("expires_in", 3600)

    await store_token(
        db, tenant_id, "jira", "access",
        access_token, refresh_token,
        expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
    )

    # Discover accessible Jira sites
    async with httpx.AsyncClient() as client:
        sites_resp = await client.get(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        sites_resp.raise_for_status()
        sites = sites_resp.json()

    cloud_id = sites[0]["id"] if sites else None
    site_url = sites[0].get("url", "") if sites else ""

    result = await db.execute(
        select(IntegrationConfig).where(
            and_(
                IntegrationConfig.tenant_id == tenant_id,
                IntegrationConfig.integration_type == "jira",
            )
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        config = IntegrationConfig(tenant_id=tenant_id, integration_type="jira")
        db.add(config)

    config.status = "connected"
    config.config_data = {"cloud_id": cloud_id, "site_url": site_url}
    config.webhook_active = False  # webhook setup is a separate step
    await db.flush()
    return config


async def get_client(db: AsyncSession, tenant_id: uuid.UUID, cloud_id: str) -> httpx.AsyncClient:
    token = await get_token(db, tenant_id, "jira", "access")
    if not token:
        raise RuntimeError(f"No valid Jira token for tenant {tenant_id}")
    return httpx.AsyncClient(
        base_url=f"{JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=30.0,
    )


async def sync_issues(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    cloud_id: str,
    updated_since: datetime | None = None,
) -> list[dict]:
    jql = "ORDER BY updated DESC"
    if updated_since:
        ts = updated_since.strftime("%Y-%m-%d %H:%M")
        jql = f'updated >= "{ts}" ORDER BY updated DESC'

    async with await get_client(db, tenant_id, cloud_id) as client:
        resp = await client.get(
            "/search",
            params={"jql": jql, "maxResults": 100, "fields": "summary,status,assignee,updated,worklog"},
        )
        resp.raise_for_status()
        return resp.json().get("issues", [])


async def sync_worklogs(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    cloud_id: str,
    updated_since: datetime | None = None,
) -> list[dict]:
    async with await get_client(db, tenant_id, cloud_id) as client:
        params = {}
        if updated_since:
            params["since"] = int(updated_since.timestamp() * 1000)
        resp = await client.get("/worklog/updated", params=params)
        resp.raise_for_status()
        return resp.json().get("values", [])
