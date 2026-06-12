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

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TEAMS_SCOPES = [
    "https://graph.microsoft.com/User.Read.All",
    "https://graph.microsoft.com/Calendars.Read",
    "https://graph.microsoft.com/OnlineMeetings.Read.All",
    "https://graph.microsoft.com/Presence.Read.All",
    "https://graph.microsoft.com/Team.ReadBasic.All",
    "offline_access",
]


def build_teams_consent_url(state: str) -> str:
    token_url = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/authorize"
    params = {
        "client_id": settings.teams_client_id,
        "response_type": "code",
        "redirect_uri": settings.teams_redirect_uri,
        "scope": " ".join(TEAMS_SCOPES),
        "state": state,
        "prompt": "admin_consent",  # Force admin consent flow
    }
    return f"{token_url}?{urlencode(params)}"


async def exchange_teams_code(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    code: str,
) -> IntegrationConfig:
    token_url = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_url,
            data={
                "client_id": settings.teams_client_id,
                "client_secret": settings.teams_client_secret,
                "code": code,
                "redirect_uri": settings.teams_redirect_uri,
                "grant_type": "authorization_code",
                "scope": " ".join(TEAMS_SCOPES),
            },
        )
        resp.raise_for_status()
        data = resp.json()

    await store_token(
        db, tenant_id, "teams", "access",
        data["access_token"],
        data.get("refresh_token"),
        expires_at=datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600)),
    )

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
    config.config_data = {"tenant_id": settings.entra_tenant_id}
    await db.flush()
    return config


async def get_graph_client(db: AsyncSession, tenant_id: uuid.UUID) -> httpx.AsyncClient:
    token = await get_token(db, tenant_id, "teams", "access")
    if not token:
        raise RuntimeError(f"No valid Teams token for tenant {tenant_id}")
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
