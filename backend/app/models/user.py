import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    # Core identity (from Entra ID / SCIM)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    entra_oid = Column(String(255), nullable=True)   # Azure AD object ID
    employee_id = Column(String(255), nullable=True)  # from SCIM externalId

    # Profile
    department = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    manager_email = Column(String(255), nullable=True)
    employee_type = Column(String(50), default="employee")  # employee, contractor

    # Access
    role = Column(String(50), default="employee")  # admin, manager, hr, employee
    is_active = Column(Boolean, default=True)

    # Provisioning source
    provisioning_source = Column(String(50), default="manual")  # scim, sso, manual

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="users")
    identity_mappings = relationship("IdentityMapping", back_populates="user")
    normalized_events = relationship("NormalizedEvent", back_populates="user")
