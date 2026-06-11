"""
Inventory Master — Audit Trail router
Endpoints:
  GET  /api/inventory/audit-trail   list with filters (event_type, entity_type,
                                    performed_by, date_from, date_to, page, page_size)
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory_equipment import InvAuditTrail
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


class AuditTrailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    event_type:   str
    entity_type:  str
    entity_id:    Optional[int] = None
    entity_ref:   Optional[str] = None
    performed_by: Optional[str] = None
    performed_at: Optional[str] = None
    old_value:    Optional[str] = None
    new_value:    Optional[str] = None
    details:      Optional[str] = None

    @classmethod
    def from_orm_row(cls, row: InvAuditTrail) -> "AuditTrailOut":
        return cls(
            id=row.id,
            event_type=row.event_type,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            entity_ref=row.entity_ref,
            performed_by=row.performed_by,
            performed_at=row.performed_at.strftime("%d %b %Y (%H:%M:%S)") if row.performed_at else None,
            old_value=row.old_value,
            new_value=row.new_value,
            details=row.details,
        )


class AuditTrailPage(BaseModel):
    total:   int
    page:    int
    pages:   int
    items:   List[AuditTrailOut]


@router.get("", response_model=AuditTrailPage)
def list_audit_trail(
    event_type:   Optional[str]  = Query(None),
    entity_type:  Optional[str]  = Query(None),
    performed_by: Optional[str]  = Query(None),
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    page:         int            = Query(1, ge=1),
    page_size:    int            = Query(50, ge=1, le=200),
    db:           Session        = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    q = db.query(InvAuditTrail)
    filters = []
    if event_type:
        filters.append(InvAuditTrail.event_type.ilike(f"%{event_type}%"))
    if entity_type:
        filters.append(InvAuditTrail.entity_type == entity_type)
    if performed_by:
        filters.append(InvAuditTrail.performed_by.ilike(f"%{performed_by}%"))
    if date_from:
        filters.append(InvAuditTrail.performed_at >= date_from)
    if date_to:
        filters.append(InvAuditTrail.performed_at <= date_to)
    if filters:
        q = q.filter(and_(*filters))

    total = q.count()
    rows  = q.order_by(InvAuditTrail.performed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    pages = max(1, (total + page_size - 1) // page_size)

    return AuditTrailPage(
        total=total,
        page=page,
        pages=pages,
        items=[AuditTrailOut.from_orm_row(r) for r in rows],
    )
