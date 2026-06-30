"""Inventory – Maintenance and Calibration Schedules."""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvCalibrationSchedule,
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
    InvMaintenanceSchedule,
)
from app.schemas.inventory import (
    CalibrationCompleteRequest,
    CalibrationScheduleCreate,
    CalibrationScheduleOut,
    CalibrationScheduleUpdate,
    MaintenanceCompleteRequest,
    MaintenanceScheduleCreate,
    MaintenanceScheduleOut,
    MaintenanceScheduleUpdate,
)
from app.shared.inv_audit import write_inv_audit

maintenance_router = APIRouter(
    prefix="/inventory/maintenance-schedules", tags=["inventory-maintenance"]
)
calibration_router = APIRouter(
    prefix="/inventory/calibration-schedules", tags=["inventory-calibration"]
)


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


# ── Maintenance ────────────────────────────────────────────────────────────────
@maintenance_router.get("", response_model=list[MaintenanceScheduleOut])
def list_maintenance(
    equipment_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvMaintenanceSchedule)
    if equipment_id is not None:
        q = q.filter(InvMaintenanceSchedule.equipment_id == equipment_id)
    if status:
        q = q.filter(InvMaintenanceSchedule.status == status)
    return q.order_by(InvMaintenanceSchedule.scheduled_date).offset(skip).limit(limit).all()


@maintenance_router.post("", response_model=MaintenanceScheduleOut, status_code=201)
def create_maintenance(
    body: MaintenanceScheduleCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvEquipmentCatalogue, body.equipment_id):
        raise HTTPException(404, "Equipment not found.")
    row = InvMaintenanceSchedule(**body.model_dump())
    db.add(row)
    write_inv_audit(
        db,
        event_type="MAINTENANCE_SCHEDULE_CREATED",
        entity_type="inv_maintenance_schedule",
        entity_id=None,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@maintenance_router.get("/{schedule_id}", response_model=MaintenanceScheduleOut)
def get_maintenance(
    schedule_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvMaintenanceSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Maintenance schedule not found.")
    return row


@maintenance_router.patch("/{schedule_id}", response_model=MaintenanceScheduleOut)
def update_maintenance(
    schedule_id: int,
    body: MaintenanceScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvMaintenanceSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Maintenance schedule not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    write_inv_audit(
        db,
        event_type="MAINTENANCE_SCHEDULE_UPDATED",
        entity_type="inv_maintenance_schedule",
        entity_id=schedule_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@maintenance_router.patch("/{schedule_id}/complete", response_model=MaintenanceScheduleOut)
def complete_maintenance(
    schedule_id: int,
    body: MaintenanceCompleteRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvMaintenanceSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Maintenance schedule not found.")
    if row.status == "COMPLETED":
        raise HTTPException(400, "Schedule is already completed.")
    row.status = "COMPLETED"
    row.completed_date = body.completed_date
    if body.notes:
        row.notes = body.notes
    # propagate to equipment catalogue
    equip = db.get(InvEquipmentCatalogue, row.equipment_id)
    if equip:
        equip.last_maintenance_date = body.completed_date
        equip.maintenance_status = "OK"
    write_inv_audit(
        db,
        event_type="MAINTENANCE_COMPLETED",
        entity_type="inv_maintenance_schedule",
        entity_id=schedule_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@maintenance_router.patch("/{schedule_id}/cancel", response_model=MaintenanceScheduleOut)
def cancel_maintenance(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvMaintenanceSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Maintenance schedule not found.")
    row.status = "CANCELLED"
    write_inv_audit(
        db,
        event_type="MAINTENANCE_CANCELLED",
        entity_type="inv_maintenance_schedule",
        entity_id=schedule_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


# ── Calibration ────────────────────────────────────────────────────────────────
@calibration_router.get("", response_model=list[CalibrationScheduleOut])
def list_calibration(
    instrument_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvCalibrationSchedule)
    if instrument_id is not None:
        q = q.filter(InvCalibrationSchedule.instrument_id == instrument_id)
    if status:
        q = q.filter(InvCalibrationSchedule.status == status)
    return q.order_by(InvCalibrationSchedule.scheduled_date).offset(skip).limit(limit).all()


@calibration_router.post("", response_model=CalibrationScheduleOut, status_code=201)
def create_calibration(
    body: CalibrationScheduleCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvInstrumentCatalogue, body.instrument_id):
        raise HTTPException(404, "Instrument not found.")
    row = InvCalibrationSchedule(**body.model_dump())
    db.add(row)
    write_inv_audit(
        db,
        event_type="CALIBRATION_SCHEDULE_CREATED",
        entity_type="inv_calibration_schedule",
        entity_id=None,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@calibration_router.get("/{schedule_id}", response_model=CalibrationScheduleOut)
def get_calibration(
    schedule_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvCalibrationSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Calibration schedule not found.")
    return row


@calibration_router.patch("/{schedule_id}", response_model=CalibrationScheduleOut)
def update_calibration(
    schedule_id: int,
    body: CalibrationScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvCalibrationSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Calibration schedule not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    write_inv_audit(
        db,
        event_type="CALIBRATION_SCHEDULE_UPDATED",
        entity_type="inv_calibration_schedule",
        entity_id=schedule_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@calibration_router.patch("/{schedule_id}/complete", response_model=CalibrationScheduleOut)
def complete_calibration(
    schedule_id: int,
    body: CalibrationCompleteRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvCalibrationSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Calibration schedule not found.")
    if row.status == "COMPLETED":
        raise HTTPException(400, "Schedule is already completed.")
    row.status = "COMPLETED"
    row.completed_date = body.completed_date
    if body.certificate_no:
        row.certificate_no = body.certificate_no
    # propagate to instrument catalogue
    instr = db.get(InvInstrumentCatalogue, row.instrument_id)
    if instr:
        instr.last_calibration_date = body.completed_date
        instr.calibration_status = "OK"
    write_inv_audit(
        db,
        event_type="CALIBRATION_COMPLETED",
        entity_type="inv_calibration_schedule",
        entity_id=schedule_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@calibration_router.patch("/{schedule_id}/cancel", response_model=CalibrationScheduleOut)
def cancel_calibration(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvCalibrationSchedule, schedule_id)
    if not row:
        raise HTTPException(404, "Calibration schedule not found.")
    row.status = "CANCELLED"
    write_inv_audit(
        db,
        event_type="CALIBRATION_CANCELLED",
        entity_type="inv_calibration_schedule",
        entity_id=schedule_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row
