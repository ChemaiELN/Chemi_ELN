import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


class Notebook(Base):
    __tablename__ = "notebooks"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    code                 = Column(String(50), unique=True, nullable=False)
    title                = Column(String(255), nullable=False)
    description          = Column(String(1000), nullable=True)
    project_id           = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    route_id             = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=True)
    stage_id             = Column(UUID(as_uuid=True), ForeignKey("stages.id"), nullable=True)
    type                 = Column(String(20), nullable=True)           # preliminary / synthesis / None
    parent_notebook_id   = Column(UUID(as_uuid=True), ForeignKey("notebooks.id", ondelete="SET NULL"), nullable=True)
    linked_notebook_id   = Column(UUID(as_uuid=True), ForeignKey("notebooks.id", ondelete="SET NULL"), nullable=True)
    template_id          = Column(UUID(as_uuid=True), ForeignKey("workflow_templates.id", ondelete="SET NULL"), nullable=True)
    template_snapshot    = Column(JSON, nullable=True)                 # frozen at creation time
    preliminary_complete = Column(Boolean, default=False, nullable=False, server_default="false")
    created_by           = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status               = Column(String(20), default="ACTIVE", nullable=False)
    created_at           = Column(DateTime, nullable=False, default=_now)
    updated_at           = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    project         = relationship("Project", back_populates="notebooks", foreign_keys=[project_id])
    route           = relationship("Route", foreign_keys=[route_id])
    stage           = relationship("Stage", foreign_keys=[stage_id])
    template        = relationship("WorkflowTemplate", foreign_keys=[template_id])
    creator         = relationship("User", foreign_keys=[created_by])
    parent_notebook = relationship("Notebook", foreign_keys=[parent_notebook_id], remote_side="Notebook.id")
    linked_notebook = relationship("Notebook", foreign_keys=[linked_notebook_id], remote_side="Notebook.id")
    permissions     = relationship("NotebookPermission", back_populates="notebook", cascade="all, delete-orphan")
    experiments     = relationship("Experiment", back_populates="notebook", foreign_keys="Experiment.notebook_id")


class NotebookPermission(Base):
    __tablename__ = "notebook_permissions"
    __table_args__ = (
        UniqueConstraint("notebook_id", "user_id", name="uq_notebook_user_permission"),
    )

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    notebook_id        = Column(UUID(as_uuid=True), ForeignKey("notebooks.id"), nullable=False)
    user_id            = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    can_view           = Column(Boolean, default=True,  nullable=False)
    can_edit           = Column(Boolean, default=False, nullable=False)
    can_submit         = Column(Boolean, default=False, nullable=False)
    can_verify         = Column(Boolean, default=False, nullable=False)
    can_approve        = Column(Boolean, default=False, nullable=False)
    can_clone          = Column(Boolean, default=False, nullable=False)
    can_export         = Column(Boolean, default=False, nullable=False)
    can_attach         = Column(Boolean, default=False, nullable=False)
    can_comment        = Column(Boolean, default=False, nullable=False)
    can_request_unlock = Column(Boolean, default=False, nullable=False)
    can_deactivate     = Column(Boolean, default=False, nullable=False)
    granted_by         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at         = Column(DateTime, nullable=False, default=_now)

    notebook = relationship("Notebook", back_populates="permissions")
    user     = relationship("User", foreign_keys=[user_id])
    granter  = relationship("User", foreign_keys=[granted_by])
