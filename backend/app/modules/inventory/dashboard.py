"""Inventory – Dashboard KPIs, stock availability, expiring batches, pending actions."""
import datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvBatch,
    InvBatchVerification,
    InvCalibrationSchedule,
    InvEquipmentVerification,
    InvInstrumentVerification,
    InvMaintenanceSchedule,
    InvMaterial,
    InvStockRequest,
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

    maintenance_due = db.query(InvMaintenanceSchedule).filter(
        InvMaintenanceSchedule.status.in_(["DUE"])
    ).count()

    calibration_due = db.query(InvCalibrationSchedule).filter(
        InvCalibrationSchedule.status.in_(["DUE"])
    ).count()

    pending_bv = db.query(InvBatchVerification).filter(InvBatchVerification.status == "PENDING").count()
    pending_ev = db.query(InvEquipmentVerification).filter(InvEquipmentVerification.status == "PENDING").count()
    pending_iv = db.query(InvInstrumentVerification).filter(InvInstrumentVerification.status == "PENDING").count()
    pending_verifications = pending_bv + pending_ev + pending_iv

    return DashboardKPIs(
        active_materials=active_materials,
        available_batches=available_batches,
        low_stock=low_stock,
        expiring_soon=expiring_soon,
        expired=expired,
        pending_stock_requests=pending_sr,
        critical_stock_requests=critical_sr,
        maintenance_due=maintenance_due,
        calibration_due=calibration_due,
        pending_verifications=pending_verifications,
    )


@router.get("/available-stock")
def available_stock(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    rows = (
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
        .group_by(InvMaterial.id, InvMaterial.code, InvMaterial.name)
        .order_by(InvMaterial.name)
        .all()
    )
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
    pending_bv = db.query(InvBatchVerification).filter(InvBatchVerification.status == "PENDING").count()
    pending_ev = db.query(InvEquipmentVerification).filter(InvEquipmentVerification.status == "PENDING").count()
    pending_iv = db.query(InvInstrumentVerification).filter(InvInstrumentVerification.status == "PENDING").count()
    due_maint = db.query(InvMaintenanceSchedule).filter(InvMaintenanceSchedule.status == "DUE").count()
    due_calib = db.query(InvCalibrationSchedule).filter(InvCalibrationSchedule.status == "DUE").count()
    return {
        "pending_stock_requests": pending_sr,
        "pending_batch_verifications": pending_bv,
        "pending_equipment_verifications": pending_ev,
        "pending_instrument_verifications": pending_iv,
        "maintenance_due": due_maint,
        "calibration_due": due_calib,
    }
