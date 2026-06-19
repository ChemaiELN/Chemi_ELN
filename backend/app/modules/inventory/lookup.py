"""
Inventory — General Lookup router

  GET    /api/inventory/lookup          list (lookup_type, is_active, search)
  GET    /api/inventory/lookup/types    return all valid lookup type names
  GET    /api/inventory/lookup/{id}     single record
  POST   /api/inventory/lookup          create
  PATCH  /api/inventory/lookup/{id}     update
  PATCH  /api/inventory/lookup/{id}/toggle  enable / disable
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory_lookup import InvGeneralLookup
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_lookup import (
    GeneralLookupCreate, GeneralLookupUpdate, GeneralLookupOut, LOOKUP_TYPES,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, lookup_id: int) -> InvGeneralLookup:
    obj = db.query(InvGeneralLookup).filter(InvGeneralLookup.id == lookup_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lookup entry not found")
    return obj


def _audit(db, user, event_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="general_lookup",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/types", response_model=List[str])
def get_lookup_types(current_user: User = Depends(get_current_user)):
    return LOOKUP_TYPES


@router.get("", response_model=List[GeneralLookupOut])
def list_lookups(
    lookup_type: Optional[str]  = Query(None),
    is_active:   Optional[bool] = Query(None),
    search:      Optional[str]  = Query(None),
    db:          Session        = Depends(get_db),
    current_user: User          = Depends(get_current_user),
):
    q = db.query(InvGeneralLookup)
    if lookup_type:
        q = q.filter(InvGeneralLookup.lookup_type == lookup_type)
    if is_active is not None:
        q = q.filter(InvGeneralLookup.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvGeneralLookup.lookup_value.ilike(like),
            InvGeneralLookup.lookup_code.ilike(like),
            InvGeneralLookup.description.ilike(like),
        ))
    return q.order_by(InvGeneralLookup.lookup_type, InvGeneralLookup.lookup_value).all()


@router.get("/{lookup_id}", response_model=GeneralLookupOut)
def get_lookup(
    lookup_id:   int,
    db:          Session = Depends(get_db),
    current_user: User   = Depends(get_current_user),
):
    return _get_or_404(db, lookup_id)


@router.post("", response_model=GeneralLookupOut, status_code=status.HTTP_201_CREATED)
def create_lookup(
    body:        GeneralLookupCreate,
    db:          Session = Depends(get_db),
    current_user: User   = Depends(get_current_user),
):
    if body.lookup_type not in LOOKUP_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid lookup_type '{body.lookup_type}'")
    obj = InvGeneralLookup(**body.model_dump(), created_by=current_user.username)
    db.add(obj)
    db.flush()
    _audit(db, current_user, "LOOKUP_CREATED", obj.id,
           f"{obj.lookup_type}:{obj.lookup_code}",
           details=f"Value: {obj.lookup_value}")
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{lookup_id}", response_model=GeneralLookupOut)
def update_lookup(
    lookup_id:   int,
    body:        GeneralLookupUpdate,
    db:          Session = Depends(get_db),
    current_user: User   = Depends(get_current_user),
):
    obj = _get_or_404(db, lookup_id)
    changed = body.model_dump(exclude_unset=True)
    if "lookup_type" in changed and changed["lookup_type"] not in LOOKUP_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid lookup_type '{changed['lookup_type']}'")
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "LOOKUP_UPDATED", obj.id,
           f"{obj.lookup_type}:{obj.lookup_code}",
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{lookup_id}/toggle", response_model=GeneralLookupOut)
def toggle_lookup(
    lookup_id:   int,
    db:          Session = Depends(get_db),
    current_user: User   = Depends(get_current_user),
):
    obj = _get_or_404(db, lookup_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "LOOKUP_TOGGLED", obj.id,
           f"{obj.lookup_type}:{obj.lookup_code}",
           details=f"is_active set to {obj.is_active}")
    db.commit()
    db.refresh(obj)
    return obj
