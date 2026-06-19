"""
ADC Synthesis router — sections 1.4, 1.6, 1.7.

All endpoints are scoped to an experiment:
  /api/adc/experiments/{experiment_id}/objective
  /api/adc/experiments/{experiment_id}/regulatory
  /api/adc/experiments/{experiment_id}/risk-assessment
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.adc_synthesis import (
    AdcObjective, AdcRegulatoryClassification,
    AdcRiskAssessment, AdcRiskItem,
)
from app.models.experiment import Experiment
from app.schemas.adc_synthesis import (
    ObjectiveOut, ObjectiveUpsert,
    RegulatoryOut, RegulatoryUpsert,
    RiskAssessmentOut, RiskAssessmentUpsert,
)
from app.utils.deps import get_current_user

router = APIRouter()


def _get_experiment(experiment_id: str, db: Session) -> Experiment:
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(404, "Experiment not found")
    return exp


# ── 1.4 Objective ─────────────────────────────────────────────────────────────

@router.get("/experiments/{experiment_id}/objective", response_model=ObjectiveOut)
def get_objective(experiment_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    _get_experiment(experiment_id, db)
    obj = db.query(AdcObjective).filter(AdcObjective.experiment_id == experiment_id).first()
    if not obj:
        raise HTTPException(404, "Objective not set")
    return obj


@router.put("/experiments/{experiment_id}/objective", response_model=ObjectiveOut)
def upsert_objective(
    experiment_id: str,
    body: ObjectiveUpsert,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    _get_experiment(experiment_id, db)
    obj = db.query(AdcObjective).filter(AdcObjective.experiment_id == experiment_id).first()
    if obj:
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
    else:
        obj = AdcObjective(experiment_id=experiment_id, **body.model_dump())
        db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ── 1.6 Regulatory Classification ────────────────────────────────────────────

@router.get("/experiments/{experiment_id}/regulatory", response_model=RegulatoryOut)
def get_regulatory(experiment_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    _get_experiment(experiment_id, db)
    reg = db.query(AdcRegulatoryClassification).filter(
        AdcRegulatoryClassification.experiment_id == experiment_id
    ).first()
    if not reg:
        raise HTTPException(404, "Regulatory classification not set")
    return reg


@router.put("/experiments/{experiment_id}/regulatory", response_model=RegulatoryOut)
def upsert_regulatory(
    experiment_id: str,
    body: RegulatoryUpsert,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    _get_experiment(experiment_id, db)
    reg = db.query(AdcRegulatoryClassification).filter(
        AdcRegulatoryClassification.experiment_id == experiment_id
    ).first()
    if reg:
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(reg, k, v)
    else:
        reg = AdcRegulatoryClassification(experiment_id=experiment_id, **body.model_dump())
        db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


# ── 1.7 Risk Assessment ───────────────────────────────────────────────────────

@router.get("/experiments/{experiment_id}/risk-assessment", response_model=RiskAssessmentOut)
def get_risk_assessment(experiment_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    _get_experiment(experiment_id, db)
    ra = (
        db.query(AdcRiskAssessment)
        .options(selectinload(AdcRiskAssessment.risk_items))
        .filter(AdcRiskAssessment.experiment_id == experiment_id)
        .first()
    )
    if not ra:
        raise HTTPException(404, "Risk assessment not set")
    return ra


@router.put("/experiments/{experiment_id}/risk-assessment", response_model=RiskAssessmentOut)
def upsert_risk_assessment(
    experiment_id: str,
    body: RiskAssessmentUpsert,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    _get_experiment(experiment_id, db)
    ra = (
        db.query(AdcRiskAssessment)
        .options(selectinload(AdcRiskAssessment.risk_items))
        .filter(AdcRiskAssessment.experiment_id == experiment_id)
        .first()
    )

    header = body.model_dump(exclude={"risk_items"}, exclude_unset=True)
    items_data = body.risk_items

    if ra:
        for k, v in header.items():
            setattr(ra, k, v)
    else:
        ra = AdcRiskAssessment(experiment_id=experiment_id, **header)
        db.add(ra)
        db.flush()

    if items_data is not None:
        db.query(AdcRiskItem).filter(AdcRiskItem.risk_assessment_id == ra.id).delete()
        for item in items_data:
            db.add(AdcRiskItem(risk_assessment_id=ra.id, **item.model_dump()))

    db.commit()
    db.refresh(ra)
    return ra
