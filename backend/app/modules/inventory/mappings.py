"""Inventory – Material-Manufacturer Mappings + DSD file upload/download."""
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvManufacturerMapping
from app.schemas.inventory import MappingCreate, MappingOut, MappingUpdate
from app.shared.files import ALLOWED_DOC_EXTS, delete_file, save_upload, validate_upload

router = APIRouter(prefix="/inventory/mappings", tags=["inventory-mappings"])


@router.get("", response_model=list[MappingOut])
def list_mappings(
    material_id: Optional[int] = Query(None),
    manufacturer_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvManufacturerMapping)
    if material_id is not None:
        q = q.filter(InvManufacturerMapping.material_id == material_id)
    if manufacturer_id is not None:
        q = q.filter(InvManufacturerMapping.manufacturer_id == manufacturer_id)
    return q.offset(skip).limit(limit).all()


@router.post("", response_model=MappingOut, status_code=201)
def create_mapping(
    body: MappingCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    exists = (
        db.query(InvManufacturerMapping)
        .filter_by(material_id=body.material_id, manufacturer_id=body.manufacturer_id)
        .first()
    )
    if exists:
        raise HTTPException(409, "Mapping for this material+manufacturer already exists.")
    row = InvManufacturerMapping(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{mapping_id}", response_model=MappingOut)
def get_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturerMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Mapping not found.")
    return row


@router.patch("/{mapping_id}", response_model=MappingOut)
def update_mapping(
    mapping_id: int,
    body: MappingUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturerMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Mapping not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{mapping_id}", status_code=204)
def delete_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturerMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Mapping not found.")
    delete_file(row.dsd_file_path)
    db.delete(row)
    db.commit()


# ── DSD file upload / download ─────────────────────────────────────────────────
@router.post("/{mapping_id}/dsd", response_model=MappingOut)
async def upload_dsd(
    mapping_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturerMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Mapping not found.")
    validate_upload(file, allowed_exts=ALLOWED_DOC_EXTS)
    if row.dsd_file_path:
        delete_file(row.dsd_file_path)
    row.dsd_file_path = await save_upload(file, subdir="dsd")
    db.commit()
    db.refresh(row)
    return row


@router.get("/{mapping_id}/dsd/download")
def download_dsd(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturerMapping, mapping_id)
    if not row or not row.dsd_file_path:
        raise HTTPException(404, "No DSD file attached to this mapping.")
    if not os.path.exists(row.dsd_file_path):
        raise HTTPException(404, "DSD file missing from disk.")
    return FileResponse(
        row.dsd_file_path,
        media_type="application/octet-stream",
        filename=os.path.basename(row.dsd_file_path),
    )


@router.delete("/{mapping_id}/dsd", response_model=MappingOut)
def delete_dsd(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvManufacturerMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Mapping not found.")
    delete_file(row.dsd_file_path)
    row.dsd_file_path = None
    db.commit()
    db.refresh(row)
    return row
