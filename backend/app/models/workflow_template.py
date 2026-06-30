import uuid
import datetime
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name        = Column(String(255), nullable=False)
    slug        = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    category    = Column(String(100), nullable=True)
    version     = Column(Integer, default=1, nullable=False)
    is_active   = Column(Boolean, default=True, nullable=False)
    definition  = Column(JSON, nullable=True)
    created_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at  = Column(DateTime, nullable=False, default=_now)
    updated_at  = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    creator  = relationship("User", foreign_keys=[created_by])
    versions = relationship("WorkflowTemplateVersion", back_populates="template", cascade="all, delete-orphan", order_by="WorkflowTemplateVersion.version")


class WorkflowTemplateVersion(Base):
    __tablename__ = "workflow_template_versions"
    __table_args__ = (Index("ix_wt_versions_template_id", "template_id"),)

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    template_id = Column(UUID(as_uuid=True), ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False)
    version     = Column(Integer, nullable=False)
    definition  = Column(JSON, nullable=True)
    saved_by    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    saved_at    = Column(DateTime, nullable=False, default=_now)

    template = relationship("WorkflowTemplate", back_populates="versions")
    saver    = relationship("User", foreign_keys=[saved_by])
