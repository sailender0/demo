import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, nullable=False)
    entra_tenant_id = Column(String(255), unique=True, nullable=True)
    status = Column(String(50), default="active")  # active, suspended
    scim_token_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    integration_configs = relationship("IntegrationConfig", back_populates="tenant", cascade="all, delete-orphan")
    integration_tokens = relationship("IntegrationToken", back_populates="tenant", cascade="all, delete-orphan")
    identity_mappings = relationship("IdentityMapping", back_populates="tenant", cascade="all, delete-orphan")
    normalized_events = relationship("NormalizedEvent", back_populates="tenant", cascade="all, delete-orphan")
