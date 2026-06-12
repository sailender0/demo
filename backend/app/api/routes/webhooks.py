"""
Webhook Receivers

Entry point for all inbound webhooks from GitHub, Jira, and Teams.
Pipeline: signature verify → dedup (Redis) → log to DB → publish to Kafka.
"""
import hashlib
import hmac
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Request, Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import get_settings
from app.core.redis_client import is_duplicate_webhook
from app.core.kafka import publish
from app.models.event import WebhookDelivery
from app.models.integration import IntegrationConfig
from sqlalchemy import select

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
settings = get_settings()


def _sha256_signature(body: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


async def _log_delivery(
    db: AsyncSession,
    source: str,
    delivery_id: str,
    event_name: str,
    tenant_id: uuid.UUID | None,
    status: str,
    error: str | None = None,
) -> WebhookDelivery:
    d = WebhookDelivery(
        tenant_id=tenant_id,
        source=source,
        delivery_id=delivery_id,
        event_name=event_name,
        status=status,
        error_message=error,
        received_at=datetime.utcnow(),
    )
    db.add(d)
    await db.flush()
    return d


async def _resolve_tenant_from_config(db: AsyncSession, integration_type: str, **config_filters) -> uuid.UUID | None:
    q = select(IntegrationConfig).where(IntegrationConfig.integration_type == integration_type)
    for k, v in config_filters.items():
        q = q.where(IntegrationConfig.config_data[k].astext == v)
    result = await db.execute(q)
    config = result.scalar_one_or_none()
    return config.tenant_id if config else None


# ─── GitHub ──────────────────────────────────────────────────────────────────

@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_delivery: str = Header(...),
    x_github_event: str = Header(...),
    x_hub_signature_256: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()

    # Signature verification
    expected = _sha256_signature(body, settings.github_webhook_secret)
    if not hmac.compare_digest(expected, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Deduplication
    if await is_duplicate_webhook(f"gh:{x_github_delivery}"):
        return {"status": "duplicate"}

    payload = json.loads(body)
    installation_id = str(payload.get("installation", {}).get("id", ""))
    tenant_id = await _resolve_tenant_from_config(db, "github", installation_id=installation_id)

    await _log_delivery(db, "github", x_github_delivery, x_github_event, tenant_id, "received")

    # Publish to Kafka for async processing
    await publish(
        settings.kafka_topic_webhooks,
        key=x_github_delivery,
        payload={
            "source": "github",
            "event": x_github_event,
            "delivery_id": x_github_delivery,
            "tenant_id": str(tenant_id) if tenant_id else None,
            "payload": payload,
        },
    )
    return {"status": "accepted"}


# ─── Jira ─────────────────────────────────────────────────────────────────────

@router.post("/jira")
async def jira_webhook(
    request: Request,
    x_atlassian_token: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    payload = json.loads(body)

    delivery_id = payload.get("webhookEvent", "") + ":" + str(payload.get("timestamp", ""))
    event_name = payload.get("webhookEvent", "unknown")

    cloud_id = payload.get("matchedWebhookIds", [""])[0] if payload.get("matchedWebhookIds") else ""
    tenant_id = await _resolve_tenant_from_config(db, "jira", cloud_id=cloud_id) if cloud_id else None

    if await is_duplicate_webhook(f"jira:{delivery_id}"):
        return {"status": "duplicate"}

    await _log_delivery(db, "jira", delivery_id, event_name, tenant_id, "received")

    await publish(
        settings.kafka_topic_webhooks,
        key=delivery_id,
        payload={
            "source": "jira",
            "event": event_name,
            "delivery_id": delivery_id,
            "tenant_id": str(tenant_id) if tenant_id else None,
            "payload": payload,
        },
    )
    return {"status": "accepted"}


# ─── Teams (Graph change notifications) ──────────────────────────────────────

@router.post("/teams")
async def teams_webhook(
    request: Request,
    validation_token: str = None,
    db: AsyncSession = Depends(get_db),
):
    # Graph API validation handshake
    if validation_token:
        return validation_token

    body = await request.body()
    payload = json.loads(body)

    for notification in payload.get("value", []):
        delivery_id = notification.get("changeType", "") + ":" + notification.get("resource", "")
        event_name = notification.get("changeType", "unknown")
        tenant_id_str = notification.get("tenantId")
        tenant_id = uuid.UUID(tenant_id_str) if tenant_id_str else None

        if await is_duplicate_webhook(f"teams:{delivery_id}"):
            continue

        await _log_delivery(db, "teams", delivery_id, event_name, tenant_id, "received")

        await publish(
            settings.kafka_topic_webhooks,
            key=delivery_id,
            payload={
                "source": "teams",
                "event": event_name,
                "delivery_id": delivery_id,
                "tenant_id": str(tenant_id) if tenant_id else None,
                "payload": notification,
            },
        )

    return {"status": "accepted"}
