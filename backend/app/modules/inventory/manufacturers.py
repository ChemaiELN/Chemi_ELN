"""Inventory – Manufacturers endpoints."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvManufacturer
from app.schemas.inventory import (
    ManufacturerCreate,
    ManufacturerOut,
    ManufacturerUpdate,
)

router = APIRouter(prefix="/inventory/manufacturers", tags=["inventory-manufacturers"])


@router.get("", response_model=list[ManufacturerOut])
def list_manufacturers(
    search: Optional[str] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvManufacturer)
    if active_only:
        q = q.filter(InvManufacturer.is_active.is_(True))
    if search:
        term = f"%{search}%"
        q = q.filter(
            InvManufacturer.name.ilike(term) | InvManufacturer.code.ilike(term)
        )
    return q.order_by(InvManufacturer.name).offset(skip).limit(limit).all()


@router.post("", response_model=ManufacturerOut, status_code=201)
def create_manufacturer(
    body: ManufacturerCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvManufacturer).filter_by(code=body.code).first():
        raise HTTPException(409, f"Manufacturer code '{body.code}' already exists.")
    row = InvManufacturer(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{manufacturer_id}", response_model=ManufacturerOut)
def get_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturer, manufacturer_id)
    if not row:
        raise HTTPException(404, "Manufacturer not found.")
    return row


@router.patch("/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer(
    manufacturer_id: int,
    body: ManufacturerUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturer, manufacturer_id)
    if not row:
        raise HTTPException(404, "Manufacturer not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{manufacturer_id}/deactivate", response_model=ManufacturerOut)
def deactivate_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturer, manufacturer_id)
    if not row:
        raise HTTPException(404, "Manufacturer not found.")
    row.is_active = False
    db.commit()
    db.refresh(row)
    return row
