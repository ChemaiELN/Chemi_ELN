"""
Inventory Master — Stock Requests router
Endpoints:
  GET    /api/inventory/stock-requests               list (material_id, status, criticality)
  GET    /api/inventory/stock-requests/{id}          single + events
  POST   /api/inventory/stock-requests               create / submit
  PATCH  /api/inventory/stock-requests/{id}          edit (PENDING only)
  PATCH  /api/inventory/stock-requests/{id}/approve  approve request
  PATCH  /api/inventory/stock-requests/{id}/reject   reject request
  PATCH  /api/inventory/stock-requests/{id}/fulfill  mark fulfilled
  PATCH  /api/inventory/stock-requests/{id}/cancel   cancel (PENDING only)
  GET    /api/inventory/stock-requests/{id}/events   list events
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_stock import InvStockRequest, InvStockRequestEvent
from app.models.inventory_materials import InvMaterial
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_stock import (
    StockRequestCreate, StockRequestUpdate,
    ApproveRequest, RejectRequest, FulfillRequest,
    StockRequestOut, StockRequestEventOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, req_id: int, with_events: bool = False) -> InvStockRequest:
    q = db.query(InvStockRequest).options(joinedload(InvStockRequest.material))
    if with_events:
        q = q.options(joinedload(InvStockRequest.events))
    r = q.filter(InvStockRequest.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Stock request not found")
    return r


def _enrich(r: InvStockRequest, include_events: bool = False) -> StockRequestOut:
    out = StockRequestOut.model_validate(r)
    if r.material:
        out.material_name = r.material.name
        out.material_code = r.material.code
    if include_events:
        out.events = [StockRequestEventOut.model_validate(e) for e in r.events]
    return out


def _add_event(db, request_id: int, event_type: str, performed_by: str, remarks: str = None):
    db.add(InvStockRequestEvent(
        request_id=request_id,
        event_type=event_type,
        performed_by=performed_by,
        remarks=remarks,
    ))


def _write_audit(db, user, event_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="stock_request",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[StockRequestOut])
def list_stock_requests(
    material_id:   Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    criticality:   Optional[str] = Query(None),
    search:        Optional[str] = Query(None, description="request_no or purpose substring"),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = db.query(InvStockRequest).options(joinedload(InvStockRequest.material))
    if material_id:
        q = q.filter(InvStockRequest.material_id == material_id)
    if status_filter:
        q = q.filter(InvStockRequest.status == status_filter.upper())
    if criticality:
        q = q.filter(InvStockRequest.criticality == criticality.upper())
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvStockRequest.request_no.ilike(like),
            InvStockRequest.purpose.ilike(like),
            InvStockRequest.requested_by.ilike(like),
        ))
    rows = q.order_by(InvStockRequest.requested_at.desc()).all()
    return [_enrich(r) for r in rows]


# ── Single ────────────────────────────────────────────────────────────────────

@router.get("/{req_id}", response_model=StockRequestOut)
def get_stock_request(
    req_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    r = _get_or_404(db, req_id, with_events=True)
    return _enrich(r, include_events=True)


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=StockRequestOut, status_code=status.HTTP_201_CREATED)
def create_stock_request(
    body:         StockRequestCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvStockRequest).filter(InvStockRequest.request_no == body.request_no).first():
        raise HTTPException(status_code=400, detail=f"Request no '{body.request_no}' already exists")

    mat = db.query(InvMaterial).filter(InvMaterial.id == body.material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    r = InvStockRequest(
        **body.model_dump(),
        requested_by=current_user.username,
        status="PENDING",
    )
    db.add(r)
    db.flush()

    _add_event(db, r.id, "SUBMITTED", current_user.username,
               remarks=f"Stock request submitted for {mat.name} — qty {body.qty_required} {body.unit}")
    _write_audit(db, current_user, "STOCK_REQUEST_SUBMITTED", r.id, r.request_no,
                 details=f"{mat.name} × {body.qty_required} {body.unit}, criticality={body.criticality}")
    db.commit()
    return _enrich(_get_or_404(db, r.id, with_events=True), include_events=True)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{req_id}", response_model=StockRequestOut)
def update_stock_request(
    req_id:       int,
    body:         StockRequestUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    r = _get_or_404(db, req_id)
    if r.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot edit a request with status '{r.status}'")
    changed = body.model_dump(exclude_unset=True)
    for field, value in changed.items():
        setattr(r, field, value)
    _write_audit(db, current_user, "STOCK_REQUEST_UPDATED", r.id, r.request_no,
                 details=f"Updated fields: {list(changed.keys())}")
    db.commit()
    return _enrich(_get_or_404(db, req_id, with_events=True), include_events=True)


# ── Approve ───────────────────────────────────────────────────────────────────

@router.patch("/{req_id}/approve", response_model=StockRequestOut)
def approve_stock_request(
    req_id:       int,
    body:         ApproveRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    r = _get_or_404(db, req_id)
    if r.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve a request with status '{r.status}'")
    r.status = "APPROVED"
    r.approved_by = current_user.username
    r.approved_at = datetime.now(timezone.utc)
    if body.remarks:
        r.remarks = body.remarks

    _add_event(db, r.id, "APPROVED", current_user.username, remarks=body.remarks)
    _write_audit(db, current_user, "STOCK_REQUEST_APPROVED", r.id, r.request_no,
                 details=f"Approved by {current_user.username}")
    db.commit()
    return _enrich(_get_or_404(db, req_id, with_events=True), include_events=True)


# ── Reject ────────────────────────────────────────────────────────────────────

@router.patch("/{req_id}/reject", response_model=StockRequestOut)
def reject_stock_request(
    req_id:       int,
    body:         RejectRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    r = _get_or_404(db, req_id)
    if r.status not in ("PENDING", "APPROVED"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a request with status '{r.status}'")
    r.status = "REJECTED"
    if body.remarks:
        r.remarks = body.remarks

    _add_event(db, r.id, "REJECTED", current_user.username, remarks=body.remarks)
    _write_audit(db, current_user, "STOCK_REQUEST_REJECTED", r.id, r.request_no,
                 details=f"Rejected by {current_user.username}. Reason: {body.remarks or 'N/A'}")
    db.commit()
    return _enrich(_get_or_404(db, req_id, with_events=True), include_events=True)


# ── Fulfill ───────────────────────────────────────────────────────────────────

@router.patch("/{req_id}/fulfill", response_model=StockRequestOut)
def fulfill_stock_request(
    req_id:       int,
    body:         FulfillRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    r = _get_or_404(db, req_id)
    if r.status != "APPROVED":
        raise HTTPException(status_code=400, detail=f"Only APPROVED requests can be fulfilled (current: '{r.status}')")
    r.status = "FULFILLED"
    if body.remarks:
        r.remarks = body.remarks

    _add_event(db, r.id, "FULFILLED", current_user.username, remarks=body.remarks)
    _write_audit(db, current_user, "STOCK_REQUEST_FULFILLED", r.id, r.request_no,
                 details=f"Fulfilled by {current_user.username}")
    db.commit()
    return _enrich(_get_or_404(db, req_id, with_events=True), include_events=True)


# ── Cancel ────────────────────────────────────────────────────────────────────

@router.patch("/{req_id}/cancel", response_model=StockRequestOut)
def cancel_stock_request(
    req_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    r = _get_or_404(db, req_id)
    if r.status not in ("PENDING",):
        raise HTTPException(status_code=400, detail=f"Only PENDING requests can be cancelled (current: '{r.status}')")
    r.status = "CANCELLED"

    _add_event(db, r.id, "CANCELLED", current_user.username)
    _write_audit(db, current_user, "STOCK_REQUEST_CANCELLED", r.id, r.request_no,
                 details=f"Cancelled by {current_user.username}")
    db.commit()
    return _enrich(_get_or_404(db, req_id, with_events=True), include_events=True)


# ── Events list ───────────────────────────────────────────────────────────────

@router.get("/{req_id}/events", response_model=List[StockRequestEventOut])
def list_stock_request_events(
    req_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    _get_or_404(db, req_id)
    return (
        db.query(InvStockRequestEvent)
        .filter(InvStockRequestEvent.request_id == req_id)
        .order_by(InvStockRequestEvent.performed_at.desc())
        .all()
    )
