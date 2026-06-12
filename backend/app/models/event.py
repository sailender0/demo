import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class NormalizedEvent(Base):
    __tablename__ = "normalized_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    identity_mapping_id = Column(UUID(as_uuid=True), nullable=True)

    source = Column(String(50), nullable=False)          # github, jira, teams
    event_type = Column(String(100), nullable=False)
    # PR_OPENED, PR_MERGED, PR_REVIEWED, COMMIT_PUSHED,
    # ISSUE_CREATED, ISSUE_UPDATED, WORKLOG_ADDED,
    # MEETING_ATTENDED, PRESENCE_ACTIVE

    activity_category = Column(String(50), nullable=False)
    # WORK_ACTIVITY, PRESENCE, PRODUCTIVITY

    # Normalized payload — standard shape across all sources
    normalized_data = Column(JSON, nullable=False, default=dict)
    raw_data = Column(JSON, nullable=False, default=dict)

    external_id = Column(String(255), nullable=True)     # PR number, issue key, etc.
    occurred_at = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)

    # True when identity couldn't be resolved; backfilled once resolved
    is_orphaned = Column(Boolean, default=False)

    tenant = relationship("Tenant", back_populates="normalized_events")
    user = relationship("User", back_populates="normalized_events")


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True)

    source = Column(String(50), nullable=False)           # github, jira, teams
    delivery_id = Column(String(255), nullable=False)     # X-GitHub-Delivery, etc.
    event_name = Column(String(100), nullable=True)

    status = Column(String(50), default="received")
    # received, processed, failed, duplicate

    payload_hash = Column(String(64), nullable=True)      # sha256 for exact-duplicate guard
    error_message = Column(Text, nullable=True)
    retry_count = Column(String(10), default="0")

    received_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
