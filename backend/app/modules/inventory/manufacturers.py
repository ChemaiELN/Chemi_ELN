"""
Inventory Master — Manufacturers router
Endpoints:
  GET    /api/inventory/manufacturers        list (search, is_active)
  GET    /api/inventory/manufacturers/{id}   single
  POST   /api/inventory/manufacturers        create
  PATCH  /api/inventory/manufacturers/{id}   update
  PATCH  /api/inventory/manufacturers/{id}/toggle  enable / disable
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory_manufacturers import InvManufacturer
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_manufacturers import (
    ManufacturerCreate, ManufacturerUpdate, ManufacturerOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


def _get_or_404(db: Session, mfr_id: int) -> InvManufacturer:
    m = db.query(InvManufacturer).filter(InvManufacturer.id == mfr_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    return m


def _write_audit(db, user, event_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="manufacturer",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[ManufacturerOut])
def list_manufacturers(
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(None),
    db:           Session        = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    q = db.query(InvManufacturer)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvManufacturer.name.ilike(like),
            InvManufacturer.code.ilike(like),
            InvManufacturer.country.ilike(like),
        ))
    if is_active is not None:
        q = q.filter(InvManufacturer.is_active == is_active)
    return q.order_by(InvManufacturer.code).all()


# ── Single ────────────────────────────────────────────────────────────────────
@router.get("/{mfr_id}", response_model=ManufacturerOut)
def get_manufacturer(
    mfr_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _get_or_404(db, mfr_id)


# ── Create ────────────────────────────────────────────────────────────────────
@router.post("", response_model=ManufacturerOut, status_code=status.HTTP_201_CREATED)
def create_manufacturer(
    body:         ManufacturerCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvManufacturer).filter(InvManufacturer.code == body.code).first():
        raise HTTPException(status_code=400, detail=f"Manufacturer code '{body.code}' already exists")
    m = InvManufacturer(**body.model_dump())
    db.add(m)
    db.flush()
    _write_audit(db, current_user, "MANUFACTURER_CREATED", m.id, m.code,
                 details=f"Name: {m.name}, Country: {m.country}")
    db.commit()
    db.refresh(m)
    return m


# ── Update ────────────────────────────────────────────────────────────────────
@router.patch("/{mfr_id}", response_model=ManufacturerOut)
def update_manufacturer(
    mfr_id:       int,
    body:         ManufacturerUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = _get_or_404(db, mfr_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    _write_audit(db, current_user, "MANUFACTURER_UPDATED", m.id, m.code,
                 details=f"Updated: {list(body.model_dump(exclude_unset=True).keys())}")
    db.commit()
    db.refresh(m)
    return m


# ── Toggle active ─────────────────────────────────────────────────────────────
@router.patch("/{mfr_id}/toggle", response_model=ManufacturerOut)
def toggle_manufacturer(
    mfr_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = _get_or_404(db, mfr_id)
    m.is_active = not m.is_active
    _write_audit(db, current_user, "MANUFACTURER_TOGGLED", m.id, m.code,
                 details=f"is_active set to {m.is_active}")
    db.commit()
    db.refresh(m)
    return m
