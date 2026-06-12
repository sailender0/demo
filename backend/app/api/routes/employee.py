"""
Employee-Facing API

Employees can only see their own data (enforced by RBAC).
Managers / HR see their reports.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.event import NormalizedEvent
from app.models.identity import IdentityMapping

router = APIRouter(prefix="/employee", tags=["employee"])


@router.get("/activity")
async def get_my_activity(
    days: int = Query(30, ge=1, le=90),
    source: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = select(NormalizedEvent).where(
        and_(
            NormalizedEvent.tenant_id == user.tenant_id,
            NormalizedEvent.user_id == user.id,
            NormalizedEvent.occurred_at >= since,
            NormalizedEvent.is_orphaned == False,
        )
    )
    if source:
        q = q.where(NormalizedEvent.source == source)

    result = await db.execute(q.order_by(NormalizedEvent.occurred_at.desc()).limit(200))
    events = result.scalars().all()

    return {
        "user_id": str(user.id),
        "period_days": days,
        "total": len(events),
        "events": [
            {
                "id": str(e.id),
                "source": e.source,
                "event_type": e.event_type,
                "category": e.activity_category,
                "data": e.normalized_data,
                "occurred_at": e.occurred_at.isoformat(),
            }
            for e in events
        ],
    }


@router.get("/activity/summary")
async def get_activity_summary(
    days: int = Query(30, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    rows = await db.execute(
        select(NormalizedEvent.source, NormalizedEvent.event_type, func.count(NormalizedEvent.id))
        .where(
            and_(
                NormalizedEvent.tenant_id == user.tenant_id,
                NormalizedEvent.user_id == user.id,
                NormalizedEvent.occurred_at >= since,
                NormalizedEvent.is_orphaned == False,
            )
        )
        .group_by(NormalizedEvent.source, NormalizedEvent.event_type)
    )
    counts = rows.all()

    summary: dict = {}
    for source, event_type, count in counts:
        if source not in summary:
            summary[source] = {}
        summary[source][event_type] = count

    return {"period_days": days, "summary": summary}


@router.get("/profile")
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IdentityMapping).where(
            and_(
                IdentityMapping.tenant_id == user.tenant_id,
                IdentityMapping.user_id == user.id,
            )
        )
    )
    mappings = result.scalars().all()

    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "department": user.department,
        "job_title": user.job_title,
        "employee_type": user.employee_type,
        "linked_systems": [
            {
                "system": m.system,
                "external_id": m.external_id,
                "status": m.status,
                "confidence": m.confidence_score,
            }
            for m in mappings
        ],
    }


@router.get("/team")
async def get_team_activity(
    days: int = Query(30, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Managers see their direct reports' activity. Employees see only own."""
    if user.role not in ("admin", "manager", "hr"):
        return await get_my_activity(days=days, source=None, user=user, db=db)

    since = datetime.utcnow() - timedelta(days=days)

    if user.role in ("admin", "hr"):
        user_filter = and_(
            NormalizedEvent.tenant_id == user.tenant_id,
            NormalizedEvent.occurred_at >= since,
            NormalizedEvent.is_orphaned == False,
        )
    else:
        reports_result = await db.execute(
            select(User.id).where(
                and_(User.tenant_id == user.tenant_id, User.manager_email == user.email)
            )
        )
        report_ids = [r[0] for r in reports_result.all()]
        user_filter = and_(
            NormalizedEvent.tenant_id == user.tenant_id,
            NormalizedEvent.user_id.in_(report_ids),
            NormalizedEvent.occurred_at >= since,
            NormalizedEvent.is_orphaned == False,
        )

    rows = await db.execute(
        select(
            NormalizedEvent.user_id,
            NormalizedEvent.source,
            func.count(NormalizedEvent.id).label("count")
        )
        .where(user_filter)
        .group_by(NormalizedEvent.user_id, NormalizedEvent.source)
    )

    return {"period_days": days, "breakdown": [
        {"user_id": str(r.user_id), "source": r.source, "count": r.count}
        for r in rows.all()
    ]}
