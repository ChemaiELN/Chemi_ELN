"""
Experiments router — template-based workflow system.

Endpoints (mounted under /api/notebooks):
  POST   /{notebook_id}/experiments           Create experiment

  GET    /{notebook_id}/experiments           List experiments in notebook

Endpoints (mounted under /api/experiments):
  GET    /{id}                                Get single experiment
  PATCH  /{id}                                Save data (DRAFT only)
  DELETE /{id}                                Delete (DRAFT only)
  POST   /{id}/submit                         Submit for review
  POST   /{id}/sign                           E-signature (scientist or reviewer)
  POST   /{id}/reviewers                      Assign a reviewer
  DELETE /{id}/reviewers/{reviewer_id}        Unassign a reviewer (DRAFT only)
  POST   /{id}/approve                        Approve → LOCKED (all reviewers must have signed)
  POST   /{id}/reject                         Reject
  POST   /{id}/versions                       HOD creates new version
  PATCH  /{id}/link-preliminary               Attach locked preliminary
  GET    /{id}/history                        Audit log
  POST   /{id}/files                          Upload file
  GET    /{id}/files                          List files
  DELETE /{id}/files/{file_id}                Delete file
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import verify_password
from app.database import get_db
from app.models.base import new_uuid
from app.models.experiment import Experiment, ExperimentFile, ExperimentHistory, ExperimentReview
from app.models.notebook import Notebook, NotebookPermission
from app.models.user import User
from app.schemas.experiment import (
    AssignReviewer,
    ExperimentCreate, ExperimentFileResponse, ExperimentHistoryResponse,
    ExperimentLinkPreliminary, ExperimentNewVersion, ExperimentReject,
    ExperimentResponse, ExperimentReviewResponse,
    ExperimentSign, ExperimentSummary, ExperimentUpdate,
)
from app.utils.deps import get_current_user
from app.utils.privileges import require_privilege, NOTEBOOKS_CREATE, NOTEBOOKS_EDIT, EXPERIMENTS_APPROVE

nb_router = APIRouter()
router    = APIRouter()

_nb_create = require_privilege(NOTEBOOKS_CREATE)
_nb_edit   = require_privilege(NOTEBOOKS_EDIT)


def _check_nb_perm(db: Session, notebook_id: str, user_id: str, permission: str) -> bool:
    """True if user has the named boolean permission on this notebook."""
    row = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id     == user_id,
    ).first()
    return row is not None and getattr(row, permission, False)


def _require_nb_edit(exp: "Experiment", actor: User, db: Session) -> None:
    """Raise 403 unless actor has role-level NOTEBOOKS_EDIT or notebook can_edit."""
    from app.utils.privileges import DEFAULT_GRANTS, NOTEBOOKS_EDIT
    role_code = actor.role.code if actor.role else ""
    if role_code == "QA" or role_code in DEFAULT_GRANTS.get(NOTEBOOKS_EDIT, frozenset()):
        return
    if _check_nb_perm(db, exp.notebook_id, actor.id, "can_edit"):
        return
    raise HTTPException(403, "You need can_edit permission on this notebook")


def _require_nb_submit(exp: "Experiment", actor: User, db: Session) -> None:
    """Raise 403 unless actor has role-level NOTEBOOKS_EDIT or notebook can_submit."""
    from app.utils.privileges import DEFAULT_GRANTS, NOTEBOOKS_EDIT
    role_code = actor.role.code if actor.role else ""
    if role_code == "QA" or role_code in DEFAULT_GRANTS.get(NOTEBOOKS_EDIT, frozenset()):
        return
    if _check_nb_perm(db, exp.notebook_id, actor.id, "can_submit"):
        return
    raise HTTPException(403, "You need can_submit permission on this notebook")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load(db: Session, exp_id: str) -> Experiment:
    exp = (
        db.query(Experiment)
        .options(
            selectinload(Experiment.creator),
            selectinload(Experiment.linked_preliminary),
            selectinload(Experiment.files),
            selectinload(Experiment.reviews),
        )
        .filter(Experiment.id == exp_id)
        .first()
    )
    if not exp:
        raise HTTPException(404, "Experiment not found")
    return exp


def _next_base_code(db: Session) -> str:
    """Global MAX(base_code)+1 — full_code is system-wide unique, so counter must be too."""
    max_code: str | None = (
        db.query(func.max(Experiment.base_code))
        .scalar()
    )
    if max_code is None:
        return "EXP-001"
    try:
        n = int(max_code.split("-")[1])
    except (IndexError, ValueError):
        n = 0
    return f"EXP-{n + 1:03d}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _log(
    db: Session,
    exp_id: str,
    actor_id: str,
    action: str,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Append one immutable audit entry."""
    db.add(ExperimentHistory(
        id=new_uuid(),
        experiment_id=exp_id,
        actor_id=actor_id,
        action=action,
        details=details,
    ))


def _all_reviewers_approved(db: Session, exp_id: str) -> tuple[bool, str]:
    """Return (ok, reason).  ok=True means approve is allowed."""
    reviews: List[ExperimentReview] = (
        db.query(ExperimentReview)
        .filter(ExperimentReview.experiment_id == exp_id)
        .all()
    )
    if not reviews:
        return False, "No reviewers assigned — assign at least one reviewer before approving"
    pending = [r for r in reviews if r.signed_at is None]
    if pending:
        return False, f"{len(pending)} reviewer(s) have not signed yet"
    rejected = [r for r in reviews if r.decision == "REJECTED"]
    if rejected:
        return False, f"{len(rejected)} reviewer(s) rejected this experiment"
    return True, ""


# ── Create experiment ─────────────────────────────────────────────────────────

@nb_router.post("/{notebook_id}/experiments", response_model=ExperimentResponse, status_code=201)
def create_experiment(
    notebook_id: str,
    body:        ExperimentCreate,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(get_current_user),
):
    nb = db.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(404, "Notebook not found")
    if nb.status != "ACTIVE":
        raise HTTPException(400, f"Notebook is {nb.status} — cannot add experiments")

    # Allow: role-level privilege (QA/HOD/TL) OR explicit notebook can_edit grant (Chemist)
    role_code = actor.role.code if actor.role else ""
    from app.utils.privileges import DEFAULT_GRANTS, NOTEBOOKS_CREATE
    has_role_priv = role_code == "QA" or role_code in DEFAULT_GRANTS.get(NOTEBOOKS_CREATE, frozenset())
    has_nb_perm = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id     == actor.id,
        NotebookPermission.can_edit    == True,
    ).first() is not None
    if not has_role_priv and not has_nb_perm:
        raise HTTPException(403, "You need can_edit permission on this notebook to create experiments")

    base_code = _next_base_code(db)
    exp = Experiment(
        id=new_uuid(),
        notebook_id=notebook_id,
        project_id=nb.project_id,
        base_code=base_code,
        version=1,
        full_code=f"{base_code}-01",
        title=body.title,
        screen_key=body.screen_key,
        section_key=body.section_key,
        data=body.data,
        observations=body.observations,
        conclusion=body.conclusion,
        scheme_mol=body.scheme_mol,
        status="DRAFT",
        is_latest_version=True,
        created_by=actor.id,
    )
    db.add(exp)
    db.flush()
    _log(db, exp.id, actor.id, "CREATED", {"title": body.title})
    db.commit()
    return _load(db, exp.id)


# ── List experiments in notebook ──────────────────────────────────────────────

@nb_router.get("/{notebook_id}/experiments", response_model=List[ExperimentSummary])
def list_experiments(
    notebook_id:  str,
    section_key:  Optional[str] = None,
    latest_only:  bool          = True,
    db:           Session       = Depends(get_db),
    _:            User          = Depends(get_current_user),
):
    q = db.query(Experiment).filter(Experiment.notebook_id == notebook_id)
    if latest_only:
        q = q.filter(Experiment.is_latest_version.is_(True))
    if section_key:
        q = q.filter(Experiment.section_key == section_key)
    return q.order_by(Experiment.base_code, Experiment.version).all()


# ── Get single experiment ─────────────────────────────────────────────────────

@router.get("/{exp_id}", response_model=ExperimentResponse)
def get_experiment(
    exp_id: str,
    db:     Session = Depends(get_db),
    _:      User    = Depends(get_current_user),
):
    return _load(db, exp_id)


# ── Update / save data — DRAFT only ──────────────────────────────────────────

@router.patch("/{exp_id}", response_model=ExperimentResponse)
def update_experiment(
    exp_id: str,
    body:   ExperimentUpdate,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = _load(db, exp_id)
    _require_nb_edit(exp, actor, db)
    if exp.status != "DRAFT":
        raise HTTPException(400, f"Cannot edit — experiment is {exp.status}")
    changed = body.model_dump(exclude_unset=True)
    for field, value in changed.items():
        setattr(exp, field, value)
    _log(db, exp_id, actor.id, "EDITED", {"fields": list(changed.keys())})
    db.commit()
    return _load(db, exp_id)


# ── Delete — DRAFT only ───────────────────────────────────────────────────────

@router.delete("/{exp_id}", status_code=204)
def delete_experiment(
    exp_id: str,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    _require_nb_edit(exp, actor, db)
    if exp.status != "DRAFT":
        raise HTTPException(400, "Only DRAFT experiments can be deleted")
    db.delete(exp)
    db.commit()


# ── Submit for review ─────────────────────────────────────────────────────────

@router.post("/{exp_id}/submit", response_model=ExperimentResponse)
def submit_experiment(
    exp_id: str,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = _load(db, exp_id)
    _require_nb_submit(exp, actor, db)
    if exp.status != "DRAFT":
        raise HTTPException(400, f"Cannot submit — experiment is {exp.status}")
    exp.status       = "SUBMITTED"
    exp.submitted_by = actor.id
    exp.submitted_at = _utcnow()
    _log(db, exp_id, actor.id, "SUBMITTED")
    db.commit()
    return _load(db, exp_id)


# ── Assign reviewer ───────────────────────────────────────────────────────────

@router.post("/{exp_id}/reviewers", response_model=ExperimentReviewResponse, status_code=201)
def assign_reviewer(
    exp_id: str,
    body:   AssignReviewer,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    if exp.status not in ("DRAFT", "SUBMITTED"):
        raise HTTPException(400, f"Cannot assign reviewers when experiment is {exp.status}")

    reviewer = db.get(User, body.reviewer_id)
    if not reviewer:
        raise HTTPException(404, "Reviewer user not found")

    existing = (
        db.query(ExperimentReview)
        .filter(
            ExperimentReview.experiment_id == exp_id,
            ExperimentReview.reviewer_id   == body.reviewer_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, "This reviewer is already assigned")

    review = ExperimentReview(
        id=new_uuid(),
        experiment_id=exp_id,
        reviewer_id=body.reviewer_id,
        assigned_by=actor.id,
    )
    db.add(review)
    _log(db, exp_id, actor.id, "REVIEWER_ASSIGNED", {"reviewer_id": body.reviewer_id})
    db.commit()
    db.refresh(review)
    return review


# ── Unassign reviewer ─────────────────────────────────────────────────────────

@router.delete("/{exp_id}/reviewers/{reviewer_id}", status_code=204)
def unassign_reviewer(
    exp_id:      str,
    reviewer_id: str,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(get_current_user),
):
    exp = db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    if exp.status not in ("DRAFT", "SUBMITTED"):
        raise HTTPException(400, f"Cannot change reviewers when experiment is {exp.status}")

    review = (
        db.query(ExperimentReview)
        .filter(
            ExperimentReview.experiment_id == exp_id,
            ExperimentReview.reviewer_id   == reviewer_id,
        )
        .first()
    )
    if not review:
        raise HTTPException(404, "Reviewer not assigned to this experiment")
    if review.signed_at:
        raise HTTPException(400, "Cannot unassign a reviewer who has already signed")

    db.delete(review)
    _log(db, exp_id, actor.id, "REVIEWER_UNASSIGNED", {"reviewer_id": reviewer_id})
    db.commit()


# ── E-signature (21 CFR Part 11) ──────────────────────────────────────────────

@router.post("/{exp_id}/sign", response_model=ExperimentResponse)
def sign_experiment(
    exp_id: str,
    body:   ExperimentSign,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = _load(db, exp_id)

    if not verify_password(body.password, actor.password_hash):
        raise HTTPException(401, "Invalid password — e-signature rejected")

    if body.role == "scientist":
        if exp.status not in ("DRAFT", "SUBMITTED"):
            raise HTTPException(400, f"Cannot sign as scientist — experiment is {exp.status}")
        exp.scientist_signed_by   = actor.id
        exp.scientist_signed_at   = _utcnow()
        exp.scientist_sign_reason = body.reason
        if exp.status == "DRAFT":
            exp.status       = "SUBMITTED"
            exp.submitted_by = actor.id
            exp.submitted_at = _utcnow()
            _log(db, exp_id, actor.id, "SUBMITTED")
        _log(db, exp_id, actor.id, "SIGN_SCIENTIST", {"reason": body.reason})

    elif body.role == "reviewer":
        if exp.status != "SUBMITTED":
            raise HTTPException(400, f"Cannot sign as reviewer — experiment is {exp.status}")
        if not body.decision or body.decision not in ("APPROVED", "REJECTED"):
            raise HTTPException(400, "decision must be 'APPROVED' or 'REJECTED' when role='reviewer'")

        review = (
            db.query(ExperimentReview)
            .filter(
                ExperimentReview.experiment_id == exp_id,
                ExperimentReview.reviewer_id   == actor.id,
            )
            .first()
        )
        if not review:
            raise HTTPException(403, "You are not an assigned reviewer for this experiment")
        if review.signed_at:
            raise HTTPException(400, "You have already signed this experiment")

        review.signed_at   = _utcnow()
        review.sign_reason = body.reason
        review.decision    = body.decision
        _log(db, exp_id, actor.id, "SIGN_REVIEWER", {
            "decision": body.decision, "reason": body.reason,
        })

        # If any reviewer rejects → immediately reject the experiment
        if body.decision == "REJECTED":
            exp.status           = "REJECTED"
            exp.rejected_by      = actor.id
            exp.rejected_at      = _utcnow()
            exp.rejection_reason = body.reason
            _log(db, exp_id, actor.id, "REJECTED", {"reason": body.reason, "by_reviewer": True})

    else:
        raise HTTPException(400, "role must be 'scientist' or 'reviewer'")

    db.commit()
    return _load(db, exp_id)


# ── Approve → LOCKED ──────────────────────────────────────────────────────────

_approve = require_privilege(EXPERIMENTS_APPROVE)

@router.post("/{exp_id}/approve", response_model=ExperimentResponse)
def approve_experiment(
    exp_id: str,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(_approve),
):
    exp = _load(db, exp_id)
    if exp.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot approve — experiment is {exp.status}")

    ok, reason = _all_reviewers_approved(db, exp_id)
    if not ok:
        raise HTTPException(400, reason)

    exp.status      = "LOCKED"
    exp.approved_by = actor.id
    exp.approved_at = _utcnow()
    _log(db, exp_id, actor.id, "APPROVED")
    db.commit()
    return _load(db, exp_id)


# ── Reject ────────────────────────────────────────────────────────────────────

@router.post("/{exp_id}/reject", response_model=ExperimentResponse)
def reject_experiment(
    exp_id: str,
    body:   ExperimentReject,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = _load(db, exp_id)
    if exp.status not in ("SUBMITTED", "APPROVED"):
        raise HTTPException(400, f"Cannot reject — experiment is {exp.status}")
    exp.status           = "REJECTED"
    exp.rejected_by      = actor.id
    exp.rejected_at      = _utcnow()
    exp.rejection_reason = body.reason
    _log(db, exp_id, actor.id, "REJECTED", {"reason": body.reason})
    db.commit()
    return _load(db, exp_id)


# ── New version (HOD) ─────────────────────────────────────────────────────────

@router.post("/{exp_id}/versions", response_model=ExperimentResponse, status_code=201)
def new_version(
    exp_id: str,
    body:   ExperimentNewVersion,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    old = _load(db, exp_id)
    if not old.is_latest_version:
        raise HTTPException(400, "Can only create a new version from the latest version")
    if old.status not in ("LOCKED", "REJECTED", "UNLOCKED"):
        raise HTTPException(400, f"Cannot version — experiment must be LOCKED, UNLOCKED, or REJECTED (currently {old.status})")

    old.is_latest_version = False
    db.flush()

    new_ver = old.version + 1
    exp = Experiment(
        id=new_uuid(),
        notebook_id=old.notebook_id,
        project_id=old.project_id,
        base_code=old.base_code,
        version=new_ver,
        full_code=f"{old.base_code}-{new_ver:02d}",
        title=old.title,
        screen_key=old.screen_key,
        section_key=old.section_key,
        data=dict(old.data) if old.data else None,
        observations=old.observations,
        conclusion=old.conclusion,
        disposition=None,
        status="DRAFT",
        is_latest_version=True,
        parent_id=old.id,
        revision_note=body.revision_note,
        linked_preliminary_id=old.linked_preliminary_id,
        created_by=actor.id,
    )
    db.add(exp)
    db.flush()
    _log(db, exp.id, actor.id, "CREATED", {
        "version": new_ver,
        "previous_id": old.id,
        "revision_note": body.revision_note,
    })
    _log(db, old.id, actor.id, "VERSION_CREATED", {"new_id": exp.id, "new_version": new_ver})
    db.commit()
    return _load(db, exp.id)


# ── Link preliminary ──────────────────────────────────────────────────────────

@router.patch("/{exp_id}/link-preliminary", response_model=ExperimentResponse)
def link_preliminary(
    exp_id: str,
    body:   ExperimentLinkPreliminary,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(_nb_edit),
):
    exp    = _load(db, exp_id)
    prelim = db.get(Experiment, body.preliminary_experiment_id)

    if not prelim:
        raise HTTPException(404, "Preliminary experiment not found")
    if prelim.status != "LOCKED":
        raise HTTPException(400, "Preliminary experiment must be LOCKED before linking")
    if not prelim.is_latest_version:
        latest = (
            db.query(Experiment)
            .filter(
                Experiment.base_code == prelim.base_code,
                Experiment.is_latest_version.is_(True),
            )
            .first()
        )
        hint = f" Use {latest.full_code} instead." if latest else ""
        raise HTTPException(400, f"{prelim.full_code} is not the latest version.{hint}")

    exp.linked_preliminary_id = prelim.id
    _log(db, exp_id, actor.id, "LINKED_PRELIMINARY", {"preliminary_id": prelim.id, "full_code": prelim.full_code})
    db.commit()
    return _load(db, exp_id)


# ── Audit history ─────────────────────────────────────────────────────────────

@router.get("/{exp_id}/history", response_model=List[ExperimentHistoryResponse])
def get_history(
    exp_id: str,
    db:     Session = Depends(get_db),
    _:      User    = Depends(get_current_user),
):
    if not db.get(Experiment, exp_id):
        raise HTTPException(404, "Experiment not found")
    return (
        db.query(ExperimentHistory)
        .filter(ExperimentHistory.experiment_id == exp_id)
        .order_by(ExperimentHistory.created_at)
        .all()
    )


# ── File upload ───────────────────────────────────────────────────────────────

@router.post("/{exp_id}/files", response_model=ExperimentFileResponse, status_code=201)
async def upload_file(
    exp_id:      str,
    file:        UploadFile       = File(...),
    section_key: Optional[str]   = Form(None),
    db:          Session          = Depends(get_db),
    actor:       User             = Depends(get_current_user),
):
    exp = db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    if exp.status == "LOCKED":
        raise HTTPException(400, "Cannot upload files to a LOCKED experiment")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "experiments", exp_id)
    os.makedirs(upload_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_name)
    content   = await file.read()
    with open(file_path, "wb") as fh:
        fh.write(content)

    ef = ExperimentFile(
        id=new_uuid(),
        experiment_id=exp_id,
        section_key=section_key,
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        file_type=(file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else None),
        uploaded_by=actor.id,
    )
    db.add(ef)
    _log(db, exp_id, actor.id, "FILE_UPLOADED", {"filename": file.filename})
    db.commit()
    db.refresh(ef)
    return ef


@router.get("/{exp_id}/files", response_model=List[ExperimentFileResponse])
def list_files(
    exp_id:      str,
    section_key: Optional[str] = None,
    db:          Session       = Depends(get_db),
    _:           User          = Depends(get_current_user),
):
    if not db.get(Experiment, exp_id):
        raise HTTPException(404, "Experiment not found")
    q = db.query(ExperimentFile).filter(ExperimentFile.experiment_id == exp_id)
    if section_key:
        q = q.filter(ExperimentFile.section_key == section_key)
    return q.order_by(ExperimentFile.uploaded_at).all()


@router.delete("/{exp_id}/files/{file_id}", status_code=204)
def delete_file(
    exp_id:  str,
    file_id: str,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_nb_edit),
):
    ef = db.query(ExperimentFile).filter(
        ExperimentFile.id == file_id,
        ExperimentFile.experiment_id == exp_id,
    ).first()
    if not ef:
        raise HTTPException(404, "File not found")
    exp = db.get(Experiment, exp_id)
    if exp and exp.status == "LOCKED":
        raise HTTPException(400, "Cannot delete files from a LOCKED experiment")
    if os.path.exists(ef.file_path):
        os.remove(ef.file_path)
    _log(db, exp_id, actor.id, "FILE_DELETED", {"filename": ef.filename})
    db.delete(ef)
    db.commit()
