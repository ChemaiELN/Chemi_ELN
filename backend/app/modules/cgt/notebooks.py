"""CGT Notebooks — CRUD with template-snapshot freeze on creation.

Mirrors app/modules/notebooks/router.py (ADC) but scoped to CgtProject/
CgtNotebook, without the route/stage/permission machinery (no CGT equivalent
exists yet). The template offered at creation must belong to the category
mapped from the parent project's `process` (see process_map.py) — this is
the CGT-specific twist over ADC's flow.
"""
from typing import Any, Optional
import uuid
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.dependencies import get_current_user, get_db
from app.models.cgt_notebook import CgtNotebook, CgtNotebookPermission
from app.models.project import CgtProject
from app.models.workflow_template import WorkflowTemplate
from app.modules.cgt.process_map import category_for_process
from app.shared.privileges import require_creator_role, assert_cgt_notebook_access, ASSIGNMENT_RESTRICTED_ROLES

router = APIRouter(prefix="/cgt-notebooks", tags=["cgt-notebooks"])
nb_sub_router = APIRouter(prefix="/cgt-projects", tags=["cgt-notebooks"])  # /cgt-projects/{id}/notebooks


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


def _notebook_dict(nb: CgtNotebook, include_snapshot: bool = False) -> dict:
    d: dict = {
        "id":               str(nb.id),
        "code":             nb.code,
        "title":            nb.title,
        "description":      nb.description,
        "cgt_project_id":   str(nb.cgt_project_id),
        "project_code":     nb.project.code if nb.project else None,
        "project_name":     nb.project.name if nb.project else None,
        "template_id":      str(nb.template_id) if nb.template_id else None,
        "template_name":    nb.template.name    if nb.template else None,
        "template_version": nb.template.version if nb.template else None,
        "created_by":       str(nb.created_by),
        "created_by_name":  nb.creator.username if nb.creator else None,
        "status":           nb.status,
        "created_at":       nb.created_at.isoformat(),
        "updated_at":       nb.updated_at.isoformat(),
    }
    if include_snapshot:
        d["template_snapshot"] = nb.template_snapshot
    return d


def _next_nb_code(db: Session, project_id: str, project_code: str) -> str:
    count = db.query(CgtNotebook).filter(CgtNotebook.cgt_project_id == project_id).count()
    return f"{project_code}-NB{(count + 1):03d}"


def _load_nb(db: Session, notebook_id: str) -> CgtNotebook:
    cond = CgtNotebook.id == notebook_id if _is_uuid(notebook_id) else CgtNotebook.code == notebook_id
    nb = db.query(CgtNotebook).options(
        joinedload(CgtNotebook.project),
        joinedload(CgtNotebook.creator),
        joinedload(CgtNotebook.template),
    ).filter(cond).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")
    return nb


# ── Sub-resource: list/create notebooks per project ───────────────────────────

@nb_sub_router.get("/{project_id}/notebooks")
def list_project_notebooks(
    project_id: str,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.query(CgtProject).filter(CgtProject.id == project_id).first():
        raise HTTPException(404, "CGT project not found")
    q = db.query(CgtNotebook).options(
        joinedload(CgtNotebook.project),
        joinedload(CgtNotebook.creator),
        joinedload(CgtNotebook.template),
    ).filter(CgtNotebook.cgt_project_id == project_id)
    if current_user.role.code in ASSIGNMENT_RESTRICTED_ROLES:
        q = q.join(CgtNotebookPermission, CgtNotebookPermission.cgt_notebook_id == CgtNotebook.id).filter(
            CgtNotebookPermission.user_id == current_user.id,
            CgtNotebookPermission.can_view.is_(True),
        )
    if status:
        q = q.filter(CgtNotebook.status == status)
    nbs = q.order_by(CgtNotebook.created_at.desc()).all()
    return [_notebook_dict(nb) for nb in nbs]


@nb_sub_router.post("/{project_id}/notebooks")
def create_notebook(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_creator_role(),
):
    project = db.query(CgtProject).filter(CgtProject.id == project_id).first()
    if not project:
        raise HTTPException(404, "CGT project not found")
    if not body.get("title"):
        raise HTTPException(422, "title is required")

    template_snapshot = None
    template_id = body.get("template_id")
    if template_id:
        tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
        if not tmpl:
            raise HTTPException(404, f"Workflow template '{template_id}' not found")
        if not tmpl.is_active:
            raise HTTPException(400, "Template is inactive and cannot be used")
        expected_category = category_for_process(project.process)
        if expected_category and tmpl.category != expected_category:
            raise HTTPException(
                400,
                f"Template category '{tmpl.category}' does not match this project's process "
                f"('{project.process}' -> '{expected_category}')",
            )
        template_snapshot = tmpl.definition   # FROZEN at creation time

    now = _now()
    nb = CgtNotebook(
        id=_uuid(),
        code=body.get("code") or _next_nb_code(db, project_id, project.code),
        title=body["title"],
        description=body.get("description"),
        cgt_project_id=project_id,
        template_id=template_id,
        template_snapshot=template_snapshot,
        created_by=current_user.id,
        status="ACTIVE",
        created_at=now,
        updated_at=now,
    )
    db.add(nb)
    db.commit()
    db.refresh(nb)
    db.expire(nb)
    nb = _load_nb(db, str(nb.id))
    return _notebook_dict(nb, include_snapshot=True)


# ── Top-level notebook endpoints ──────────────────────────────────────────────

@router.get("")
def list_all_notebooks(
    search:         Optional[str] = Query(None),
    status:         Optional[str] = Query(None),
    project_id:     Optional[str] = Query(None),
    assigned_to_me: bool          = Query(False),
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    q = db.query(CgtNotebook).options(
        joinedload(CgtNotebook.project),
        joinedload(CgtNotebook.creator),
        joinedload(CgtNotebook.template),
    )
    # Chemists/Analysts only ever see notebooks explicitly assigned to them —
    # this overrides the `assigned_to_me` query param, it's not optional for them.
    if assigned_to_me or current_user.role.code in ASSIGNMENT_RESTRICTED_ROLES:
        q = q.join(CgtNotebookPermission, CgtNotebookPermission.cgt_notebook_id == CgtNotebook.id).filter(
            CgtNotebookPermission.user_id == current_user.id,
            CgtNotebookPermission.can_view.is_(True),
        )
    if search:
        q = q.filter(CgtNotebook.code.ilike(f"%{search}%") | CgtNotebook.title.ilike(f"%{search}%"))
    if status:
        q = q.filter(CgtNotebook.status == status)
    if project_id:
        q = q.filter(CgtNotebook.cgt_project_id == project_id)
    total = q.count()
    nbs = q.order_by(CgtNotebook.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_notebook_dict(nb) for nb in nbs]}


@router.get("/{notebook_id}")
def get_notebook(
    notebook_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    nb = _load_nb(db, notebook_id)
    assert_cgt_notebook_access(db, current_user, nb)
    return _notebook_dict(nb, include_snapshot=True)


@router.patch("/{notebook_id}")
def update_notebook(
    notebook_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    nb = _load_nb(db, notebook_id)
    assert_cgt_notebook_access(db, current_user, nb)
    for field in ("title", "description", "status"):
        if field in body:
            setattr(nb, field, body[field])
    nb.updated_at = _now()
    db.commit()
    db.refresh(nb)
    return _notebook_dict(_load_nb(db, notebook_id), include_snapshot=True)


@router.get("/{notebook_id}/template-snapshot")
def get_template_snapshot(
    notebook_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    nb = _load_nb(db, notebook_id)
    return {"template_snapshot": nb.template_snapshot, "template_id": str(nb.template_id) if nb.template_id else None}


# ── Assigned users (chemists) ─────────────────────────────────────────────────

@router.get("/{notebook_id}/assigned-users")
def get_assigned_users(
    notebook_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    nb = _load_nb(db, notebook_id)
    perms = db.query(CgtNotebookPermission).filter(
        CgtNotebookPermission.cgt_notebook_id == nb.id,
        CgtNotebookPermission.can_edit == True,
    ).all()
    result = []
    for p in perms:
        u = p.user
        result.append({
            "user_id":    str(p.user_id),
            "username":   u.username if u else None,
            "emp_no":     u.emp_no   if u else None,
            "granted_at": p.granted_at.isoformat(),
        })
    return result


@router.post("/{notebook_id}/assign-user")
def assign_user(
    notebook_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_creator_role(),
):
    nb = _load_nb(db, notebook_id)
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(422, "user_id is required")

    existing = db.query(CgtNotebookPermission).filter(
        CgtNotebookPermission.cgt_notebook_id == nb.id,
        CgtNotebookPermission.user_id == user_id,
    ).first()

    if existing:
        existing.can_edit   = True
        existing.can_view   = True
        existing.can_submit = True
    else:
        db.add(CgtNotebookPermission(
            id=_uuid(), cgt_notebook_id=nb.id, user_id=user_id,
            can_view=True, can_edit=True, can_submit=True,
            granted_by=current_user.id, granted_at=_now(),
        ))
    db.commit()
    return {"ok": True}


@router.delete("/{notebook_id}/unassign/{user_id}")
def unassign_user(
    notebook_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    _: Any = require_creator_role(),
):
    nb = _load_nb(db, notebook_id)
    perm = db.query(CgtNotebookPermission).filter(
        CgtNotebookPermission.cgt_notebook_id == nb.id,
        CgtNotebookPermission.user_id == user_id,
    ).first()
    if perm:
        db.delete(perm)
        db.commit()
    return {"ok": True}
