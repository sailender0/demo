from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.config import get_settings
from app.api.routes.auth import router as auth_router
from app.api.routes.admin import router as admin_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.scim import router as scim_router
from app.api.routes.employee import router as employee_router
from app.core.kafka import flush_producer

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    flush_producer()


app = FastAPI(
    title="Enterprise Integration Platform",
    description="Org-level SSO + GitHub/Jira/Teams integration with identity correlation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(admin_router, prefix=PREFIX)
app.include_router(webhooks_router, prefix=PREFIX)
app.include_router(scim_router, prefix=PREFIX)
app.include_router(employee_router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
