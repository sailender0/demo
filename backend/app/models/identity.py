import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class IdentityMapping(Base):
    __tablename__ = "identity_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    system = Column(String(50), nullable=False)          # github, jira, teams
    external_id = Column(String(255), nullable=False)    # github login, jira accountId, teams userId
    external_email = Column(String(255), nullable=True)
    external_name = Column(String(255), nullable=True)
    external_display = Column(String(255), nullable=True)

    # Confidence-scored matching
    confidence_score = Column(Integer, default=0)         # 0-100
    status = Column(String(50), default="UNRESOLVED")
    # AUTO_LINKED, NEEDS_REVIEW, MANUALLY_LINKED, UNRESOLVED

    match_reasons = Column(JSON, default=list)
    # e.g. ["email_match:+60", "scim_provision:+30", "name_similarity:+10"]

    resolved_by = Column(UUID(as_uuid=True), nullable=True)  # admin who manually resolved
    resolved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="identity_mappings")
    user = relationship("User", back_populates="identity_mappings")
