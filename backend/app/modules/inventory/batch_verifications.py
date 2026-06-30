"""Inventory – Batch Verifications."""
import datetime
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvBatch, InvBatchVerification
from app.schemas.inventory import (
    BatchVerificationAction,
    BatchVerificationCreate,
    BatchVerificationOut,
)
from app.shared.inv_audit import write_inv_audit

router = APIRouter(prefix="/inventory/batch-verifications", tags=["inventory-batch-verifications"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _gen_request_no() -> str:
    return f"BV-{uuid.uuid4().hex[:8].upper()}"


@router.get("", response_model=list[BatchVerificationOut])
def list_verifications(
    batch_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvBatchVerification)
    if batch_id is not None:
        q = q.filter(InvBatchVerification.batch_id == batch_id)
    if status:
        q = q.filter(InvBatchVerification.status == status)
    return q.order_by(InvBatchVerification.requested_at.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=BatchVerificationOut, status_code=201)
def create_verification(
    body: BatchVerificationCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.get(InvBatch, body.batch_id):
        raise HTTPException(404, "Batch not found.")

    request_no = _gen_request_no()
    while db.query(InvBatchVerification).filter_by(request_no=request_no).first():
        request_no = _gen_request_no()

    row = InvBatchVerification(
        request_no=request_no,
        batch_id=body.batch_id,
        requested_by=_user_ref(current_user),
        requested_at=datetime.datetime.utcnow(),
        remarks=body.remarks,
    )
    db.add(row)
    write_inv_audit(
        db,
        event_type="BATCH_VERIFICATION_CREATED",
        entity_type="inv_batch_verification",
        entity_ref=request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/{verification_id}", response_model=BatchVerificationOut)
def get_verification(
    verification_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvBatchVerification, verification_id)
    if not row:
        raise HTTPException(404, "Verification not found.")
    return row


@router.patch("/{verification_id}/verify", response_model=BatchVerificationOut)
def verify(
    verification_id: int,
    body: BatchVerificationAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvBatchVerification, verification_id)
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
        event_type="BATCH_VERIFICATION_VERIFIED",
        entity_type="inv_batch_verification",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{verification_id}/reject", response_model=BatchVerificationOut)
def reject(
    verification_id: int,
    body: BatchVerificationAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvBatchVerification, verification_id)
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
        event_type="BATCH_VERIFICATION_REJECTED",
        entity_type="inv_batch_verification",
        entity_ref=row.request_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row
