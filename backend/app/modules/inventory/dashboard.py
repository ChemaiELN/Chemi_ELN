"""
Inventory Master — Dashboard router
Endpoints:
  GET /api/inventory/dashboard/kpis            — headline counters for the dashboard
  GET /api/inventory/dashboard/available-stock — available qty per material (aggregated)
  GET /api/inventory/dashboard/expiring-soon   — batches expiring within N days
  GET /api/inventory/dashboard/pending-actions — items needing attention
"""
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, and_, case
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.inventory_materials import InvMaterial
from app.models.inventory_batches import InvBatch
from app.models.inventory_stock import InvStockRequest
from app.models.inventory_equipment import (
    InvEquipmentCatalogue, InvInstrumentCatalogue,
    InvEquipmentVerification, InvInstrumentVerification,
)
from app.models.inventory_batches import InvBatchVerification
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ── response shapes ───────────────────────────────────────────────────────────

class KpiCard(BaseModel):
    label:   str
    value:   int
    detail:  Optional[str] = None


class KpiResponse(BaseModel):
    materials:               KpiCard
    batches_available:       KpiCard
    batches_low_stock:       KpiCard
    batches_expiring_30d:    KpiCard
    batches_expired:         KpiCard
    stock_requests_pending:  KpiCard
    stock_requests_critical: KpiCard
    maintenance_due:         KpiCard
    calibration_due:         KpiCard
    verifications_pending:   KpiCard


class AvailableStockRow(BaseModel):
    material_id:   int
    material_code: str
    material_name: str
    material_type: str
    total_available: float
    unit:          str
    batch_count:   int
    has_expiring:  bool    # any batch expiring within 60 days


class ExpiringBatchRow(BaseModel):
    batch_id:      int
    batch_no:      str
    material_name: str
    material_code: str
    qty_available: float
    unit:          str
    expiry_date:   date
    days_to_expiry: int
    location:      Optional[str] = None


class PendingActionRow(BaseModel):
    category:    str     # STOCK_REQUEST | BATCH_VERIFICATION | EQUIP_VERIFICATION | INSTR_VERIFICATION | MAINTENANCE | CALIBRATION
    ref_no:      str
    description: str
    priority:    str     # HIGH | MEDIUM | LOW


# ── KPIs ─────────────────────────────────────────────────────────────────────

@router.get("/kpis", response_model=KpiResponse)
def get_kpis(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    today = date.today()
    in_30 = today + timedelta(days=30)

    # Materials — single count
    total_materials = db.query(func.count(InvMaterial.id)).filter(InvMaterial.is_active == True).scalar() or 0

    # All batch KPIs in ONE query using conditional aggregation
    batch_row = db.query(
        func.count(case((and_(InvBatch.category == "available", InvBatch.is_active == True), 1))).label("available"),
        func.count(case((and_(
            InvBatch.category == "available", InvBatch.is_active == True,
            InvBatch.qty_available > 0,
            InvBatch.qty_available < InvBatch.qty_received * 0.10,
        ), 1))).label("low_stock"),
        func.count(case((and_(
            InvBatch.is_active == True, InvBatch.expiry_date != None,
            InvBatch.expiry_date >= today, InvBatch.expiry_date <= in_30,
            InvBatch.qty_available > 0,
        ), 1))).label("expiring_30"),
        func.count(case((and_(
            InvBatch.is_active == True, InvBatch.expiry_date != None,
            InvBatch.expiry_date < today, InvBatch.qty_available > 0,
        ), 1))).label("expired"),
    ).one()
    batches_available = batch_row.available
    low_stock         = batch_row.low_stock
    expiring_30       = batch_row.expiring_30
    expired           = batch_row.expired

    # Stock requests — single query with conditional aggregation
    sr_row = db.query(
        func.count(case((InvStockRequest.status == "PENDING", 1))).label("pending"),
        func.count(case((and_(InvStockRequest.status == "PENDING", InvStockRequest.criticality == "CRITICAL"), 1))).label("critical"),
    ).one()
    sr_pending  = sr_row.pending
    sr_critical = sr_row.critical

    # Maintenance due
    maint_due = (
        db.query(func.count(InvEquipmentCatalogue.id))
        .filter(InvEquipmentCatalogue.maintenance_status.in_(["DUE", "OVERDUE"]))
        .scalar() or 0
    )

    # Calibration due
    calib_due = (
        db.query(func.count(InvInstrumentCatalogue.id))
        .filter(InvInstrumentCatalogue.calibration_status.in_(["DUE", "EXPIRED"]))
        .scalar() or 0
    )

    # Pending verifications — 3 separate tables, fast indexed COUNTs
    bv_pending = db.query(func.count(InvBatchVerification.id)).filter(InvBatchVerification.status == "PENDING").scalar() or 0
    ev_pending = db.query(func.count(InvEquipmentVerification.id)).filter(InvEquipmentVerification.status == "PENDING").scalar() or 0
    iv_pending = db.query(func.count(InvInstrumentVerification.id)).filter(InvInstrumentVerification.status == "PENDING").scalar() or 0
    verif_pending = bv_pending + ev_pending + iv_pending

    return KpiResponse(
        materials               = KpiCard(label="Active Materials",          value=total_materials),
        batches_available       = KpiCard(label="Available Batches",         value=batches_available),
        batches_low_stock       = KpiCard(label="Low Stock Batches",         value=low_stock,     detail="< 10% remaining"),
        batches_expiring_30d    = KpiCard(label="Expiring in 30 Days",       value=expiring_30),
        batches_expired         = KpiCard(label="Expired (qty remaining)",   value=expired),
        stock_requests_pending  = KpiCard(label="Pending Stock Requests",    value=sr_pending),
        stock_requests_critical = KpiCard(label="Critical Stock Requests",   value=sr_critical),
        maintenance_due         = KpiCard(label="Maintenance Due",           value=maint_due),
        calibration_due         = KpiCard(label="Calibration Due",           value=calib_due),
        verifications_pending   = KpiCard(label="Pending Verifications",     value=verif_pending,
                                          detail=f"Batch:{bv_pending} Equip:{ev_pending} Instr:{iv_pending}"),
    )


# ── Available Stock ───────────────────────────────────────────────────────────

@router.get("/available-stock", response_model=List[AvailableStockRow])
def get_available_stock(
    material_type: Optional[str] = Query(None),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    today = date.today()
    in_60 = today + timedelta(days=60)

    # Single aggregated query — no per-material loop
    q = (
        db.query(
            InvMaterial.id,
            InvMaterial.code,
            InvMaterial.name,
            InvMaterial.material_type,
            func.coalesce(func.sum(InvBatch.qty_available), 0).label("total_available"),
            func.count(InvBatch.id).label("batch_count"),
            func.max(InvBatch.unit).label("unit"),
            func.max(case(
                (and_(
                    InvBatch.expiry_date != None,
                    InvBatch.expiry_date >= today,
                    InvBatch.expiry_date <= in_60,
                ), 1),
                else_=0,
            )).label("has_expiring"),
        )
        .outerjoin(InvBatch, and_(
            InvBatch.material_id == InvMaterial.id,
            InvBatch.category == "available",
            InvBatch.is_active == True,
        ))
        .filter(InvMaterial.is_active == True)
        .group_by(InvMaterial.id, InvMaterial.code, InvMaterial.name, InvMaterial.material_type)
        .order_by(InvMaterial.code)
    )
    if material_type:
        q = q.filter(InvMaterial.material_type == material_type)

    return [
        AvailableStockRow(
            material_id=r.id,
            material_code=r.code,
            material_name=r.name,
            material_type=r.material_type,
            total_available=float(r.total_available),
            unit=r.unit or "",
            batch_count=r.batch_count,
            has_expiring=bool(r.has_expiring),
        )
        for r in q.all()
    ]


# ── Expiring Soon ─────────────────────────────────────────────────────────────

@router.get("/expiring-soon", response_model=List[ExpiringBatchRow])
def get_expiring_soon(
    days:         int     = Query(60, ge=1, le=365, description="Look-ahead window in days"),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    today  = date.today()
    cutoff = today + timedelta(days=days)

    batches = (
        db.query(InvBatch)
        .options(selectinload(InvBatch.material))
        .filter(
            InvBatch.is_active    == True,
            InvBatch.expiry_date  != None,
            InvBatch.expiry_date  >= today,
            InvBatch.expiry_date  <= cutoff,
            InvBatch.qty_available > 0,
        )
        .order_by(InvBatch.expiry_date)
        .all()
    )

    rows = []
    for b in batches:
        mat = b.material
        rows.append(ExpiringBatchRow(
            batch_id=b.id,
            batch_no=b.batch_no,
            material_name=mat.name if mat else "",
            material_code=mat.code if mat else "",
            qty_available=float(b.qty_available),
            unit=b.unit,
            expiry_date=b.expiry_date,
            days_to_expiry=(b.expiry_date - today).days,
            location=b.location,
        ))
    return rows


# ── Pending Actions ───────────────────────────────────────────────────────────

@router.get("/pending-actions", response_model=List[PendingActionRow])
def get_pending_actions(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    actions: List[PendingActionRow] = []

    # Critical / High stock requests — eager-load material to avoid N+1
    for sr in (
        db.query(InvStockRequest)
        .options(selectinload(InvStockRequest.material))
        .filter(InvStockRequest.status == "PENDING")
        .order_by(InvStockRequest.requested_at)
        .all()
    ):
        mat_name = sr.material.name if sr.material else "?"
        priority = sr.criticality if sr.criticality in ("HIGH", "CRITICAL") else "MEDIUM"
        actions.append(PendingActionRow(
            category="STOCK_REQUEST",
            ref_no=sr.request_no,
            description=f"{mat_name} — {sr.qty_required} {sr.unit}",
            priority=priority,
        ))

    # Pending batch verifications — eager-load batch to avoid N+1
    for bv in (
        db.query(InvBatchVerification)
        .options(selectinload(InvBatchVerification.batch))
        .filter(InvBatchVerification.status == "PENDING")
        .all()
    ):
        batch_no = bv.batch.batch_no if bv.batch else "?"
        actions.append(PendingActionRow(
            category="BATCH_VERIFICATION",
            ref_no=bv.request_no,
            description=f"Batch {batch_no} awaiting verification",
            priority="MEDIUM",
        ))

    # Pending equipment verifications — eager-load equipment to avoid N+1
    for ev in (
        db.query(InvEquipmentVerification)
        .options(selectinload(InvEquipmentVerification.equipment))
        .filter(InvEquipmentVerification.status == "PENDING")
        .all()
    ):
        asset = ev.equipment.asset_id if ev.equipment else "?"
        actions.append(PendingActionRow(
            category="EQUIP_VERIFICATION",
            ref_no=ev.request_no,
            description=f"Equipment {asset} awaiting verification",
            priority="MEDIUM",
        ))

    # Pending instrument verifications — eager-load instrument to avoid N+1
    for iv in (
        db.query(InvInstrumentVerification)
        .options(selectinload(InvInstrumentVerification.instrument))
        .filter(InvInstrumentVerification.status == "PENDING")
        .all()
    ):
        asset = iv.instrument.asset_id if iv.instrument else "?"
        actions.append(PendingActionRow(
            category="INSTR_VERIFICATION",
            ref_no=iv.request_no,
            description=f"Instrument {asset} awaiting verification",
            priority="MEDIUM",
        ))

    # Equipment maintenance due (no relationship access — fields are on the model itself)
    for eq in db.query(InvEquipmentCatalogue).filter(
        InvEquipmentCatalogue.maintenance_status.in_(["DUE", "OVERDUE"])
    ).all():
        priority = "HIGH" if eq.maintenance_status == "OVERDUE" else "MEDIUM"
        actions.append(PendingActionRow(
            category="MAINTENANCE",
            ref_no=eq.asset_id,
            description=f"{eq.name} — maintenance {eq.maintenance_status.lower()}",
            priority=priority,
        ))

    # Instrument calibration due (no relationship access — fields are on the model itself)
    for ins in db.query(InvInstrumentCatalogue).filter(
        InvInstrumentCatalogue.calibration_status.in_(["DUE", "EXPIRED"])
    ).all():
        priority = "HIGH" if ins.calibration_status == "EXPIRED" else "MEDIUM"
        actions.append(PendingActionRow(
            category="CALIBRATION",
            ref_no=ins.asset_id,
            description=f"{ins.name} — calibration {ins.calibration_status.lower()}",
            priority=priority,
        ))

    return actions
