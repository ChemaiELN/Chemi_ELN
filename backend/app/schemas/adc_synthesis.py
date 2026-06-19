from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


# ── Objective (1.4) ──────────────────────────────────────────────────────────

class ObjectiveBase(BaseModel):
    study_purpose:    Optional[str] = None
    hypothesis:       Optional[str] = None
    success_criteria: Optional[str] = None


class ObjectiveUpsert(ObjectiveBase):
    pass


class ObjectiveOut(ObjectiveBase):
    id:            str
    experiment_id: str
    created_at:    datetime
    updated_at:    datetime

    model_config = {"from_attributes": True}


# ── Regulatory Classification (1.6) ──────────────────────────────────────────

OelBand = Literal["Band 1 (>1 mg/m³)", "Band 2 (0.1–1 mg/m³)", "Band 3 (0.01–0.1 mg/m³)", "Band 4 (0.001–0.01 mg/m³)", "Band 5 (<0.001 mg/m³)"]
ContainmentCategory = Literal["Open handling", "Local exhaust ventilation", "Glovebox", "Isolator", "High-containment suite"]
GmpClassification = Literal["GMP", "Non-GMP (PD)", "Non-GMP (Research)"]


class RegulatoryBase(BaseModel):
    oel_band:             Optional[str] = None
    containment_category: Optional[str] = None
    gmp_classification:   Optional[str] = None


class RegulatoryUpsert(RegulatoryBase):
    pass


class RegulatoryOut(RegulatoryBase):
    id:            str
    experiment_id: str
    created_at:    datetime
    updated_at:    datetime

    model_config = {"from_attributes": True}


# ── Risk Assessment (1.7) ─────────────────────────────────────────────────────

AssessmentType   = Literal["FMEA", "HAZOP", "Pre-run risk review", "Deviation risk review"]
RiskLevel        = Literal["Low", "Medium", "High", "Critical"]
AssessmentStatus = Literal["Draft", "Under review", "Approved", "Superseded"]


class RiskItemCreate(BaseModel):
    seq_no:       int = 0
    process_step: Optional[str] = None
    failure_mode: Optional[str] = None
    severity:     Optional[int] = None
    occurrence:   Optional[int] = None
    detection:    Optional[int] = None
    rpn:          Optional[int] = None
    mitigation:   Optional[str] = None


class RiskItemOut(RiskItemCreate):
    id:                 int
    risk_assessment_id: str

    model_config = {"from_attributes": True}


class RiskAssessmentBase(BaseModel):
    assessment_id:      Optional[str] = None
    assessment_type:    Optional[str] = None
    last_reviewed:      Optional[date] = None
    reviewed_by:        Optional[str] = None
    overall_risk_level: Optional[str] = None
    status:             Optional[str] = "Draft"
    additional_notes:   Optional[str] = None


class RiskAssessmentUpsert(RiskAssessmentBase):
    risk_items: Optional[List[RiskItemCreate]] = None


class RiskAssessmentOut(RiskAssessmentBase):
    id:            str
    experiment_id: str
    created_at:    datetime
    updated_at:    datetime
    risk_items:    List[RiskItemOut] = []

    model_config = {"from_attributes": True}
