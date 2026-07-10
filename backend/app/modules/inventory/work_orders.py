"""Inventory – Requests -> Work Orders -> Execution (Phase 5).

Flow: a schedule (Planned) or a direct equipment/instrument pick (Unplanned /
Breakdown) is Raised into a work order. The work order is then Started, its
checklist filled in, Ended, Verified, and Approved — each of the last two
steps re-authenticates the acting user's password (electronic signature) via
the existing /api/auth/verify-password mechanism, reused here directly.
"""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.utils import verify_password
from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvCalibrationReference,
    InvChecklist,
    InvChecklistItem,
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
    InvInstrumentParameter,
    InvLogMapping,
    InvMeasurementMaster,
    InvSchedule,
    InvSparePart,
    InvWorkOrder,
    InvWorkOrderResult,
    InvWorkOrderSignature,
    InvWorkOrderSpare,
)
from app.schemas.inventory import (
    CalibrationReferenceCreate,
    CalibrationReferenceOut,
    WorkOrderBreakdownDetails,
    WorkOrderCommentAction,
    WorkOrderDetailOut,
    WorkOrderOut,
    WorkOrderRaise,
    WorkOrderResultSave,
    WorkOrderVerifyAction,
)
from app.shared.inv_audit import write_inv_audit
from app.modules.inventory.schedules import SCHEDULE_MONTHS, _add_months

router = APIRouter(prefix="/inventory/work-orders", tags=["inventory-work-orders"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _catalogue_item(db: Session, wo: InvWorkOrder):
    if wo.target_kind == "EQUIPMENT":
        return db.get(InvEquipmentCatalogue, wo.equipment_id) if wo.equipment_id else None
    return db.get(InvInstrumentCatalogue, wo.instrument_id) if wo.instrument_id else None


def _to_out(db: Session, wo: InvWorkOrder) -> dict:
    item = _catalogue_item(db, wo)
    cl = db.get(InvChecklist, wo.checklist_id) if wo.checklist_id else None
    return {
        "id": wo.id, "workorder_no": wo.workorder_no, "target_kind": wo.target_kind,
        "equipment_id": wo.equipment_id, "instrument_id": wo.instrument_id,
        "equipment_code": item.asset_id if item else None,
        "schedule_id": wo.schedule_id, "checklist_id": wo.checklist_id,
        "checklist_name": cl.name if cl else None,
        "kind": wo.kind, "log_type": wo.log_type, "status": wo.status,
        "deviation": wo.deviation, "remarks": wo.remarks,
        "maintenance_type": wo.maintenance_type,
        "breakdown_description": wo.breakdown_description, "spare_parts_used": wo.spare_parts_used,
        "calibration_source": wo.calibration_source, "certificate_no": wo.certificate_no,
        "raised_by": wo.raised_by, "raised_at": wo.raised_at,
        "started_by": wo.started_by, "started_at": wo.started_at,
        "ended_by": wo.ended_by, "ended_at": wo.ended_at,
        "verified_by": wo.verified_by, "verified_at": wo.verified_at,
        "approved_by": wo.approved_by, "approved_at": wo.approved_at,
        "created_at": wo.created_at, "updated_at": wo.updated_at,
    }


def _to_detail(db: Session, wo: InvWorkOrder) -> dict:
    out = _to_out(db, wo)
    items = []
    if wo.checklist_id:
        items = (
            db.query(InvChecklistItem)
            .filter_by(checklist_id=wo.checklist_id)
            .order_by(InvChecklistItem.seq_no)
            .all()
        )
    out["results"] = wo.results
    out["signatures"] = wo.signatures
    out["spares_used"] = wo.spares_used
    out["checklist_items"] = items
    out["calib_references"] = wo.calib_references
    return out


def _next_workorder_no(db: Session, target_kind: str) -> str:
    prefix = "MO" if target_kind == "EQUIPMENT" else "IO"
    year = datetime.date.today().year
    count = (
        db.query(func.count(InvWorkOrder.id))
        .filter(InvWorkOrder.workorder_no.like(f"{prefix}/%/{year}"))
        .scalar()
    ) or 0
    return f"{prefix}/{count + 1:03d}/{year}"


def _sign(db: Session, wo: InvWorkOrder, *, signing_for: str, name: str, comments: Optional[str] = None):
    db.add(InvWorkOrderSignature(work_order_id=wo.id, signing_for=signing_for, name=name, comments=comments))


# ── Requests: PLANNED (from schedules) / UNPLANNED / BREAKDOWN (direct pick) ──
@router.get("/requests")
def list_requests(
    kind: str = Query(..., description="PLANNED, UNPLANNED or BREAKDOWN"),
    target_kind: str = Query(..., description="EQUIPMENT or INSTRUMENT"),
    log_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    open_statuses = ("RAISED", "IN_PROGRESS", "PENDING_VERIFICATION", "PENDING_APPROVAL")

    if kind == "PLANNED":
        q = db.query(InvSchedule).filter(InvSchedule.target_kind == target_kind, InvSchedule.status != "DONE")
        if log_type:
            q = q.filter(InvSchedule.log_type == log_type)
        open_schedule_ids = {
            r[0] for r in db.query(InvWorkOrder.schedule_id).filter(
                InvWorkOrder.schedule_id.isnot(None), InvWorkOrder.status.in_(open_statuses)
            ).all()
        }
        from app.modules.inventory.schedules import _to_out as schedule_to_out
        rows = [schedule_to_out(db, s) for s in q.order_by(InvSchedule.due_date).all() if s.id not in open_schedule_ids]
        return rows

    # UNPLANNED / BREAKDOWN — direct catalogue pick, any item (optionally minus ones with an open work order)
    Model = InvEquipmentCatalogue if target_kind == "EQUIPMENT" else InvInstrumentCatalogue
    id_field = InvWorkOrder.equipment_id if target_kind == "EQUIPMENT" else InvWorkOrder.instrument_id
    open_ids = {
        r[0] for r in db.query(id_field).filter(
            id_field.isnot(None), InvWorkOrder.kind == kind, InvWorkOrder.status.in_(open_statuses)
        ).all()
    }
    items = db.query(Model).filter(Model.is_active.is_(True)).order_by(Model.asset_id).all()
    return [
        {
            "id": it.id, "asset_id": it.asset_id, "name": it.name,
            "status": it.status, "has_open_request": it.id in open_ids,
        }
        for it in items
    ]


@router.post("", response_model=WorkOrderDetailOut, status_code=201)
def raise_work_order(
    body: WorkOrderRaise,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if body.kind not in ("PLANNED", "UNPLANNED", "BREAKDOWN"):
        raise HTTPException(400, "kind must be PLANNED, UNPLANNED or BREAKDOWN.")

    schedule = None
    if body.schedule_id:
        schedule = db.get(InvSchedule, body.schedule_id)
        if not schedule:
            raise HTTPException(404, "Schedule not found.")
        target_kind, equipment_id, instrument_id = schedule.target_kind, schedule.equipment_id, schedule.instrument_id
        log_type = schedule.log_type
        checklist_id = schedule.checklist_id
    else:
        if bool(body.equipment_id) == bool(body.instrument_id):
            raise HTTPException(400, "Provide exactly one of equipment_id or instrument_id.")
        target_kind = "EQUIPMENT" if body.equipment_id else "INSTRUMENT"
        equipment_id, instrument_id = body.equipment_id, body.instrument_id
        log_type = body.log_type
        mapping = db.query(InvLogMapping).filter_by(
            equipment_id=equipment_id, instrument_id=instrument_id, log_type=log_type,
        ).first()
        checklist_id = mapping.checklist_id if mapping else None

    calibration_source = body.calibration_source if (target_kind == "INSTRUMENT" and log_type == "CALIBRATION") else None
    if calibration_source and calibration_source not in ("INTERNAL", "EXTERNAL"):
        raise HTTPException(400, "calibration_source must be INTERNAL or EXTERNAL.")

    wo = InvWorkOrder(
        workorder_no=_next_workorder_no(db, target_kind), target_kind=target_kind,
        equipment_id=equipment_id, instrument_id=instrument_id,
        schedule_id=schedule.id if schedule else None, checklist_id=checklist_id,
        kind=body.kind, log_type=log_type, status="RAISED",
        deviation=body.deviation, remarks=body.remarks, calibration_source=calibration_source,
        raised_by=_user_ref(current_user), raised_at=datetime.datetime.utcnow(),
    )
    db.add(wo)
    db.flush()
    if schedule:
        schedule.status = "PLANNED"
    write_inv_audit(
        db, event_type="WORKORDER_RAISED", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=_user_ref(current_user), details=body.remarks,
    )
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


@router.get("", response_model=list[WorkOrderOut])
def list_work_orders(
    kind: Optional[str] = Query(None),
    target_kind: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvWorkOrder)
    if kind:
        q = q.filter(InvWorkOrder.kind == kind)
    if target_kind:
        q = q.filter(InvWorkOrder.target_kind == target_kind)
    if status:
        q = q.filter(InvWorkOrder.status == status)
    if search:
        q = q.filter(InvWorkOrder.workorder_no.ilike(f"%{search}%"))
    rows = q.order_by(InvWorkOrder.id.desc()).all()
    return [_to_out(db, r) for r in rows]


@router.get("/{wo_id}", response_model=WorkOrderDetailOut)
def get_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    return _to_detail(db, wo)


def _require_status(wo: InvWorkOrder, expected: str, action: str):
    if wo.status != expected:
        raise HTTPException(409, f"Work order must be {expected} to {action} (currently {wo.status}).")


@router.post("/{wo_id}/start", response_model=WorkOrderDetailOut)
def start_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    _require_status(wo, "RAISED", "start")
    wo.status = "IN_PROGRESS"
    wo.started_by = _user_ref(current_user)
    wo.started_at = datetime.datetime.utcnow()
    _sign(db, wo, signing_for="Started By", name=wo.started_by, comments="Started Successfully")
    write_inv_audit(
        db, event_type="WORKORDER_STARTED", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=wo.started_by,
    )
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


@router.put("/{wo_id}/results", response_model=WorkOrderDetailOut)
def save_results(
    wo_id: int,
    body: list[WorkOrderResultSave],
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    if wo.status != "IN_PROGRESS":
        raise HTTPException(409, "Work order must be IN_PROGRESS to record observations.")
    user = _user_ref(current_user)
    now = datetime.datetime.utcnow()
    for item in body:
        existing = None
        if item.checklist_item_id:
            existing = db.query(InvWorkOrderResult).filter_by(
                work_order_id=wo_id, checklist_item_id=item.checklist_item_id
            ).first()
        if existing:
            existing.observation, existing.comment = item.observation, item.comment
            existing.done_by, existing.done_at = user, now
        else:
            db.add(InvWorkOrderResult(
                work_order_id=wo_id, checklist_item_id=item.checklist_item_id,
                observation=item.observation, comment=item.comment, done_by=user, done_at=now,
            ))
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


@router.post("/{wo_id}/end", response_model=WorkOrderDetailOut)
def end_work_order(
    wo_id: int,
    body: WorkOrderCommentAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    _require_status(wo, "IN_PROGRESS", "end")
    wo.status = "PENDING_VERIFICATION"
    wo.ended_by = _user_ref(current_user)
    wo.ended_at = datetime.datetime.utcnow()
    if body.certificate_no:
        wo.certificate_no = body.certificate_no
    _sign(db, wo, signing_for="Ended By", name=wo.ended_by, comments=body.comment or "Ended Successfully")
    write_inv_audit(
        db, event_type="WORKORDER_ENDED", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=wo.ended_by,
    )
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


def _reauth(current_user, password: str):
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(401, "Incorrect password.")


@router.post("/{wo_id}/verify", response_model=WorkOrderDetailOut)
def verify_work_order(
    wo_id: int,
    body: WorkOrderVerifyAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    _require_status(wo, "PENDING_VERIFICATION", "verify")
    _reauth(current_user, body.password)
    wo.status = "PENDING_APPROVAL"
    wo.verified_by = _user_ref(current_user)
    wo.verified_at = datetime.datetime.utcnow()
    if body.maintenance_type:
        wo.maintenance_type = body.maintenance_type
    _sign(db, wo, signing_for="Verified By", name=wo.verified_by, comments=body.comment)
    write_inv_audit(
        db, event_type="WORKORDER_VERIFIED", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=wo.verified_by, details=body.comment,
    )
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


@router.post("/{wo_id}/approve", response_model=WorkOrderDetailOut)
def approve_work_order(
    wo_id: int,
    body: WorkOrderVerifyAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    _require_status(wo, "PENDING_APPROVAL", "approve")
    _reauth(current_user, body.password)
    wo.status = "APPROVED"
    wo.approved_by = _user_ref(current_user)
    wo.approved_at = datetime.datetime.utcnow()
    _sign(db, wo, signing_for="Approved By", name=wo.approved_by, comments=body.comment)
    write_inv_audit(
        db, event_type="WORKORDER_APPROVED", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=wo.approved_by, details=body.comment,
    )

    if wo.schedule_id:
        schedule = db.get(InvSchedule, wo.schedule_id)
        if schedule and schedule.status != "DONE":
            schedule.done_on = datetime.date.today()
            schedule.status = "DONE"
            months = SCHEDULE_MONTHS.get(schedule.schedule_type, 1)
            db.add(InvSchedule(
                target_kind=schedule.target_kind, equipment_id=schedule.equipment_id,
                instrument_id=schedule.instrument_id, log_type=schedule.log_type,
                checklist_id=schedule.checklist_id, schedule_type=schedule.schedule_type,
                due_date=_add_months(schedule.due_date, months), tolerance_days=schedule.tolerance_days,
                alert_limit=schedule.alert_limit, deviation_limit=schedule.deviation_limit,
                status="DUE", source="AUTO_GENERATED", created_by=wo.approved_by,
            ))

    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


@router.post("/{wo_id}/reinitiate", response_model=WorkOrderDetailOut)
def reinitiate_work_order(
    wo_id: int,
    body: WorkOrderCommentAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    if wo.status not in ("IN_PROGRESS", "PENDING_VERIFICATION", "PENDING_APPROVAL"):
        raise HTTPException(409, "Only in-progress or pending-review work orders can be re-initiated.")
    old = wo.status
    wo.status = "RAISED"
    write_inv_audit(
        db, event_type="WORKORDER_REINITIATED", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=_user_ref(current_user),
        old_value=old, new_value="RAISED", details=body.comment,
    )
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


@router.post("/{wo_id}/breakdown-details", response_model=WorkOrderDetailOut)
def save_breakdown_details(
    wo_id: int,
    body: WorkOrderBreakdownDetails,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    if wo.kind != "BREAKDOWN":
        raise HTTPException(400, "Only breakdown work orders accept breakdown details.")
    wo.breakdown_description = body.description
    wo.spare_parts_used = body.spare_parts_used
    for code in body.part_codes:
        part = db.query(InvSparePart).filter_by(part_code=code).first()
        db.add(InvWorkOrderSpare(work_order_id=wo.id, spare_part_id=part.id if part else None, part_code=code))
    _sign(db, wo, signing_for="Breakdown Equipment Maintenance Request", name=_user_ref(current_user), comments="ok")
    write_inv_audit(
        db, event_type="WORKORDER_BREAKDOWN_DETAILS", entity_type="inv_work_order", entity_id=wo.id,
        entity_ref=wo.workorder_no, performed_by=_user_ref(current_user), details=body.description,
    )
    db.commit()
    db.refresh(wo)
    return _to_detail(db, wo)


# ── Calibration Reference Details (Phase 6) ───────────────────────────────────
@router.post("/{wo_id}/calibration-references", response_model=CalibrationReferenceOut, status_code=201)
def add_calibration_reference(
    wo_id: int,
    body: CalibrationReferenceCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    wo = db.get(InvWorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found.")
    if wo.target_kind != "INSTRUMENT" or wo.log_type != "CALIBRATION":
        raise HTTPException(400, "Calibration references only apply to instrument calibration work orders.")

    measurement_name = None
    tolerance_pct = None
    if body.measurement_id:
        m = db.get(InvMeasurementMaster, body.measurement_id)
        measurement_name = m.name if m else None
        param = db.query(InvInstrumentParameter).filter_by(
            instrument_id=wo.instrument_id, measurement_id=body.measurement_id,
        ).first()
        tolerance_pct = param.calibration_tolerance_pct if param else None

    if body.reference_reading:
        variance_pct = abs(body.instrument_reading - body.reference_reading) / abs(body.reference_reading) * 100
    else:
        variance_pct = None
    status = None
    if variance_pct is not None and tolerance_pct is not None:
        status = "PASS" if variance_pct <= tolerance_pct else "FAIL"

    row = InvCalibrationReference(
        work_order_id=wo_id, measurement_id=body.measurement_id, measurement_name=measurement_name,
        reference_inst_id=body.reference_inst_id, reference_reading=body.reference_reading,
        instrument_reading=body.instrument_reading, variance_pct=variance_pct, tolerance_pct=tolerance_pct,
        status=status, done_by=_user_ref(current_user), done_at=datetime.datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/calibration-references/{ref_id}", status_code=204)
def delete_calibration_reference(
    ref_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvCalibrationReference, ref_id)
    if not row:
        raise HTTPException(404, "Calibration reference not found.")
    db.delete(row)
    db.commit()
