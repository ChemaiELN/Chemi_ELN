"""Inventory – Dashboard KPIs, stock availability, expiring batches, pending actions."""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvBatch,
    InvChecklist,
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
    InvMaterial,
    InvStockRequest,
    InvWorkOrder,
)
from app.schemas.inventory import DashboardKPIs

router = APIRouter(prefix="/inventory/dashboard", tags=["inventory-dashboard"])


@router.get("/kpis", response_model=DashboardKPIs)
def get_kpis(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    today = datetime.date.today()
    soon = today + datetime.timedelta(days=30)

    active_materials = db.query(InvMaterial).filter(InvMaterial.is_active.is_(True)).count()

    available_batches = db.query(InvBatch).filter(
        InvBatch.status.in_(["AVAILABLE", "PARTIALLY_CONSUMED"])
    ).count()

    low_stock = db.query(InvBatch).filter(
        InvBatch.status.in_(["AVAILABLE", "PARTIALLY_CONSUMED"]),
        InvBatch.qty_available > 0,
        InvBatch.qty_available < InvBatch.qty_received * 0.10,
    ).count()

    expiring_soon = db.query(InvBatch).filter(
        InvBatch.expiry_date != None,
        InvBatch.expiry_date <= soon,
        InvBatch.expiry_date >= today,
        InvBatch.qty_available > 0,
    ).count()

    expired = db.query(InvBatch).filter(
        InvBatch.expiry_date != None,
        InvBatch.expiry_date < today,
        InvBatch.qty_available > 0,
    ).count()

    pending_sr = db.query(InvStockRequest).filter(InvStockRequest.status == "PENDING").count()

    critical_sr = db.query(InvStockRequest).filter(
        InvStockRequest.status == "PENDING",
        InvStockRequest.criticality == "CRITICAL",
    ).count()

    in_stock_material_ids = (
        db.query(InvBatch.material_id)
        .filter(InvBatch.status.in_(["AVAILABLE", "PARTIALLY_CONSUMED"]), InvBatch.qty_available > 0)
        .distinct()
        .subquery()
    )
    out_of_stock = db.query(InvMaterial).filter(
        InvMaterial.is_active.is_(True),
        InvMaterial.id.notin_(db.query(in_stock_material_ids.c.material_id)),
    ).count()

    pending_work_orders = db.query(InvWorkOrder).filter(
        InvWorkOrder.status.in_(["PENDING_VERIFICATION", "PENDING_APPROVAL"])
    ).count()
    pending_checklists = db.query(InvChecklist).filter(
        InvChecklist.status.in_(["PENDING_VERIFICATION", "PENDING_APPROVAL"])
    ).count()
    pending_approvals_total = pending_sr + pending_work_orders + pending_checklists

    due_cutoff = today + datetime.timedelta(days=7)
    maintenance_due = db.query(InvEquipmentCatalogue).filter(
        InvEquipmentCatalogue.is_active.is_(True),
        InvEquipmentCatalogue.next_maintenance_date != None,
        InvEquipmentCatalogue.next_maintenance_date <= due_cutoff,
    ).count()
    calibration_due = db.query(InvInstrumentCatalogue).filter(
        InvInstrumentCatalogue.is_active.is_(True),
        InvInstrumentCatalogue.required_calibration.is_(True),
        InvInstrumentCatalogue.next_calibration_date != None,
        InvInstrumentCatalogue.next_calibration_date <= due_cutoff,
    ).count()

    return DashboardKPIs(
        active_materials=active_materials,
        available_batches=available_batches,
        low_stock=low_stock,
        expiring_soon=expiring_soon,
        expired=expired,
        pending_stock_requests=pending_sr,
        critical_stock_requests=critical_sr,
        out_of_stock=out_of_stock,
        pending_approvals_total=pending_approvals_total,
        maintenance_due=maintenance_due,
        calibration_due=calibration_due,
    )


@router.get("/available-stock")
def available_stock(
    material_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = (
        db.query(
            InvMaterial.id.label("material_id"),
            InvMaterial.code,
            InvMaterial.name,
            func.coalesce(func.sum(InvBatch.qty_available), 0).label("total_qty_available"),
            func.count(InvBatch.id).label("batch_count"),
        )
        .outerjoin(InvBatch, (InvBatch.material_id == InvMaterial.id) &
                   InvBatch.status.in_(["AVAILABLE", "PARTIALLY_CONSUMED"]))
        .filter(InvMaterial.is_active.is_(True))
    )
    if material_id is not None:
        q = q.filter(InvMaterial.id == material_id)
    rows = q.group_by(InvMaterial.id, InvMaterial.code, InvMaterial.name).order_by(InvMaterial.name).all()
    return [
        {
            "material_id": r.material_id,
            "code": r.code,
            "name": r.name,
            "total_qty_available": float(r.total_qty_available),
            "batch_count": r.batch_count,
        }
        for r in rows
    ]


@router.get("/expiring-soon")
def expiring_soon(
    days: int = 30,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    today = datetime.date.today()
    cutoff = today + datetime.timedelta(days=days)
    batches = (
        db.query(InvBatch)
        .filter(
            InvBatch.expiry_date != None,
            InvBatch.expiry_date <= cutoff,
            InvBatch.expiry_date >= today,
            InvBatch.qty_available > 0,
        )
        .order_by(InvBatch.expiry_date)
        .all()
    )
    return [
        {
            "id": b.id,
            "batch_no": b.batch_no,
            "inhouse_batch_no": b.inhouse_batch_no,
            "material_id": b.material_id,
            "qty_available": float(b.qty_available),
            "unit": b.unit,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        }
        for b in batches
    ]


@router.get("/pending-actions")
def pending_actions(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    pending_sr = db.query(InvStockRequest).filter(InvStockRequest.status == "PENDING").count()
    return {
        "pending_stock_requests": pending_sr,
    }


@router.get("/pending-approvals")
def pending_approvals(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    now = datetime.datetime.utcnow()
    rows: list[dict] = []

    for sr in db.query(InvStockRequest).filter(InvStockRequest.status == "PENDING").all():
        rows.append({
            "type": "Stock Request",
            "reference_no": sr.request_no,
            "status": sr.status,
            "raised_by": sr.requested_by,
            "raised_at": sr.created_at.isoformat() if sr.created_at else None,
            "age_days": (now - sr.created_at).days if sr.created_at else None,
        })

    for wo in db.query(InvWorkOrder).filter(
        InvWorkOrder.status.in_(["PENDING_VERIFICATION", "PENDING_APPROVAL"])
    ).all():
        rows.append({
            "type": "Work Order",
            "reference_no": wo.workorder_no,
            "status": wo.status,
            "raised_by": wo.raised_by,
            "raised_at": wo.raised_at.isoformat() if wo.raised_at else None,
            "age_days": (now - wo.raised_at).days if wo.raised_at else None,
        })

    for cl in db.query(InvChecklist).filter(
        InvChecklist.status.in_(["PENDING_VERIFICATION", "PENDING_APPROVAL"])
    ).all():
        rows.append({
            "type": "Checklist",
            "reference_no": cl.name,
            "status": cl.status,
            "raised_by": cl.created_by,
            "raised_at": cl.created_at.isoformat() if cl.created_at else None,
            "age_days": (now - cl.created_at).days if cl.created_at else None,
        })

    rows.sort(key=lambda r: r["age_days"] if r["age_days"] is not None else -1, reverse=True)
    return rows


@router.get("/maintenance-calibration-due")
def maintenance_calibration_due(
    days: int = 7,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    today = datetime.date.today()
    cutoff = today + datetime.timedelta(days=days)
    rows: list[dict] = []

    for eq in db.query(InvEquipmentCatalogue).filter(
        InvEquipmentCatalogue.is_active.is_(True),
        InvEquipmentCatalogue.next_maintenance_date != None,
        InvEquipmentCatalogue.next_maintenance_date <= cutoff,
    ).order_by(InvEquipmentCatalogue.next_maintenance_date).all():
        rows.append({
            "type": "Maintenance",
            "asset_code": eq.asset_id,
            "asset_name": eq.name,
            "due_date": eq.next_maintenance_date.isoformat(),
            "days_until_due": (eq.next_maintenance_date - today).days,
        })

    for inst in db.query(InvInstrumentCatalogue).filter(
        InvInstrumentCatalogue.is_active.is_(True),
        InvInstrumentCatalogue.required_calibration.is_(True),
        InvInstrumentCatalogue.next_calibration_date != None,
        InvInstrumentCatalogue.next_calibration_date <= cutoff,
    ).order_by(InvInstrumentCatalogue.next_calibration_date).all():
        rows.append({
            "type": "Calibration",
            "asset_code": inst.asset_id,
            "asset_name": inst.name,
            "due_date": inst.next_calibration_date.isoformat(),
            "days_until_due": (inst.next_calibration_date - today).days,
        })

    rows.sort(key=lambda r: r["due_date"])
    return rows


@router.get("/equipment-status")
def equipment_status(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    eq_rows = (
        db.query(InvEquipmentCatalogue.status, func.count(InvEquipmentCatalogue.id))
        .filter(InvEquipmentCatalogue.is_active.is_(True))
        .group_by(InvEquipmentCatalogue.status)
        .all()
    )
    inst_rows = (
        db.query(InvInstrumentCatalogue.status, func.count(InvInstrumentCatalogue.id))
        .filter(InvInstrumentCatalogue.is_active.is_(True))
        .group_by(InvInstrumentCatalogue.status)
        .all()
    )
    return {
        "equipment": [{"status": s, "count": c} for s, c in eq_rows],
        "instruments": [{"status": s, "count": c} for s, c in inst_rows],
    }


@router.get("/expiry-timeline")
def expiry_timeline(
    months: int = 6,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    today = datetime.date.today()
    cutoff = (today.replace(day=1) + datetime.timedelta(days=32 * months)).replace(day=1)
    batches = db.query(InvBatch.expiry_date, InvBatch.qty_available).filter(
        InvBatch.expiry_date != None,
        InvBatch.expiry_date >= today,
        InvBatch.expiry_date < cutoff,
        InvBatch.qty_available > 0,
    ).all()

    buckets: dict[str, dict[str, float]] = {}
    for expiry_date, qty in batches:
        key = expiry_date.strftime("%Y-%m")
        b = buckets.setdefault(key, {"count": 0, "qty": 0.0})
        b["count"] += 1
        b["qty"] += float(qty or 0)

    return [
        {"month": k, "count": int(v["count"]), "qty": v["qty"]}
        for k, v in sorted(buckets.items())
    ]
