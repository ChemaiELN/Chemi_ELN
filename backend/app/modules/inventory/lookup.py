"""Inventory – General Lookup CRUD."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvGeneralLookup
from app.schemas.inventory import LookupCreate, LookupOut, LookupUpdate
from app.shared.inv_audit import write_inv_audit

router = APIRouter(prefix="/inventory/lookup", tags=["inventory-lookup"])

LOOKUP_TYPES = [
    "Material Type",
    "STORAGE_LOCATION",
    "HAZARD_CLASS",
    "DISPOSAL_METHOD",
    "VENDOR_TYPE",
    "SAMPLE_TYPE",
    "TEST_CATEGORY",
    "INSTRUMENT_CATEGORY",
    "EQUIPMENT_CATEGORY",
    "COLUMN_PHASE",
    "CUSTOM",
]


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


@router.get("/types")
def list_lookup_types(_: Any = Depends(get_current_user)):
    return LOOKUP_TYPES


@router.get("", response_model=list[LookupOut])
def list_lookups(
    lookup_type: Optional[str] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvGeneralLookup)
    if lookup_type:
        q = q.filter(InvGeneralLookup.lookup_type == lookup_type)
    if active_only:
        q = q.filter(InvGeneralLookup.is_active.is_(True))
    return q.order_by(InvGeneralLookup.lookup_type, InvGeneralLookup.lookup_value).offset(skip).limit(limit).all()


@router.post("", response_model=LookupOut, status_code=201)
def create_lookup(
    body: LookupCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if body.lookup_type not in LOOKUP_TYPES:
        raise HTTPException(400, f"Invalid lookup_type. Allowed: {LOOKUP_TYPES}")
    row = InvGeneralLookup(**body.model_dump(), created_by=_user_ref(current_user))
    db.add(row)
    write_inv_audit(
        db,
        event_type="LOOKUP_CREATED",
        entity_type="inv_general_lookup",
        performed_by=_user_ref(current_user),
        details=f"{body.lookup_type}:{body.lookup_code}",
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/{lookup_id}", response_model=LookupOut)
def get_lookup(
    lookup_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvGeneralLookup, lookup_id)
    if not row:
        raise HTTPException(404, "Lookup not found.")
    return row


@router.patch("/{lookup_id}", response_model=LookupOut)
def update_lookup(
    lookup_id: int,
    body: LookupUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvGeneralLookup, lookup_id)
    if not row:
        raise HTTPException(404, "Lookup not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    write_inv_audit(
        db,
        event_type="LOOKUP_UPDATED",
        entity_type="inv_general_lookup",
        entity_id=lookup_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{lookup_id}/toggle", response_model=LookupOut)
def toggle_lookup(
    lookup_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvGeneralLookup, lookup_id)
    if not row:
        raise HTTPException(404, "Lookup not found.")
    row.is_active = not row.is_active
    write_inv_audit(
        db,
        event_type="LOOKUP_TOGGLED",
        entity_type="inv_general_lookup",
        entity_id=lookup_id,
        performed_by=_user_ref(current_user),
        new_value=str(row.is_active),
    )
    db.commit()
    db.refresh(row)
    return row
