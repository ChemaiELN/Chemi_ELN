"""Inventory – Storage Conditions CRUD."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvStorageCondition
from app.schemas.inventory import (
    StorageConditionCreate,
    StorageConditionOut,
    StorageConditionUpdate,
)

router = APIRouter(prefix="/inventory/storage-conditions", tags=["inventory-lookup"])


@router.get("", response_model=list[StorageConditionOut])
def list_storage_conditions(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    return (
        db.query(InvStorageCondition)
        .order_by(InvStorageCondition.sort_order, InvStorageCondition.label)
        .all()
    )


@router.post("", response_model=StorageConditionOut, status_code=201)
def create_storage_condition(
    body: StorageConditionCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvStorageCondition).filter_by(label=body.label).first():
        raise HTTPException(400, f"Storage condition '{body.label}' already exists.")
    row = InvStorageCondition(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{condition_id}", response_model=StorageConditionOut)
def update_storage_condition(
    condition_id: int,
    body: StorageConditionUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvStorageCondition, condition_id)
    if not row:
        raise HTTPException(404, "Storage condition not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{condition_id}/toggle", response_model=StorageConditionOut)
def toggle_storage_condition(
    condition_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvStorageCondition, condition_id)
    if not row:
        raise HTTPException(404, "Storage condition not found.")
    row.is_active = not row.is_active
    db.commit()
    db.refresh(row)
    out = StorageConditionOut.model_validate(row)
    out.message = f"{row.label} {'activated' if row.is_active else 'deactivated'}."
    return out


@router.delete("/{condition_id}", status_code=204)
def delete_storage_condition(
    condition_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvStorageCondition, condition_id)
    if not row:
        raise HTTPException(404, "Storage condition not found.")
    db.delete(row)
    db.commit()
