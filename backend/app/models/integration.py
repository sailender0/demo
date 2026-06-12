import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class IntegrationConfig(Base):
    __tablename__ = "integration_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    integration_type = Column(String(50), nullable=False)  # github, jira, teams
    status = Column(String(50), default="disconnected")   # connected, disconnected, error

    # Non-sensitive configuration
    config_data = Column(JSON, default=dict)  # org_name, base_url, installation_id, etc.

    last_sync_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    webhook_active = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="integration_configs")


class IntegrationToken(Base):
    __tablename__ = "integration_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    integration_type = Column(String(50), nullable=False)   # github, jira, teams
    token_type = Column(String(50), nullable=False)          # installation, access, refresh

    # AES/Fernet encrypted values
    encrypted_value = Column(Text, nullable=False)
    encrypted_refresh = Column(Text, nullable=True)

    expires_at = Column(DateTime, nullable=True)
    last_refreshed_at = Column(DateTime, default=datetime.utcnow)
    is_valid = Column(Boolean, default=True)
    refresh_failure_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="integration_tokens")
