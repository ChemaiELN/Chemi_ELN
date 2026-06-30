"""Inventory – Equipment and Instrument Verifications."""
import datetime
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvEquipmentCatalogue,
    InvEquipmentVerification,
    InvInstrumentCatalogue,
    InvInstrumentVerification,
)
from app.schemas.inventory import (
    EquipVerificationCreate,
    EquipVerificationOut,
    InstrVerificationCreate,
    InstrVerificationOut,
    VerificationAction,
)
from app.shared.inv_audit import write_inv_audit

equip_verif_router = APIRouter(
    prefix="/inventory/equipment-verifications", tags=["inventory-equipment-verifications"]
)
instr_verif_router = APIRouter(
    prefix="/inventory/instrument-verifications", tags=["inventory-instrument-verifications"]
)


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _gen_req_no(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


# ── Equipment Verifications ────────────────────────────────────────────────────
@equip_verif_router.get("", response_model=list[EquipVerificationOut])
def list_equip_verifs(
    equipment_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvEquipmentVerification)
    if equipment_id is not None:
        q = q.filter(InvEquipmentVerification.equipment_id == equipment_id)
    if status:
        q = q.filter(InvEquipmentVerification.status == status)
    return q.order_by(InvEquipmentVerification.requested_at.desc()).offset(skip).limit(limit).all()


@equip_verif_router.post("", response_model=EquipVerificationOut, status_code=201)
def create_equip_verif(
    body: EquipVerificationCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvEquipmentCatalogue, body.equipment_id):
        raise HTTPException(404, "Equipment not found.")
    request_no = _gen_req_no("EV")
    while db.query(InvEquipmentVerification).filter_by(request_no=request_no).first():
        request_no = _gen_req_no("EV")
    row = InvEquipmentVerification(
        request_no=request_no,
        equipment_id=body.equipment_id,
        requested_by=_user_ref(current_user),
        requested_at=datetime.datetime.utcnow(),
        remarks=body.remarks,
    )
    db.add(row)
    write_inv_audit(
        db,
        event_type="EQUIP_VERIFICATION_CREATED",
        entity_type="inv_equipment_verification",
        entity_ref=request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@equip_verif_router.get("/{verif_id}", response_model=EquipVerificationOut)
def get_equip_verif(
    verif_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvEquipmentVerification, verif_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    return row


@equip_verif_router.patch("/{verif_id}/verify", response_model=EquipVerificationOut)
def verify_equip(
    verif_id: int,
    body: VerificationAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvEquipmentVerification, verif_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    if row.status != "PENDING":
        raise HTTPException(400, f"Cannot verify a '{row.status}' verification.")
    row.status = "VERIFIED"
    row.verified_by = _user_ref(current_user)
    row.verified_at = datetime.datetime.utcnow()
    if body.remarks:
        row.remarks = body.remarks
    write_inv_audit(
        db,
        event_type="EQUIP_VERIFICATION_VERIFIED",
        entity_type="inv_equipment_verification",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@equip_verif_router.patch("/{verif_id}/reject", response_model=EquipVerificationOut)
def reject_equip(
    verif_id: int,
    body: VerificationAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvEquipmentVerification, verif_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    if row.status != "PENDING":
        raise HTTPException(400, f"Cannot reject a '{row.status}' verification.")
    row.status = "REJECTED"
    row.verified_by = _user_ref(current_user)
    row.verified_at = datetime.datetime.utcnow()
    if body.remarks:
        row.remarks = body.remarks
    write_inv_audit(
        db,
        event_type="EQUIP_VERIFICATION_REJECTED",
        entity_type="inv_equipment_verification",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


# ── Instrument Verifications ───────────────────────────────────────────────────
@instr_verif_router.get("", response_model=list[InstrVerificationOut])
def list_instr_verifs(
    instrument_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvInstrumentVerification)
    if instrument_id is not None:
        q = q.filter(InvInstrumentVerification.instrument_id == instrument_id)
    if status:
        q = q.filter(InvInstrumentVerification.status == status)
    return q.order_by(InvInstrumentVerification.requested_at.desc()).offset(skip).limit(limit).all()


@instr_verif_router.post("", response_model=InstrVerificationOut, status_code=201)
def create_instr_verif(
    body: InstrVerificationCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvInstrumentCatalogue, body.instrument_id):
        raise HTTPException(404, "Instrument not found.")
    request_no = _gen_req_no("IV")
    while db.query(InvInstrumentVerification).filter_by(request_no=request_no).first():
        request_no = _gen_req_no("IV")
    row = InvInstrumentVerification(
        request_no=request_no,
        instrument_id=body.instrument_id,
        requested_by=_user_ref(current_user),
        requested_at=datetime.datetime.utcnow(),
        remarks=body.remarks,
    )
    db.add(row)
    write_inv_audit(
        db,
        event_type="INSTR_VERIFICATION_CREATED",
        entity_type="inv_instrument_verification",
        entity_ref=request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@instr_verif_router.get("/{verif_id}", response_model=InstrVerificationOut)
def get_instr_verif(
    verif_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentVerification, verif_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    return row


@instr_verif_router.patch("/{verif_id}/verify", response_model=InstrVerificationOut)
def verify_instr(
    verif_id: int,
    body: VerificationAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentVerification, verif_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    if row.status != "PENDING":
        raise HTTPException(400, f"Cannot verify a '{row.status}' verification.")
    row.status = "VERIFIED"
    row.verified_by = _user_ref(current_user)
    row.verified_at = datetime.datetime.utcnow()
    if body.remarks:
        row.remarks = body.remarks
    write_inv_audit(
        db,
        event_type="INSTR_VERIFICATION_VERIFIED",
        entity_type="inv_instrument_verification",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@instr_verif_router.patch("/{verif_id}/reject", response_model=InstrVerificationOut)
def reject_instr(
    verif_id: int,
    body: VerificationAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvInstrumentVerification, verif_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    if row.status != "PENDING":
        raise HTTPException(400, f"Cannot reject a '{row.status}' verification.")
    row.status = "REJECTED"
    row.verified_by = _user_ref(current_user)
    row.verified_at = datetime.datetime.utcnow()
    if body.remarks:
        row.remarks = body.remarks
    write_inv_audit(
        db,
        event_type="INSTR_VERIFICATION_REJECTED",
        entity_type="inv_instrument_verification",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row
