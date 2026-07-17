"""Inventory – Consumable Types full CRUD."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvConsumableType
from app.schemas.inventory import (
    ConsumableTypeCreate,
    ConsumableTypeOut,
    ConsumableTypeUpdate,
)

router = APIRouter(prefix="/inventory/consumable-types", tags=["inventory-lookup"])


@router.get("", response_model=list[ConsumableTypeOut])
def list_consumable_types(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    return (
        db.query(InvConsumableType)
        .order_by(InvConsumableType.sort_order)
        .all()
    )


@router.post("", response_model=ConsumableTypeOut, status_code=201)
def create_consumable_type(
    body: ConsumableTypeCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvConsumableType).filter_by(name=body.name).first():
        raise HTTPException(400, f"Consumable type '{body.name}' already exists.")
    row = InvConsumableType(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{type_id}", response_model=ConsumableTypeOut)
def get_consumable_type(
    type_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvConsumableType, type_id)
    if not row:
        raise HTTPException(404, "Consumable type not found.")
    return row


@router.patch("/{type_id}", response_model=ConsumableTypeOut)
def update_consumable_type(
    type_id: int,
    body: ConsumableTypeUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvConsumableType, type_id)
    if not row:
        raise HTTPException(404, "Consumable type not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{type_id}/toggle", response_model=ConsumableTypeOut)
def toggle_consumable_type(
    type_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvConsumableType, type_id)
    if not row:
        raise HTTPException(404, "Consumable type not found.")
    row.is_active = not row.is_active
    db.commit()
    db.refresh(row)
    out = ConsumableTypeOut.model_validate(row)
    out.message = f"{row.name} {'activated' if row.is_active else 'deactivated'}."
    return out


@router.delete("/{type_id}", status_code=204)
def delete_consumable_type(
    type_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvConsumableType, type_id)
    if not row:
        raise HTTPException(404, "Consumable type not found.")
    db.delete(row)
    db.commit()
