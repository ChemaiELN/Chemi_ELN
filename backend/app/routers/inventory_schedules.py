"""
Inventory Master — Maintenance / Calibration Schedules + Equipment / Instrument
Verification router.  Four sub-routers, each registered at its own prefix.

  Maintenance Schedules      /api/inventory/maintenance-schedules
  Calibration Schedules      /api/inventory/calibration-schedules
  Equipment Verifications    /api/inventory/equipment-verifications
  Instrument Verifications   /api/inventory/instrument-verifications

Maintenance Schedules:
  GET    ""              list (equipment_id, status)
  GET    "/{id}"         single
  POST   ""              create
  PATCH  "/{id}"         update
  PATCH  "/{id}/complete"  mark completed → updates equipment.last_maintenance_date
  PATCH  "/{id}/cancel"    cancel

Calibration Schedules:
  GET    ""              list (instrument_id, status)
  GET    "/{id}"         single
  POST   ""              create
  PATCH  "/{id}"         update
  PATCH  "/{id}/complete"  mark completed → updates instrument.last_calibration_date
  PATCH  "/{id}/cancel"    cancel

Equipment / Instrument Verifications (identical pattern):
  GET    ""              list (equipment_id / instrument_id, status)
  GET    "/{id}"         single
  POST   ""              create / request
  PATCH  "/{id}/verify"  approve
  PATCH  "/{id}/reject"  reject
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_equipment import (
    InvMaintenanceSchedule, InvCalibrationSchedule,
    InvEquipmentVerification, InvInstrumentVerification,
    InvEquipmentCatalogue, InvInstrumentCatalogue,
    InvAuditTrail,
)
from app.schemas.inventory_schedules import (
    MaintenanceScheduleCreate, MaintenanceScheduleUpdate,
    MaintenanceCompleteRequest, MaintenanceScheduleOut,
    CalibrationScheduleCreate, CalibrationScheduleUpdate,
    CalibrationCompleteRequest, CalibrationScheduleOut,
    EquipVerificationCreate, VerificationDecision, EquipVerificationOut,
    InstrVerificationCreate, InstrVerificationOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

maint_router     = APIRouter()
calib_router     = APIRouter()
equip_ver_router = APIRouter()
instr_ver_router = APIRouter()


# ── shared audit ─────────────────────────────────────────────────────────────

def _audit(db, user, event_type, entity_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type=entity_type,
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ═══════════════════════════════════════════════════════════════════════════════
# MAINTENANCE SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════

def _ms_or_404(db: Session, ms_id: int) -> InvMaintenanceSchedule:
    obj = (
        db.query(InvMaintenanceSchedule)
        .options(joinedload(InvMaintenanceSchedule.equipment))
        .filter(InvMaintenanceSchedule.id == ms_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    return obj


def _enrich_ms(obj: InvMaintenanceSchedule) -> MaintenanceScheduleOut:
    out = MaintenanceScheduleOut.model_validate(obj)
    if obj.equipment:
        out.equipment_asset_id = obj.equipment.asset_id
        out.equipment_name     = obj.equipment.name
    return out


@maint_router.get("", response_model=List[MaintenanceScheduleOut])
def list_maintenance_schedules(
    equipment_id:  Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = db.query(InvMaintenanceSchedule).options(
        joinedload(InvMaintenanceSchedule.equipment)
    )
    if equipment_id:
        q = q.filter(InvMaintenanceSchedule.equipment_id == equipment_id)
    if status_filter:
        q = q.filter(InvMaintenanceSchedule.status == status_filter.upper())
    return [_enrich_ms(obj) for obj in q.order_by(InvMaintenanceSchedule.scheduled_date).all()]


@maint_router.get("/{ms_id}", response_model=MaintenanceScheduleOut)
def get_maintenance_schedule(
    ms_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_ms(_ms_or_404(db, ms_id))


@maint_router.post("", response_model=MaintenanceScheduleOut, status_code=http_status.HTTP_201_CREATED)
def create_maintenance_schedule(
    body:         MaintenanceScheduleCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    eq = db.query(InvEquipmentCatalogue).filter(
        InvEquipmentCatalogue.id == body.equipment_id
    ).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    obj = InvMaintenanceSchedule(**body.model_dump(), status="DUE")
    db.add(obj)
    db.flush()
    _audit(db, current_user, "MAINT_SCHEDULE_CREATED", "maintenance_schedule",
           obj.id, eq.asset_id,
           details=f"Type: {obj.maintenance_type}, date: {obj.scheduled_date}")
    db.commit()
    return _enrich_ms(_ms_or_404(db, obj.id))


@maint_router.patch("/{ms_id}", response_model=MaintenanceScheduleOut)
def update_maintenance_schedule(
    ms_id:        int,
    body:         MaintenanceScheduleUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ms_or_404(db, ms_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "MAINT_SCHEDULE_UPDATED", "maintenance_schedule",
           obj.id, obj.equipment.asset_id if obj.equipment else str(ms_id),
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    return _enrich_ms(_ms_or_404(db, ms_id))


@maint_router.patch("/{ms_id}/complete", response_model=MaintenanceScheduleOut)
def complete_maintenance_schedule(
    ms_id:        int,
    body:         MaintenanceCompleteRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ms_or_404(db, ms_id)
    if obj.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Schedule already completed")
    if obj.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cannot complete a cancelled schedule")

    obj.status         = "COMPLETED"
    obj.completed_date = body.completed_date
    if body.technician:
        obj.technician = body.technician
    if body.notes:
        obj.notes = body.notes

    # Propagate to equipment catalogue
    if obj.equipment:
        obj.equipment.last_maintenance_date = body.completed_date
        obj.equipment.maintenance_status    = "OK"

    _audit(db, current_user, "MAINT_SCHEDULE_COMPLETED", "maintenance_schedule",
           obj.id, obj.equipment.asset_id if obj.equipment else str(ms_id),
           details=f"Completed on {body.completed_date} by {body.technician or current_user.username}")
    db.commit()
    return _enrich_ms(_ms_or_404(db, ms_id))


@maint_router.patch("/{ms_id}/cancel", response_model=MaintenanceScheduleOut)
def cancel_maintenance_schedule(
    ms_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ms_or_404(db, ms_id)
    if obj.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a schedule with status '{obj.status}'")
    obj.status = "CANCELLED"
    _audit(db, current_user, "MAINT_SCHEDULE_CANCELLED", "maintenance_schedule",
           obj.id, obj.equipment.asset_id if obj.equipment else str(ms_id))
    db.commit()
    return _enrich_ms(_ms_or_404(db, ms_id))


# ═══════════════════════════════════════════════════════════════════════════════
# CALIBRATION SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════

def _cs_or_404(db: Session, cs_id: int) -> InvCalibrationSchedule:
    obj = (
        db.query(InvCalibrationSchedule)
        .options(joinedload(InvCalibrationSchedule.instrument))
        .filter(InvCalibrationSchedule.id == cs_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Calibration schedule not found")
    return obj


def _enrich_cs(obj: InvCalibrationSchedule) -> CalibrationScheduleOut:
    out = CalibrationScheduleOut.model_validate(obj)
    if obj.instrument:
        out.instrument_asset_id = obj.instrument.asset_id
        out.instrument_name     = obj.instrument.name
    return out


@calib_router.get("", response_model=List[CalibrationScheduleOut])
def list_calibration_schedules(
    instrument_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = db.query(InvCalibrationSchedule).options(
        joinedload(InvCalibrationSchedule.instrument)
    )
    if instrument_id:
        q = q.filter(InvCalibrationSchedule.instrument_id == instrument_id)
    if status_filter:
        q = q.filter(InvCalibrationSchedule.status == status_filter.upper())
    return [_enrich_cs(obj) for obj in q.order_by(InvCalibrationSchedule.scheduled_date).all()]


@calib_router.get("/{cs_id}", response_model=CalibrationScheduleOut)
def get_calibration_schedule(
    cs_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_cs(_cs_or_404(db, cs_id))


@calib_router.post("", response_model=CalibrationScheduleOut, status_code=http_status.HTTP_201_CREATED)
def create_calibration_schedule(
    body:         CalibrationScheduleCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    instr = db.query(InvInstrumentCatalogue).filter(
        InvInstrumentCatalogue.id == body.instrument_id
    ).first()
    if not instr:
        raise HTTPException(status_code=404, detail="Instrument not found")

    obj = InvCalibrationSchedule(**body.model_dump(), status="DUE")
    db.add(obj)
    db.flush()
    _audit(db, current_user, "CALIB_SCHEDULE_CREATED", "calibration_schedule",
           obj.id, instr.asset_id,
           details=f"Type: {obj.calibration_type}, date: {obj.scheduled_date}")
    db.commit()
    return _enrich_cs(_cs_or_404(db, obj.id))


@calib_router.patch("/{cs_id}", response_model=CalibrationScheduleOut)
def update_calibration_schedule(
    cs_id:        int,
    body:         CalibrationScheduleUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _cs_or_404(db, cs_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "CALIB_SCHEDULE_UPDATED", "calibration_schedule",
           obj.id, obj.instrument.asset_id if obj.instrument else str(cs_id),
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    return _enrich_cs(_cs_or_404(db, cs_id))


@calib_router.patch("/{cs_id}/complete", response_model=CalibrationScheduleOut)
def complete_calibration_schedule(
    cs_id:        int,
    body:         CalibrationCompleteRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _cs_or_404(db, cs_id)
    if obj.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Schedule already completed")
    if obj.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cannot complete a cancelled schedule")

    obj.status         = "COMPLETED"
    obj.completed_date = body.completed_date
    if body.technician:
        obj.technician = body.technician
    if body.certificate_no:
        obj.certificate_no = body.certificate_no
    if body.notes:
        obj.notes = body.notes

    # Propagate to instrument catalogue
    if obj.instrument:
        obj.instrument.last_calibration_date = body.completed_date
        obj.instrument.calibration_status    = "OK"

    _audit(db, current_user, "CALIB_SCHEDULE_COMPLETED", "calibration_schedule",
           obj.id, obj.instrument.asset_id if obj.instrument else str(cs_id),
           details=f"Completed {body.completed_date}, cert: {body.certificate_no or '-'}")
    db.commit()
    return _enrich_cs(_cs_or_404(db, cs_id))


@calib_router.patch("/{cs_id}/cancel", response_model=CalibrationScheduleOut)
def cancel_calibration_schedule(
    cs_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _cs_or_404(db, cs_id)
    if obj.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a schedule with status '{obj.status}'")
    obj.status = "CANCELLED"
    _audit(db, current_user, "CALIB_SCHEDULE_CANCELLED", "calibration_schedule",
           obj.id, obj.instrument.asset_id if obj.instrument else str(cs_id))
    db.commit()
    return _enrich_cs(_cs_or_404(db, cs_id))


# ═══════════════════════════════════════════════════════════════════════════════
# EQUIPMENT VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _ev_or_404(db: Session, ev_id: int) -> InvEquipmentVerification:
    obj = (
        db.query(InvEquipmentVerification)
        .options(joinedload(InvEquipmentVerification.equipment))
        .filter(InvEquipmentVerification.id == ev_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Equipment verification not found")
    return obj


def _enrich_ev(obj: InvEquipmentVerification) -> EquipVerificationOut:
    out = EquipVerificationOut.model_validate(obj)
    if obj.equipment:
        out.equipment_asset_id = obj.equipment.asset_id
        out.equipment_name     = obj.equipment.name
    return out


@equip_ver_router.get("", response_model=List[EquipVerificationOut])
def list_equip_verifications(
    equipment_id:  Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = db.query(InvEquipmentVerification).options(
        joinedload(InvEquipmentVerification.equipment)
    )
    if equipment_id:
        q = q.filter(InvEquipmentVerification.equipment_id == equipment_id)
    if status_filter:
        q = q.filter(InvEquipmentVerification.status == status_filter.upper())
    return [_enrich_ev(obj) for obj in q.order_by(InvEquipmentVerification.requested_at.desc()).all()]


@equip_ver_router.get("/{ev_id}", response_model=EquipVerificationOut)
def get_equip_verification(
    ev_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_ev(_ev_or_404(db, ev_id))


@equip_ver_router.post("", response_model=EquipVerificationOut, status_code=http_status.HTTP_201_CREATED)
def create_equip_verification(
    body:         EquipVerificationCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvEquipmentVerification).filter(
        InvEquipmentVerification.request_no == body.request_no
    ).first():
        raise HTTPException(status_code=400, detail=f"Request no '{body.request_no}' already exists")

    eq = db.query(InvEquipmentCatalogue).filter(
        InvEquipmentCatalogue.id == body.equipment_id
    ).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    obj = InvEquipmentVerification(
        request_no=body.request_no,
        equipment_id=body.equipment_id,
        requested_by=current_user.username,
        status="PENDING",
        remarks=body.remarks,
    )
    db.add(obj)
    db.flush()
    _audit(db, current_user, "EQUIP_VERIFICATION_REQUESTED", "equipment_verification",
           obj.id, body.request_no,
           details=f"Verification requested for {eq.asset_id} — {eq.name}")
    db.commit()
    return _enrich_ev(_ev_or_404(db, obj.id))


@equip_ver_router.patch("/{ev_id}/verify", response_model=EquipVerificationOut)
def verify_equip_verification(
    ev_id:        int,
    body:         VerificationDecision,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ev_or_404(db, ev_id)
    if obj.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot verify a request with status '{obj.status}'")
    obj.status      = "VERIFIED"
    obj.verified_by = current_user.username
    obj.verified_at = datetime.now(timezone.utc)
    if body.remarks:
        obj.remarks = body.remarks
    _audit(db, current_user, "EQUIP_VERIFICATION_APPROVED", "equipment_verification",
           obj.id, obj.request_no,
           details=f"Verified by {current_user.username}")
    db.commit()
    return _enrich_ev(_ev_or_404(db, ev_id))


@equip_ver_router.patch("/{ev_id}/reject", response_model=EquipVerificationOut)
def reject_equip_verification(
    ev_id:        int,
    body:         VerificationDecision,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ev_or_404(db, ev_id)
    if obj.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot reject a request with status '{obj.status}'")
    obj.status      = "REJECTED"
    obj.verified_by = current_user.username
    obj.verified_at = datetime.now(timezone.utc)
    if body.remarks:
        obj.remarks = body.remarks
    _audit(db, current_user, "EQUIP_VERIFICATION_REJECTED", "equipment_verification",
           obj.id, obj.request_no,
           details=f"Rejected by {current_user.username}. Reason: {body.remarks or 'N/A'}")
    db.commit()
    return _enrich_ev(_ev_or_404(db, ev_id))


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _iv_or_404(db: Session, iv_id: int) -> InvInstrumentVerification:
    obj = (
        db.query(InvInstrumentVerification)
        .options(joinedload(InvInstrumentVerification.instrument))
        .filter(InvInstrumentVerification.id == iv_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Instrument verification not found")
    return obj


def _enrich_iv(obj: InvInstrumentVerification) -> InstrVerificationOut:
    out = InstrVerificationOut.model_validate(obj)
    if obj.instrument:
        out.instrument_asset_id = obj.instrument.asset_id
        out.instrument_name     = obj.instrument.name
    return out


@instr_ver_router.get("", response_model=List[InstrVerificationOut])
def list_instr_verifications(
    instrument_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = db.query(InvInstrumentVerification).options(
        joinedload(InvInstrumentVerification.instrument)
    )
    if instrument_id:
        q = q.filter(InvInstrumentVerification.instrument_id == instrument_id)
    if status_filter:
        q = q.filter(InvInstrumentVerification.status == status_filter.upper())
    return [_enrich_iv(obj) for obj in q.order_by(InvInstrumentVerification.requested_at.desc()).all()]


@instr_ver_router.get("/{iv_id}", response_model=InstrVerificationOut)
def get_instr_verification(
    iv_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_iv(_iv_or_404(db, iv_id))


@instr_ver_router.post("", response_model=InstrVerificationOut, status_code=http_status.HTTP_201_CREATED)
def create_instr_verification(
    body:         InstrVerificationCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvInstrumentVerification).filter(
        InvInstrumentVerification.request_no == body.request_no
    ).first():
        raise HTTPException(status_code=400, detail=f"Request no '{body.request_no}' already exists")

    instr = db.query(InvInstrumentCatalogue).filter(
        InvInstrumentCatalogue.id == body.instrument_id
    ).first()
    if not instr:
        raise HTTPException(status_code=404, detail="Instrument not found")

    obj = InvInstrumentVerification(
        request_no=body.request_no,
        instrument_id=body.instrument_id,
        requested_by=current_user.username,
        status="PENDING",
        remarks=body.remarks,
    )
    db.add(obj)
    db.flush()
    _audit(db, current_user, "INSTR_VERIFICATION_REQUESTED", "instrument_verification",
           obj.id, body.request_no,
           details=f"Verification requested for {instr.asset_id} — {instr.name}")
    db.commit()
    return _enrich_iv(_iv_or_404(db, obj.id))


@instr_ver_router.patch("/{iv_id}/verify", response_model=InstrVerificationOut)
def verify_instr_verification(
    iv_id:        int,
    body:         VerificationDecision,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _iv_or_404(db, iv_id)
    if obj.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot verify a request with status '{obj.status}'")
    obj.status      = "VERIFIED"
    obj.verified_by = current_user.username
    obj.verified_at = datetime.now(timezone.utc)
    if body.remarks:
        obj.remarks = body.remarks
    _audit(db, current_user, "INSTR_VERIFICATION_APPROVED", "instrument_verification",
           obj.id, obj.request_no,
           details=f"Verified by {current_user.username}")
    db.commit()
    return _enrich_iv(_iv_or_404(db, iv_id))


@instr_ver_router.patch("/{iv_id}/reject", response_model=InstrVerificationOut)
def reject_instr_verification(
    iv_id:        int,
    body:         VerificationDecision,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _iv_or_404(db, iv_id)
    if obj.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot reject a request with status '{obj.status}'")
    obj.status      = "REJECTED"
    obj.verified_by = current_user.username
    obj.verified_at = datetime.now(timezone.utc)
    if body.remarks:
        obj.remarks = body.remarks
    _audit(db, current_user, "INSTR_VERIFICATION_REJECTED", "instrument_verification",
           obj.id, obj.request_no,
           details=f"Rejected by {current_user.username}. Reason: {body.remarks or 'N/A'}")
    db.commit()
    return _enrich_iv(_iv_or_404(db, iv_id))
