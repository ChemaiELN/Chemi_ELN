"""Inventory – Spare Parts master (Phase 5)."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvSparePart
from app.schemas.inventory import SparePartCreate, SparePartOut, SparePartUpdate

router = APIRouter(prefix="/inventory/spare-parts", tags=["inventory-spare-parts"])


@router.get("", response_model=list[SparePartOut])
def list_spare_parts(
    search: Optional[str] = Query(None),
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvSparePart)
    if active_only:
        q = q.filter(InvSparePart.is_active.is_(True))
    if search:
        term = f"%{search}%"
        q = q.filter(InvSparePart.name.ilike(term) | InvSparePart.part_code.ilike(term))
    return q.order_by(InvSparePart.part_code).all()


@router.post("", response_model=SparePartOut, status_code=201)
def create_spare_part(
    body: SparePartCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvSparePart).filter_by(part_code=body.part_code).first():
        raise HTTPException(409, f"Part code '{body.part_code}' already exists.")
    row = InvSparePart(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=SparePartOut)
def update_spare_part(
    item_id: int,
    body: SparePartUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvSparePart, item_id)
    if not row:
        raise HTTPException(404, "Spare part not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{item_id}/toggle", response_model=SparePartOut)
def toggle_spare_part(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvSparePart, item_id)
    if not row:
        raise HTTPException(404, "Spare part not found.")
    row.is_active = not row.is_active
    db.commit()
    db.refresh(row)
    return row
