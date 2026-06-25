import uuid
import httpx
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.config import get_settings
from app.models.integration import IntegrationConfig
from app.services.token_lifecycle import store_token, get_token

settings = get_settings()

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_TOKEN_URL = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/token"


async def _fetch_client_credentials_token() -> tuple[str, datetime]:
    """
    Client Credentials flow — app authenticates as itself, no user interaction.
    Requires Application permissions granted in Azure Portal (admin consent once).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.teams_client_id,
                "client_secret": settings.teams_client_secret,
                "scope": "https://graph.microsoft.com/.default",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))
    return data["access_token"], expires_at


async def ensure_teams_token(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """
    Returns a valid Graph API token, fetching a new one via client credentials
    if the stored token is missing or expired. No user action needed.
    """
    token = await get_token(db, tenant_id, "teams", "access")
    if token:
        return token

    # Fetch fresh token via client credentials
    access_token, expires_at = await _fetch_client_credentials_token()
    await store_token(db, tenant_id, "teams", "access", access_token, expires_at=expires_at)

    # Upsert IntegrationConfig so the app shows as connected
    result = await db.execute(
        select(IntegrationConfig).where(
            and_(
                IntegrationConfig.tenant_id == tenant_id,
                IntegrationConfig.integration_type == "teams",
            )
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        config = IntegrationConfig(tenant_id=tenant_id, integration_type="teams")
        db.add(config)
    config.status = "connected"
    config.config_data = {"method": "client_credentials"}
    await db.flush()

    return access_token


async def get_graph_client(db: AsyncSession, tenant_id: uuid.UUID) -> httpx.AsyncClient:
    token = await ensure_teams_token(db, tenant_id)
    return httpx.AsyncClient(
        base_url=GRAPH_BASE,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=30.0,
    )


async def sync_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    async with await get_graph_client(db, tenant_id) as client:
        resp = await client.get(
            "/users",
            params={"$select": "id,displayName,mail,userPrincipalName,department,jobTitle", "$top": 999},
        )
        resp.raise_for_status()
        return resp.json().get("value", [])


async def sync_meetings(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: str,
    start: datetime,
    end: datetime,
) -> list[dict]:
    async with await get_graph_client(db, tenant_id) as client:
        resp = await client.get(
            f"/users/{user_id}/calendarView",
            params={
                "startDateTime": start.isoformat(),
                "endDateTime": end.isoformat(),
                "$select": "subject,start,end,attendees,isOnlineMeeting,onlineMeetingUrl",
                "$top": 100,
            },
        )
        if resp.status_code == 403:
            return []
        resp.raise_for_status()
        return resp.json().get("value", [])


async def get_user_presence(db: AsyncSession, tenant_id: uuid.UUID, user_aad_ids: list[str]) -> list[dict]:
    async with await get_graph_client(db, tenant_id) as client:
        resp = await client.post(
            "/communications/getPresencesByUserId",
            json={"ids": user_aad_ids[:650]},  # Graph API max
        )
        resp.raise_for_status()
        return resp.json().get("value", [])
