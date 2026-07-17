"""Inventory – UOM Dimensions and Units CRUD."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvUomDimension, InvUomUnit
from app.schemas.inventory import (
    UomDimensionCreate,
    UomDimensionOut,
    UomDimensionUpdate,
    UomUnitCreate,
    UomUnitOut,
    UomUnitUpdate,
)
from app.shared.inv_audit import write_inv_audit

router = APIRouter(prefix="/inventory/uom-master", tags=["inventory-uom"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


@router.get("", response_model=list[UomDimensionOut])
def list_dimensions(
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvUomDimension)
    if active_only:
        q = q.filter(InvUomDimension.is_active.is_(True))
    return q.order_by(InvUomDimension.sort_order).offset(skip).limit(limit).all()


@router.post("", response_model=UomDimensionOut, status_code=201)
def create_dimension(
    body: UomDimensionCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if db.query(InvUomDimension).filter_by(dimension_key=body.dimension_key).first():
        raise HTTPException(409, f"Dimension key '{body.dimension_key}' already exists.")
    row = InvUomDimension(**body.model_dump())
    db.add(row)
    write_inv_audit(
        db,
        event_type="UOM_DIMENSION_CREATED",
        entity_type="inv_uom_dimension",
        entity_ref=body.dimension_key,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/{dimension_key}", response_model=UomDimensionOut)
def get_dimension(
    dimension_key: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.query(InvUomDimension).filter_by(dimension_key=dimension_key).first()
    if not row:
        raise HTTPException(404, f"Dimension '{dimension_key}' not found.")
    return row


@router.patch("/{dimension_id}", response_model=UomDimensionOut)
def update_dimension(
    dimension_id: int,
    body: UomDimensionUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvUomDimension, dimension_id)
    if not row:
        raise HTTPException(404, "Dimension not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    write_inv_audit(
        db,
        event_type="UOM_DIMENSION_UPDATED",
        entity_type="inv_uom_dimension",
        entity_id=dimension_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{dimension_id}/toggle", response_model=UomDimensionOut)
def toggle_dimension(
    dimension_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvUomDimension, dimension_id)
    if not row:
        raise HTTPException(404, "Dimension not found.")
    row.is_active = not row.is_active
    write_inv_audit(
        db,
        event_type="UOM_DIMENSION_TOGGLED",
        entity_type="inv_uom_dimension",
        entity_id=dimension_id,
        performed_by=_user_ref(current_user),
        new_value=str(row.is_active),
    )
    db.commit()
    db.refresh(row)
    out = UomDimensionOut.model_validate(row)
    out.message = f"{row.display_name} {'activated' if row.is_active else 'deactivated'}."
    return out


@router.post("/{dimension_id}/units", response_model=UomUnitOut, status_code=201)
def create_unit(
    dimension_id: int,
    body: UomUnitCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvUomDimension, dimension_id):
        raise HTTPException(404, "Dimension not found.")
    exists = db.query(InvUomUnit).filter_by(dimension_id=dimension_id, symbol=body.symbol).first()
    if exists:
        raise HTTPException(409, f"Symbol '{body.symbol}' already exists in this dimension.")
    row = InvUomUnit(dimension_id=dimension_id, **body.model_dump())
    db.add(row)
    write_inv_audit(
        db,
        event_type="UOM_UNIT_CREATED",
        entity_type="inv_uom_unit",
        performed_by=_user_ref(current_user),
        details=f"dim={dimension_id} symbol={body.symbol}",
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/units/{unit_id}", response_model=UomUnitOut)
def update_unit(
    unit_id: int,
    body: UomUnitUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvUomUnit, unit_id)
    if not row:
        raise HTTPException(404, "Unit not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    write_inv_audit(
        db,
        event_type="UOM_UNIT_UPDATED",
        entity_type="inv_uom_unit",
        entity_id=unit_id,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/units/{unit_id}/toggle", response_model=UomUnitOut)
def toggle_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvUomUnit, unit_id)
    if not row:
        raise HTTPException(404, "Unit not found.")
    row.is_active = not row.is_active
    write_inv_audit(
        db,
        event_type="UOM_UNIT_TOGGLED",
        entity_type="inv_uom_unit",
        entity_id=unit_id,
        performed_by=_user_ref(current_user),
        new_value=str(row.is_active),
    )
    db.commit()
    db.refresh(row)
    out = UomUnitOut.model_validate(row)
    out.message = f"{row.name} {'activated' if row.is_active else 'deactivated'}."
    return out
