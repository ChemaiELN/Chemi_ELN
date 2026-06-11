"""
Inventory Master — Reports router
Four report endpoints:

  GET /api/inventory/reports/batch-inventory     — current stock levels per material/batch
  GET /api/inventory/reports/expiry              — batches by expiry date range
  GET /api/inventory/reports/stock-requests      — stock request history with filters
  GET /api/inventory/reports/equipment-status    — equipment & instrument status overview
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_batches import InvBatch
from app.models.inventory_materials import InvMaterial
from app.models.inventory_stock import InvStockRequest
from app.models.inventory_equipment import (
    InvEquipmentCatalogue, InvInstrumentCatalogue, InvColumnCatalogue,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ── Report 1: Batch Inventory ─────────────────────────────────────────────────

class BatchInventoryRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    batch_id:        int
    batch_no:        str
    material_code:   str
    material_name:   str
    material_type:   str
    manufacturer:    Optional[str]    = None
    qty_received:    Decimal
    qty_available:   Decimal
    unit:            str
    location:        Optional[str]    = None
    mfg_date:        Optional[date]   = None
    expiry_date:     Optional[date]   = None
    retest_date:     Optional[date]   = None
    status:          str
    category:        str
    received_by:     Optional[str]    = None
    received_at:     Optional[str]    = None


@router.get("/batch-inventory", response_model=List[BatchInventoryRow])
def report_batch_inventory(
    category:      Optional[str] = Query(None, description="available | non_available | historic"),
    material_id:   Optional[int] = Query(None),
    material_type: Optional[str] = Query(None),
    status:        Optional[str] = Query(None),
    location:      Optional[str] = Query(None),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = (
        db.query(InvBatch)
        .options(
            joinedload(InvBatch.material),
            joinedload(InvBatch.manufacturer),
        )
        .filter(InvBatch.is_active == True)
    )
    if category:
        q = q.filter(InvBatch.category == category)
    if material_id:
        q = q.filter(InvBatch.material_id == material_id)
    if material_type:
        q = q.join(InvBatch.material).filter(InvMaterial.material_type == material_type)
    if status:
        q = q.filter(InvBatch.status == status.upper())
    if location:
        q = q.filter(InvBatch.location.ilike(f"%{location}%"))

    rows = []
    for b in q.order_by(InvBatch.received_at.desc()).all():
        mat = b.material
        mfr = b.manufacturer
        rows.append(BatchInventoryRow(
            batch_id=b.id,
            batch_no=b.batch_no,
            material_code=mat.code if mat else "",
            material_name=mat.name if mat else "",
            material_type=mat.material_type if mat else "",
            manufacturer=mfr.name if mfr else None,
            qty_received=b.qty_received,
            qty_available=b.qty_available,
            unit=b.unit,
            location=b.location,
            mfg_date=b.mfg_date,
            expiry_date=b.expiry_date,
            retest_date=b.retest_date,
            status=b.status,
            category=b.category,
            received_by=b.received_by,
            received_at=b.received_at.strftime("%d %b %Y") if b.received_at else None,
        ))
    return rows


# ── Report 2: Expiry Report ───────────────────────────────────────────────────

class ExpiryReportRow(BaseModel):
    batch_id:      int
    batch_no:      str
    material_code: str
    material_name: str
    manufacturer:  Optional[str]   = None
    qty_available: Decimal
    unit:          str
    location:      Optional[str]   = None
    mfg_date:      Optional[date]  = None
    expiry_date:   date
    retest_date:   Optional[date]  = None
    status:        str
    days_to_expiry: int


@router.get("/expiry", response_model=List[ExpiryReportRow])
def report_expiry(
    date_from:   Optional[date] = Query(None, description="Include batches expiring on or after this date"),
    date_to:     Optional[date] = Query(None, description="Include batches expiring on or before this date"),
    include_expired: bool        = Query(False, description="Include already-expired batches"),
    db:          Session         = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    today = date.today()
    filters = [
        InvBatch.is_active   == True,
        InvBatch.expiry_date != None,
    ]
    if not include_expired:
        filters.append(InvBatch.expiry_date >= today)
    if date_from:
        filters.append(InvBatch.expiry_date >= date_from)
    if date_to:
        filters.append(InvBatch.expiry_date <= date_to)

    batches = (
        db.query(InvBatch)
        .options(joinedload(InvBatch.material), joinedload(InvBatch.manufacturer))
        .filter(and_(*filters))
        .order_by(InvBatch.expiry_date)
        .all()
    )

    rows = []
    for b in batches:
        mat = b.material
        mfr = b.manufacturer
        days = (b.expiry_date - today).days
        rows.append(ExpiryReportRow(
            batch_id=b.id,
            batch_no=b.batch_no,
            material_code=mat.code if mat else "",
            material_name=mat.name if mat else "",
            manufacturer=mfr.name if mfr else None,
            qty_available=b.qty_available,
            unit=b.unit,
            location=b.location,
            mfg_date=b.mfg_date,
            expiry_date=b.expiry_date,
            retest_date=b.retest_date,
            status=b.status,
            days_to_expiry=days,
        ))
    return rows


# ── Report 3: Stock Requests ──────────────────────────────────────────────────

class StockRequestReportRow(BaseModel):
    request_id:       int
    request_no:       str
    material_code:    str
    material_name:    str
    qty_required:     Decimal
    unit:             str
    criticality:      str
    status:           str
    requested_by:     Optional[str]  = None
    requested_at:     Optional[str]  = None
    approved_by:      Optional[str]  = None
    approved_at:      Optional[str]  = None
    required_by_date: Optional[date] = None
    purpose:          Optional[str]  = None
    remarks:          Optional[str]  = None


@router.get("/stock-requests", response_model=List[StockRequestReportRow])
def report_stock_requests(
    status:        Optional[str]  = Query(None),
    criticality:   Optional[str]  = Query(None),
    material_id:   Optional[int]  = Query(None),
    requested_by:  Optional[str]  = Query(None),
    date_from:     Optional[date] = Query(None, description="requested_at on or after"),
    date_to:       Optional[date] = Query(None, description="requested_at on or before"),
    db:            Session         = Depends(get_db),
    current_user:  User            = Depends(get_current_user),
):
    q = db.query(InvStockRequest).options(joinedload(InvStockRequest.material))
    if status:
        q = q.filter(InvStockRequest.status == status.upper())
    if criticality:
        q = q.filter(InvStockRequest.criticality == criticality.upper())
    if material_id:
        q = q.filter(InvStockRequest.material_id == material_id)
    if requested_by:
        q = q.filter(InvStockRequest.requested_by.ilike(f"%{requested_by}%"))
    if date_from:
        q = q.filter(InvStockRequest.requested_at >= date_from)
    if date_to:
        q = q.filter(InvStockRequest.requested_at <= date_to)

    rows = []
    for r in q.order_by(InvStockRequest.requested_at.desc()).all():
        mat = r.material
        rows.append(StockRequestReportRow(
            request_id=r.id,
            request_no=r.request_no,
            material_code=mat.code if mat else "",
            material_name=mat.name if mat else "",
            qty_required=r.qty_required,
            unit=r.unit,
            criticality=r.criticality,
            status=r.status,
            requested_by=r.requested_by,
            requested_at=r.requested_at.strftime("%d %b %Y") if r.requested_at else None,
            approved_by=r.approved_by,
            approved_at=r.approved_at.strftime("%d %b %Y") if r.approved_at else None,
            required_by_date=r.required_by_date,
            purpose=r.purpose,
            remarks=r.remarks,
        ))
    return rows


# ── Report 4: Equipment Status ────────────────────────────────────────────────

class EquipmentStatusRow(BaseModel):
    asset_type:           str     # EQUIPMENT | INSTRUMENT | COLUMN
    asset_id:             str
    name:                 str
    type_name:            Optional[str] = None
    manufacturer:         Optional[str] = None
    model:                Optional[str] = None
    location:             Optional[str] = None
    status:               str
    service_status:       str           # maintenance_status / calibration_status / injection_status
    last_service_date:    Optional[date] = None
    next_service_due:     Optional[date] = None
    is_active:            bool


@router.get("/equipment-status", response_model=List[EquipmentStatusRow])
def report_equipment_status(
    asset_type:     Optional[str]  = Query(None, description="EQUIPMENT | INSTRUMENT | COLUMN"),
    status:         Optional[str]  = Query(None),
    service_status: Optional[str]  = Query(None, description="OK | DUE | OVERDUE | EXPIRED | EXHAUSTED"),
    db:             Session         = Depends(get_db),
    current_user:   User            = Depends(get_current_user),
):
    rows: List[EquipmentStatusRow] = []

    # Equipment
    if not asset_type or asset_type.upper() == "EQUIPMENT":
        q = db.query(InvEquipmentCatalogue).options(
            joinedload(InvEquipmentCatalogue.equipment_type)
        )
        if status:
            q = q.filter(InvEquipmentCatalogue.status == status.upper())
        if service_status:
            q = q.filter(InvEquipmentCatalogue.maintenance_status == service_status.upper())
        for eq in q.order_by(InvEquipmentCatalogue.asset_id).all():
            rows.append(EquipmentStatusRow(
                asset_type="EQUIPMENT",
                asset_id=eq.asset_id,
                name=eq.name,
                type_name=eq.equipment_type.name if eq.equipment_type else None,
                manufacturer=eq.manufacturer,
                model=eq.model,
                location=eq.location,
                status=eq.status,
                service_status=eq.maintenance_status,
                last_service_date=eq.last_maintenance_date,
                next_service_due=eq.maintenance_due_date,
                is_active=eq.is_active,
            ))

    # Instruments
    if not asset_type or asset_type.upper() == "INSTRUMENT":
        q = db.query(InvInstrumentCatalogue).options(
            joinedload(InvInstrumentCatalogue.instrument_type)
        )
        if status:
            q = q.filter(InvInstrumentCatalogue.status == status.upper())
        if service_status:
            q = q.filter(InvInstrumentCatalogue.calibration_status == service_status.upper())
        for ins in q.order_by(InvInstrumentCatalogue.asset_id).all():
            rows.append(EquipmentStatusRow(
                asset_type="INSTRUMENT",
                asset_id=ins.asset_id,
                name=ins.name,
                type_name=ins.instrument_type.name if ins.instrument_type else None,
                manufacturer=ins.manufacturer,
                model=ins.model,
                location=ins.location,
                status=ins.status,
                service_status=ins.calibration_status,
                last_service_date=ins.last_calibration_date,
                next_service_due=ins.calibration_due_date,
                is_active=ins.is_active,
            ))

    # Columns
    if not asset_type or asset_type.upper() == "COLUMN":
        q = db.query(InvColumnCatalogue).options(
            joinedload(InvColumnCatalogue.column_type)
        )
        if status:
            q = q.filter(InvColumnCatalogue.status == status.upper())
        for col in q.order_by(InvColumnCatalogue.column_id).all():
            # derive injection service status
            if col.status == "EXHAUSTED":
                svc = "EXHAUSTED"
            elif col.max_injections and col.cumulative_injections >= col.max_injections * 0.9:
                svc = "DUE"
            else:
                svc = "OK"
            if service_status and svc != service_status.upper():
                continue
            rows.append(EquipmentStatusRow(
                asset_type="COLUMN",
                asset_id=col.column_id,
                name=col.name,
                type_name=col.column_type.name if col.column_type else None,
                manufacturer=col.manufacturer,
                model=None,
                location=None,
                status=col.status,
                service_status=svc,
                last_service_date=col.purchased_date,
                next_service_due=None,
                is_active=col.is_active,
            ))

    return rows
