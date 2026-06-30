"""Experiments — section-level data capture for ADC notebooks.

One Experiment per notebook section (section_key identifies the section).
data = {screen_key: {field_key: value}} — full section state stored as JSON.
Status: DRAFT → SUBMITTED → APPROVED / REJECTED → (unlock) → DRAFT
"""
from typing import Any, Optional
import uuid, datetime, os, shutil

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
import io

from app.dependencies import get_current_user, get_db
from app.models.experiment import Experiment, ExperimentFile, ExperimentHistory, ExperimentReview
from app.models.notebook import Notebook
from app.models.project import Project, ProjectUser
from app.models.admin import User

router = APIRouter(tags=["experiments"])
exp_router = APIRouter(prefix="/experiments", tags=["experiments"])


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "experiments"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, exp_id: str) -> Experiment:
    e = db.query(Experiment).filter(Experiment.id == exp_id).first()
    if not e:
        raise HTTPException(404, "Experiment not found")
    return e


def _nb_or_404(db: Session, nb_id: str) -> Notebook:
    nb = db.query(Notebook).filter(Notebook.id == nb_id).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")
    return nb


def _exp_dict(e: Experiment, include_data: bool = True) -> dict:
    d: dict = {
        "id":            str(e.id),
        "notebook_id":   str(e.notebook_id),
        "project_id":    str(e.project_id),
        "base_code":     e.base_code,
        "version":       e.version,
        "full_code":     e.full_code,
        "title":         e.title,
        "section_key":   e.section_key,
        "screen_key":    e.screen_key,
        "status":        e.status,
        "disposition":   e.disposition,
        "observations":  e.observations,
        "conclusion":    e.conclusion,
        "is_latest_version": e.is_latest_version,
        "created_by":    str(e.created_by),
        "submitted_by":  str(e.submitted_by)  if e.submitted_by  else None,
        "submitted_at":  e.submitted_at.isoformat() if e.submitted_at  else None,
        "approved_by":   str(e.approved_by)   if e.approved_by   else None,
        "approved_at":   e.approved_at.isoformat()  if e.approved_at   else None,
        "rejected_by":   str(e.rejected_by)   if e.rejected_by   else None,
        "rejected_at":   e.rejected_at.isoformat()  if e.rejected_at   else None,
        "rejection_reason": e.rejection_reason,
        "scientist_signed_by": str(e.scientist_signed_by) if e.scientist_signed_by else None,
        "scientist_signed_at": e.scientist_signed_at.isoformat() if e.scientist_signed_at else None,
        "scientist_sign_reason": e.scientist_sign_reason,
        "created_at":    e.created_at.isoformat(),
        "updated_at":    e.updated_at.isoformat(),
    }
    if include_data:
        d["data"] = e.data or {}
    return d


def _next_exp_code(db: Session, notebook_id) -> tuple[str, str]:
    """Global sequential experiment code: EXP-{n:03d}-01."""
    count = db.query(func.count(Experiment.id)).scalar() + 1
    base  = f"EXP-{count:03d}"
    full  = f"{base}-01"
    return base, full


def _add_history(db: Session, exp: Experiment, actor_id: Any, action: str, details: dict = None):
    db.add(ExperimentHistory(
        id=_uuid(), experiment_id=exp.id,
        actor_id=actor_id, action=action,
        details=details or {}, created_at=_now(),
    ))


# ── List all experiments (global) ─────────────────────────────────────────────

@exp_router.get("")
def list_all_experiments(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    CreatorUser = User.__table__.alias("creator_user")
    q = (
        db.query(
            Experiment,
            Notebook.code.label("notebook_code"),
            Notebook.title.label("notebook_title"),
            Project.code.label("project_code"),
            Project.name.label("project_name"),
        )
        .join(Notebook, Experiment.notebook_id == Notebook.id)
        .join(Project,  Experiment.project_id  == Project.id)
        .filter(Experiment.is_latest_version == True)
    )
    if current_user.role.code == "TL":
        assigned_project_ids = db.query(ProjectUser.project_id).filter(
            ProjectUser.user_id == current_user.id
        ).subquery()
        q = q.filter(Experiment.project_id.in_(assigned_project_ids))
    if search:
        like = f"%{search}%"
        q = q.filter(
            Experiment.full_code.ilike(like) |
            Experiment.title.ilike(like) |
            Notebook.code.ilike(like) |
            Project.code.ilike(like)
        )
    if status:
        q = q.filter(Experiment.status == status)
    total = q.count()
    rows  = q.order_by(Experiment.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    creator_ids = list({str(e.Experiment.created_by) for e in rows if e.Experiment.created_by})
    creators: dict = {}
    if creator_ids:
        for u in db.query(User).filter(User.id.in_(creator_ids)).all():
            creators[str(u.id)] = u.username

    items = []
    for row in rows:
        e = row.Experiment
        items.append({
            **_exp_dict(e, include_data=False),
            "notebook_code":  row.notebook_code,
            "notebook_title": row.notebook_title,
            "project_code":   row.project_code,
            "project_name":   row.project_name,
            "created_by_name": creators.get(str(e.created_by)),
        })
    return {"total": total, "items": items}


# ── List / create experiments for a notebook ─────────────────────────────────

@router.get("/notebooks/{notebook_id}/experiments")
def list_experiments(
    notebook_id: str,
    section_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _nb_or_404(db, notebook_id)
    q = db.query(Experiment).filter(
        Experiment.notebook_id == notebook_id,
        Experiment.is_latest_version == True,
    )
    if section_key:
        q = q.filter(Experiment.section_key == section_key)
    return [_exp_dict(e, include_data=False) for e in q.order_by(Experiment.created_at).all()]


@router.post("/notebooks/{notebook_id}/experiments")
def create_experiment(
    notebook_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    nb = _nb_or_404(db, notebook_id)
    section_key = body.get("section_key")  # optional — null means full-notebook experiment

    # Legacy: enforce one active experiment per section when section_key is provided
    if section_key:
        existing = db.query(Experiment).filter(
            Experiment.notebook_id == notebook_id,
            Experiment.section_key == section_key,
            Experiment.is_latest_version == True,
        ).first()
        if existing:
            raise HTTPException(409, f"Experiment for section '{section_key}' already exists")

    base_code, full_code = _next_exp_code(db, notebook_id)
    now = _now()
    title = body.get("title") or (section_key.replace("_", " ").title() if section_key else "Untitled Experiment")
    e = Experiment(
        id=_uuid(),
        notebook_id=nb.id,
        project_id=nb.project_id,
        base_code=base_code,
        version=1,
        full_code=full_code,
        title=title,
        section_key=section_key,
        screen_key=body.get("screen_key"),
        data={},
        status="DRAFT",
        is_latest_version=True,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(e)
    _add_history(db, e, current_user.id, "CREATED", {"title": title})
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


# ── Single experiment CRUD ────────────────────────────────────────────────────

@exp_router.get("/{exp_id}")
def get_experiment(
    exp_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    return _exp_dict(_get_or_404(db, exp_id))


@exp_router.patch("/{exp_id}")
def update_experiment(
    exp_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    if e.status in ("APPROVED", "LOCKED", "VOID"):
        raise HTTPException(400, f"Cannot edit experiment in status '{e.status}'")

    # Deep-merge data: body["data"] = {screen_key: {field_key: value}}
    if "data" in body and isinstance(body["data"], dict):
        merged = dict(e.data or {})
        for screen_key, screen_data in body["data"].items():
            if isinstance(screen_data, dict):
                merged[screen_key] = {**(merged.get(screen_key) or {}), **screen_data}
            else:
                merged[screen_key] = screen_data
        e.data = merged

    for field in ("screen_key", "observations", "conclusion", "disposition"):
        if field in body:
            setattr(e, field, body[field])

    e.updated_at = _now()
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


# ── Workflow transitions ──────────────────────────────────────────────────────

@exp_router.post("/{exp_id}/submit")
def submit_experiment(
    exp_id: str,
    body: dict = {},
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    if e.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(400, f"Cannot submit from status '{e.status}'")
    now = _now()
    e.status       = "SUBMITTED"
    e.submitted_by = current_user.id
    e.submitted_at = now
    e.updated_at   = now
    # Capture scientist e-signature if provided
    if body.get("sign_reason"):
        e.scientist_signed_by   = current_user.id
        e.scientist_signed_at   = now
        e.scientist_sign_reason = body["sign_reason"]
    _add_history(db, e, current_user.id, "SUBMITTED")
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/approve")
def approve_experiment(
    exp_id: str,
    body: dict = {},
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    if e.status != "SUBMITTED":
        raise HTTPException(400, "Can only approve a SUBMITTED experiment")
    now = _now()
    e.status      = "APPROVED"
    e.approved_by = current_user.id
    e.approved_at = now
    e.updated_at  = now
    _add_history(db, e, current_user.id, "APPROVED", {"sign_reason": body.get("sign_reason")})
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/reject")
def reject_experiment(
    exp_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    if e.status != "SUBMITTED":
        raise HTTPException(400, "Can only reject a SUBMITTED experiment")
    now = _now()
    e.status           = "REJECTED"
    e.rejected_by      = current_user.id
    e.rejected_at      = now
    e.rejection_reason = body.get("reason", "")
    e.updated_at       = now
    _add_history(db, e, current_user.id, "REJECTED", {"reason": e.rejection_reason})
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


@exp_router.post("/{exp_id}/unlock")
def unlock_experiment(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    if e.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(400, "Can only unlock APPROVED or REJECTED experiments")
    e.status     = "DRAFT"
    e.updated_at = _now()
    _add_history(db, e, current_user.id, "UNLOCKED")
    db.commit()
    db.refresh(e)
    return _exp_dict(e)


# ── Files ─────────────────────────────────────────────────────────────────────

@exp_router.get("/{exp_id}/files")
def list_files(
    exp_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, exp_id)
    files = db.query(ExperimentFile).filter(ExperimentFile.experiment_id == exp_id).all()
    return [
        {
            "id": str(f.id), "filename": f.filename, "file_size": f.file_size,
            "file_type": f.file_type, "section_key": f.section_key,
            "uploaded_by": str(f.uploaded_by), "uploaded_at": f.uploaded_at.isoformat(),
        }
        for f in files
    ]


@exp_router.post("/{exp_id}/files")
async def upload_file(
    exp_id: str,
    section_key: Optional[str] = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    e = _get_or_404(db, exp_id)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    dest_name = f"{exp_id}_{_uuid()}_{file.filename}"
    dest_path = os.path.join(UPLOAD_DIR, dest_name)
    with open(dest_path, "wb") as fh:
        shutil.copyfileobj(file.file, fh)
    size = os.path.getsize(dest_path)
    ef = ExperimentFile(
        id=_uuid(), experiment_id=e.id,
        section_key=section_key or e.section_key,
        filename=file.filename, file_path=dest_path,
        file_size=size, file_type=file.content_type,
        uploaded_by=current_user.id, uploaded_at=_now(),
    )
    db.add(ef)
    db.commit()
    db.refresh(ef)
    return {"id": str(ef.id), "filename": ef.filename, "file_size": ef.file_size}


@exp_router.delete("/{exp_id}/files/{file_id}")
def delete_file(
    exp_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, exp_id)
    ef = db.query(ExperimentFile).filter(
        ExperimentFile.id == file_id,
        ExperimentFile.experiment_id == exp_id,
    ).first()
    if not ef:
        raise HTTPException(404, "File not found")
    if os.path.exists(ef.file_path):
        os.remove(ef.file_path)
    db.delete(ef)
    db.commit()
    return {"ok": True}


# ── Report (docx) ─────────────────────────────────────────────────────────────

@exp_router.get("/{exp_id}/report/docx")
def download_report_docx(
    exp_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    from app.modules.experiments.report import generate_experiment_docx
    e = _get_or_404(db, exp_id)

    nb = db.query(Notebook).filter(Notebook.id == e.notebook_id).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")

    proj = db.query(Project).filter(Project.id == e.project_id).first()

    approver_name  = None
    submitter_name = None
    if e.approved_by:
        u = db.query(User).filter(User.id == e.approved_by).first()
        if u:
            approver_name = u.username
    if e.submitted_by:
        u = db.query(User).filter(User.id == e.submitted_by).first()
        if u:
            submitter_name = u.username

    exp_dict  = _exp_dict(e)
    nb_dict   = {
        "id": str(nb.id), "code": nb.code, "title": nb.title,
        "template_snapshot": nb.template_snapshot,
    }
    proj_dict = {
        "id": str(proj.id) if proj else "", "code": getattr(proj, "code", ""),
        "name": getattr(proj, "name", ""),
    } if proj else {}

    docx_bytes = generate_experiment_docx(
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


# ── History ───────────────────────────────────────────────────────────────────

@exp_router.get("/{exp_id}/history")
def get_history(
    exp_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, exp_id)
    rows = db.query(ExperimentHistory).filter(
        ExperimentHistory.experiment_id == exp_id
    ).order_by(ExperimentHistory.created_at).all()
    return [
        {"action": h.action, "actor_id": str(h.actor_id),
         "details": h.details, "created_at": h.created_at.isoformat()}
        for h in rows
    ]
