"""
Inventory Master — Materials router
Endpoints:
  GET    /api/inventory/materials            list (search, type, is_active)
  GET    /api/inventory/materials/{id}       single with chemical + formulation props
  POST   /api/inventory/materials            create
  PATCH  /api/inventory/materials/{id}       update
  PATCH  /api/inventory/materials/{id}/toggle enable / disable
  PUT    /api/inventory/materials/{id}/chemical-props    upsert chemical props
  PUT    /api/inventory/materials/{id}/formulation-props upsert formulation props
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.inventory_materials import (
    InvMaterial, InvMaterialChemicalProps, InvMaterialFormulationProps,
)
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_materials import (
    MaterialCreate, MaterialUpdate, MaterialOut,
    ChemicalPropsUpsert, ChemicalPropsOut,
    FormulationPropsUpsert, FormulationPropsOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


def _get_or_404(db: Session, material_id: int) -> InvMaterial:
    m = (
        db.query(InvMaterial)
        .options(
            selectinload(InvMaterial.chemical_props),
            selectinload(InvMaterial.formulation_props),
        )
        .filter(InvMaterial.id == material_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Material not found")
    return m


def _write_audit(db, user, event_type, entity_id, entity_ref, details=None,
                 old_value=None, new_value=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="material",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username,
        old_value=old_value, new_value=new_value, details=details,
    ))


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[MaterialOut])
def list_materials(
    search:        Optional[str]  = Query(None),
    material_type: Optional[str]  = Query(None),
    is_active:     Optional[bool] = Query(None),
    department_id: Optional[str]  = Query(None),
    db:            Session        = Depends(get_db),
    current_user:  User           = Depends(get_current_user),
):
    q = db.query(InvMaterial).options(
        selectinload(InvMaterial.chemical_props),
        selectinload(InvMaterial.formulation_props),
    )
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            InvMaterial.name.ilike(like),
            InvMaterial.code.ilike(like),
            InvMaterial.cas_no.ilike(like),
        ))
    if material_type:
        q = q.filter(InvMaterial.material_type == material_type)
    if is_active is not None:
        q = q.filter(InvMaterial.is_active == is_active)
    if department_id:
        q = q.filter(InvMaterial.department_id == department_id)
    return q.order_by(InvMaterial.code).all()


# ── Single ────────────────────────────────────────────────────────────────────
@router.get("/{material_id}", response_model=MaterialOut)
def get_material(
    material_id:  int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _get_or_404(db, material_id)


# ── Create ────────────────────────────────────────────────────────────────────
@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def create_material(
    body:         MaterialCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if db.query(InvMaterial).filter(InvMaterial.code == body.code).first():
        raise HTTPException(status_code=400, detail=f"Material code '{body.code}' already exists")
    m = InvMaterial(**body.model_dump())
    db.add(m)
    db.flush()
    _write_audit(db, current_user, "MATERIAL_CREATED", m.id, m.code,
                 details=f"Name: {m.name}, Type: {m.material_type}")
    db.commit()
    db.refresh(m)
    return _get_or_404(db, m.id)


# ── Update ────────────────────────────────────────────────────────────────────
@router.patch("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id:  int,
    body:         MaterialUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = _get_or_404(db, material_id)
    old = f"Name: {m.name}"
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    _write_audit(db, current_user, "MATERIAL_UPDATED", m.id, m.code,
                 old_value=old, new_value=f"Name: {m.name}")
    db.commit()
    return _get_or_404(db, material_id)


# ── Toggle active ─────────────────────────────────────────────────────────────
@router.patch("/{material_id}/toggle", response_model=MaterialOut)
def toggle_material(
    material_id:  int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = _get_or_404(db, material_id)
    m.is_active = not m.is_active
    _write_audit(db, current_user, "MATERIAL_TOGGLED", m.id, m.code,
                 details=f"is_active set to {m.is_active}")
    db.commit()
    return _get_or_404(db, material_id)


# ── Upsert chemical props ─────────────────────────────────────────────────────
@router.put("/{material_id}/chemical-props", response_model=ChemicalPropsOut)
def upsert_chemical_props(
    material_id:  int,
    body:         ChemicalPropsUpsert,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    _get_or_404(db, material_id)  # 404 check
    cp = db.query(InvMaterialChemicalProps).filter_by(material_id=material_id).first()
    if cp:
        old = f"density: {cp.density}, purity: {cp.purity_pct}"
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(cp, field, value)
        new = f"density: {cp.density}, purity: {cp.purity_pct}"
    else:
        old = None
        cp = InvMaterialChemicalProps(material_id=material_id, **body.model_dump())
        db.add(cp)
        new = f"density: {cp.density}, purity: {cp.purity_pct}"
    db.flush()
    _write_audit(db, current_user, "CHEMICAL_PROPS_UPDATED",
                 material_id, str(material_id), old_value=old, new_value=new)
    db.commit()
    db.refresh(cp)
    return cp


# ── Upsert formulation props ──────────────────────────────────────────────────
@router.put("/{material_id}/formulation-props", response_model=FormulationPropsOut)
def upsert_formulation_props(
    material_id:  int,
    body:         FormulationPropsUpsert,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    _get_or_404(db, material_id)
    fp = db.query(InvMaterialFormulationProps).filter_by(material_id=material_id).first()
    if fp:
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(fp, field, value)
    else:
        fp = InvMaterialFormulationProps(material_id=material_id, **body.model_dump())
        db.add(fp)
    db.flush()
    _write_audit(db, current_user, "FORMULATION_PROPS_UPDATED",
                 material_id, str(material_id),
                 details=f"role: {fp.role}, concentration: {fp.concentration}")
    db.commit()
    db.refresh(fp)
    return fp
