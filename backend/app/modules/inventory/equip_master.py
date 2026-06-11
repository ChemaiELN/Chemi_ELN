"""
Inventory Master — Equipment Master Data router
Three sets of endpoints (same CRUD pattern each):

  Equipment Types    /api/inventory/equipment-types
  Instrument Types   /api/inventory/instrument-types
  Column Types       /api/inventory/column-types

Each set:
  GET    ""          list (search, is_active)
  GET    "/{id}"     single
  POST   ""          create
  PATCH  "/{id}"     update
  PATCH  "/{id}/toggle"  enable / disable
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory_equipment import (
    InvEquipmentType, InvInstrumentType, InvColumnType, InvAuditTrail,
)
from app.schemas.inventory_equip_master import (
    EquipmentTypeCreate, EquipmentTypeUpdate, EquipmentTypeOut,
    InstrumentTypeCreate, InstrumentTypeUpdate, InstrumentTypeOut,
    ColumnTypeCreate, ColumnTypeUpdate, ColumnTypeOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

# Three separate routers — each registered at a different prefix in main.py
equip_type_router = APIRouter()
instr_type_router = APIRouter()
col_type_router   = APIRouter()


# ── shared audit helper ───────────────────────────────────────────────────────

def _audit(db, user, event_type, entity_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type=entity_type,
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ═══════════════════════════════════════════════════════════════════════════════
# EQUIPMENT TYPES
# ═══════════════════════════════════════════════════════════════════════════════

def _et_or_404(db: Session, et_id: int) -> InvEquipmentType:
    obj = db.query(InvEquipmentType).filter(InvEquipmentType.id == et_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    return obj


@equip_type_router.get("", response_model=List[EquipmentTypeOut])
def list_equipment_types(
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(None),
    db:           Session        = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    q = db.query(InvEquipmentType)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvEquipmentType.name.ilike(like),
            InvEquipmentType.code.ilike(like),
        ))
    if is_active is not None:
        q = q.filter(InvEquipmentType.is_active == is_active)
    return q.order_by(InvEquipmentType.code).all()


@equip_type_router.get("/{et_id}", response_model=EquipmentTypeOut)
def get_equipment_type(
    et_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _et_or_404(db, et_id)


@equip_type_router.post("", response_model=EquipmentTypeOut, status_code=status.HTTP_201_CREATED)
def create_equipment_type(
    body:         EquipmentTypeCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvEquipmentType).filter(InvEquipmentType.code == body.code).first():
        raise HTTPException(status_code=400, detail=f"Equipment type code '{body.code}' already exists")
    obj = InvEquipmentType(**body.model_dump())
    db.add(obj)
    db.flush()
    _audit(db, current_user, "EQUIP_TYPE_CREATED", "equipment_type", obj.id, obj.code,
           details=f"Name: {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@equip_type_router.patch("/{et_id}", response_model=EquipmentTypeOut)
def update_equipment_type(
    et_id:        int,
    body:         EquipmentTypeUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _et_or_404(db, et_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "EQUIP_TYPE_UPDATED", "equipment_type", obj.id, obj.code,
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    db.refresh(obj)
    return obj


@equip_type_router.patch("/{et_id}/toggle", response_model=EquipmentTypeOut)
def toggle_equipment_type(
    et_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _et_or_404(db, et_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "EQUIP_TYPE_TOGGLED", "equipment_type", obj.id, obj.code,
           details=f"is_active set to {obj.is_active}")
    db.commit()
    db.refresh(obj)
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT TYPES
# ═══════════════════════════════════════════════════════════════════════════════

def _it_or_404(db: Session, it_id: int) -> InvInstrumentType:
    obj = db.query(InvInstrumentType).filter(InvInstrumentType.id == it_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Instrument type not found")
    return obj


@instr_type_router.get("", response_model=List[InstrumentTypeOut])
def list_instrument_types(
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(None),
    db:           Session        = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    q = db.query(InvInstrumentType)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvInstrumentType.name.ilike(like),
            InvInstrumentType.code.ilike(like),
        ))
    if is_active is not None:
        q = q.filter(InvInstrumentType.is_active == is_active)
    return q.order_by(InvInstrumentType.code).all()


@instr_type_router.get("/{it_id}", response_model=InstrumentTypeOut)
def get_instrument_type(
    it_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _it_or_404(db, it_id)


@instr_type_router.post("", response_model=InstrumentTypeOut, status_code=status.HTTP_201_CREATED)
def create_instrument_type(
    body:         InstrumentTypeCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvInstrumentType).filter(InvInstrumentType.code == body.code).first():
        raise HTTPException(status_code=400, detail=f"Instrument type code '{body.code}' already exists")
    obj = InvInstrumentType(**body.model_dump())
    db.add(obj)
    db.flush()
    _audit(db, current_user, "INSTR_TYPE_CREATED", "instrument_type", obj.id, obj.code,
           details=f"Name: {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@instr_type_router.patch("/{it_id}", response_model=InstrumentTypeOut)
def update_instrument_type(
    it_id:        int,
    body:         InstrumentTypeUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _it_or_404(db, it_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "INSTR_TYPE_UPDATED", "instrument_type", obj.id, obj.code,
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    db.refresh(obj)
    return obj


@instr_type_router.patch("/{it_id}/toggle", response_model=InstrumentTypeOut)
def toggle_instrument_type(
    it_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _it_or_404(db, it_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "INSTR_TYPE_TOGGLED", "instrument_type", obj.id, obj.code,
           details=f"is_active set to {obj.is_active}")
    db.commit()
    db.refresh(obj)
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# COLUMN TYPES
# ═══════════════════════════════════════════════════════════════════════════════

def _ct_or_404(db: Session, ct_id: int) -> InvColumnType:
    obj = db.query(InvColumnType).filter(InvColumnType.id == ct_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Column type not found")
    return obj


@col_type_router.get("", response_model=List[ColumnTypeOut])
def list_column_types(
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(None),
    db:           Session        = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    q = db.query(InvColumnType)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvColumnType.name.ilike(like),
            InvColumnType.code.ilike(like),
        ))
    if is_active is not None:
        q = q.filter(InvColumnType.is_active == is_active)
    return q.order_by(InvColumnType.code).all()


@col_type_router.get("/{ct_id}", response_model=ColumnTypeOut)
def get_column_type(
    ct_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _ct_or_404(db, ct_id)


@col_type_router.post("", response_model=ColumnTypeOut, status_code=status.HTTP_201_CREATED)
def create_column_type(
    body:         ColumnTypeCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvColumnType).filter(InvColumnType.code == body.code).first():
        raise HTTPException(status_code=400, detail=f"Column type code '{body.code}' already exists")
    obj = InvColumnType(**body.model_dump())
    db.add(obj)
    db.flush()
    _audit(db, current_user, "COL_TYPE_CREATED", "column_type", obj.id, obj.code,
           details=f"Name: {obj.name}, length={obj.length_mm}mm, particle={obj.particle_size_um}um")
    db.commit()
    db.refresh(obj)
    return obj


@col_type_router.patch("/{ct_id}", response_model=ColumnTypeOut)
def update_column_type(
    ct_id:        int,
    body:         ColumnTypeUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ct_or_404(db, ct_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "COL_TYPE_UPDATED", "column_type", obj.id, obj.code,
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    db.refresh(obj)
    return obj


@col_type_router.patch("/{ct_id}/toggle", response_model=ColumnTypeOut)
def toggle_column_type(
    ct_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ct_or_404(db, ct_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "COL_TYPE_TOGGLED", "column_type", obj.id, obj.code,
           details=f"is_active set to {obj.is_active}")
    db.commit()
    db.refresh(obj)
    return obj
