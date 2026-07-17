"""CGT Experiments — one experiment per CGT notebook (the whole template).

Unlike ADC's one-experiment-per-section model, a CgtExperiment spans the
entire notebook: sections and screens are navigated client-side within it.
data = {section_id: {screen_id: field_values_or_rows}}. Workflow mirrors
ADC's e-signature flow: chemist submits (signs) -> CGT HOD approves (signs)
or rejects; HOD may unlock back to DRAFT.
"""
from typing import Any, Optional
import uuid
import datetime

import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.utils import verify_password
from app.dependencies import get_current_user, get_db
from app.models.cgt_experiment import CgtExperiment
from app.models.cgt_notebook import CgtNotebook, CgtNotebookPermission
from app.shared.privileges import assert_cgt_notebook_access, require_creator_role, ASSIGNMENT_RESTRICTED_ROLES


def _verify_signature_password(current_user: Any, password: Optional[str]) -> None:
    """Password re-entry is the electronic signature — mirrors a wet signature:
    the user must prove it's really them, at this moment, before the record
    is finalized."""
    if not password:
        raise HTTPException(422, "password is required to sign")
    if not verify_password(password, current_user.password_hash):
        # 400, not 401 — a 401 here would trip the frontend's global
        # session-expiry interceptor and force-log the user out.
        raise HTTPException(400, "Incorrect password")

# Only a CGT HOD signs off on (approves/rejects) a submitted experiment —
# narrower than ADC's TL+HOD approver set, per the CGT sign-off requirement.
APPROVER_ROLES = {"HOD"}


def require_approver_role():
    from fastapi import status as _status

    def _dep(current_user: Any = Depends(get_current_user)):
        if current_user.role.code not in APPROVER_ROLES:
            raise HTTPException(
                status_code=_status.HTTP_403_FORBIDDEN,
                detail="Only HOD can approve or reject an experiment.",
            )
        return current_user

    return Depends(_dep)


router = APIRouter(tags=["cgt-experiments"])
exp_router = APIRouter(prefix="/cgt-experiments", tags=["cgt-experiments"])


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _get_or_404(db: Session, exp_id: str) -> CgtExperiment:
    cond = CgtExperiment.id == exp_id if _is_uuid(exp_id) else CgtExperiment.full_code == exp_id
    e = db.query(CgtExperiment).filter(cond).first()
    if not e:
        raise HTTPException(404, "Experiment not found")
    return e


def _nb_or_404(db: Session, nb_id: str) -> CgtNotebook:
    cond = CgtNotebook.id == nb_id if _is_uuid(nb_id) else CgtNotebook.code == nb_id
    nb = db.query(CgtNotebook).filter(cond).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")
    return nb


def _exp_dict(e: CgtExperiment, include_data: bool = True) -> dict:
    d: dict = {
        "id":            str(e.id),
        "cgt_notebook_id": str(e.cgt_notebook_id),
        "cgt_project_id":  str(e.cgt_project_id),
        "base_code":     e.base_code,
        "version":       e.version,
        "full_code":     e.full_code,
        "title":         e.title,
        "section_key":   e.section_key,
        "screen_key":    e.screen_key,
        "status":        e.status,
        "observations":  e.observations,
        "conclusion":    e.conclusion,
        "is_latest_version": e.is_latest_version,
        "created_by":    str(e.created_by),
        "submitted_by":  str(e.submitted_by) if e.submitted_by else None,
        "submitted_at":  e.submitted_at.isoformat() if e.submitted_at else None,
        "approved_by":   str(e.approved_by) if e.approved_by else None,
        "approved_at":   e.approved_at.isoformat() if e.approved_at else None,
        "rejected_by":   str(e.rejected_by) if e.rejected_by else None,
        "rejected_at":   e.rejected_at.isoformat() if e.rejected_at else None,
        "rejection_reason": e.rejection_reason,
        "scientist_signed_by":   str(e.scientist_signed_by) if e.scientist_signed_by else None,
        "scientist_signed_at":   e.scientist_signed_at.isoformat() if e.scientist_signed_at else None,
        "scientist_sign_reason": e.scientist_sign_reason,
        "created_at":    e.created_at.isoformat(),
        "updated_at":    e.updated_at.isoformat(),
    }
    if include_data:
        d["data"] = e.data or {}
    return d


def _next_exp_code(db: Session) -> tuple[str, str]:
    """Global sequential experiment code: CGT-EXP-{n:03d}-01.

    Derived from the highest existing sequence number, not COUNT(*) — a plain
    count silently collides with an already-used code as soon as any row is
    ever deleted (count drops but the max sequence already issued doesn't)."""
    max_seq = 0
    for (code,) in db.query(CgtExperiment.base_code).all():
        try:
            seq = int(code.rsplit("-", 1)[-1])
            if seq > max_seq:
                max_seq = seq
        except (ValueError, AttributeError):
            pass
    base = f"CGT-EXP-{max_seq + 1:03d}"
    return base, f"{base}-01"


# ── List experiments for a notebook ───────────────────────────────────────────

@router.get("/cgt-notebooks/{notebook_id}/experiments")
def list_experiments(
    notebook_id: str,
    section_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    nb = _nb_or_404(db, notebook_id)
    assert_cgt_notebook_access(db, current_user, nb)
    q = db.query(CgtExperiment).filter(
        CgtExperiment.cgt_notebook_id == nb.id,
        CgtExperiment.is_latest_version == True,
    )
    if section_key:
        q = q.filter(CgtExperiment.section_key == section_key)
    return [_exp_dict(e, include_data=False) for e in q.order_by(CgtExperiment.created_at).all()]


@router.post("/cgt-notebooks/{notebook_id}/experiments")
def create_experiment(
    notebook_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_creator_role(),
):
    """A notebook can hold multiple freely-titled experiments (mirrors ADC's
    NotebookOverviewPage "New Experiment" flow) — each is a distinct run;
    sections/screens are navigated client-side within whichever experiment is
    open (data is keyed data[section_id][screen_id])."""
    nb = _nb_or_404(db, notebook_id)
    assert_cgt_notebook_access(db, current_user, nb)
    if not body.get("title"):
        raise HTTPException(422, "title is required")

    base_code, full_code = _next_exp_code(db)
    now = _now()
    e = CgtExperiment(
        id=_uuid(),
        cgt_notebook_id=nb.id,
        cgt_project_id=nb.cgt_project_id,
        base_code=base_code,
        version=1,
        full_code=full_code,
        title=body["title"],
        section_key=body.get("section_key"),
        screen_key=body.get("screen_key"),
        data={},
        status="DRAFT",
        is_latest_version=True,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


# ── List all experiments (global) ─────────────────────────────────────────────

@exp_router.get("")
def list_all_experiments(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    from app.models.project import CgtProject
    from app.models.admin import User

    q = (
        db.query(
            CgtExperiment,
            CgtNotebook.code.label("notebook_code"),
            CgtNotebook.title.label("notebook_title"),
            CgtProject.code.label("project_code"),
            CgtProject.name.label("project_name"),
        )
        .join(CgtNotebook, CgtExperiment.cgt_notebook_id == CgtNotebook.id)
        .join(CgtProject,  CgtExperiment.cgt_project_id  == CgtProject.id)
        .filter(CgtExperiment.is_latest_version == True)
    )
    if current_user.role.code in ASSIGNMENT_RESTRICTED_ROLES:
        assigned_notebook_ids = db.query(CgtNotebookPermission.cgt_notebook_id).filter(
            CgtNotebookPermission.user_id == current_user.id,
            CgtNotebookPermission.can_view.is_(True),
        ).subquery()
        q = q.filter(CgtExperiment.cgt_notebook_id.in_(assigned_notebook_ids))
    if search:
        like = f"%{search}%"
        q = q.filter(
            CgtExperiment.full_code.ilike(like) |
            CgtExperiment.title.ilike(like) |
            CgtNotebook.code.ilike(like) |
            CgtProject.code.ilike(like)
        )
    if status:
        q = q.filter(CgtExperiment.status == status)
    total = q.count()
    rows  = q.order_by(CgtExperiment.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    creator_ids = list({str(row.CgtExperiment.created_by) for row in rows if row.CgtExperiment.created_by})
    creators: dict = {}
    if creator_ids:
        for u in db.query(User).filter(User.id.in_(creator_ids)).all():
            creators[str(u.id)] = u.username

    items = []
    for row in rows:
        e = row.CgtExperiment
        items.append({
            **_exp_dict(e, include_data=False),
            "notebook_code":   row.notebook_code,
            "notebook_title":  row.notebook_title,
            "project_code":    row.project_code,
            "project_name":    row.project_name,
            "created_by_name": creators.get(str(e.created_by)),
        })
    return {"total": total, "items": items}


# ── Single experiment CRUD ─────────────────────────────────────────────────────

@exp_router.get("/{exp_id}")
def get_experiment(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    return _exp_dict(e)


@exp_router.patch("/{exp_id}")
def update_experiment(
    exp_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    if e.status in ("APPROVED", "REJECTED"):
        raise HTTPException(400, f"Cannot edit experiment in status '{e.status}'")

    # Shallow-merge data one level deep: body["data"] = {section_id: {screen_id: value}}.
    # Only the touched section's dict is merged, so other sections' data survives.
    if "data" in body and isinstance(body["data"], dict):
        merged = dict(e.data or {})
        for section_id, section_data in body["data"].items():
            if isinstance(section_data, dict):
                merged[section_id] = {**(merged.get(section_id) or {}), **section_data}
            else:
                merged[section_id] = section_data
        e.data = merged

    for field in ("screen_key", "observations", "conclusion"):
        if field in body:
            setattr(e, field, body[field])

    e.updated_at = _now()
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/submit")
def submit_experiment(
    exp_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Chemist signature: re-entering the password proves it's really them,
    right now, finalizing the record — the electronic-signature equivalent
    of a wet signature."""
    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    if e.status != "DRAFT":
        raise HTTPException(400, f"Cannot submit experiment in status '{e.status}'")
    _verify_signature_password(current_user, body.get("password"))
    now = _now()
    e.status = "SUBMITTED"
    e.submitted_by = current_user.id
    e.submitted_at = now
    e.scientist_signed_by = current_user.id
    e.scientist_signed_at = now
    e.scientist_sign_reason = body.get("sign_reason") or "Submitted for review"
    e.updated_at = now
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/approve")
def approve_experiment(
    exp_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_approver_role(),
):
    """HOD signature: same password re-entry proof as the chemist's submit
    signature, required before the record can be locked as APPROVED."""
    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    if e.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot approve experiment in status '{e.status}'")
    _verify_signature_password(current_user, body.get("password"))
    now = _now()
    e.status = "APPROVED"
    e.approved_by = current_user.id
    e.approved_at = now
    e.updated_at = now
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/reject")
def reject_experiment(
    exp_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_approver_role(),
):
    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    if e.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot reject experiment in status '{e.status}'")
    reason = body.get("reason")
    if not reason:
        raise HTTPException(422, "reason is required")
    _verify_signature_password(current_user, body.get("password"))
    now = _now()
    e.status = "REJECTED"
    e.rejected_by = current_user.id
    e.rejected_at = now
    e.rejection_reason = reason
    e.updated_at = now
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/unlock")
def unlock_experiment(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: Any = require_approver_role(),
):
    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    if e.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(400, f"Cannot unlock experiment in status '{e.status}'")
    e.status = "DRAFT"
    e.updated_at = _now()
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


# ── Report (docx) ─────────────────────────────────────────────────────────────

@exp_router.get("/{exp_id}/report/docx")
def download_cgt_report_docx(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    from app.models.admin import User
    from app.models.project import CgtProject
    from app.modules.cgt.report import generate_cgt_experiment_docx

    e = _get_or_404(db, exp_id)
    assert_cgt_notebook_access(db, current_user, e.notebook)
    if e.status != "APPROVED":
        raise HTTPException(400, "Only approved experiments can be downloaded as a report")

    nb = db.query(CgtNotebook).filter(CgtNotebook.id == e.cgt_notebook_id).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")
    proj = db.query(CgtProject).filter(CgtProject.id == e.cgt_project_id).first()

    approver_name = None
    submitter_name = None
    if e.approved_by:
        u = db.query(User).filter(User.id == e.approved_by).first()
        if u:
            approver_name = u.username
    if e.submitted_by:
        u = db.query(User).filter(User.id == e.submitted_by).first()
        if u:
            submitter_name = u.username

    exp_dict = _exp_dict(e)
    nb_dict = {
        "id": str(nb.id), "code": nb.code, "title": nb.title,
        "template_snapshot": nb.template_snapshot,
    }
    proj_dict = {
        "id": str(proj.id) if proj else "", "code": getattr(proj, "code", ""),
        "name": getattr(proj, "name", ""),
    } if proj else {}

    docx_bytes = generate_cgt_experiment_docx(
        experiment=exp_dict,
        notebook=nb_dict,
        project=proj_dict,
        approver_name=approver_name,
        submitter_name=submitter_name,
    )

    filename = f"{e.full_code}_report.docx".replace("/", "-").replace(" ", "_")
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
