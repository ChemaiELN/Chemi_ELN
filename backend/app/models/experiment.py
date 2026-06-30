import uuid
import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, SmallInteger, Text, DateTime,
    BigInteger, ForeignKey, Index, UniqueConstraint, CheckConstraint, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


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

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    notebook_id = Column(UUID(as_uuid=True), ForeignKey("notebooks.id"), nullable=False)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id"),  nullable=False)

    # ── Identity ─────────────────────────────────────────────────────────────
    base_code = Column(String(50), nullable=False)
    version   = Column(SmallInteger, default=1, nullable=False)
    full_code = Column(String(60), unique=True, nullable=False)
    title     = Column(String(255), nullable=False)

    screen_key  = Column(String(100), nullable=True)
    section_key = Column(String(100), nullable=True)

    # ── Data ─────────────────────────────────────────────────────────────────
    data           = Column(JSON, nullable=True)
    observations   = Column(Text, nullable=True)
    conclusion     = Column(Text, nullable=True)
    disposition    = Column(String(100), nullable=True)    # Release for conjugation / Hold / Reject
    lp_disposition = Column(String(100), nullable=True)   # linker-payload disposition (ADC)
    scheme_mol     = Column(Text, nullable=True)           # Ketcher MOL/SMILES

    # ── Status ────────────────────────────────────────────────────────────────
    status            = Column(String(20), default="DRAFT", nullable=False)
    is_latest_version = Column(Boolean, default=True, nullable=False)

    # ── Versioning ───────────────────────────────────────────────────────────
    parent_id             = Column(UUID(as_uuid=True), ForeignKey("experiments.id"), nullable=True)
    revision_note         = Column(Text, nullable=True)
    linked_preliminary_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id"), nullable=True)

    # ── Workflow fields ───────────────────────────────────────────────────────
    created_by       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    submitted_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at     = Column(DateTime, nullable=True)
    approved_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at      = Column(DateTime, nullable=True)
    rejected_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejected_at      = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    voided_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    voided_at        = Column(DateTime, nullable=True)
    void_reason      = Column(Text, nullable=True)

    # ── E-signatures (21 CFR Part 11) ────────────────────────────────────────
    scientist_signed_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    scientist_signed_at   = Column(DateTime, nullable=True)
    scientist_sign_reason = Column(String(200), nullable=True)

    created_at = Column(DateTime, nullable=False, default=_now)
    updated_at = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    notebook             = relationship("Notebook", foreign_keys=[notebook_id], back_populates="experiments")
    project              = relationship("Project", foreign_keys=[project_id])
    creator              = relationship("User", foreign_keys=[created_by])
    submitter            = relationship("User", foreign_keys=[submitted_by])
    approver             = relationship("User", foreign_keys=[approved_by])
    rejecter             = relationship("User", foreign_keys=[rejected_by])
    voider               = relationship("User", foreign_keys=[voided_by])
    scientist_signer     = relationship("User", foreign_keys=[scientist_signed_by])
    parent               = relationship("Experiment", foreign_keys=[parent_id],             remote_side="Experiment.id", post_update=True)
    linked_preliminary   = relationship("Experiment", foreign_keys=[linked_preliminary_id], remote_side="Experiment.id", post_update=True)
    files                = relationship("ExperimentFile",           back_populates="experiment", cascade="all, delete-orphan")
    reviews              = relationship("ExperimentReview",         back_populates="experiment", cascade="all, delete-orphan")
    history              = relationship("ExperimentHistory",        back_populates="experiment", cascade="all, delete-orphan")
    intermediate_id_rows = relationship("ExperimentIntermediateId", back_populates="experiment", cascade="all, delete-orphan")
    materials            = relationship("ExperimentMaterial",       back_populates="experiment", cascade="all, delete-orphan")


class ExperimentFile(Base):
    __tablename__ = "experiment_files"
    __table_args__ = (Index("ix_exp_files_exp_id", "experiment_id"),)

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id"), nullable=False)
    section_key   = Column(String(100), nullable=True)
    filename      = Column(String(255), nullable=False)
    file_path     = Column(String(500), nullable=False)
    file_size     = Column(BigInteger, nullable=True)
    file_type     = Column(String(50), nullable=True)
    uploaded_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at   = Column(DateTime, nullable=False, default=_now)

    experiment = relationship("Experiment", back_populates="files")
    uploader   = relationship("User", foreign_keys=[uploaded_by])


class ExperimentReview(Base):
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

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    reviewer_id   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at   = Column(DateTime, nullable=False, default=_now)
    signed_at     = Column(DateTime, nullable=True)
    sign_reason   = Column(String(200), nullable=True)
    decision      = Column(String(20), nullable=True)

    experiment = relationship("Experiment", back_populates="reviews")
    reviewer   = relationship("User", foreign_keys=[reviewer_id])
    assigner   = relationship("User", foreign_keys=[assigned_by])


class ExperimentHistory(Base):
    __tablename__ = "experiment_history"
    __table_args__ = (
        Index("ix_exp_history_experiment_id", "experiment_id"),
        Index("ix_exp_history_created_at",    "created_at"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    actor_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action        = Column(String(50), nullable=False)
    details       = Column(JSON, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=_now)

    experiment = relationship("Experiment", back_populates="history")
    actor      = relationship("User", foreign_keys=[actor_id])


class ExperimentIntermediateId(Base):
    __tablename__ = "experiment_intermediate_ids"
    __table_args__ = (
        UniqueConstraint("experiment_id", "screen_key", "field_key", name="uq_exp_intid"),
        Index("ix_exp_intid_experiment_id", "experiment_id"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    screen_key    = Column(String(100), nullable=False)
    field_key     = Column(String(100), nullable=False)
    generated_id  = Column(String(50),  nullable=False)
    created_at    = Column(DateTime, nullable=False, default=_now)

    experiment = relationship("Experiment", back_populates="intermediate_id_rows")


class ExperimentMaterial(Base):
    __tablename__ = "experiment_materials"
    __table_args__ = (
        CheckConstraint(
            "status IN ('RESERVED','ISSUED','RETURNED')",
            name="ck_exp_material_status",
        ),
        Index("ix_exp_materials_experiment_id", "experiment_id"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id"), nullable=False)
    material_id   = Column(Integer, ForeignKey("inv_materials.id"), nullable=True)
    batch_id      = Column(Integer, ForeignKey("inv_batches.id"),   nullable=True)
    material_role = Column(String(100), nullable=True)
    qty_reserved  = Column(Numeric(12, 4), nullable=False)
    unit          = Column(String(20), nullable=True)
    qty_issued    = Column(Numeric(12, 4), nullable=True)
    status        = Column(String(20), default="RESERVED", nullable=False)
    created_at    = Column(DateTime, nullable=False, default=_now)
    updated_at    = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    experiment = relationship("Experiment", back_populates="materials")
    material   = relationship("InvMaterial", foreign_keys=[material_id])
    batch      = relationship("InvBatch",    foreign_keys=[batch_id])
