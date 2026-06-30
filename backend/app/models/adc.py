import uuid
import datetime
from sqlalchemy import (
    Column, String, Integer, SmallInteger, Text, Date, DateTime, ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


class AdcObjective(Base):
    """1.4 — Study objective linked to a single experiment."""
    __tablename__ = "adc_objective"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id    = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    study_purpose    = Column(Text, nullable=True)
    hypothesis       = Column(Text, nullable=True)
    success_criteria = Column(Text, nullable=True)
    created_at       = Column(DateTime, nullable=False, default=_now)
    updated_at       = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    experiment = relationship("Experiment", foreign_keys=[experiment_id])


class AdcRegulatoryClassification(Base):
    """1.6 — Regulatory / cytotoxic classification linked to a single experiment."""
    __tablename__ = "adc_regulatory_classification"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id        = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    oel_band             = Column(String(50), nullable=True)
    containment_category = Column(String(100), nullable=True)
    gmp_classification   = Column(String(50), nullable=True)
    created_at           = Column(DateTime, nullable=False, default=_now)
    updated_at           = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    experiment = relationship("Experiment", foreign_keys=[experiment_id])


class AdcRiskAssessment(Base):
    """1.7 — Risk assessment header linked to a single experiment."""
    __tablename__ = "adc_risk_assessment"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    experiment_id      = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    assessment_id      = Column(String(100), nullable=True)
    assessment_type    = Column(String(50), nullable=True)
    last_reviewed      = Column(Date, nullable=True)
    reviewed_by        = Column(String(200), nullable=True)
    overall_risk_level = Column(String(20), nullable=True)
    status             = Column(String(30), nullable=True, server_default="Draft")
    additional_notes   = Column(Text, nullable=True)
    created_at         = Column(DateTime, nullable=False, default=_now)
    updated_at         = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    experiment = relationship("Experiment", foreign_keys=[experiment_id])
    risk_items = relationship(
        "AdcRiskItem",
        back_populates="risk_assessment",
        cascade="all, delete-orphan",
        order_by="AdcRiskItem.seq_no",
    )


class AdcRiskItem(Base):
    """1.7 — FMEA row. Integer PK (autoincrement) per spec."""
    __tablename__ = "adc_risk_item"
    __table_args__ = (Index("ix_adc_risk_item_risk_assessment_id", "risk_assessment_id"),)

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    risk_assessment_id = Column(UUID(as_uuid=True), ForeignKey("adc_risk_assessment.id", ondelete="CASCADE"), nullable=False)
    seq_no             = Column(SmallInteger, nullable=False, default=0)
    process_step       = Column(String(300), nullable=True)
    failure_mode       = Column(String(300), nullable=True)
    severity           = Column(SmallInteger, nullable=True)
    occurrence         = Column(SmallInteger, nullable=True)
    detection          = Column(SmallInteger, nullable=True)
    rpn                = Column(Integer, nullable=True)
    mitigation         = Column(Text, nullable=True)

    risk_assessment = relationship("AdcRiskAssessment", back_populates="risk_items")
