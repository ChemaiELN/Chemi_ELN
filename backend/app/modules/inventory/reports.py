"""Inventory – Reports endpoints."""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvBatch,
    InvEquipmentCatalogue,
    InvMaterial,
    InvStockRequest,
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
