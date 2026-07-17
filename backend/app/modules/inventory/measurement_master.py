"""Inventory – Instrument Measurement Master (Phase 3)."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvMeasurementMaster
from app.schemas.inventory import (
    MeasurementMasterCreate,
    MeasurementMasterOut,
    MeasurementMasterUpdate,
)

router = APIRouter(prefix="/inventory/measurement-master", tags=["inventory-measurement-master"])


@router.get("", response_model=list[MeasurementMasterOut])
def list_measurements(
    search: Optional[str] = Query(None),
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvMeasurementMaster)
    if active_only:
        q = q.filter(InvMeasurementMaster.is_active.is_(True))
    if search:
        q = q.filter(InvMeasurementMaster.name.ilike(f"%{search}%"))
    return q.order_by(InvMeasurementMaster.name).all()


@router.post("", response_model=MeasurementMasterOut, status_code=201)
def create_measurement(
    body: MeasurementMasterCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = InvMeasurementMaster(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=MeasurementMasterOut)
def update_measurement(
    item_id: int,
    body: MeasurementMasterUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvMeasurementMaster, item_id)
    if not row:
        raise HTTPException(404, "Measurement not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{item_id}/toggle", response_model=MeasurementMasterOut)
def toggle_measurement(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvMeasurementMaster, item_id)
    if not row:
        raise HTTPException(404, "Measurement not found.")
    row.is_active = not row.is_active
    db.commit()
    db.refresh(row)
    out = MeasurementMasterOut.model_validate(row)
    out.message = f"{row.name} {'activated' if row.is_active else 'deactivated'}."
    return out
