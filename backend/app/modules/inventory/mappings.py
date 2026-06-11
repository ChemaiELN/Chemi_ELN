"""
Inventory Master — Manufacturer Mapping router
Endpoints:
  GET    /api/inventory/mappings             list (material_id, manufacturer_id filters)
  POST   /api/inventory/mappings             create
  PATCH  /api/inventory/mappings/{id}        update
  DELETE /api/inventory/mappings/{id}        remove
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_manufacturers import InvManufacturerMapping, InvManufacturer
from app.models.inventory_materials import InvMaterial
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_manufacturers import MappingCreate, MappingUpdate, MappingOut
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


def _get_or_404(db: Session, mapping_id: int) -> InvManufacturerMapping:
    m = (
        db.query(InvManufacturerMapping)
        .options(
            joinedload(InvManufacturerMapping.material),
            joinedload(InvManufacturerMapping.manufacturer),
        )
        .filter(InvManufacturerMapping.id == mapping_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return m


def _enrich(mapping: InvManufacturerMapping) -> MappingOut:
    """Attach denormalised name/code fields for the frontend."""
    out = MappingOut.model_validate(mapping)
    if mapping.material:
        out.material_name = mapping.material.name
        out.material_code = mapping.material.code
    if mapping.manufacturer:
        out.manufacturer_name = mapping.manufacturer.name
        out.manufacturer_code = mapping.manufacturer.code
    return out


def _write_audit(db, user, event_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="mapping",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[MappingOut])
def list_mappings(
    material_id:     Optional[int] = Query(None),
    manufacturer_id: Optional[int] = Query(None),
    db:              Session       = Depends(get_db),
    current_user:    User          = Depends(get_current_user),
):
    q = db.query(InvManufacturerMapping).options(
        joinedload(InvManufacturerMapping.material),
        joinedload(InvManufacturerMapping.manufacturer),
    )
    if material_id:
        q = q.filter(InvManufacturerMapping.material_id == material_id)
    if manufacturer_id:
        q = q.filter(InvManufacturerMapping.manufacturer_id == manufacturer_id)
    return [_enrich(m) for m in q.order_by(InvManufacturerMapping.id).all()]


# ── Create ────────────────────────────────────────────────────────────────────
@router.post("", response_model=MappingOut, status_code=status.HTTP_201_CREATED)
def create_mapping(
    body:         MappingCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    # Check material + manufacturer exist
    mat = db.query(InvMaterial).filter(InvMaterial.id == body.material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    mfr = db.query(InvManufacturer).filter(InvManufacturer.id == body.manufacturer_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    # Prevent duplicate
    exists = db.query(InvManufacturerMapping).filter_by(
        material_id=body.material_id, manufacturer_id=body.manufacturer_id
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Mapping already exists for this material-manufacturer pair")

    m = InvManufacturerMapping(**body.model_dump())
    db.add(m)
    db.flush()
    _write_audit(db, current_user, "MAPPING_CREATED", m.id, mat.code,
                 details=f"Vendor {mfr.name} ({mfr.code}) mapped to {mat.name}")
    db.commit()
    return _enrich(_get_or_404(db, m.id))


# ── Update ────────────────────────────────────────────────────────────────────
@router.patch("/{mapping_id}", response_model=MappingOut)
def update_mapping(
    mapping_id:   int,
    body:         MappingUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = _get_or_404(db, mapping_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    ref = m.material.code if m.material else str(mapping_id)
    _write_audit(db, current_user, "MAPPING_UPDATED", m.id, ref,
                 details=f"Updated: {list(body.model_dump(exclude_unset=True).keys())}")
    db.commit()
    return _enrich(_get_or_404(db, mapping_id))


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(
    mapping_id:   int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = _get_or_404(db, mapping_id)
    ref = m.material.code if m.material else str(mapping_id)
    mfr_name = m.manufacturer.name if m.manufacturer else ""
    _write_audit(db, current_user, "MAPPING_DELETED", m.id, ref,
                 details=f"Vendor {mfr_name} removed from {ref}")
    db.delete(m)
    db.commit()
