from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class ATR(Base):
    __tablename__ = "atr"

    id:                  Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    atr_no:              Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # ATR00066041VNA
    experiment_id:       Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))
    notebook_id:         Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("notebooks.id"))
    project_id:          Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("projects.id"))
    test_type:           Mapped[str] = mapped_column(String(100), nullable=False)  # NMR / HPLC / MS / IR
    objectives:          Mapped[str] = mapped_column(Text, nullable=False)
    # NEW / SUBMITTED / ASSIGNED / IN_PROGRESS / VERIFIED / COMPLETED / CANCELLED
    status:              Mapped[str] = mapped_column(String(30), default="NEW", nullable=False)
    raised_by:           Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    raised_at:           Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    submitted_to:        Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))   # FIX-07a
    submitted_at:        Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    assigned_to:         Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    assigned_at:         Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    due_date:            Mapped[Optional[date]] = mapped_column(Date)
    result:              Mapped[Optional[str]] = mapped_column(Text)
    result_observations: Mapped[Optional[str]] = mapped_column(Text)
    completed_at:        Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_by:        Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    verified_at:         Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verified_by:         Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    version:             Mapped[int]  = mapped_column(SmallInteger, default=1, nullable=False)
    is_latest_version:   Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)    # FIX-32
    created_at:          Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:          Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    experiment:    Mapped[Optional["Experiment"]]    = relationship(back_populates="atr_requests", foreign_keys=[experiment_id])
    raised_user:   Mapped["User"]                    = relationship(foreign_keys=[raised_by])
    submittee:     Mapped[Optional["User"]]          = relationship(foreign_keys=[submitted_to])
    assignee:      Mapped[Optional["User"]]          = relationship(foreign_keys=[assigned_to])
    attachments:   Mapped[List["ATRAttachment"]]     = relationship(back_populates="atr", cascade="all, delete-orphan")
    final_reports: Mapped[List["ATRFinalReport"]]    = relationship(back_populates="atr", cascade="all, delete-orphan")


class ATRAttachment(Base):
    __tablename__ = "atr_attachments"

    id:          Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    atr_id:      Mapped[str] = mapped_column(PUUID, ForeignKey("atr.id"), nullable=False)
    filename:    Mapped[str] = mapped_column(String(255), nullable=False)
    file_path:   Mapped[str] = mapped_column(String(500), nullable=False)
    file_size:   Mapped[Optional[int]]  = mapped_column(BigInteger)  # bytes
    uploaded_by: Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    atr:      Mapped["ATR"]  = relationship(back_populates="attachments")
    uploader: Mapped["User"] = relationship(foreign_keys=[uploaded_by])


class ATRFinalReport(Base):
    """Final analytical report PDF uploaded by the analyst."""
    __tablename__ = "atr_final_reports"

    id:          Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    atr_id:      Mapped[str]           = mapped_column(PUUID, ForeignKey("atr.id"), nullable=False)
    filename:    Mapped[str]           = mapped_column(String(255), nullable=False)
    file_path:   Mapped[str]           = mapped_column(String(500), nullable=False)
    file_size:   Mapped[Optional[int]] = mapped_column(BigInteger)
    uploaded_by: Mapped[str]           = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)

    atr:      Mapped["ATR"]  = relationship(back_populates="final_reports")
    uploader: Mapped["User"] = relationship(foreign_keys=[uploaded_by])


from app.models.experiment import Experiment  # noqa: E402
from app.models.user import User              # noqa: E402
