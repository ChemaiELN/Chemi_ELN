"""Inventory – Instrument Specification: parameters + spec details (Phase 3)."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvInstrumentCatalogue,
    InvInstrumentParameter,
    InvInstrumentSpecDetail,
    InvMeasurementMaster,
)
from app.schemas.inventory import (
    InstrumentParameterCreate,
    InstrumentParameterOut,
    InstrumentParameterUpdate,
    InstrumentSpecDetailCreate,
    InstrumentSpecDetailOut,
    InstrumentSpecDetailUpdate,
)

router = APIRouter(prefix="/inventory", tags=["inventory-instrument-spec"])


def _require_instrument(db: Session, instrument_id: int) -> None:
    if not db.get(InvInstrumentCatalogue, instrument_id):
        raise HTTPException(404, "Instrument not found.")


# ── Instrument Parameters (calibration measurement config) ────────────────────
@router.get("/instruments/{instrument_id}/parameters", response_model=list[InstrumentParameterOut])
def list_parameters(
    instrument_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _require_instrument(db, instrument_id)
    return (
        db.query(InvInstrumentParameter)
        .filter_by(instrument_id=instrument_id)
        .order_by(InvInstrumentParameter.seq_no, InvInstrumentParameter.id)
        .all()
    )


@router.post("/instruments/{instrument_id}/parameters", response_model=InstrumentParameterOut, status_code=201)
def add_parameter(
    instrument_id: int,
    body: InstrumentParameterCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _require_instrument(db, instrument_id)
    data = body.model_dump()
    # snapshot measurement name from master when not supplied
    if data.get("measurement_id") and not data.get("measurement_name"):
        m = db.get(InvMeasurementMaster, data["measurement_id"])
        if m:
            data["measurement_name"] = m.name
    seq = data.pop("seq_no", None)
    if seq is None:
        seq = db.query(InvInstrumentParameter).filter_by(instrument_id=instrument_id).count() + 1
    row = InvInstrumentParameter(instrument_id=instrument_id, seq_no=seq, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/instrument-parameters/{param_id}", response_model=InstrumentParameterOut)
def update_parameter(
    param_id: int,
    body: InstrumentParameterUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentParameter, param_id)
    if not row:
        raise HTTPException(404, "Parameter not found.")
    data = body.model_dump(exclude_unset=True)
    if data.get("measurement_id") and not data.get("measurement_name"):
        m = db.get(InvMeasurementMaster, data["measurement_id"])
        if m:
            data["measurement_name"] = m.name
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/instrument-parameters/{param_id}", status_code=204)
def delete_parameter(
    param_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentParameter, param_id)
    if not row:
        raise HTTPException(404, "Parameter not found.")
    db.delete(row)
    db.commit()


# ── Instrument Specification Details (generic key/value/uom) ──────────────────
@router.get("/instruments/{instrument_id}/spec-details", response_model=list[InstrumentSpecDetailOut])
def list_spec_details(
    instrument_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _require_instrument(db, instrument_id)
    return (
        db.query(InvInstrumentSpecDetail)
        .filter_by(instrument_id=instrument_id)
        .order_by(InvInstrumentSpecDetail.seq_no, InvInstrumentSpecDetail.id)
        .all()
    )


@router.post("/instruments/{instrument_id}/spec-details", response_model=InstrumentSpecDetailOut, status_code=201)
def add_spec_detail(
    instrument_id: int,
    body: InstrumentSpecDetailCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _require_instrument(db, instrument_id)
    data = body.model_dump()
    seq = data.pop("seq_no", None)
    if seq is None:
        seq = db.query(InvInstrumentSpecDetail).filter_by(instrument_id=instrument_id).count() + 1
    row = InvInstrumentSpecDetail(instrument_id=instrument_id, seq_no=seq, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/instrument-spec-details/{detail_id}", response_model=InstrumentSpecDetailOut)
def update_spec_detail(
    detail_id: int,
    body: InstrumentSpecDetailUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentSpecDetail, detail_id)
    if not row:
        raise HTTPException(404, "Specification detail not found.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/instrument-spec-details/{detail_id}", status_code=204)
def delete_spec_detail(
    detail_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentSpecDetail, detail_id)
    if not row:
        raise HTTPException(404, "Specification detail not found.")
    db.delete(row)
    db.commit()
