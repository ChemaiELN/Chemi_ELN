"""Inventory – Materials, ChemicalProps, FormulationProps endpoints."""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvMaterialChemicalProps,
    InvMaterialFormulationProps,
    InvMaterial,
)
from app.schemas.inventory import (
    ChemicalPropsOut,
    ChemicalPropsUpsert,
    FormulationPropsOut,
    FormulationPropsUpsert,
    MaterialCreate,
    MaterialOut,
    MaterialUpdate,
)

router = APIRouter(prefix="/inventory/materials", tags=["inventory-materials"])


@router.get("", response_model=list[MaterialOut])
def list_materials(
    search: Optional[str] = Query(None),
    material_type: Optional[str] = Query(None),
    consumable_type_id: Optional[int] = Query(None),
    department_id: Optional[UUID] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvMaterial)
    if active_only:
        q = q.filter(InvMaterial.is_active.is_(True))
    if material_type is not None:
        q = q.filter(InvMaterial.material_type.ilike(material_type))
    if consumable_type_id is not None:
        q = q.filter(InvMaterial.consumable_type_id == consumable_type_id)
    if department_id is not None:
        q = q.filter(InvMaterial.department_id == department_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            InvMaterial.name.ilike(term)
            | InvMaterial.code.ilike(term)
            | InvMaterial.cas_no.ilike(term)
            | InvMaterial.molecular_formula.ilike(term)
            | InvMaterial.hazard_class.ilike(term)
            | InvMaterial.material_type.ilike(term)
        )
    total = q.count()
    items = q.order_by(InvMaterial.code).offset(skip).limit(limit).all()
    return items


@router.post("", response_model=MaterialOut, status_code=201)
def create_material(
    body: MaterialCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvMaterial).filter_by(code=body.code).first():
        raise HTTPException(409, f"Material code '{body.code}' already exists.")
    row = InvMaterial(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvMaterial, material_id)
    if not row:
        raise HTTPException(404, "Material not found.")
    return row


@router.patch("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: int,
    body: MaterialUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvMaterial, material_id)
    if not row:
        raise HTTPException(404, "Material not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{material_id}/deactivate", response_model=MaterialOut)
def deactivate_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvMaterial, material_id)
    if not row:
        raise HTTPException(404, "Material not found.")
    row.is_active = False
    db.commit()
    db.refresh(row)
    return row


# ── Chemical Props ─────────────────────────────────────────────────────────────
@router.get("/{material_id}/chemical-props", response_model=Optional[ChemicalPropsOut])
def get_chemical_props(
    material_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    mat = db.get(InvMaterial, material_id)
    if not mat:
        raise HTTPException(404, "Material not found.")
    return mat.chemical_props


@router.put("/{material_id}/chemical-props", response_model=ChemicalPropsOut)
def upsert_chemical_props(
    material_id: int,
    body: ChemicalPropsUpsert,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    mat = db.get(InvMaterial, material_id)
    if not mat:
        raise HTTPException(404, "Material not found.")
    props = mat.chemical_props
    if props is None:
        props = InvMaterialChemicalProps(material_id=material_id)
        db.add(props)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(props, k, v)
    db.commit()
    db.refresh(props)
    return props


# ── Formulation Props ──────────────────────────────────────────────────────────
@router.get("/{material_id}/formulation-props", response_model=Optional[FormulationPropsOut])
def get_formulation_props(
    material_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    mat = db.get(InvMaterial, material_id)
    if not mat:
        raise HTTPException(404, "Material not found.")
    return mat.formulation_props


@router.put("/{material_id}/formulation-props", response_model=FormulationPropsOut)
def upsert_formulation_props(
    material_id: int,
    body: FormulationPropsUpsert,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    mat = db.get(InvMaterial, material_id)
    if not mat:
        raise HTTPException(404, "Material not found.")
    props = mat.formulation_props
    if props is None:
        props = InvMaterialFormulationProps(material_id=material_id)
        db.add(props)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(props, k, v)
    db.commit()
    db.refresh(props)
    return props
