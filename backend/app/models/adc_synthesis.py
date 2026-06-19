from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class AdcObjective(Base):
    """1.4 — Objective section linked to an experiment."""
    __tablename__ = "adc_objective"

    id:               Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id:    Mapped[str]           = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    study_purpose:    Mapped[Optional[str]] = mapped_column(Text)
    hypothesis:       Mapped[Optional[str]] = mapped_column(Text)
    success_criteria: Mapped[Optional[str]] = mapped_column(Text)
    created_at:       Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:       Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    experiment: Mapped["Experiment"] = relationship(foreign_keys=[experiment_id])


class AdcRegulatoryClassification(Base):
    """1.6 — Regulatory Classification (Cytotoxic) linked to an experiment."""
    __tablename__ = "adc_regulatory_classification"

    id:                   Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id:        Mapped[str]           = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    # OEL Band: Band 1 (>1 mg/m³) … Band 5 (<0.001 mg/m³)
    oel_band:             Mapped[Optional[str]] = mapped_column(String(50))
    # Open handling / Local exhaust ventilation / Glovebox / isolator / High-containment suite
    containment_category: Mapped[Optional[str]] = mapped_column(String(100))
    # GMP / Non-GMP (PD) / Non-GMP (Research)
    gmp_classification:   Mapped[Optional[str]] = mapped_column(String(50))
    created_at:           Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:           Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    experiment: Mapped["Experiment"] = relationship(foreign_keys=[experiment_id])


class AdcRiskAssessment(Base):
    """1.7 — Risk Assessment header linked to an experiment."""
    __tablename__ = "adc_risk_assessment"

    id:                Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id:     Mapped[str]           = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    assessment_id:     Mapped[Optional[str]] = mapped_column(String(100))          # e.g. RA-ADC-ELN-001
    # FMEA / HAZOP / Pre-run risk review / Deviation risk review
    assessment_type:   Mapped[Optional[str]] = mapped_column(String(50))
    last_reviewed:     Mapped[Optional[date]] = mapped_column(Date)
    reviewed_by:       Mapped[Optional[str]] = mapped_column(String(200))
    # Low / Medium / High / Critical
    overall_risk_level: Mapped[Optional[str]] = mapped_column(String(20))
    # Draft / Under review / Approved / Superseded
    status:            Mapped[Optional[str]] = mapped_column(String(30), default="Draft")
    additional_notes:  Mapped[Optional[str]] = mapped_column(Text)
    created_at:        Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:        Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    experiment: Mapped["Experiment"]        = relationship(foreign_keys=[experiment_id])
    risk_items: Mapped[List["AdcRiskItem"]] = relationship(back_populates="risk_assessment", cascade="all, delete-orphan", order_by="AdcRiskItem.seq_no")


class AdcRiskItem(Base):
    """1.7 — FMEA risk register rows."""
    __tablename__ = "adc_risk_item"

    id:                  Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    risk_assessment_id:  Mapped[str]           = mapped_column(PUUID, ForeignKey("adc_risk_assessment.id", ondelete="CASCADE"), nullable=False, index=True)
    seq_no:              Mapped[int]           = mapped_column(SmallInteger, nullable=False, default=0)
    process_step:        Mapped[Optional[str]] = mapped_column(String(300))
    failure_mode:        Mapped[Optional[str]] = mapped_column(String(300))
    severity:            Mapped[Optional[int]] = mapped_column(SmallInteger)   # 1–5
    occurrence:          Mapped[Optional[int]] = mapped_column(SmallInteger)   # 1–5
    detection:           Mapped[Optional[int]] = mapped_column(SmallInteger)   # 1–5
    rpn:                 Mapped[Optional[int]] = mapped_column(Integer)        # severity × occurrence × detection
    mitigation:          Mapped[Optional[str]] = mapped_column(Text)

    risk_assessment: Mapped["AdcRiskAssessment"] = relationship(back_populates="risk_items")


from app.models.experiment import Experiment  # noqa: E402
