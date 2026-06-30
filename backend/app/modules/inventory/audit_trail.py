"""Inventory – Audit Trail read endpoint."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvAuditTrail

router = APIRouter(prefix="/inventory/audit-trail", tags=["inventory-audit"])


@router.get("")
def list_audit_trail(
    event_type: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    performed_by: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    import datetime
    q = db.query(InvAuditTrail)
    if event_type:
        q = q.filter(InvAuditTrail.event_type == event_type)
    if entity_type:
        q = q.filter(InvAuditTrail.entity_type == entity_type)
    if performed_by:
        q = q.filter(InvAuditTrail.performed_by.ilike(f"%{performed_by}%"))
    if date_from:
        q = q.filter(InvAuditTrail.performed_at >= datetime.datetime.fromisoformat(date_from))
    if date_to:
        dt = datetime.datetime.fromisoformat(date_to) + datetime.timedelta(days=1)
        q = q.filter(InvAuditTrail.performed_at < dt)
    rows = q.order_by(InvAuditTrail.performed_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "event_type": r.event_type,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "entity_ref": r.entity_ref,
            "performed_by": r.performed_by,
            "performed_at": r.performed_at.isoformat(),
            "old_value": r.old_value,
            "new_value": r.new_value,
            "details": getattr(r, "details", None),
        }
        for r in rows
    ]


@router.get("/event-types")
def list_event_types(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    rows = db.query(InvAuditTrail.event_type).distinct().order_by(InvAuditTrail.event_type).all()
    return [r[0] for r in rows]


@router.get("/entity-types")
def list_entity_types(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    rows = db.query(InvAuditTrail.entity_type).distinct().order_by(InvAuditTrail.entity_type).all()
    return [r[0] for r in rows]
