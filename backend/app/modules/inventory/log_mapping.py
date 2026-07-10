"""Inventory – Log Mapping: bind approved checklists to equipment/instruments (Phase 3).

Equipment logs (MAINTENANCE / CLEANING) carry tolerance_days; instrument
calibration logs (CALIBRATION) carry alert_limit / deviation_limit.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvChecklist, InvLogMapping
from app.schemas.inventory import LogMappingCreate, LogMappingOut, LogMappingUpdate

router = APIRouter(prefix="/inventory/log-mappings", tags=["inventory-log-mappings"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _to_out(db: Session, row: InvLogMapping) -> dict:
    cl = db.get(InvChecklist, row.checklist_id) if row.checklist_id else None
    return {
        "id": row.id,
        "equipment_id": row.equipment_id,
        "instrument_id": row.instrument_id,
        "log_type": row.log_type,
        "checklist_id": row.checklist_id,
        "checklist_name": cl.name if cl else None,
        "checklist_version": cl.version if cl else None,
        "tolerance_days": row.tolerance_days,
        "alert_limit": row.alert_limit,
        "deviation_limit": row.deviation_limit,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("", response_model=list[LogMappingOut])
def list_mappings(
    equipment_id: Optional[int] = Query(None),
    instrument_id: Optional[int] = Query(None),
    log_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvLogMapping)
    if equipment_id is not None:
        q = q.filter(InvLogMapping.equipment_id == equipment_id)
    if instrument_id is not None:
        q = q.filter(InvLogMapping.instrument_id == instrument_id)
    if log_type:
        q = q.filter(InvLogMapping.log_type == log_type)
    return [_to_out(db, r) for r in q.order_by(InvLogMapping.id).all()]


@router.post("", response_model=LogMappingOut, status_code=201)
def create_mapping(
    body: LogMappingCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if bool(body.equipment_id) == bool(body.instrument_id):
        raise HTTPException(400, "Provide exactly one of equipment_id or instrument_id.")
    existing = db.query(InvLogMapping).filter(
        InvLogMapping.equipment_id == body.equipment_id,
        InvLogMapping.instrument_id == body.instrument_id,
        InvLogMapping.log_type == body.log_type,
    ).first()
    if existing:
        raise HTTPException(409, f"A {body.log_type} mapping already exists for this item.")
    if body.checklist_id:
        cl = db.get(InvChecklist, body.checklist_id)
        if not cl:
            raise HTTPException(404, "Checklist not found.")
        if cl.status != "APPROVED":
            raise HTTPException(409, "Only APPROVED checklists can be mapped.")
    row = InvLogMapping(**body.model_dump(), created_by=_user_ref(current_user))
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.patch("/{mapping_id}", response_model=LogMappingOut)
def update_mapping(
    mapping_id: int,
    body: LogMappingUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvLogMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Log mapping not found.")
    data = body.model_dump(exclude_unset=True)
    if data.get("checklist_id"):
        cl = db.get(InvChecklist, data["checklist_id"])
        if not cl:
            raise HTTPException(404, "Checklist not found.")
        if cl.status != "APPROVED":
            raise HTTPException(409, "Only APPROVED checklists can be mapped.")
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.delete("/{mapping_id}", status_code=204)
def delete_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvLogMapping, mapping_id)
    if not row:
        raise HTTPException(404, "Log mapping not found.")
    db.delete(row)
    db.commit()
