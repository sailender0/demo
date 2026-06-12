import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.config import get_settings
from app.core.auth import (
    ENTRA_AUTH_URL,
    exchange_entra_code,
    get_entra_user_info,
    create_access_token,
    get_current_user,
)
from app.models.user import User
from app.models.tenant import Tenant

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_REDIRECT_URI = "http://localhost:8001/api/v1/auth/callback"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    role: str


@router.get("/login")
async def login():
    """Redirect browser to Microsoft Entra ID login."""
    state = secrets.token_urlsafe(16)
    url = (
        f"{ENTRA_AUTH_URL}"
        f"?client_id={settings.entra_client_id}"
        f"&response_type=code"
        f"&redirect_uri={_REDIRECT_URI}"
        f"&scope=openid+profile+email+User.Read"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/callback")
async def auth_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle Entra ID OAuth callback, issue internal JWT."""
    try:
        token_data = await exchange_entra_code(code, _REDIRECT_URI)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code")

    user_info = await get_entra_user_info(token_data["access_token"])

    email = user_info.get("mail") or user_info.get("userPrincipalName", "")
    domain = email.split("@")[-1] if "@" in email else ""

    # Find tenant by domain
    result = await db.execute(select(Tenant).where(Tenant.domain == domain, Tenant.status == "active"))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=403, detail=f"No active tenant for domain {domain}. Ask your admin to register your organization.")

    # Find or create user
    result = await db.execute(
        select(User).where(and_(User.tenant_id == tenant.id, User.email == email))
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            tenant_id=tenant.id,
            email=email,
            name=user_info.get("displayName", email),
            entra_oid=user_info.get("id"),
            department=user_info.get("department"),
            job_title=user_info.get("jobTitle"),
            role="employee",
            provisioning_source="sso",
        )
        db.add(user)
        await db.flush()

    jwt_token = create_access_token({"sub": str(user.id), "tenant_id": str(tenant.id), "role": user.role})

    return RedirectResponse(
        f"{settings.frontend_url}/auth/success?token={jwt_token}"
    )


@router.get("/me", response_model=dict)
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "department": user.department,
        "job_title": user.job_title,
        "employee_type": user.employee_type,
        "tenant_id": str(user.tenant_id),
    }


@router.post("/logout")
async def logout():
    return {"message": "Logged out"}
