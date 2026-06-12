import secrets
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.database import get_db
from app.core.auth import require_admin, get_current_user
from app.models.tenant import Tenant
from app.models.user import User
from app.models.integration import IntegrationConfig
from app.models.identity import IdentityMapping
from app.models.event import NormalizedEvent, WebhookDelivery
from app.services import github_service, jira_service, teams_service, identity_correlation
from app.config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()

# ─── Tenant Management ────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    domain: str
    entra_tenant_id: str | None = None


@router.post("/tenants", response_model=dict)
async def create_tenant(body: TenantCreate, db: AsyncSession = Depends(get_db)):
    tenant = Tenant(
        name=body.name,
        domain=body.domain.lower(),
        entra_tenant_id=body.entra_tenant_id,
    )
    db.add(tenant)
    await db.flush()
    return {"id": str(tenant.id), "name": tenant.name, "domain": tenant.domain}


@router.get("/tenants/me", response_model=dict)
async def get_my_tenant(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one()
    return {"id": str(tenant.id), "name": tenant.name, "domain": tenant.domain, "status": tenant.status}


# ─── Integrations ─────────────────────────────────────────────────────────────

@router.get("/integrations")
async def list_integrations(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IntegrationConfig).where(IntegrationConfig.tenant_id == user.tenant_id)
    )
    configs = result.scalars().all()
    return [
        {
            "type": c.integration_type,
            "status": c.status,
            "config": c.config_data,
            "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
            "last_error": c.last_error,
            "webhook_active": c.webhook_active,
        }
        for c in configs
    ]


# ── GitHub ──

@router.get("/integrations/github/install-url")
async def github_install_url(user: User = Depends(require_admin)):
    """Return the GitHub App installation URL for the org."""
    state = f"{user.tenant_id}:{secrets.token_urlsafe(8)}"
    app_slug = "your-github-app-slug"  # configure in env
    return {
        "url": f"https://github.com/apps/{app_slug}/installations/new?state={state}"
    }


@router.post("/integrations/github/callback")
async def github_callback(
    installation_id: str = Body(...),
    org_name: str = Body(...),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await github_service.handle_app_install_callback(
        db, user.tenant_id, installation_id, org_name
    )
    return {"status": config.status, "org": org_name}


# ── Jira ──

@router.get("/integrations/jira/auth-url")
async def jira_auth_url(user: User = Depends(require_admin)):
    state = f"{user.tenant_id}:{secrets.token_urlsafe(8)}"
    return {"url": jira_service.build_jira_auth_url(state)}


@router.get("/integrations/jira/callback")
async def jira_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = uuid.UUID(state.split(":")[0])
    try:
        await jira_service.exchange_jira_code(db, tenant_id, code)
        return RedirectResponse(f"{settings.frontend_url}/admin/integrations?connected=jira")
    except Exception as e:
        return RedirectResponse(f"{settings.frontend_url}/admin/integrations?error=jira&detail={str(e)}")


# ── Teams ──

@router.get("/integrations/teams/consent-url")
async def teams_consent_url(user: User = Depends(require_admin)):
    state = f"{user.tenant_id}:{secrets.token_urlsafe(8)}"
    return {"url": teams_service.build_teams_consent_url(state)}


@router.get("/integrations/teams/callback")
async def teams_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = uuid.UUID(state.split(":")[0])
    try:
        await teams_service.exchange_teams_code(db, tenant_id, code)
        return RedirectResponse(f"{settings.frontend_url}/admin/integrations?connected=teams")
    except Exception as e:
        return RedirectResponse(f"{settings.frontend_url}/admin/integrations?error=teams&detail={str(e)}")


@router.delete("/integrations/{integration_type}")
async def disconnect_integration(
    integration_type: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntegrationConfig).where(
            and_(
                IntegrationConfig.tenant_id == user.tenant_id,
                IntegrationConfig.integration_type == integration_type,
            )
        )
    )
    config = result.scalar_one_or_none()
    if config:
        config.status = "disconnected"
    return {"status": "disconnected"}


# ─── Identity Mappings ────────────────────────────────────────────────────────

@router.get("/identity/mappings")
async def list_mappings(
    status: str | None = Query(None),
    system: str | None = Query(None),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(IdentityMapping).where(IdentityMapping.tenant_id == user.tenant_id)
    if status:
        q = q.where(IdentityMapping.status == status)
    if system:
        q = q.where(IdentityMapping.system == system)
    result = await db.execute(q.order_by(IdentityMapping.confidence_score.asc()).limit(200))
    mappings = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "system": m.system,
            "external_id": m.external_id,
            "external_email": m.external_email,
            "external_name": m.external_name,
            "user_id": str(m.user_id) if m.user_id else None,
            "confidence_score": m.confidence_score,
            "status": m.status,
            "match_reasons": m.match_reasons,
        }
        for m in mappings
    ]


@router.get("/identity/unresolved")
async def list_unresolved(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IdentityMapping).where(
            and_(
                IdentityMapping.tenant_id == user.tenant_id,
                IdentityMapping.status.in_(["UNRESOLVED", "NEEDS_REVIEW"]),
            )
        ).order_by(IdentityMapping.created_at.desc())
    )
    mappings = result.scalars().all()
    return {"count": len(mappings), "mappings": [
        {
            "id": str(m.id),
            "system": m.system,
            "external_id": m.external_id,
            "external_email": m.external_email,
            "confidence_score": m.confidence_score,
            "status": m.status,
        }
        for m in mappings
    ]}


class ResolveMapping(BaseModel):
    mapping_id: str
    user_id: str


@router.post("/identity/resolve")
async def resolve_mapping(
    body: ResolveMapping,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    mapping = await identity_correlation.resolve_mapping_manually(
        db,
        uuid.UUID(body.mapping_id),
        uuid.UUID(body.user_id),
        user.id,
    )
    from app.services.event_normalizer import backfill_orphaned_events
    backfilled = await backfill_orphaned_events(db, user.tenant_id, mapping.user_id, mapping.id)
    return {"status": mapping.status, "backfilled_events": backfilled}


# ─── Sync Health ──────────────────────────────────────────────────────────────

@router.get("/sync/health")
async def sync_health(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    configs_result = await db.execute(
        select(IntegrationConfig).where(IntegrationConfig.tenant_id == user.tenant_id)
    )
    configs = configs_result.scalars().all()

    total_users = await db.scalar(
        select(func.count(User.id)).where(User.tenant_id == user.tenant_id, User.is_active == True)
    )
    linked_users = await db.scalar(
        select(func.count(IdentityMapping.id.distinct())).where(
            and_(
                IdentityMapping.tenant_id == user.tenant_id,
                IdentityMapping.status.in_(["AUTO_LINKED", "MANUALLY_LINKED"]),
            )
        )
    )
    unresolved = await db.scalar(
        select(func.count(IdentityMapping.id)).where(
            and_(
                IdentityMapping.tenant_id == user.tenant_id,
                IdentityMapping.status.in_(["UNRESOLVED", "NEEDS_REVIEW"]),
            )
        )
    )
    orphaned_events = await db.scalar(
        select(func.count(NormalizedEvent.id)).where(
            and_(
                NormalizedEvent.tenant_id == user.tenant_id,
                NormalizedEvent.is_orphaned == True,
            )
        )
    )

    return {
        "identity": {
            "total_users": total_users,
            "linked_users": linked_users,
            "unresolved_mappings": unresolved,
            "orphaned_events": orphaned_events,
        },
        "integrations": [
            {
                "type": c.integration_type,
                "status": c.status,
                "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
                "last_error": c.last_error,
                "webhook_active": c.webhook_active,
            }
            for c in configs
        ],
    }


@router.get("/sync/logs")
async def sync_logs(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.tenant_id == user.tenant_id)
        .order_by(WebhookDelivery.received_at.desc())
        .limit(100)
    )
    deliveries = result.scalars().all()
    return [
        {
            "source": d.source,
            "delivery_id": d.delivery_id,
            "event_name": d.event_name,
            "status": d.status,
            "received_at": d.received_at.isoformat(),
            "error": d.error_message,
        }
        for d in deliveries
    ]


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.tenant_id == user.tenant_id).order_by(User.name)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "department": u.department,
            "employee_type": u.employee_type,
            "is_active": u.is_active,
            "provisioning_source": u.provisioning_source,
        }
        for u in users
    ]
