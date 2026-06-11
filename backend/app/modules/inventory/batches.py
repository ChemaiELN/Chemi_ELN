"""
Inventory Master — Batches router
Endpoints:
  GET    /api/inventory/batches                    list (category, material_id, status, search)
  GET    /api/inventory/batches/{id}               single + nested events
  POST   /api/inventory/batches                    receive new batch
  PATCH  /api/inventory/batches/{id}               edit batch metadata
  PATCH  /api/inventory/batches/{id}/toggle        enable / disable
  POST   /api/inventory/batches/{id}/issue         issue qty → ISSUED event
  POST   /api/inventory/batches/{id}/allocate      allocate to project → STOCK_ALLOCATION event
  GET    /api/inventory/batches/{id}/events        list events for a batch
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_batches import InvBatch, InvBatchEvent
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_batches import (
    BatchCreate, BatchUpdate, BatchOut,
    BatchEventOut, BatchEventCreate,
    IssueRequest, AllocateRequest,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, batch_id: int, with_events: bool = False) -> InvBatch:
    q = db.query(InvBatch)
    if with_events:
        q = q.options(
            joinedload(InvBatch.events),
            joinedload(InvBatch.material),
            joinedload(InvBatch.manufacturer),
        )
    else:
        q = q.options(
            joinedload(InvBatch.material),
            joinedload(InvBatch.manufacturer),
        )
    b = q.filter(InvBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    return b


def _enrich(batch: InvBatch, include_events: bool = False) -> BatchOut:
    out = BatchOut.model_validate(batch)
    if batch.material:
        out.material_name = batch.material.name
        out.material_code = batch.material.code
    if batch.manufacturer:
        out.manufacturer_name = batch.manufacturer.name
    if include_events:
        out.events = [BatchEventOut.model_validate(e) for e in batch.events]
    return out


def _write_audit(db, user, event_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="batch",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


def _add_batch_event(db, batch_id: int, event_type: str, performed_by: str,
                     qty=None, ref_no=None, module=None, issued_to=None,
                     purpose=None, project_code=None, remarks=None):
    ev = InvBatchEvent(
        batch_id=batch_id,
        event_type=event_type,
        qty=qty,
        ref_no=ref_no,
        module=module,
        issued_to=issued_to,
        purpose=purpose,
        project_code=project_code,
        performed_by=performed_by,
        remarks=remarks,
    )
    db.add(ev)


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[BatchOut])
def list_batches(
    category:    Optional[str] = Query(None, description="available | non_available | historic"),
    material_id: Optional[int] = Query(None),
    status:      Optional[str] = Query(None, description="AVAILABLE | PARTIALLY_CONSUMED | CONSUMED | EXPIRED | QUARANTINE"),
    search:      Optional[str] = Query(None, description="batch_no or location substring"),
    is_active:   Optional[bool] = Query(None),
    db:          Session        = Depends(get_db),
    current_user: User          = Depends(get_current_user),
):
    q = db.query(InvBatch).options(
        joinedload(InvBatch.material),
        joinedload(InvBatch.manufacturer),
    )
    if category:
        q = q.filter(InvBatch.category == category)
    if material_id:
        q = q.filter(InvBatch.material_id == material_id)
    if status:
        q = q.filter(InvBatch.status == status.upper())
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvBatch.batch_no.ilike(like),
            InvBatch.location.ilike(like),
            InvBatch.invoice_no.ilike(like),
        ))
    if is_active is not None:
        q = q.filter(InvBatch.is_active == is_active)

    batches = q.order_by(InvBatch.received_at.desc()).all()
    return [_enrich(b) for b in batches]


# ── Single ────────────────────────────────────────────────────────────────────

@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id:     int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    b = _get_or_404(db, batch_id, with_events=True)
    return _enrich(b, include_events=True)


# ── Create (receive new batch) ────────────────────────────────────────────────

@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    body:         BatchCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    # Unique batch_no guard
    if db.query(InvBatch).filter(InvBatch.batch_no == body.batch_no).first():
        raise HTTPException(status_code=400, detail=f"Batch no '{body.batch_no}' already exists")

    data = body.model_dump()
    # qty_available defaults to qty_received if not supplied
    if data.get("qty_available") is None:
        data["qty_available"] = data["qty_received"]

    b = InvBatch(**data)
    db.add(b)
    db.flush()

    # Record RECEIVED event
    _add_batch_event(db, b.id, "RECEIVED", current_user.username,
                     qty=b.qty_received,
                     remarks=f"Batch {b.batch_no} received. Invoice: {b.invoice_no or '-'}")

    _write_audit(db, current_user, "BATCH_RECEIVED", b.id, b.batch_no,
                 details=f"qty={b.qty_received} {b.unit}, location={b.location}")

    db.commit()
    return _enrich(_get_or_404(db, b.id, with_events=True), include_events=True)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id:     int,
    body:         BatchUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    b = _get_or_404(db, batch_id)
    changed = body.model_dump(exclude_unset=True)
    for field, value in changed.items():
        setattr(b, field, value)
    _write_audit(db, current_user, "BATCH_UPDATED", b.id, b.batch_no,
                 details=f"Updated fields: {list(changed.keys())}")
    db.commit()
    return _enrich(_get_or_404(db, batch_id, with_events=True), include_events=True)


# ── Toggle active ─────────────────────────────────────────────────────────────

@router.patch("/{batch_id}/toggle", response_model=BatchOut)
def toggle_batch(
    batch_id:     int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    b = _get_or_404(db, batch_id)
    b.is_active = not b.is_active
    _write_audit(db, current_user, "BATCH_TOGGLED", b.id, b.batch_no,
                 details=f"is_active set to {b.is_active}")
    db.commit()
    return _enrich(_get_or_404(db, batch_id, with_events=True), include_events=True)


# ── Issue qty ─────────────────────────────────────────────────────────────────

@router.post("/{batch_id}/issue", response_model=BatchOut)
def issue_batch(
    batch_id:     int,
    body:         IssueRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    b = _get_or_404(db, batch_id)

    if not b.is_active:
        raise HTTPException(status_code=400, detail="Batch is inactive")
    if b.status in ("CONSUMED", "EXPIRED", "QUARANTINE"):
        raise HTTPException(status_code=400, detail=f"Cannot issue from a batch with status '{b.status}'")
    if body.qty <= 0:
        raise HTTPException(status_code=400, detail="Issue qty must be > 0")
    if body.qty > b.qty_available:
        raise HTTPException(
            status_code=400,
            detail=f"Requested qty {body.qty} exceeds available {b.qty_available} {b.unit}",
        )

    b.qty_available = b.qty_available - body.qty

    # Update batch status
    if b.qty_available == 0:
        b.status = "CONSUMED"
        b.category = "historic"
    else:
        b.status = "PARTIALLY_CONSUMED"

    _add_batch_event(
        db, b.id, "ISSUED", current_user.username,
        qty=body.qty,
        ref_no=body.ref_no,
        module=body.module,
        issued_to=body.issued_to,
        purpose=body.purpose,
        project_code=body.project_code,
        remarks=body.remarks,
    )
    _write_audit(db, current_user, "BATCH_ISSUED", b.id, b.batch_no,
                 details=f"Issued {body.qty} {b.unit} to {body.issued_to or 'N/A'}. "
                         f"Remaining: {b.qty_available} {b.unit}")

    db.commit()
    return _enrich(_get_or_404(db, batch_id, with_events=True), include_events=True)


# ── Allocate to project ───────────────────────────────────────────────────────

@router.post("/{batch_id}/allocate", response_model=BatchOut)
def allocate_batch(
    batch_id:     int,
    body:         AllocateRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    b = _get_or_404(db, batch_id)

    if not b.is_active:
        raise HTTPException(status_code=400, detail="Batch is inactive")
    if b.status in ("CONSUMED", "EXPIRED", "QUARANTINE"):
        raise HTTPException(status_code=400, detail=f"Cannot allocate from batch with status '{b.status}'")
    if body.qty <= 0:
        raise HTTPException(status_code=400, detail="Allocation qty must be > 0")
    if body.qty > b.qty_available:
        raise HTTPException(
            status_code=400,
            detail=f"Requested qty {body.qty} exceeds available {b.qty_available} {b.unit}",
        )

    b.qty_available = b.qty_available - body.qty
    if b.qty_available == 0:
        b.status = "CONSUMED"
        b.category = "historic"
    else:
        b.status = "PARTIALLY_CONSUMED"

    _add_batch_event(
        db, b.id, "STOCK_ALLOCATION", current_user.username,
        qty=body.qty,
        ref_no=body.ref_no,
        module=body.module,
        project_code=body.project_code,
        purpose=body.purpose,
        remarks=body.remarks,
    )
    _write_audit(db, current_user, "BATCH_ALLOCATED", b.id, b.batch_no,
                 details=f"Allocated {body.qty} {b.unit} to project {body.project_code}. "
                         f"Remaining: {b.qty_available} {b.unit}")

    db.commit()
    return _enrich(_get_or_404(db, batch_id, with_events=True), include_events=True)


# ── Batch events list ─────────────────────────────────────────────────────────

@router.get("/{batch_id}/events", response_model=List[BatchEventOut])
def list_batch_events(
    batch_id:     int,
    event_type:   Optional[str] = Query(None),
    db:           Session       = Depends(get_db),
    current_user: User          = Depends(get_current_user),
):
    # Ensure batch exists
    _get_or_404(db, batch_id)

    q = db.query(InvBatchEvent).filter(InvBatchEvent.batch_id == batch_id)
    if event_type:
        q = q.filter(InvBatchEvent.event_type == event_type.upper())
    return q.order_by(InvBatchEvent.performed_at.desc()).all()
