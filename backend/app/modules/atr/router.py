from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.atr import ATR, ATRAttachment
from app.models.base import new_uuid
from app.models.experiment import Experiment
from app.models.unlock_request import UnlockRequest
from app.models.user import User
from app.schemas.atr import (
    ATRAssignRequest,
    ATRAttachmentResponse,
    ATRCompleteRequest,
    ATRCreate,
    ATRResponse,
    ATRSummary,
    ATRUpdate,
    UnlockRequestCreate,
    UnlockRequestResponse,
    UnlockReviewRequest,
)
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.files import delete_file, save_upload, upload_dir, validate_upload
from app.utils.sequences import next_value

router = APIRouter()
unlock_router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _roles(user: User) -> set:
    return {user.role.code}


def _atr_no(db: Session) -> str:
    seq = next_value(db, "ATR")
    return f"ATR{seq:08d}"


def _get_atr(db: Session, atr_id: str) -> ATR:
    atr = db.get(ATR, atr_id)
    if not atr:
        raise HTTPException(404, "ATR not found")
    return atr


# ── ATR CRUD ─────────────────────────────────────────────────────────────────

@router.post("/", status_code=201, response_model=ATRResponse)
def create_atr(
    body: ATRCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.experiment_id:
        exp = db.get(Experiment, body.experiment_id)
        if not exp:
            raise HTTPException(404, "Experiment not found")
        nb_id = body.notebook_id or exp.notebook_id
        proj_id = body.project_id or exp.project_id
    else:
        nb_id = body.notebook_id
        proj_id = body.project_id

    atr_no = _atr_no(db)
    atr = ATR(
        id=new_uuid(),
        atr_no=atr_no,
        experiment_id=body.experiment_id,
        notebook_id=nb_id,
        project_id=proj_id,
        test_type=body.test_type,
        objectives=body.objectives,
        due_date=body.due_date,
        status="NEW",
        raised_by=current_user.id,
        raised_at=_now(),
    )
    db.add(atr)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="CREATED",
        target_type="atr", target_id=atr.id, target_label=atr_no,
        detail=f"ATR raised for test type '{body.test_type}'",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(atr)
    return atr


@router.get("/", response_model=PaginatedResponse[ATRSummary])
def list_atr(
    experiment_id: Optional[str] = Query(None),
    notebook_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = _roles(current_user)
    q = db.query(ATR)

    if "QA" not in roles and "TL" not in roles and "HOD" not in roles:
        q = q.filter(
            or_(ATR.raised_by == current_user.id, ATR.assigned_to == current_user.id)
        )

    if experiment_id:
        q = q.filter(ATR.experiment_id == experiment_id)
    if notebook_id:
        q = q.filter(ATR.notebook_id == notebook_id)
    if project_id:
        q = q.filter(ATR.project_id == project_id)
    if status:
        q = q.filter(ATR.status == status.upper())
    if test_type:
        q = q.filter(ATR.test_type.ilike(f"%{test_type}%"))

    total = q.count()
    pg = paginate(total, page, page_size)
    items = (
        q.order_by(ATR.raised_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedResponse(items=items, **pg)


@router.get("/{atr_id}", response_model=ATRResponse)
def get_atr(
    atr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_atr(db, atr_id)


@router.patch("/{atr_id}", response_model=ATRResponse)
def update_atr(
    atr_id: str,
    body: ATRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atr = _get_atr(db, atr_id)
    if atr.status != "NEW":
        raise HTTPException(400, f"ATR cannot be edited in '{atr.status}' status")
    roles = _roles(current_user)
    if atr.raised_by != current_user.id and not roles.intersection({"QA", "TL", "TL"}):
        raise HTTPException(403, "Only the raiser or QA/TL can edit an ATR")

    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(atr, field, val)
    db.commit()
    db.refresh(atr)
    return atr


# ── Workflow ──────────────────────────────────────────────────────────────────

@router.post("/{atr_id}/submit", response_model=ATRResponse)
def submit_atr(
    atr_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atr = _get_atr(db, atr_id)
    if atr.status != "NEW":
        raise HTTPException(400, f"Cannot submit from '{atr.status}' status")
    roles = _roles(current_user)
    if atr.raised_by != current_user.id and not roles.intersection({"QA", "TL", "TL"}):
        raise HTTPException(403, "Only the raiser or QA/TL can submit an ATR")

    atr.status = "SUBMITTED"
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="SUBMITTED",
        target_type="atr", target_id=atr.id, target_label=atr.atr_no,
        detail="ATR submitted for assignment",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(atr)
    return atr


@router.post("/{atr_id}/assign", response_model=ATRResponse)
def assign_atr(
    atr_id: str,
    body: ATRAssignRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA", "TL", "TL")),
):
    """Accept the ATR and assign to an analyst (SUBMITTED → VERIFIED)."""
    atr = _get_atr(db, atr_id)
    if atr.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot assign from '{atr.status}' status")

    analyst = db.get(User, body.assigned_to)
    if not analyst:
        raise HTTPException(404, "Assigned user not found")

    atr.status = "VERIFIED"
    atr.assigned_to = body.assigned_to
    atr.verified_by = current_user.id
    atr.verified_at = _now()
    if body.due_date:
        atr.due_date = body.due_date
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="ASSIGNED",
        target_type="atr", target_id=atr.id, target_label=atr.atr_no,
        detail=f"Assigned to analyst {analyst.username} ({analyst.emp_no})",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(atr)
    return atr


@router.post("/{atr_id}/complete", response_model=ATRResponse)
def complete_atr(
    atr_id: str,
    body: ATRCompleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyst records results and marks ATR complete (VERIFIED → COMPLETED)."""
    atr = _get_atr(db, atr_id)
    if atr.status != "VERIFIED":
        raise HTTPException(400, f"Cannot complete from '{atr.status}' status")
    roles = _roles(current_user)
    if (
        atr.assigned_to != current_user.id
        and not roles.intersection({"QA", "TL", "TL"})
    ):
        raise HTTPException(403, "Only the assigned analyst or QA/TL can complete an ATR")

    atr.status = "COMPLETED"
    atr.result = body.result
    atr.result_observations = body.result_observations
    atr.completed_by = current_user.id
    atr.completed_at = _now()
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="COMPLETED",
        target_type="atr", target_id=atr.id, target_label=atr.atr_no,
        detail=f"Result: {body.result[:100] if body.result else '—'}",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(atr)
    return atr


@router.post("/{atr_id}/cancel", response_model=ATRResponse)
def cancel_atr(
    atr_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atr = _get_atr(db, atr_id)
    if atr.status == "COMPLETED":
        raise HTTPException(400, "Completed ATRs cannot be cancelled")
    if atr.status == "CANCELLED":
        raise HTTPException(400, "ATR is already cancelled")
    roles = _roles(current_user)
    if atr.raised_by != current_user.id and not roles.intersection({"QA", "TL"}):
        raise HTTPException(403, "Only the raiser or QA/TL can cancel an ATR")

    atr.status = "CANCELLED"
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="CANCELLED",
        target_type="atr", target_id=atr.id, target_label=atr.atr_no,
        detail="ATR cancelled",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(atr)
    return atr


# ── ATR Attachments ───────────────────────────────────────────────────────────

@router.post(
    "/{atr_id}/attachments",
    status_code=201,
    response_model=ATRAttachmentResponse,
)
async def upload_atr_attachment(
    atr_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file attachment to an ATR. Raiser or QA/TL only."""
    atr = _get_atr(db, atr_id)
    if atr.status == "CANCELLED":
        raise HTTPException(400, "Cannot attach files to a cancelled ATR")

    roles = _roles(current_user)
    if atr.raised_by != current_user.id and not roles.intersection({"QA", "TL", "TL"}):
        raise HTTPException(403, "Only the raiser or QA/TL can attach files to an ATR")

    validate_upload(file)
    subdir = upload_dir() / "atr" / atr_id
    file_path, file_size = await save_upload(file, subdir)

    att = ATRAttachment(
        id=new_uuid(),
        atr_id=atr_id,
        filename=file.filename or "upload",
        file_path=file_path,
        file_size=file_size,
        uploaded_by=current_user.id,
    )
    db.add(att)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="ATTACHMENT_UPLOADED",
        target_type="atr", target_id=atr_id, target_label=atr.atr_no,
        detail=f"Uploaded '{file.filename}' ({file_size} bytes)",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(att)
    return att


@router.get("/{atr_id}/attachments", response_model=List[ATRAttachmentResponse])
def list_atr_attachments(
    atr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_atr(db, atr_id)  # 404 if not found
    return (
        db.query(ATRAttachment)
        .filter(ATRAttachment.atr_id == atr_id)
        .order_by(ATRAttachment.uploaded_at)
        .all()
    )


@router.get(
    "/{atr_id}/attachments/{att_id}",
    response_class=FileResponse,
)
def download_atr_attachment(
    atr_id: str,
    att_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the attachment file to the client."""
    _get_atr(db, atr_id)
    att = db.get(ATRAttachment, att_id)
    if not att or att.atr_id != atr_id:
        raise HTTPException(404, "Attachment not found")

    import os
    if not os.path.exists(att.file_path):
        raise HTTPException(404, "File not found on server")

    return FileResponse(
        path=att.file_path,
        filename=att.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{atr_id}/attachments/{att_id}", status_code=204)
def delete_atr_attachment(
    atr_id: str,
    att_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an ATR attachment. Uploader or QA only."""
    atr = _get_atr(db, atr_id)
    att = db.get(ATRAttachment, att_id)
    if not att or att.atr_id != atr_id:
        raise HTTPException(404, "Attachment not found")

    roles = _roles(current_user)
    if att.uploaded_by != current_user.id and "QA" not in roles:
        raise HTTPException(403, "Only the uploader or QA can delete attachments")

    file_path = att.file_path
    db.delete(att)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ATR", action="ATTACHMENT_DELETED",
        target_type="atr", target_id=atr_id, target_label=atr.atr_no,
        detail=f"Deleted attachment '{att.filename}'",
        ip_address=get_ip(request),
    )
    db.commit()
    delete_file(file_path)


# ── UnlockRequest ─────────────────────────────────────────────────────────────

@unlock_router.post("/", status_code=201, response_model=UnlockRequestResponse)
def create_unlock_request(
    body: UnlockRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chemist requests QA to unlock an APPROVED experiment for revision."""
    exp = db.get(Experiment, body.experiment_id)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    if exp.status != "APPROVED":
        raise HTTPException(400, f"Unlock requests can only be raised for APPROVED experiments (current: {exp.status})")

    existing = (
        db.query(UnlockRequest)
        .filter(
            UnlockRequest.experiment_id == body.experiment_id,
            UnlockRequest.status == "PENDING",
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "A pending unlock request already exists for this experiment")

    req = UnlockRequest(
        id=new_uuid(),
        experiment_id=body.experiment_id,
        reason=body.reason,
        status="PENDING",
        requested_by=current_user.id,
        requested_at=_now(),
    )
    db.add(req)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="UnlockRequests", action="RAISED",
        target_type="unlock_request", target_id=req.id,
        target_label=exp.full_code,
        detail=f"Unlock requested: {body.reason}",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(req)
    return _enrich_unlock(db, req)


@unlock_router.get("/", response_model=PaginatedResponse[UnlockRequestResponse])
def list_unlock_requests(
    experiment_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = _roles(current_user)
    q = db.query(UnlockRequest)

    if "QA" not in roles and "TL" not in roles:
        q = q.filter(UnlockRequest.requested_by == current_user.id)

    if experiment_id:
        q = q.filter(UnlockRequest.experiment_id == experiment_id)
    if status:
        q = q.filter(UnlockRequest.status == status.upper())

    total = q.count()
    pg = paginate(total, page, page_size)
    items = (
        q.order_by(UnlockRequest.requested_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # ── Resolve experiment full_codes and user display names ──────────────────
    exp_ids  = list({it.experiment_id for it in items})
    user_ids = list({it.requested_by for it in items} |
                    {it.reviewed_by   for it in items if it.reviewed_by})

    exp_map: dict = {}
    if exp_ids:
        rows = db.query(Experiment.id, Experiment.full_code).filter(
            Experiment.id.in_(exp_ids)
        ).all()
        exp_map = {r.id: r.full_code for r in rows}

    user_map: dict = {}
    if user_ids:
        rows = db.query(User.id, User.display_name).filter(
            User.id.in_(user_ids)
        ).all()
        user_map = {r.id: r.display_name for r in rows}

    result: list[UnlockRequestResponse] = []
    for it in items:
        resp = UnlockRequestResponse.model_validate(it)
        resp.experiment_full_code = exp_map.get(it.experiment_id)
        resp.requester_name       = user_map.get(it.requested_by)
        resp.reviewer_name        = user_map.get(it.reviewed_by) if it.reviewed_by else None
        result.append(resp)

    return PaginatedResponse(items=result, **pg)


def _enrich_unlock(db: Session, req: UnlockRequest) -> UnlockRequestResponse:
    """Attach experiment_full_code, requester_name, reviewer_name to a response."""
    resp = UnlockRequestResponse.model_validate(req)
    exp = db.get(Experiment, req.experiment_id)
    resp.experiment_full_code = exp.full_code if exp else None
    requester = db.get(User, req.requested_by)
    resp.requester_name = requester.display_name if requester else None
    if req.reviewed_by:
        reviewer = db.get(User, req.reviewed_by)
        resp.reviewer_name = reviewer.display_name if reviewer else None
    return resp


@unlock_router.get("/{req_id}", response_model=UnlockRequestResponse)
def get_unlock_request(
    req_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = db.get(UnlockRequest, req_id)
    if not req:
        raise HTTPException(404, "Unlock request not found")
    return _enrich_unlock(db, req)


@unlock_router.post("/{req_id}/approve", response_model=UnlockRequestResponse)
def approve_unlock_request(
    req_id: str,
    body: UnlockReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    """QA approves the request — also transitions the experiment to UNLOCKED."""
    req = db.get(UnlockRequest, req_id)
    if not req:
        raise HTTPException(404, "Unlock request not found")
    if req.status != "PENDING":
        raise HTTPException(400, f"Request is already '{req.status}'")

    req.status = "APPROVED"
    req.reviewed_by = current_user.id
    req.reviewed_at = _now()
    req.review_note = body.review_note

    exp = db.get(Experiment, req.experiment_id)
    if exp and exp.status == "APPROVED":
        exp.status = "UNLOCKED"
        exp.unlocked_by = current_user.id
        exp.unlocked_at = _now()

    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="UnlockRequests", action="APPROVED",
        target_type="unlock_request", target_id=req.id,
        target_label=exp.full_code if exp else req.experiment_id,
        detail=f"Unlock approved. Note: {body.review_note or '—'}",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(req)
    return _enrich_unlock(db, req)


@unlock_router.post("/{req_id}/reject", response_model=UnlockRequestResponse)
def reject_unlock_request(
    req_id: str,
    body: UnlockReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    req = db.get(UnlockRequest, req_id)
    if not req:
        raise HTTPException(404, "Unlock request not found")
    if req.status != "PENDING":
        raise HTTPException(400, f"Request is already '{req.status}'")

    req.status = "REJECTED"
    req.reviewed_by = current_user.id
    req.reviewed_at = _now()
    req.review_note = body.review_note

    db.flush()
    exp = db.get(Experiment, req.experiment_id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="UnlockRequests", action="REJECTED",
        target_type="unlock_request", target_id=req.id,
        target_label=exp.full_code if exp else req.experiment_id,
        detail=f"Unlock rejected. Note: {body.review_note or '—'}",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(req)
    return req
