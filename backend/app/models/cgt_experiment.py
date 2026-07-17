import uuid
import datetime
from sqlalchemy import (
    Column, String, Boolean, SmallInteger, Text, DateTime,
    ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


# ── CGT Experiment ───────────────────────────────────────────────────────────
# One row per notebook section (section_key), mirroring Experiment/ADC's
# section-level data-capture pattern, but a lean v1: no versioning/e-signature/
# files/reviews/materials child tables yet (Phase 5 brings workflow parity).
# data = {screen_key: {field_key: value}} — same shape the runtime section
# renderer (FieldRenderer) already expects.
class CgtExperiment(Base):
    __tablename__ = "cgt_experiments"
    __table_args__ = (
        Index("ix_cgt_exp_notebook_id", "cgt_notebook_id"),
        Index("ix_cgt_exp_project_id",  "cgt_project_id"),
        Index("ix_cgt_exp_full_code",   "full_code"),
        Index("ix_cgt_exp_status",      "status"),
        CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')",
            name="ck_cgt_exp_status",
        ),
    )

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    cgt_notebook_id = Column(UUID(as_uuid=True), ForeignKey("cgt_notebooks.id"), nullable=False)
    cgt_project_id  = Column(UUID(as_uuid=True), ForeignKey("cgt_projects.id"),  nullable=False)

    base_code = Column(String(50), nullable=False)
    version   = Column(SmallInteger, default=1, nullable=False)
    full_code = Column(String(60), unique=True, nullable=False)
    title     = Column(String(255), nullable=False)

    screen_key  = Column(String(100), nullable=True)
    section_key = Column(String(100), nullable=True)

    data         = Column(JSON, nullable=True)
    observations = Column(Text, nullable=True)
    conclusion   = Column(Text, nullable=True)

    status            = Column(String(20), default="DRAFT", nullable=False)
    is_latest_version = Column(Boolean, default=True, nullable=False)

    created_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at  = Column(DateTime, nullable=True)
    rejected_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejected_at  = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # E-signature (21 CFR Part 11 style) — mirrors Experiment/ADC's
    # scientist_signed_by/at/reason; the approver's sign reason is only kept
    # in CgtExperimentHistory.details, same as ADC's approve flow.
    scientist_signed_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    scientist_signed_at     = Column(DateTime, nullable=True)
    scientist_sign_reason   = Column(String(500), nullable=True)

    created_at = Column(DateTime, nullable=False, default=_now)
    updated_at = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    notebook   = relationship("CgtNotebook", foreign_keys=[cgt_notebook_id], back_populates="experiments")
    project    = relationship("CgtProject", foreign_keys=[cgt_project_id])
    creator    = relationship("User", foreign_keys=[created_by])
    submitter  = relationship("User", foreign_keys=[submitted_by])
    approver   = relationship("User", foreign_keys=[approved_by])
    rejecter   = relationship("User", foreign_keys=[rejected_by])
    scientist_signer = relationship("User", foreign_keys=[scientist_signed_by])
