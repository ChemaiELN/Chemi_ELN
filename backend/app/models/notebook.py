from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class Notebook(Base):
    __tablename__ = "notebooks"

    id:          Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    code:        Mapped[str]           = mapped_column(String(50), unique=True, nullable=False)
    title:       Mapped[str]           = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    project_id:  Mapped[str]           = mapped_column(PUUID, ForeignKey("projects.id"), nullable=False)
    route_id:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("routes.id"))
    stage_id:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("stages.id"))

    # preliminary / synthesis / None (free-form)
    type: Mapped[Optional[str]] = mapped_column(String(20))

    # Re-attempt chain: TL creates a new notebook when the whole experiment is rejected.
    # parent_notebook_id → the notebook this is a re-attempt of.
    parent_notebook_id:  Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("notebooks.id", ondelete="SET NULL"))

    # Cross-notebook link: synthesis notebook points to its locked preliminary notebook.
    linked_notebook_id:  Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("notebooks.id", ondelete="SET NULL"))

    # Workflow template link
    template_id:       Mapped[Optional[str]]            = mapped_column(PUUID, ForeignKey("workflow_templates.id", ondelete="SET NULL"))
    # Frozen copy of the template definition at the time this notebook was created.
    template_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)

    created_by: Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    # ACTIVE / ARCHIVED / LOCKED
    status:     Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project:          Mapped["Project"]                   = relationship(foreign_keys=[project_id])
    route:            Mapped[Optional["Route"]]            = relationship(foreign_keys=[route_id])
    stage:            Mapped[Optional["Stage"]]            = relationship(foreign_keys=[stage_id])
    template:         Mapped[Optional["WorkflowTemplate"]] = relationship(foreign_keys=[template_id])
    creator:          Mapped["User"]                       = relationship(foreign_keys=[created_by])
    parent_notebook:  Mapped[Optional["Notebook"]]         = relationship(foreign_keys=[parent_notebook_id],  remote_side="Notebook.id")
    linked_notebook:  Mapped[Optional["Notebook"]]         = relationship(foreign_keys=[linked_notebook_id],  remote_side="Notebook.id")
    permissions:      Mapped[List["NotebookPermission"]]   = relationship(back_populates="notebook")
    experiments:      Mapped[List["Experiment"]]           = relationship(back_populates="notebook", foreign_keys="Experiment.notebook_id")


class NotebookPermission(Base):
    __tablename__ = "notebook_permissions"
    __table_args__ = (
        UniqueConstraint('notebook_id', 'user_id', name='uq_notebook_user_permission'),
    )

    id:          Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    notebook_id: Mapped[str]  = mapped_column(PUUID, ForeignKey("notebooks.id"), nullable=False)
    user_id:     Mapped[str]  = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    can_view:           Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    can_edit:           Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_submit:         Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_verify:         Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_approve:        Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_clone:          Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_export:         Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_attach:         Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_comment:        Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_request_unlock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_deactivate:     Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    granted_by:  Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    granted_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    notebook: Mapped["Notebook"]        = relationship(back_populates="permissions")
    user:     Mapped["User"]            = relationship(foreign_keys=[user_id])
    granter:  Mapped[Optional["User"]]  = relationship(foreign_keys=[granted_by])


from app.models.project import Project                      # noqa: E402
from app.models.route import Route, Stage                   # noqa: E402
from app.models.user import User                            # noqa: E402
from app.models.workflow_template import WorkflowTemplate   # noqa: E402
from app.models.experiment import Experiment                # noqa: E402
