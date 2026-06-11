from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class AuditLog(Base):
    """
    Every significant action in the system is written here.
    One row per event — never updated, only inserted.
    """
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_module_at",  "module",      "created_at"),
        Index("ix_audit_user_at",    "user_id",     "created_at"),
        Index("ix_audit_target",     "target_type", "target_id"),
        Index("ix_audit_created_at", "created_at"),
    )

    id:           Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    user_id:      Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))  # NULL = system action
    username:     Mapped[str] = mapped_column(String(50), nullable=False)   # snapshot — survives user deletion
    module:       Mapped[str] = mapped_column(String(50), nullable=False)   # Experiments / ATR / Users / Admin
    action:       Mapped[str] = mapped_column(String(100), nullable=False)  # SUBMITTED / APPROVED / CREATED ...
    target_type:  Mapped[Optional[str]] = mapped_column(String(50))         # experiment / atr / user
    target_id:    Mapped[Optional[str]] = mapped_column(String(36))         # ID of affected record
    target_label: Mapped[Optional[str]] = mapped_column(String(255))        # OQ/R1/S1/E03166/001
    detail:       Mapped[Optional[str]] = mapped_column(Text)               # Human-readable description
    ip_address:   Mapped[Optional[str]] = mapped_column(String(45))
    created_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
