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


# ── CGT Notebook ─────────────────────────────────────────────────────────────
# Deliberately separate from Notebook/ADC (same reasoning as CgtProject vs
# Project): CGT projects/notebooks/experiments are their own table family so
# ADC's schema and access rules are untouched. Structurally a lean subset of
# Notebook — no route/stage/parent/linked-notebook/permission machinery yet
# (see Phase 5 in the CGT hierarchy plan for workflow parity).
class CgtNotebook(Base):
    __tablename__ = "cgt_notebooks"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    code              = Column(String(50), unique=True, nullable=False)
    title             = Column(String(255), nullable=False)
    description       = Column(String(1000), nullable=True)
    cgt_project_id    = Column(UUID(as_uuid=True), ForeignKey("cgt_projects.id"), nullable=False)
    template_id       = Column(UUID(as_uuid=True), ForeignKey("workflow_templates.id", ondelete="SET NULL"), nullable=True)
    template_snapshot = Column(JSON, nullable=True)   # frozen at creation time
    created_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status            = Column(String(20), default="ACTIVE", nullable=False)
    created_at        = Column(DateTime, nullable=False, default=_now)
    updated_at        = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    project     = relationship("CgtProject", foreign_keys=[cgt_project_id])
    template    = relationship("WorkflowTemplate", foreign_keys=[template_id])
    creator     = relationship("User", foreign_keys=[created_by])
    experiments = relationship("CgtExperiment", back_populates="notebook", foreign_keys="CgtExperiment.cgt_notebook_id")
    permissions = relationship("CgtNotebookPermission", back_populates="notebook", cascade="all, delete-orphan")


# ── CGT Notebook Permission ───────────────────────────────────────────────────
# Mirrors NotebookPermission/ADC (app/models/notebook.py) — this is how a
# chemist/analyst is assigned to (and gains visibility into) a CGT notebook.
class CgtNotebookPermission(Base):
    __tablename__ = "cgt_notebook_permissions"
    __table_args__ = (
        UniqueConstraint("cgt_notebook_id", "user_id", name="uq_cgt_notebook_user_permission"),
    )

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    cgt_notebook_id = Column(UUID(as_uuid=True), ForeignKey("cgt_notebooks.id"), nullable=False)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    can_view        = Column(Boolean, default=True,  nullable=False)
    can_edit        = Column(Boolean, default=False, nullable=False)
    can_submit      = Column(Boolean, default=False, nullable=False)
    granted_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at      = Column(DateTime, nullable=False, default=_now)

    notebook = relationship("CgtNotebook", back_populates="permissions")
    user     = relationship("User", foreign_keys=[user_id])
    granter  = relationship("User", foreign_keys=[granted_by])
