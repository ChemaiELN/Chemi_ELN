from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey,
    Index, JSON, SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class Experiment(Base):
    __tablename__ = "experiments"
    __table_args__ = (
        Index("ix_exp_notebook_id",       "notebook_id"),
        Index("ix_exp_project_id",        "project_id"),
        Index("ix_exp_base_code",         "base_code"),
        Index("ix_exp_full_code",         "full_code"),
        Index("ix_exp_status",            "status"),
        Index("ix_exp_is_latest_version", "is_latest_version"),
        CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','LOCKED','REJECTED','UNLOCKED','VOID')",
            name="ck_exp_status",
        ),
    )

    id:           Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    notebook_id:  Mapped[str] = mapped_column(PUUID, ForeignKey("notebooks.id"), nullable=False)
    project_id:   Mapped[str] = mapped_column(PUUID, ForeignKey("projects.id"),  nullable=False)

    # ── Identity ──────────────────────────────────────────────────────────────
    # base_code:  "EXP-001"       — same for all versions of the same experiment
    # version:    1, 2, 3 …
    # full_code:  "EXP-001-01"    — unique; what scientists see
    base_code:  Mapped[str] = mapped_column(String(50),  nullable=False)
    version:    Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    full_code:  Mapped[str] = mapped_column(String(60),  unique=True, nullable=False)
    title:      Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Template screen link ───────────────────────────────────────────────────
    # screen_key:  "wf1_method_concentration"  (NULL = free-form experiment)
    # section_key: "wf1"                       (parent section / workflow group)
    screen_key:  Mapped[Optional[str]] = mapped_column(String(100))
    section_key: Mapped[Optional[str]] = mapped_column(String(100))

    # ── Data ──────────────────────────────────────────────────────────────────
    # All scientist-filled field values for this screen.
    # Shape validated against template definition[screen_key].fields at save time.
    data:         Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    observations: Mapped[Optional[str]]            = mapped_column(Text)
    conclusion:   Mapped[Optional[str]]            = mapped_column(Text)
    disposition:  Mapped[Optional[str]]            = mapped_column(String(100))  # Release / Hold / Reject
    scheme_mol:   Mapped[Optional[str]]            = mapped_column(Text)         # Ketcher MOL/SMILES data

    # ── Status ────────────────────────────────────────────────────────────────
    status:            Mapped[str]  = mapped_column(String(20), default="DRAFT", nullable=False)
    is_latest_version: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Versioning ────────────────────────────────────────────────────────────
    # parent_id → the immediately preceding version (NULL on v1)
    parent_id:     Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))
    revision_note: Mapped[Optional[str]] = mapped_column(Text)

    # ── Cross-notebook reference ───────────────────────────────────────────────
    # Synthesis experiments set this after a Preliminary is LOCKED.
    # Validated: target must be LOCKED + is_latest_version=True at link time.
    # Once set, keeps resolving even if a newer Preliminary version is created.
    linked_preliminary_id: Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))

    # ── Workflow actions ───────────────────────────────────────────────────────
    created_by:      Mapped[str]           = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    submitted_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    submitted_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_by:     Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    approved_at:     Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejected_by:     Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    rejected_at:     Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    # ── E-signatures (21 CFR Part 11) ─────────────────────────────────────────
    scientist_signed_by:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    scientist_signed_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scientist_sign_reason: Mapped[Optional[str]] = mapped_column(String(200))
    # Reviewer signatures are now in experiment_reviews (one row per reviewer).

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # ── Relationships ──────────────────────────────────────────────────────────
    notebook:           Mapped["Notebook"]                 = relationship(foreign_keys=[notebook_id], back_populates="experiments")
    project:            Mapped["Project"]                  = relationship(foreign_keys=[project_id])
    creator:            Mapped["User"]                     = relationship(foreign_keys=[created_by])
    submitter:          Mapped[Optional["User"]]           = relationship(foreign_keys=[submitted_by])
    approver:           Mapped[Optional["User"]]           = relationship(foreign_keys=[approved_by])
    rejecter:           Mapped[Optional["User"]]           = relationship(foreign_keys=[rejected_by])
    scientist_signer:   Mapped[Optional["User"]]           = relationship(foreign_keys=[scientist_signed_by])
    parent:             Mapped[Optional["Experiment"]]     = relationship(foreign_keys=[parent_id], remote_side="Experiment.id")
    linked_preliminary: Mapped[Optional["Experiment"]]     = relationship(foreign_keys=[linked_preliminary_id], remote_side="Experiment.id")
    files:              Mapped[List["ExperimentFile"]]     = relationship(back_populates="experiment", cascade="all, delete-orphan")
    reviews:            Mapped[List["ExperimentReview"]]   = relationship(back_populates="experiment", cascade="all, delete-orphan")
    history:            Mapped[List["ExperimentHistory"]]  = relationship(back_populates="experiment", cascade="all, delete-orphan")
    atr_requests:       Mapped[List["ATR"]]                = relationship(back_populates="experiment", foreign_keys="ATR.experiment_id")


class ExperimentFile(Base):
    __tablename__ = "experiment_files"
    __table_args__ = (Index("ix_exp_files_exp_id", "experiment_id"),)

    id:            Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str]           = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    section_key:   Mapped[Optional[str]] = mapped_column(String(100))   # which screen section the file belongs to
    filename:      Mapped[str]           = mapped_column(String(255), nullable=False)
    file_path:     Mapped[str]           = mapped_column(String(500), nullable=False)
    file_size:     Mapped[Optional[int]] = mapped_column(BigInteger)
    file_type:     Mapped[Optional[str]] = mapped_column(String(50))    # pdf / xlsx / csv
    uploaded_by:   Mapped[str]           = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at:   Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)

    experiment: Mapped["Experiment"] = relationship(back_populates="files")
    uploader:   Mapped["User"]       = relationship(foreign_keys=[uploaded_by])


class ExperimentReview(Base):
    """One row per reviewer assigned to an experiment.

    decision is NULL until the reviewer signs.  All rows must be APPROVED
    before the experiment can be approved.  Any REJECTED row triggers immediate
    rejection of the experiment.
    """
    __tablename__ = "experiment_reviews"
    __table_args__ = (
        UniqueConstraint("experiment_id", "reviewer_id", name="uq_exp_review"),
        CheckConstraint(
            "decision IS NULL OR decision IN ('APPROVED','REJECTED')",
            name="ck_review_decision",
        ),
        Index("ix_exp_reviews_experiment_id", "experiment_id"),
        Index("ix_exp_reviews_reviewer_id",   "reviewer_id"),
    )

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    reviewer_id:   Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    assigned_by:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    assigned_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    signed_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sign_reason: Mapped[Optional[str]]      = mapped_column(String(200))
    decision:    Mapped[Optional[str]]      = mapped_column(String(20))   # APPROVED | REJECTED | None

    experiment:  Mapped["Experiment"]      = relationship(back_populates="reviews")
    reviewer:    Mapped["User"]            = relationship(foreign_keys=[reviewer_id])
    assigner:    Mapped[Optional["User"]]  = relationship(foreign_keys=[assigned_by])


class ExperimentHistory(Base):
    """Immutable audit log — one row per action on an experiment."""
    __tablename__ = "experiment_history"
    __table_args__ = (
        Index("ix_exp_history_experiment_id", "experiment_id"),
        Index("ix_exp_history_created_at",    "created_at"),
    )

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    actor_id:      Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    action:        Mapped[str] = mapped_column(String(50), nullable=False)
    details:       Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    experiment: Mapped["Experiment"] = relationship(back_populates="history")
    actor:      Mapped["User"]       = relationship(foreign_keys=[actor_id])


from app.models.notebook import Notebook  # noqa: E402
from app.models.project import Project    # noqa: E402
from app.models.user import User          # noqa: E402
