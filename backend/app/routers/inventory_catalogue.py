"""
Inventory Master — Equipment / Instrument / Column Catalogue router
Three sets of endpoints:

  Equipment Catalogue    /api/inventory/equipment-catalogue
  Instrument Catalogue   /api/inventory/instrument-catalogue
  Column Catalogue       /api/inventory/column-catalogue

Each set:
  GET    ""              list (search, status, type_id, is_active)
  GET    "/{id}"         single with denormalised type info
  POST   ""              create
  PATCH  "/{id}"         update
  PATCH  "/{id}/toggle"  enable / disable
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_equipment import (
    InvEquipmentCatalogue, InvEquipmentType,
    InvInstrumentCatalogue, InvInstrumentType,
    InvColumnCatalogue, InvColumnType,
    InvAuditTrail,
)
from app.schemas.inventory_catalogue import (
    EquipmentCatalogueCreate, EquipmentCatalogueUpdate, EquipmentCatalogueOut,
    InstrumentCatalogueCreate, InstrumentCatalogueUpdate, InstrumentCatalogueOut,
    ColumnCatalogueCreate, ColumnCatalogueUpdate, ColumnCatalogueOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

equip_cat_router  = APIRouter()
instr_cat_router  = APIRouter()
col_cat_router    = APIRouter()


# ── shared audit helper ───────────────────────────────────────────────────────

def _audit(db, user, event_type, entity_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type=entity_type,
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ═══════════════════════════════════════════════════════════════════════════════
# EQUIPMENT CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

def _ec_or_404(db: Session, ec_id: int) -> InvEquipmentCatalogue:
    obj = (
        db.query(InvEquipmentCatalogue)
        .options(joinedload(InvEquipmentCatalogue.equipment_type))
        .filter(InvEquipmentCatalogue.id == ec_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return obj


def _enrich_ec(obj: InvEquipmentCatalogue) -> EquipmentCatalogueOut:
    out = EquipmentCatalogueOut.model_validate(obj)
    if obj.equipment_type:
        out.equipment_type_name = obj.equipment_type.name
        out.equipment_type_code = obj.equipment_type.code
    return out


@equip_cat_router.get("", response_model=List[EquipmentCatalogueOut])
def list_equipment(
    search:            Optional[str]  = Query(None, description="asset_id, name, or location"),
    status_filter:     Optional[str]  = Query(None, alias="status"),
    equipment_type_id: Optional[int]  = Query(None),
    maintenance_status: Optional[str] = Query(None),
    is_active:         Optional[bool] = Query(None),
    db:                Session        = Depends(get_db),
    current_user:      User           = Depends(get_current_user),
):
    q = db.query(InvEquipmentCatalogue).options(
        joinedload(InvEquipmentCatalogue.equipment_type)
    )
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvEquipmentCatalogue.asset_id.ilike(like),
            InvEquipmentCatalogue.name.ilike(like),
            InvEquipmentCatalogue.location.ilike(like),
            InvEquipmentCatalogue.serial_no.ilike(like),
        ))
    if status_filter:
        q = q.filter(InvEquipmentCatalogue.status == status_filter.upper())
    if equipment_type_id:
        q = q.filter(InvEquipmentCatalogue.equipment_type_id == equipment_type_id)
    if maintenance_status:
        q = q.filter(InvEquipmentCatalogue.maintenance_status == maintenance_status.upper())
    if is_active is not None:
        q = q.filter(InvEquipmentCatalogue.is_active == is_active)
    return [_enrich_ec(obj) for obj in q.order_by(InvEquipmentCatalogue.asset_id).all()]


@equip_cat_router.get("/{ec_id}", response_model=EquipmentCatalogueOut)
def get_equipment(
    ec_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_ec(_ec_or_404(db, ec_id))


@equip_cat_router.post("", response_model=EquipmentCatalogueOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    body:         EquipmentCatalogueCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvEquipmentCatalogue).filter(
        InvEquipmentCatalogue.asset_id == body.asset_id
    ).first():
        raise HTTPException(status_code=400, detail=f"Asset ID '{body.asset_id}' already exists")
    obj = InvEquipmentCatalogue(**body.model_dump())
    db.add(obj)
    db.flush()
    _audit(db, current_user, "EQUIPMENT_CREATED", "equipment", obj.id, obj.asset_id,
           details=f"{obj.name} | {obj.manufacturer or ''} {obj.model or ''} | {obj.location or ''}")
    db.commit()
    return _enrich_ec(_ec_or_404(db, obj.id))


@equip_cat_router.patch("/{ec_id}", response_model=EquipmentCatalogueOut)
def update_equipment(
    ec_id:        int,
    body:         EquipmentCatalogueUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ec_or_404(db, ec_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "EQUIPMENT_UPDATED", "equipment", obj.id, obj.asset_id,
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    return _enrich_ec(_ec_or_404(db, ec_id))


@equip_cat_router.patch("/{ec_id}/toggle", response_model=EquipmentCatalogueOut)
def toggle_equipment(
    ec_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ec_or_404(db, ec_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "EQUIPMENT_TOGGLED", "equipment", obj.id, obj.asset_id,
           details=f"is_active set to {obj.is_active}")
    db.commit()
    return _enrich_ec(_ec_or_404(db, ec_id))


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

def _ic_or_404(db: Session, ic_id: int) -> InvInstrumentCatalogue:
    obj = (
        db.query(InvInstrumentCatalogue)
        .options(joinedload(InvInstrumentCatalogue.instrument_type))
        .filter(InvInstrumentCatalogue.id == ic_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return obj


def _enrich_ic(obj: InvInstrumentCatalogue) -> InstrumentCatalogueOut:
    out = InstrumentCatalogueOut.model_validate(obj)
    if obj.instrument_type:
        out.instrument_type_name = obj.instrument_type.name
        out.instrument_type_code = obj.instrument_type.code
    return out


@instr_cat_router.get("", response_model=List[InstrumentCatalogueOut])
def list_instruments(
    search:             Optional[str]  = Query(None, description="asset_id, name, or location"),
    status_filter:      Optional[str]  = Query(None, alias="status"),
    instrument_type_id: Optional[int]  = Query(None),
    calibration_status: Optional[str]  = Query(None),
    is_active:          Optional[bool] = Query(None),
    db:                 Session        = Depends(get_db),
    current_user:       User           = Depends(get_current_user),
):
    q = db.query(InvInstrumentCatalogue).options(
        joinedload(InvInstrumentCatalogue.instrument_type)
    )
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvInstrumentCatalogue.asset_id.ilike(like),
            InvInstrumentCatalogue.name.ilike(like),
            InvInstrumentCatalogue.location.ilike(like),
            InvInstrumentCatalogue.serial_no.ilike(like),
        ))
    if status_filter:
        q = q.filter(InvInstrumentCatalogue.status == status_filter.upper())
    if instrument_type_id:
        q = q.filter(InvInstrumentCatalogue.instrument_type_id == instrument_type_id)
    if calibration_status:
        q = q.filter(InvInstrumentCatalogue.calibration_status == calibration_status.upper())
    if is_active is not None:
        q = q.filter(InvInstrumentCatalogue.is_active == is_active)
    return [_enrich_ic(obj) for obj in q.order_by(InvInstrumentCatalogue.asset_id).all()]


@instr_cat_router.get("/{ic_id}", response_model=InstrumentCatalogueOut)
def get_instrument(
    ic_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_ic(_ic_or_404(db, ic_id))


@instr_cat_router.post("", response_model=InstrumentCatalogueOut, status_code=status.HTTP_201_CREATED)
def create_instrument(
    body:         InstrumentCatalogueCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvInstrumentCatalogue).filter(
        InvInstrumentCatalogue.asset_id == body.asset_id
    ).first():
        raise HTTPException(status_code=400, detail=f"Asset ID '{body.asset_id}' already exists")
    obj = InvInstrumentCatalogue(**body.model_dump())
    db.add(obj)
    db.flush()
    _audit(db, current_user, "INSTRUMENT_CREATED", "instrument", obj.id, obj.asset_id,
           details=f"{obj.name} | {obj.manufacturer or ''} {obj.model or ''} | {obj.location or ''}")
    db.commit()
    return _enrich_ic(_ic_or_404(db, obj.id))


@instr_cat_router.patch("/{ic_id}", response_model=InstrumentCatalogueOut)
def update_instrument(
    ic_id:        int,
    body:         InstrumentCatalogueUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ic_or_404(db, ic_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    _audit(db, current_user, "INSTRUMENT_UPDATED", "instrument", obj.id, obj.asset_id,
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    return _enrich_ic(_ic_or_404(db, ic_id))


@instr_cat_router.patch("/{ic_id}/toggle", response_model=InstrumentCatalogueOut)
def toggle_instrument(
    ic_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _ic_or_404(db, ic_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "INSTRUMENT_TOGGLED", "instrument", obj.id, obj.asset_id,
           details=f"is_active set to {obj.is_active}")
    db.commit()
    return _enrich_ic(_ic_or_404(db, ic_id))


# ═══════════════════════════════════════════════════════════════════════════════
# COLUMN CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

def _cc_or_404(db: Session, cc_id: int) -> InvColumnCatalogue:
    obj = (
        db.query(InvColumnCatalogue)
        .options(joinedload(InvColumnCatalogue.column_type))
        .filter(InvColumnCatalogue.id == cc_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Column not found")
    return obj


def _enrich_cc(obj: InvColumnCatalogue) -> ColumnCatalogueOut:
    out = ColumnCatalogueOut.model_validate(obj)
    if obj.column_type:
        out.column_type_name = obj.column_type.name
        out.column_type_code = obj.column_type.code
    # compute injections remaining
    if obj.max_injections is not None:
        out.injections_remaining = max(0, obj.max_injections - obj.cumulative_injections)
    return out


@col_cat_router.get("", response_model=List[ColumnCatalogueOut])
def list_columns(
    search:         Optional[str]  = Query(None, description="column_id, name, or serial_no"),
    status_filter:  Optional[str]  = Query(None, alias="status"),
    column_type_id: Optional[int]  = Query(None),
    is_active:      Optional[bool] = Query(None),
    db:             Session        = Depends(get_db),
    current_user:   User           = Depends(get_current_user),
):
    q = db.query(InvColumnCatalogue).options(
        joinedload(InvColumnCatalogue.column_type)
    )
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvColumnCatalogue.column_id.ilike(like),
            InvColumnCatalogue.name.ilike(like),
            InvColumnCatalogue.serial_no.ilike(like),
        ))
    if status_filter:
        q = q.filter(InvColumnCatalogue.status == status_filter.upper())
    if column_type_id:
        q = q.filter(InvColumnCatalogue.column_type_id == column_type_id)
    if is_active is not None:
        q = q.filter(InvColumnCatalogue.is_active == is_active)
    return [_enrich_cc(obj) for obj in q.order_by(InvColumnCatalogue.column_id).all()]


@col_cat_router.get("/{cc_id}", response_model=ColumnCatalogueOut)
def get_column(
    cc_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich_cc(_cc_or_404(db, cc_id))


@col_cat_router.post("", response_model=ColumnCatalogueOut, status_code=status.HTTP_201_CREATED)
def create_column(
    body:         ColumnCatalogueCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvColumnCatalogue).filter(
        InvColumnCatalogue.column_id == body.column_id
    ).first():
        raise HTTPException(status_code=400, detail=f"Column ID '{body.column_id}' already exists")
    obj = InvColumnCatalogue(**body.model_dump())
    db.add(obj)
    db.flush()
    _audit(db, current_user, "COLUMN_CREATED", "column", obj.id, obj.column_id,
           details=f"{obj.name} | max_injections={obj.max_injections}")
    db.commit()
    return _enrich_cc(_cc_or_404(db, obj.id))


@col_cat_router.patch("/{cc_id}", response_model=ColumnCatalogueOut)
def update_column(
    cc_id:        int,
    body:         ColumnCatalogueUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _cc_or_404(db, cc_id)
    changed = body.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    # auto-update status if injections exhausted
    if obj.max_injections is not None and obj.cumulative_injections >= obj.max_injections:
        obj.status = "EXHAUSTED"
    _audit(db, current_user, "COLUMN_UPDATED", "column", obj.id, obj.column_id,
           details=f"Updated: {list(changed.keys())}")
    db.commit()
    return _enrich_cc(_cc_or_404(db, cc_id))


@col_cat_router.patch("/{cc_id}/toggle", response_model=ColumnCatalogueOut)
def toggle_column(
    cc_id:        int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    obj = _cc_or_404(db, cc_id)
    obj.is_active = not obj.is_active
    _audit(db, current_user, "COLUMN_TOGGLED", "column", obj.id, obj.column_id,
           details=f"is_active set to {obj.is_active}")
    db.commit()
    return _enrich_cc(_cc_or_404(db, cc_id))
