"""Inventory – Equipment, Instrument, and Column catalogue endpoints."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvColumnCatalogue,
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
)
from app.schemas.inventory import (
    ColumnCatalogueCreate,
    ColumnCatalogueOut,
    ColumnCatalogueUpdate,
    EquipmentCatalogueCreate,
    EquipmentCatalogueOut,
    EquipmentCatalogueUpdate,
    InstrumentCatalogueCreate,
    InstrumentCatalogueOut,
    InstrumentCatalogueUpdate,
)

# ── Equipment Catalogue ────────────────────────────────────────────────────────
equipment_router = APIRouter(
    prefix="/inventory/equipment", tags=["inventory-equipment"]
)


@equipment_router.get("", response_model=list[EquipmentCatalogueOut])
def list_equipment(
    search: Optional[str] = Query(None),
    equipment_type_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvEquipmentCatalogue)
    if active_only:
        q = q.filter(InvEquipmentCatalogue.is_active.is_(True))
    if equipment_type_id is not None:
        q = q.filter(InvEquipmentCatalogue.equipment_type_id == equipment_type_id)
    if status:
        q = q.filter(InvEquipmentCatalogue.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            InvEquipmentCatalogue.name.ilike(term)
            | InvEquipmentCatalogue.asset_id.ilike(term)
        )
    return q.order_by(InvEquipmentCatalogue.asset_id).offset(skip).limit(limit).all()


@equipment_router.post("", response_model=EquipmentCatalogueOut, status_code=201)
def create_equipment(
    body: EquipmentCatalogueCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvEquipmentCatalogue).filter_by(asset_id=body.asset_id).first():
        raise HTTPException(409, f"Asset ID '{body.asset_id}' already exists.")
    row = InvEquipmentCatalogue(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@equipment_router.get("/{item_id}", response_model=EquipmentCatalogueOut)
def get_equipment(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvEquipmentCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Equipment not found.")
    return row


@equipment_router.patch("/{item_id}", response_model=EquipmentCatalogueOut)
def update_equipment(
    item_id: int,
    body: EquipmentCatalogueUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvEquipmentCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Equipment not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@equipment_router.delete("/{item_id}/deactivate", response_model=EquipmentCatalogueOut)
def deactivate_equipment(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvEquipmentCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Equipment not found.")
    row.is_active = False
    db.commit()
    db.refresh(row)
    return row


# ── Instrument Catalogue ───────────────────────────────────────────────────────
instrument_router = APIRouter(
    prefix="/inventory/instruments", tags=["inventory-instruments"]
)


@instrument_router.get("", response_model=list[InstrumentCatalogueOut])
def list_instruments(
    search: Optional[str] = Query(None),
    instrument_type_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvInstrumentCatalogue)
    if active_only:
        q = q.filter(InvInstrumentCatalogue.is_active.is_(True))
    if instrument_type_id is not None:
        q = q.filter(InvInstrumentCatalogue.instrument_type_id == instrument_type_id)
    if status:
        q = q.filter(InvInstrumentCatalogue.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            InvInstrumentCatalogue.name.ilike(term)
            | InvInstrumentCatalogue.asset_id.ilike(term)
        )
    return q.order_by(InvInstrumentCatalogue.asset_id).offset(skip).limit(limit).all()


@instrument_router.post("", response_model=InstrumentCatalogueOut, status_code=201)
def create_instrument(
    body: InstrumentCatalogueCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvInstrumentCatalogue).filter_by(asset_id=body.asset_id).first():
        raise HTTPException(409, f"Asset ID '{body.asset_id}' already exists.")
    row = InvInstrumentCatalogue(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@instrument_router.get("/{item_id}", response_model=InstrumentCatalogueOut)
def get_instrument(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Instrument not found.")
    return row


@instrument_router.patch("/{item_id}", response_model=InstrumentCatalogueOut)
def update_instrument(
    item_id: int,
    body: InstrumentCatalogueUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Instrument not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@instrument_router.delete("/{item_id}/deactivate", response_model=InstrumentCatalogueOut)
def deactivate_instrument(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Instrument not found.")
    row.is_active = False
    db.commit()
    db.refresh(row)
    return row


# ── Column Catalogue ───────────────────────────────────────────────────────────
column_router = APIRouter(
    prefix="/inventory/columns", tags=["inventory-columns"]
)


@column_router.get("", response_model=list[ColumnCatalogueOut])
def list_columns(
    search: Optional[str] = Query(None),
    column_type_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvColumnCatalogue)
    if active_only:
        q = q.filter(InvColumnCatalogue.is_active.is_(True))
    if column_type_id is not None:
        q = q.filter(InvColumnCatalogue.column_type_id == column_type_id)
    if status:
        q = q.filter(InvColumnCatalogue.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            InvColumnCatalogue.name.ilike(term)
            | InvColumnCatalogue.column_id.ilike(term)
        )
    return q.order_by(InvColumnCatalogue.column_id).offset(skip).limit(limit).all()


@column_router.post("", response_model=ColumnCatalogueOut, status_code=201)
def create_column(
    body: ColumnCatalogueCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvColumnCatalogue).filter_by(column_id=body.column_id).first():
        raise HTTPException(409, f"Column ID '{body.column_id}' already exists.")
    row = InvColumnCatalogue(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@column_router.get("/{item_id}", response_model=ColumnCatalogueOut)
def get_column(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvColumnCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Column not found.")
    return row


@column_router.patch("/{item_id}", response_model=ColumnCatalogueOut)
def update_column(
    item_id: int,
    body: ColumnCatalogueUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvColumnCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Column not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    # auto-EXHAUSTED logic
    if row.cumulative_injections >= row.max_injections and row.status == "ACTIVE":
        row.status = "EXHAUSTED"
    db.commit()
    db.refresh(row)
    return row


@column_router.delete("/{item_id}/deactivate", response_model=ColumnCatalogueOut)
def deactivate_column(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvColumnCatalogue, item_id)
    if not row:
        raise HTTPException(404, "Column not found.")
    row.is_active = False
    db.commit()
    db.refresh(row)
    return row
