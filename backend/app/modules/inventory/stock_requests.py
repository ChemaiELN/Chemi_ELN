"""Inventory – Stock Requests lifecycle."""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvMaterial, InvStockRequest, InvStockRequestEvent
from app.schemas.inventory import (
    StockRequestAction,
    StockRequestCreate,
    StockRequestEventOut,
    StockRequestListOut,
    StockRequestOut,
    StockRequestUpdate,
)
from app.shared.inv_audit import write_inv_audit
from app.shared.privileges import require_creator_role, require_store_incharge_role

router = APIRouter(prefix="/inventory/stock-requests", tags=["inventory-stock-requests"])

# Whitelist of columns the Stock Requests table UI is allowed to sort by.
SORTABLE_COLUMNS = {
    "request_no": InvStockRequest.request_no,
    "qty_required": InvStockRequest.qty_required,
    "criticality": InvStockRequest.criticality,
    "status": InvStockRequest.status,
    "created_at": InvStockRequest.created_at,
}


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _gen_request_no(db: Session) -> str:
    yy = datetime.datetime.utcnow().strftime("%y")
    prefix = f"SR-{yy}-"
    last = (
        db.query(InvStockRequest.request_no)
        .filter(InvStockRequest.request_no.like(f"{prefix}%"))
        .order_by(InvStockRequest.request_no.desc())
        .first()
    )
    if last:
        try:
            seq = int(last[0].split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def _add_event(db, request_id: int, event_type: str, performed_by: str, remarks: Optional[str] = None):
    db.add(InvStockRequestEvent(
        request_id=request_id,
        event_type=event_type,
        performed_by=performed_by,
        performed_at=datetime.datetime.utcnow(),
        remarks=remarks,
    ))


@router.get("", response_model=StockRequestListOut)
def list_requests(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    criticality: Optional[str] = Query(None),
    material_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("desc"),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvStockRequest)
    if status:
        q = q.filter(InvStockRequest.status == status)
    if criticality:
        q = q.filter(InvStockRequest.criticality == criticality)
    if material_id is not None:
        q = q.filter(InvStockRequest.material_id == material_id)
    if search:
        term = f"%{search}%"
        q = q.join(InvMaterial, InvStockRequest.material_id == InvMaterial.id).filter(
            InvStockRequest.request_no.ilike(term)
            | InvStockRequest.status.ilike(term)
            | InvStockRequest.criticality.ilike(term)
            | InvStockRequest.requested_by.ilike(term)
            | InvStockRequest.unit.ilike(term)
            | InvMaterial.name.ilike(term)
        )
    total = q.count()
    sort_col = SORTABLE_COLUMNS.get(sort_by, InvStockRequest.id)
    order_clause = sort_col.desc() if sort_dir == "desc" else sort_col.asc()
    items = q.order_by(order_clause).offset(skip).limit(limit).all()
    return {"items": items, "total": total}


@router.post("", response_model=StockRequestOut, status_code=201)
def create_request(
    body: StockRequestCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvMaterial, body.material_id):
        raise HTTPException(404, "Material not found.")

    request_no = _gen_request_no(db)
    while db.query(InvStockRequest).filter_by(request_no=request_no).first():
        request_no = _gen_request_no(db)

    row = InvStockRequest(
        request_no=request_no,
        material_id=body.material_id,
        qty_required=body.qty_required,
        unit=body.unit,
        criticality=body.criticality,
    )
    db.add(row)
    db.flush()
    _add_event(db, row.id, "SUBMITTED", _user_ref(current_user), body.remarks)
    write_inv_audit(
        db,
        event_type="STOCK_REQUEST_CREATED",
        entity_type="inv_stock_request",
        entity_ref=request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/{request_id}", response_model=StockRequestOut)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvStockRequest, request_id)
    if not row:
        raise HTTPException(404, "Stock request not found.")
    return row


@router.patch("/{request_id}", response_model=StockRequestOut)
def update_request(
    request_id: int,
    body: StockRequestUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvStockRequest, request_id)
    if not row:
        raise HTTPException(404, "Stock request not found.")
    if row.status != "PENDING":
        raise HTTPException(400, "Only PENDING requests can be updated.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    write_inv_audit(
        db,
        event_type="STOCK_REQUEST_UPDATED",
        entity_type="inv_stock_request",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{request_id}/approve", response_model=StockRequestOut)
def approve_request(
    request_id: int,
    body: StockRequestAction,
    db: Session = Depends(get_db),
    current_user: Any = require_creator_role(),
):
    row = db.get(InvStockRequest, request_id)
    if not row:
        raise HTTPException(404, "Stock request not found.")
    if row.status != "PENDING":
        raise HTTPException(400, f"Cannot approve a '{row.status}' request.")
    row.status = "APPROVED"
    _add_event(db, row.id, "APPROVED", _user_ref(current_user), body.remarks)
    write_inv_audit(
        db,
        event_type="STOCK_REQUEST_APPROVED",
        entity_type="inv_stock_request",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{request_id}/reject", response_model=StockRequestOut)
def reject_request(
    request_id: int,
    body: StockRequestAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Reject is two-stage, like approve: HOD/TL reject a PENDING request
    (the initial review); Store Incharge rejects an already-APPROVED one
    (e.g. stock turned out unavailable during fulfillment)."""
    row = db.get(InvStockRequest, request_id)
    if not row:
        raise HTTPException(404, "Stock request not found.")
    if row.status == "PENDING":
        if current_user.role.code not in {"HOD", "TL"}:
            raise HTTPException(403, "Only HOD or Team Lead can reject a pending request.")
    elif row.status == "APPROVED":
        if current_user.role.code != "STORE_INCHARGE":
            raise HTTPException(403, "Only Store Incharge can reject an approved request.")
    else:
        raise HTTPException(400, f"Cannot reject a '{row.status}' request.")
    row.status = "REJECTED"
    _add_event(db, row.id, "REJECTED", _user_ref(current_user), body.remarks)
    write_inv_audit(
        db,
        event_type="STOCK_REQUEST_REJECTED",
        entity_type="inv_stock_request",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{request_id}/fulfill", response_model=StockRequestOut)
def fulfill_request(
    request_id: int,
    body: StockRequestAction,
    db: Session = Depends(get_db),
    current_user: Any = require_store_incharge_role(),
):
    row = db.get(InvStockRequest, request_id)
    if not row:
        raise HTTPException(404, "Stock request not found.")
    if row.status != "APPROVED":
        raise HTTPException(400, f"Cannot fulfill a '{row.status}' request.")
    row.status = "FULFILLED"
    _add_event(db, row.id, "FULFILLED", _user_ref(current_user), body.remarks)
    write_inv_audit(
        db,
        event_type="STOCK_REQUEST_FULFILLED",
        entity_type="inv_stock_request",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{request_id}/cancel", response_model=StockRequestOut)
def cancel_request(
    request_id: int,
    body: StockRequestAction,
    db: Session = Depends(get_db),
    current_user: Any = require_store_incharge_role(),
):
    row = db.get(InvStockRequest, request_id)
    if not row:
        raise HTTPException(404, "Stock request not found.")
    if row.status != "APPROVED":
        raise HTTPException(400, f"Cannot cancel a '{row.status}' request — only APPROVED requests can be cancelled.")
    row.status = "CANCELLED"
    _add_event(db, row.id, "CANCELLED", _user_ref(current_user), body.remarks)
    write_inv_audit(
        db,
        event_type="STOCK_REQUEST_CANCELLED",
        entity_type="inv_stock_request",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/{request_id}/events", response_model=list[StockRequestEventOut])
def get_events(
    request_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if not db.get(InvStockRequest, request_id):
        raise HTTPException(404, "Stock request not found.")
    return (
        db.query(InvStockRequestEvent)
        .filter_by(request_id=request_id)
        .order_by(InvStockRequestEvent.performed_at.desc())
        .all()
    )
