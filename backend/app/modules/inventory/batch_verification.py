"""
Inventory Master — Batch Verification router
Endpoints:
  GET    /api/inventory/batch-verifications              list (batch_id, status)
  GET    /api/inventory/batch-verifications/{id}         single
  POST   /api/inventory/batch-verifications              create / request verification
  PATCH  /api/inventory/batch-verifications/{id}/verify  approve verification
  PATCH  /api/inventory/batch-verifications/{id}/reject  reject verification
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory_batches import InvBatch, InvBatchVerification
from app.models.inventory_equipment import InvAuditTrail
from app.schemas.inventory_stock import (
    BatchVerificationCreate, BatchVerificationVerify,
    BatchVerificationReject, BatchVerificationOut,
)
from app.utils.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, ver_id: int) -> InvBatchVerification:
    v = (
        db.query(InvBatchVerification)
        .options(
            joinedload(InvBatchVerification.batch).joinedload(InvBatch.material)
        )
        .filter(InvBatchVerification.id == ver_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Batch verification request not found")
    return v


def _enrich(v: InvBatchVerification) -> BatchVerificationOut:
    out = BatchVerificationOut.model_validate(v)
    if v.batch:
        out.batch_no = v.batch.batch_no
        if v.batch.material:
            out.material_name = v.batch.material.name
    return out


def _write_audit(db, user, event_type, entity_id, entity_ref, details=None):
    db.add(InvAuditTrail(
        event_type=event_type, entity_type="batch_verification",
        entity_id=entity_id, entity_ref=entity_ref,
        performed_by=user.username, details=details,
    ))


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[BatchVerificationOut])
def list_verifications(
    batch_id:     Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db:           Session        = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    q = (
        db.query(InvBatchVerification)
        .options(
            joinedload(InvBatchVerification.batch).joinedload(InvBatch.material)
        )
    )
    if batch_id:
        q = q.filter(InvBatchVerification.batch_id == batch_id)
    if status_filter:
        q = q.filter(InvBatchVerification.status == status_filter.upper())
    rows = q.order_by(InvBatchVerification.requested_at.desc()).all()
    return [_enrich(v) for v in rows]


# ── Single ────────────────────────────────────────────────────────────────────

@router.get("/{ver_id}", response_model=BatchVerificationOut)
def get_verification(
    ver_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return _enrich(_get_or_404(db, ver_id))


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=BatchVerificationOut, status_code=status.HTTP_201_CREATED)
def create_verification(
    body:         BatchVerificationCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    # Unique request_no guard
    if db.query(InvBatchVerification).filter(
        InvBatchVerification.request_no == body.request_no
    ).first():
        raise HTTPException(status_code=400, detail=f"Verification request_no '{body.request_no}' already exists")

    # Batch must exist
    batch = db.query(InvBatch).filter(InvBatch.id == body.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    v = InvBatchVerification(
        request_no=body.request_no,
        batch_id=body.batch_id,
        requested_by=current_user.username,
        status="PENDING",
        remarks=body.remarks,
    )
    db.add(v)
    db.flush()
    _write_audit(db, current_user, "BATCH_VERIFICATION_REQUESTED", v.id, body.request_no,
                 details=f"Verification requested for batch {batch.batch_no}")
    db.commit()
    return _enrich(_get_or_404(db, v.id))


# ── Verify (approve) ──────────────────────────────────────────────────────────

@router.patch("/{ver_id}/verify", response_model=BatchVerificationOut)
def verify_verification(
    ver_id:       int,
    body:         BatchVerificationVerify,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from datetime import datetime, timezone
    v = _get_or_404(db, ver_id)
    if v.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot verify a request with status '{v.status}'")
    v.status = "VERIFIED"
    v.verified_by = current_user.username
    v.verified_at = datetime.now(timezone.utc)
    if body.remarks:
        v.remarks = body.remarks
    _write_audit(db, current_user, "BATCH_VERIFICATION_APPROVED", v.id, v.request_no,
                 details=f"Verified by {current_user.username}")
    db.commit()
    return _enrich(_get_or_404(db, ver_id))


# ── Reject ────────────────────────────────────────────────────────────────────

@router.patch("/{ver_id}/reject", response_model=BatchVerificationOut)
def reject_verification(
    ver_id:       int,
    body:         BatchVerificationReject,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from datetime import datetime, timezone
    v = _get_or_404(db, ver_id)
    if v.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot reject a request with status '{v.status}'")
    v.status = "REJECTED"
    v.verified_by = current_user.username
    v.verified_at = datetime.now(timezone.utc)
    if body.remarks:
        v.remarks = body.remarks
    _write_audit(db, current_user, "BATCH_VERIFICATION_REJECTED", v.id, v.request_no,
                 details=f"Rejected by {current_user.username}. Reason: {body.remarks or 'N/A'}")
    db.commit()
    return _enrich(_get_or_404(db, ver_id))
