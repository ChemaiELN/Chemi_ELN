"""Inventory – Reports endpoints."""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvBatch,
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
    InvMaterial,
    InvStockRequest,
    InvUsageLog,
    InvWorkOrder,
)

router = APIRouter(prefix="/inventory/reports", tags=["inventory-reports"])


@router.get("/batch-inventory")
def batch_inventory_report(
    material_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvBatch)
    if material_id:
        q = q.filter(InvBatch.material_id == material_id)
    if status:
        q = q.filter(InvBatch.status == status)
    batches = q.order_by(InvBatch.id.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": b.id,
            "batch_no": b.batch_no,
            "inhouse_batch_no": b.inhouse_batch_no,
            "material_id": b.material_id,
            "manufacturer_id": b.manufacturer_id,
            "qty_received": float(b.qty_received),
            "qty_available": float(b.qty_available),
            "unit": b.unit,
            "status": b.status,
            "category": b.category,
            "mfg_date": b.mfg_date.isoformat() if b.mfg_date else None,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "gr_date": b.gr_date.isoformat() if b.gr_date else None,
        }
        for b in batches
    ]


@router.get("/expiry")
def expiry_report(
    expired_only: bool = Query(False),
    days_ahead: int = Query(90),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    today = datetime.date.today()
    cutoff = today + datetime.timedelta(days=days_ahead)
    q = db.query(InvBatch).filter(InvBatch.expiry_date != None)
    if expired_only:
        q = q.filter(InvBatch.expiry_date < today)
    else:
        q = q.filter(InvBatch.expiry_date <= cutoff)
    batches = q.order_by(InvBatch.expiry_date).offset(skip).limit(limit).all()
    return [
        {
            "id": b.id,
            "batch_no": b.batch_no,
            "inhouse_batch_no": b.inhouse_batch_no,
            "material_id": b.material_id,
            "qty_available": float(b.qty_available),
            "unit": b.unit,
            "status": b.status,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "is_expired": b.expiry_date < today if b.expiry_date else False,
        }
        for b in batches
    ]


@router.get("/stock-requests")
def stock_requests_report(
    status: Optional[str] = Query(None),
    criticality: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvStockRequest)
    if status:
        q = q.filter(InvStockRequest.status == status)
    if criticality:
        q = q.filter(InvStockRequest.criticality == criticality)
    rows = q.order_by(InvStockRequest.id.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "request_no": r.request_no,
            "material_id": r.material_id,
            "qty_required": float(r.qty_required),
            "unit": r.unit,
            "criticality": r.criticality,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/equipment-status")
def equipment_status_report(
    status: Optional[str] = Query(None),
    maintenance_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvEquipmentCatalogue)
    if status:
        q = q.filter(InvEquipmentCatalogue.status == status)
    if maintenance_status:
        q = q.filter(InvEquipmentCatalogue.maintenance_status == maintenance_status)
    rows = q.order_by(InvEquipmentCatalogue.asset_id).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "asset_id": r.asset_id,
            "name": r.name,
            "make": r.make,
            "model": r.model,
            "location": r.location,
            "status": r.status,
            "maintenance_status": r.maintenance_status,
            "last_maintenance_date": r.last_maintenance_date.isoformat() if r.last_maintenance_date else None,
            "next_maintenance_date": r.next_maintenance_date.isoformat() if r.next_maintenance_date else None,
        }
        for r in rows
    ]


@router.get("/instrument-status")
def instrument_status_report(
    status: Optional[str] = Query(None),
    calibration_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvInstrumentCatalogue)
    if status:
        q = q.filter(InvInstrumentCatalogue.status == status)
    if calibration_status:
        q = q.filter(InvInstrumentCatalogue.calibration_status == calibration_status)
    rows = q.order_by(InvInstrumentCatalogue.asset_id).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "asset_id": r.asset_id,
            "name": r.name,
            "make": r.make,
            "model": r.model,
            "location": r.location,
            "status": r.status,
            "calibration_status": r.calibration_status,
            "required_calibration": r.required_calibration,
            "last_calibration_date": r.last_calibration_date.isoformat() if r.last_calibration_date else None,
            "next_calibration_date": r.next_calibration_date.isoformat() if r.next_calibration_date else None,
        }
        for r in rows
    ]


@router.get("/work-orders")
def work_orders_report(
    target_kind: Optional[str] = Query(None),
    kind: Optional[str] = Query(None),
    log_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[datetime.date] = Query(None),
    to_date: Optional[datetime.date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvWorkOrder)
    if target_kind:
        q = q.filter(InvWorkOrder.target_kind == target_kind)
    if kind:
        q = q.filter(InvWorkOrder.kind == kind)
    if log_type:
        q = q.filter(InvWorkOrder.log_type == log_type)
    if status:
        q = q.filter(InvWorkOrder.status == status)
    if from_date:
        q = q.filter(InvWorkOrder.raised_at >= datetime.datetime.combine(from_date, datetime.time.min))
    if to_date:
        q = q.filter(InvWorkOrder.raised_at <= datetime.datetime.combine(to_date, datetime.time.max))
    rows = q.order_by(InvWorkOrder.id.desc()).offset(skip).limit(limit).all()

    equipment_ids = [r.equipment_id for r in rows if r.equipment_id]
    instrument_ids = [r.instrument_id for r in rows if r.instrument_id]
    eq_codes = {e.id: e.asset_id for e in db.query(InvEquipmentCatalogue).filter(InvEquipmentCatalogue.id.in_(equipment_ids)).all()} if equipment_ids else {}
    inst_codes = {i.id: i.asset_id for i in db.query(InvInstrumentCatalogue).filter(InvInstrumentCatalogue.id.in_(instrument_ids)).all()} if instrument_ids else {}

    return [
        {
            "id": r.id,
            "workorder_no": r.workorder_no,
            "target_kind": r.target_kind,
            "equipment_code": eq_codes.get(r.equipment_id) or inst_codes.get(r.instrument_id),
            "kind": r.kind,
            "log_type": r.log_type,
            "status": r.status,
            "calibration_source": r.calibration_source,
            "maintenance_type": r.maintenance_type,
            "raised_by": r.raised_by,
            "raised_at": r.raised_at.isoformat() if r.raised_at else None,
            "approved_by": r.approved_by,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
        }
        for r in rows
    ]


@router.get("/usage-summary")
def usage_summary_report(
    target_kind: str = Query(...),
    from_date: Optional[datetime.date] = Query(None),
    to_date: Optional[datetime.date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvUsageLog).filter(InvUsageLog.target_kind == target_kind)
    if from_date:
        q = q.filter(InvUsageLog.started_at >= datetime.datetime.combine(from_date, datetime.time.min))
    if to_date:
        q = q.filter(InvUsageLog.started_at <= datetime.datetime.combine(to_date, datetime.time.max))
    logs = q.all()

    id_field = "equipment_id" if target_kind == "EQUIPMENT" else "instrument_id"
    Model = InvEquipmentCatalogue if target_kind == "EQUIPMENT" else InvInstrumentCatalogue
    codes = {m.id: m.asset_id for m in db.query(Model).all()}

    now = datetime.datetime.now()
    summary: dict[int, dict] = {}
    for log in logs:
        item_id = getattr(log, id_field)
        if item_id is None:
            continue
        entry = summary.setdefault(item_id, {"session_count": 0, "total_seconds": 0, "last_used_at": None})
        entry["session_count"] += 1
        end = log.ended_at or now
        entry["total_seconds"] += max(0, int((end - log.started_at).total_seconds())) if log.started_at else 0
        if log.started_at and (entry["last_used_at"] is None or log.started_at > entry["last_used_at"]):
            entry["last_used_at"] = log.started_at

    rows = sorted(summary.items(), key=lambda kv: codes.get(kv[0], ""))[skip:skip + limit]
    return [
        {
            "id": item_id, "asset_id": codes.get(item_id),
            "session_count": e["session_count"],
            "total_hours": round(e["total_seconds"] / 3600, 2),
            "last_used_at": e["last_used_at"].isoformat() if e["last_used_at"] else None,
        }
        for item_id, e in rows
    ]
