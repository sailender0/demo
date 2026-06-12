"""
SCIM 2.0 Provisioning Endpoint

Receives provisioning events from Microsoft Entra ID / Okta.
Endpoint: POST /api/v1/scim/Users

Authentication: Bearer token stored as scim_token_hash on the Tenant record.
"""
import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.tenant import Tenant
from app.services.identity_correlation import process_scim_user

router = APIRouter(prefix="/scim", tags=["scim"])


async def _verify_scim_token(authorization: str = Header(...), db: AsyncSession = Depends(get_db)) -> Tenant:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.split(" ", 1)[1]
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    result = await db.execute(select(Tenant).where(Tenant.scim_token_hash == token_hash))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid SCIM token")
    return tenant


@router.post("/Users", status_code=201)
async def scim_create_user(
    request: Request,
    tenant: Tenant = Depends(_verify_scim_token),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.json()
    user = await process_scim_user(db, tenant.id, payload)
    return _scim_user_response(user)


@router.put("/Users/{user_id}")
async def scim_update_user(
    user_id: str,
    request: Request,
    tenant: Tenant = Depends(_verify_scim_token),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.json()
    user = await process_scim_user(db, tenant.id, payload)
    return _scim_user_response(user)


@router.patch("/Users/{user_id}")
async def scim_patch_user(
    user_id: str,
    request: Request,
    tenant: Tenant = Depends(_verify_scim_token),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.json()
    # Handle SCIM PATCH (active=false → deactivate)
    operations = payload.get("Operations", [])
    from app.models.user import User
    from sqlalchemy import and_
    result = await db.execute(
        select(User).where(and_(User.id == uuid.UUID(user_id), User.tenant_id == tenant.id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for op in operations:
        if op.get("op") == "Replace" and op.get("path") == "active":
            user.is_active = op.get("value", True)

    return _scim_user_response(user)


@router.delete("/Users/{user_id}", status_code=204)
async def scim_delete_user(
    user_id: str,
    tenant: Tenant = Depends(_verify_scim_token),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User
    from sqlalchemy import and_
    result = await db.execute(
        select(User).where(and_(User.id == uuid.UUID(user_id), User.tenant_id == tenant.id))
    )
    user = result.scalar_one_or_none()
    if user:
        user.is_active = False


def _scim_user_response(user) -> dict:
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": str(user.id),
        "userName": user.email,
        "name": {"formatted": user.name},
        "emails": [{"value": user.email, "type": "work", "primary": True}],
        "active": user.is_active,
        "meta": {"resourceType": "User"},
    }
