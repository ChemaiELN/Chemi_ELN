from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"

    id:          Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    name:        Mapped[str]           = mapped_column(String(255), nullable=False)
    slug:        Mapped[str]           = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category:    Mapped[Optional[str]] = mapped_column(String(100))   # ADC / Formulation / Stability
    version:     Mapped[int]           = mapped_column(Integer, default=1, nullable=False)
    is_active:   Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)

    # Full template definition stored as JSON.
    # Structure: { "sections": [ { "key", "title", "screens": [ { "key", "title",
    #   "persona", "has_signature", "has_files", "fields": [ { "key", "label",
    #   "type", "required", "options" } ] } ] } ] }
    definition:  Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)

    created_by:  Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id", ondelete="SET NULL"))
    created_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])


from app.models.user import User  # noqa: E402
