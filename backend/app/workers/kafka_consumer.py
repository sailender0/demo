"""
Kafka Consumer — Webhook Event Processor

Reads from webhook-raw topic, normalizes events, writes to DB.
Commits offsets only after successful DB write (at-least-once delivery).
"""
import asyncio
import json
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.core.kafka import make_consumer
from app.config import get_settings
from app.services.event_normalizer import (
    normalize_github_event,
    normalize_jira_event,
    normalize_teams_event,
)
from app.models.event import WebhookDelivery
from sqlalchemy import select, and_

settings = get_settings()
logger = logging.getLogger(__name__)


async def _process_message(payload: dict, db: AsyncSession) -> None:
    source = payload["source"]
    event = payload["event"]
    tenant_id_str = payload.get("tenant_id")
    raw = payload["payload"]

    if not tenant_id_str:
        logger.warning("Webhook %s has no tenant_id, skipping normalization", payload.get("delivery_id"))
        return

    tenant_id = uuid.UUID(tenant_id_str)

    try:
        if source == "github":
            await normalize_github_event(db, tenant_id, event, raw)
        elif source == "jira":
            await normalize_jira_event(db, tenant_id, event, raw)
        elif source == "teams":
            await normalize_teams_event(db, tenant_id, event, raw)

        # Update webhook delivery status to processed
        result = await db.execute(
            select(WebhookDelivery).where(
                and_(
                    WebhookDelivery.delivery_id == payload.get("delivery_id", ""),
                    WebhookDelivery.source == source,
                )
            )
        )
        delivery = result.scalar_one_or_none()
        if delivery:
            from datetime import datetime
            delivery.status = "processed"
            delivery.processed_at = datetime.utcnow()

    except Exception as exc:
        logger.exception("Failed to normalize %s event %s: %s", source, event, exc)
        raise


async def run_consumer() -> None:
    consumer = make_consumer()
    consumer.subscribe([settings.kafka_topic_webhooks])
    logger.info("Kafka consumer started, listening on %s", settings.kafka_topic_webhooks)

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                await asyncio.sleep(0.1)
                continue
            if msg.error():
                logger.error("Kafka error: %s", msg.error())
                continue

            try:
                payload = json.loads(msg.value().decode())
                async with AsyncSessionLocal() as db:
                    await _process_message(payload, db)
                    await db.commit()
                consumer.commit(message=msg)
            except Exception as exc:
                logger.exception("Message processing failed: %s", exc)
                # Don't commit offset — message will be redelivered
    finally:
        consumer.close()
