"""
Event Normalization Layer

Converts raw GitHub / Jira / Teams events into a uniform NormalizedEvent shape.
Resolves external identity → internal user_id via IdentityMapping.
Orphans events (is_orphaned=True) when identity cannot be resolved yet.
"""
import uuid
import hashlib
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.event import NormalizedEvent
from app.models.identity import IdentityMapping
from app.services import identity_correlation


async def _resolve_identity(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    system: str,
    external_id: str,
    external_email: str | None = None,
    external_name: str | None = None,
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """Returns (user_id, mapping_id). Both None if still unresolved."""
    result = await db.execute(
        select(IdentityMapping).where(
            and_(
                IdentityMapping.tenant_id == tenant_id,
                IdentityMapping.system == system,
                IdentityMapping.external_id == external_id,
            )
        )
    )
    mapping = result.scalar_one_or_none()

    if not mapping:
        mapping = await identity_correlation.correlate_external_identity(
            db, tenant_id, system, external_id, external_email, external_name
        )

    if mapping.status in ("AUTO_LINKED", "MANUALLY_LINKED") and mapping.user_id:
        return mapping.user_id, mapping.id

    return None, mapping.id


async def normalize_github_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    event_name: str,
    payload: dict,
) -> NormalizedEvent | None:
    actor = payload.get("sender", {})
    external_id = actor.get("login", "")
    external_email = actor.get("email")
    external_name = actor.get("name")

    user_id, mapping_id = await _resolve_identity(
        db, tenant_id, "github", external_id, external_email, external_name
    )

    event_type_map = {
        "pull_request.opened": ("PR_OPENED", "WORK_ACTIVITY"),
        "pull_request.closed": ("PR_MERGED" if payload.get("pull_request", {}).get("merged") else "PR_CLOSED", "WORK_ACTIVITY"),
        "pull_request_review.submitted": ("PR_REVIEWED", "WORK_ACTIVITY"),
        "push": ("COMMIT_PUSHED", "WORK_ACTIVITY"),
        "issues.opened": ("ISSUE_CREATED", "WORK_ACTIVITY"),
        "issues.closed": ("ISSUE_CLOSED", "WORK_ACTIVITY"),
    }

    action = payload.get("action", "")
    key = f"{event_name}.{action}" if action else event_name
    event_type, category = event_type_map.get(key, ("GITHUB_ACTIVITY", "WORK_ACTIVITY"))

    pr = payload.get("pull_request", {})
    normalized_data = {
        "title": pr.get("title") or payload.get("head_commit", {}).get("message", "")[:200],
        "url": pr.get("html_url") or payload.get("compare", ""),
        "repo": payload.get("repository", {}).get("full_name", ""),
        "author": external_id,
        "commit_count": len(payload.get("commits", [])) if event_name == "push" else None,
    }

    event = NormalizedEvent(
        tenant_id=tenant_id,
        user_id=user_id,
        identity_mapping_id=mapping_id,
        source="github",
        event_type=event_type,
        activity_category=category,
        normalized_data=normalized_data,
        raw_data=payload,
        external_id=str(pr.get("number", "")),
        occurred_at=_parse_ts(pr.get("updated_at") or payload.get("head_commit", {}).get("timestamp")),
        is_orphaned=(user_id is None),
    )
    db.add(event)
    await db.flush()
    return event


async def normalize_jira_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    event_name: str,
    payload: dict,
) -> NormalizedEvent | None:
    user = payload.get("user", {})
    external_id = user.get("accountId", "")
    external_email = user.get("emailAddress")
    external_name = user.get("displayName")

    user_id, mapping_id = await _resolve_identity(
        db, tenant_id, "jira", external_id, external_email, external_name
    )

    event_type_map = {
        "jira:issue_created": ("ISSUE_CREATED", "WORK_ACTIVITY"),
        "jira:issue_updated": ("ISSUE_UPDATED", "WORK_ACTIVITY"),
        "worklog_created": ("WORKLOG_ADDED", "WORK_ACTIVITY"),
        "sprint_started": ("SPRINT_STARTED", "WORK_ACTIVITY"),
        "sprint_closed": ("SPRINT_CLOSED", "WORK_ACTIVITY"),
    }
    event_type, category = event_type_map.get(event_name, ("JIRA_ACTIVITY", "WORK_ACTIVITY"))

    issue = payload.get("issue", {})
    fields = issue.get("fields", {})
    normalized_data = {
        "issue_key": issue.get("key"),
        "summary": fields.get("summary", "")[:200],
        "status": fields.get("status", {}).get("name"),
        "assignee": fields.get("assignee", {}).get("displayName") if fields.get("assignee") else None,
        "author": external_name,
        "time_spent": payload.get("worklog", {}).get("timeSpentSeconds"),
    }

    event = NormalizedEvent(
        tenant_id=tenant_id,
        user_id=user_id,
        identity_mapping_id=mapping_id,
        source="jira",
        event_type=event_type,
        activity_category=category,
        normalized_data=normalized_data,
        raw_data=payload,
        external_id=issue.get("key"),
        occurred_at=_parse_ts(fields.get("updated")),
        is_orphaned=(user_id is None),
    )
    db.add(event)
    await db.flush()
    return event


async def normalize_teams_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    event_name: str,
    payload: dict,
) -> NormalizedEvent | None:
    initiator = payload.get("initiator", {})
    external_id = initiator.get("user", {}).get("id", "")
    external_email = initiator.get("user", {}).get("userPrincipalName")

    user_id, mapping_id = await _resolve_identity(
        db, tenant_id, "teams", external_id, external_email
    )

    event_type_map = {
        "meeting.started": ("MEETING_STARTED", "PRESENCE"),
        "meeting.ended": ("MEETING_ENDED", "PRESENCE"),
        "presence.updated": ("PRESENCE_ACTIVE", "PRESENCE"),
    }
    event_type, category = event_type_map.get(event_name, ("TEAMS_ACTIVITY", "PRESENCE"))

    normalized_data = {
        "subject": payload.get("subject", ""),
        "duration_minutes": payload.get("duration"),
        "attendee_count": len(payload.get("attendees", [])),
        "is_online_meeting": payload.get("isOnlineMeeting", False),
        "availability": payload.get("availability"),
    }

    event = NormalizedEvent(
        tenant_id=tenant_id,
        user_id=user_id,
        identity_mapping_id=mapping_id,
        source="teams",
        event_type=event_type,
        activity_category=category,
        normalized_data=normalized_data,
        raw_data=payload,
        occurred_at=_parse_ts(payload.get("startDateTime") or payload.get("timestamp")),
        is_orphaned=(user_id is None),
    )
    db.add(event)
    await db.flush()
    return event


async def backfill_orphaned_events(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, mapping_id: uuid.UUID) -> int:
    """
    Called after an identity is manually resolved.
    Assigns user_id to all orphaned events from that mapping.
    """
    from sqlalchemy import update
    result = await db.execute(
        select(NormalizedEvent).where(
            and_(
                NormalizedEvent.tenant_id == tenant_id,
                NormalizedEvent.identity_mapping_id == mapping_id,
                NormalizedEvent.is_orphaned == True,
            )
        )
    )
    orphans = result.scalars().all()
    for event in orphans:
        event.user_id = user_id
        event.is_orphaned = False
    await db.flush()
    return len(orphans)


def _parse_ts(value: str | None) -> datetime:
    if not value:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()
