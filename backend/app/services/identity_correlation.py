"""
Identity Correlation Engine

Scores and links external system identities (GitHub, Jira, Teams) to internal
users provisioned via SSO/SCIM. Uses a confidence-score model:

  AUTO_LINKED   >= 80 pts  (automatic, no admin action needed)
  NEEDS_REVIEW  40-79 pts  (surfaced in admin dashboard)
  UNRESOLVED    < 40 pts   (held in queue, events orphaned until resolved)
"""
import uuid
from datetime import datetime
from difflib import SequenceMatcher
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.identity import IdentityMapping
from app.models.user import User


AUTO_LINK_THRESHOLD = 80
NEEDS_REVIEW_THRESHOLD = 40

SCORE_EMAIL_EXACT = 60
SCORE_SCIM_PROVIDED = 30
SCORE_NAME_SIMILAR = 10


def _name_similarity(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


async def correlate_external_identity(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    system: str,
    external_id: str,
    external_email: str | None,
    external_name: str | None,
    external_display: str | None = None,
) -> IdentityMapping:
    """
    Find or create an IdentityMapping for an external identity.
    Runs scoring against all active users in the tenant.
    """
    # Idempotent: return existing mapping if already processed
    result = await db.execute(
        select(IdentityMapping).where(
            and_(
                IdentityMapping.tenant_id == tenant_id,
                IdentityMapping.system == system,
                IdentityMapping.external_id == external_id,
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    users = await db.execute(
        select(User).where(and_(User.tenant_id == tenant_id, User.is_active == True))
    )
    all_users = users.scalars().all()

    best_score = 0
    best_user: User | None = None
    best_reasons: list[str] = []

    for user in all_users:
        score = 0
        reasons: list[str] = []

        if external_email and user.email.lower() == external_email.lower():
            score += SCORE_EMAIL_EXACT
            reasons.append(f"email_match:+{SCORE_EMAIL_EXACT}")

        if user.provisioning_source == "scim" and external_email:
            if user.email.lower() == external_email.lower():
                score += SCORE_SCIM_PROVIDED
                reasons.append(f"scim_provision:+{SCORE_SCIM_PROVIDED}")

        sim = _name_similarity(user.name, external_name or external_display)
        if sim >= 0.85:
            name_pts = int(SCORE_NAME_SIMILAR * sim)
            score += name_pts
            reasons.append(f"name_similarity:+{name_pts}")

        if score > best_score:
            best_score = score
            best_user = user
            best_reasons = reasons

    if best_score >= AUTO_LINK_THRESHOLD:
        link_status = "AUTO_LINKED"
        linked_user = best_user
    elif best_score >= NEEDS_REVIEW_THRESHOLD:
        link_status = "NEEDS_REVIEW"
        linked_user = best_user  # tentative — admin must confirm
    else:
        link_status = "UNRESOLVED"
        linked_user = None
        best_reasons = []

    mapping = IdentityMapping(
        tenant_id=tenant_id,
        user_id=linked_user.id if linked_user else None,
        system=system,
        external_id=external_id,
        external_email=external_email,
        external_name=external_name,
        external_display=external_display,
        confidence_score=best_score,
        status=link_status,
        match_reasons=best_reasons,
    )
    db.add(mapping)
    await db.flush()
    return mapping


async def resolve_mapping_manually(
    db: AsyncSession,
    mapping_id: uuid.UUID,
    user_id: uuid.UUID,
    resolved_by: uuid.UUID,
) -> IdentityMapping:
    result = await db.execute(select(IdentityMapping).where(IdentityMapping.id == mapping_id))
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise ValueError(f"Mapping {mapping_id} not found")

    mapping.user_id = user_id
    mapping.status = "MANUALLY_LINKED"
    mapping.resolved_by = resolved_by
    mapping.resolved_at = datetime.utcnow()
    mapping.confidence_score = 100
    await db.flush()
    return mapping


async def process_scim_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    scim_payload: dict,
) -> User:
    """
    Handle SCIM provisioning from Entra ID / Okta.
    Creates or updates the User record.
    """
    email = scim_payload.get("userName", "").lower()
    external_id = scim_payload.get("externalId", "")
    name_obj = scim_payload.get("name", {})
    name = f"{name_obj.get('givenName', '')} {name_obj.get('familyName', '')}".strip()

    emails = scim_payload.get("emails", [])
    work_email = next((e["value"] for e in emails if e.get("type") == "work"), email)

    result = await db.execute(
        select(User).where(and_(User.tenant_id == tenant_id, User.email == work_email))
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            tenant_id=tenant_id,
            email=work_email,
            name=name,
            employee_id=external_id or None,
            department=_scim_attr(scim_payload, "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User", "department"),
            job_title=scim_payload.get("title"),
            employee_type="contractor" if scim_payload.get("userType") == "Contractor" else "employee",
            provisioning_source="scim",
            is_active=scim_payload.get("active", True),
        )
        db.add(user)
    else:
        user.name = name
        user.is_active = scim_payload.get("active", True)
        user.department = _scim_attr(scim_payload, "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User", "department") or user.department
        user.updated_at = datetime.utcnow()

    await db.flush()
    return user


def _scim_attr(payload: dict, schema: str, key: str) -> str | None:
    return payload.get(schema, {}).get(key)
