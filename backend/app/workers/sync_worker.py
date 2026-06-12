"""
Background Sync Worker

Scheduled tasks:
  - Every 45 min: proactive token refresh
  - Every 4 hrs:  reconciliation (detect webhook gaps)
  - On demand:    historical backfill triggered by admin
"""
import asyncio
import logging
from datetime import datetime, timedelta
from app.database import AsyncSessionLocal
from app.services.token_lifecycle import check_expiring_tokens
from app.services import github_service, jira_service, teams_service
from app.services.event_normalizer import (
    normalize_github_event,
    normalize_jira_event,
)
from app.models.integration import IntegrationConfig
from sqlalchemy import select, and_

logger = logging.getLogger(__name__)


async def token_refresh_loop() -> None:
    """Runs every 45 minutes, proactively refreshes tokens near expiry."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                report = await check_expiring_tokens(db)
                if report:
                    logger.info("Token refresh run: %s", report)
        except Exception as exc:
            logger.exception("Token refresh loop error: %s", exc)
        await asyncio.sleep(45 * 60)


async def reconciliation_loop() -> None:
    """
    Runs every 4 hours. Fetches recent activity from all integrations
    and inserts any events not already recorded (catches missed webhooks).
    """
    while True:
        await asyncio.sleep(4 * 60 * 60)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(IntegrationConfig).where(IntegrationConfig.status == "connected")
                )
                configs = result.scalars().all()

                since = datetime.utcnow() - timedelta(hours=4)
                for config in configs:
                    try:
                        await _reconcile_integration(db, config, since)
                    except Exception as exc:
                        logger.exception(
                            "Reconciliation failed for tenant %s / %s: %s",
                            config.tenant_id, config.integration_type, exc
                        )
        except Exception as exc:
            logger.exception("Reconciliation loop error: %s", exc)


async def _reconcile_integration(db, config: IntegrationConfig, since: datetime) -> None:
    tenant_id = config.tenant_id

    if config.integration_type == "github":
        org = config.config_data.get("org_name")
        if not org:
            return
        prs = await github_service.sync_pull_requests(db, tenant_id, org, since=since)
        for pr_payload in prs:
            await normalize_github_event(db, tenant_id, "pull_request", {"pull_request": pr_payload, "sender": pr_payload.get("user", {})})
        config.last_sync_at = datetime.utcnow()
        await db.flush()

    elif config.integration_type == "jira":
        cloud_id = config.config_data.get("cloud_id")
        if not cloud_id:
            return
        issues = await jira_service.sync_issues(db, tenant_id, cloud_id, updated_since=since)
        for issue in issues:
            await normalize_jira_event(db, tenant_id, "jira:issue_updated", {"issue": issue, "user": issue.get("fields", {}).get("assignee") or {}})
        config.last_sync_at = datetime.utcnow()
        await db.flush()


async def run_backfill(tenant_id, integration_type: str, days: int = 90) -> int:
    """Admin-triggered historical backfill for a specific integration."""
    since = datetime.utcnow() - timedelta(days=days)
    processed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(IntegrationConfig).where(
                and_(
                    IntegrationConfig.tenant_id == tenant_id,
                    IntegrationConfig.integration_type == integration_type,
                    IntegrationConfig.status == "connected",
                )
            )
        )
        config = result.scalar_one_or_none()
        if not config:
            return 0

        if integration_type == "github":
            org = config.config_data.get("org_name", "")
            prs = await github_service.sync_pull_requests(db, tenant_id, org, since=since)
            for pr_payload in prs:
                await normalize_github_event(db, tenant_id, "pull_request", {"pull_request": pr_payload, "sender": pr_payload.get("user", {})})
                processed += 1

        elif integration_type == "jira":
            cloud_id = config.config_data.get("cloud_id", "")
            issues = await jira_service.sync_issues(db, tenant_id, cloud_id, updated_since=since)
            for issue in issues:
                await normalize_jira_event(db, tenant_id, "jira:issue_updated", {"issue": issue, "user": {}})
                processed += 1

        await db.commit()
    return processed
