"""Notebooks — CRUD with template-snapshot freeze on creation.

Key invariant: when a template_id is provided at creation time, the template's
current definition is frozen into template_snapshot so the notebook never drifts
if the template is updated later.
"""
from typing import Any, Optional
import uuid
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.dependencies import get_current_user, get_db
from app.models.notebook import Notebook, NotebookPermission
from app.models.project import Project, ProjectUser
from app.models.workflow_template import WorkflowTemplate
from app.models.admin import User

router = APIRouter(prefix="/notebooks", tags=["notebooks"])
nb_sub_router = APIRouter(prefix="/projects", tags=["notebooks"])  # /projects/{id}/notebooks


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, notebook_id: str) -> Notebook:
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")
    return nb


def _notebook_dict(nb: Notebook, include_snapshot: bool = False) -> dict:
    d: dict = {
        "id":                   str(nb.id),
        "code":                 nb.code,
        "title":                nb.title,
        "description":          nb.description,
        "project_id":           str(nb.project_id),
        "project_code":         nb.project.code if nb.project else None,
        "project_name":         nb.project.name if nb.project else None,
        "route_id":             str(nb.route_id)           if nb.route_id           else None,
        "stage_id":             str(nb.stage_id)           if nb.stage_id           else None,
        "type":                 nb.type,
        "parent_notebook_id":   str(nb.parent_notebook_id) if nb.parent_notebook_id else None,
        "linked_notebook_id":   str(nb.linked_notebook_id) if nb.linked_notebook_id else None,
        "template_id":          str(nb.template_id)        if nb.template_id        else None,
        "template_name":        nb.template.name    if nb.template else None,
        "template_version":     nb.template.version if nb.template else None,
        "preliminary_complete": nb.preliminary_complete,
        "created_by":           str(nb.created_by),
        "created_by_name":      nb.creator.username if nb.creator else None,
        "status":               nb.status,
        "created_at":           nb.created_at.isoformat(),
        "updated_at":           nb.updated_at.isoformat(),
    }
    if include_snapshot:
        d["template_snapshot"] = nb.template_snapshot
    return d


def _next_nb_code(db: Session, project_id: str, project_code: str) -> str:
    count = db.query(Notebook).filter(Notebook.project_id == project_id).count()
    return f"{project_code}-NB{(count + 1):03d}"


# ── Sub-resource: list notebooks per project ──────────────────────────────────

@nb_sub_router.get("/{project_id}/notebooks")
def list_project_notebooks(
    project_id: str,
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not db.query(Project).filter(Project.id == project_id).first():
        raise HTTPException(404, "Project not found")
    if current_user.role.code == "TL":
        member = db.query(ProjectUser).filter(
            ProjectUser.project_id == project_id,
            ProjectUser.user_id == current_user.id,
        ).first()
        if not member:
            raise HTTPException(403, "Access denied: not a member of this project")
    q = db.query(Notebook).options(
        joinedload(Notebook.project),
        joinedload(Notebook.creator),
        joinedload(Notebook.template),
    ).filter(Notebook.project_id == project_id)
    if type:
        q = q.filter(Notebook.type == type)
    if status:
        q = q.filter(Notebook.status == status)
    nbs = q.order_by(Notebook.created_at.desc()).all()
    return [_notebook_dict(nb) for nb in nbs]


@nb_sub_router.post("/{project_id}/notebooks")
def create_notebook(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if not body.get("title"):
        raise HTTPException(422, "title is required")

    # Freeze template snapshot if a template_id is provided
    template_snapshot = None
    template_id = body.get("template_id")
    if template_id:
        tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
        if not tmpl:
            raise HTTPException(404, f"Workflow template '{template_id}' not found")
        if not tmpl.is_active:
            raise HTTPException(400, "Template is inactive and cannot be used")
        template_snapshot = tmpl.definition   # FROZEN at creation time

    now = _now()
    nb = Notebook(
        id=_uuid(),
        code=body.get("code") or _next_nb_code(db, project_id, project.code),
        title=body["title"],
        description=body.get("description"),
        project_id=project_id,
        route_id=body.get("route_id"),
        stage_id=body.get("stage_id"),
        type=body.get("type"),
        parent_notebook_id=body.get("parent_notebook_id"),
        linked_notebook_id=body.get("linked_notebook_id"),
        template_id=template_id,
        template_snapshot=template_snapshot,
        preliminary_complete=False,
        created_by=current_user.id,
        status="ACTIVE",
        created_at=now,
        updated_at=now,
    )
    db.add(nb)
    db.commit()
    db.refresh(nb)
    # Reload with relationships
    db.expire(nb)
    nb = db.query(Notebook).options(
        joinedload(Notebook.project),
        joinedload(Notebook.creator),
        joinedload(Notebook.template),
    ).filter(Notebook.id == nb.id).first()
    return _notebook_dict(nb, include_snapshot=True)


# ── Top-level notebook endpoints ──────────────────────────────────────────────

def _load_nb(db: Session, notebook_id: str) -> Notebook:
    nb = db.query(Notebook).options(
        joinedload(Notebook.project),
        joinedload(Notebook.creator),
        joinedload(Notebook.template),
    ).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(404, "Notebook not found")
    return nb


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
    q = db.query(Notebook).options(
        joinedload(Notebook.project),
        joinedload(Notebook.creator),
        joinedload(Notebook.template),
    )
    if current_user.role.code == "TL":
        assigned_project_ids = db.query(ProjectUser.project_id).filter(
            ProjectUser.user_id == current_user.id
        ).subquery()
        q = q.filter(Notebook.project_id.in_(assigned_project_ids))
    if assigned_to_me:
        q = q.join(NotebookPermission, NotebookPermission.notebook_id == Notebook.id).filter(
            NotebookPermission.user_id == current_user.id
        )
    if search:
        q = q.filter(
            Notebook.code.ilike(f"%{search}%") | Notebook.title.ilike(f"%{search}%")
        )
    if status:
        q = q.filter(Notebook.status == status)
    if project_id:
        q = q.filter(Notebook.project_id == project_id)
    total = q.count()
    nbs = q.order_by(Notebook.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_notebook_dict(nb) for nb in nbs]}


@router.get("/{notebook_id}")
def get_notebook(
    notebook_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    return _notebook_dict(_load_nb(db, notebook_id), include_snapshot=True)


@router.patch("/{notebook_id}")
def update_notebook(
    notebook_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    nb = _load_nb(db, notebook_id)
    for field in ("title", "description", "route_id", "stage_id", "linked_notebook_id", "status"):
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
    nb = _get_or_404(db, notebook_id)
    return {"template_snapshot": nb.template_snapshot, "template_id": str(nb.template_id) if nb.template_id else None}


# ── Assigned users (chemists) ─────────────────────────────────────────────────

@router.get("/{notebook_id}/assigned-users")
def get_assigned_users(
    notebook_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, notebook_id)
    perms = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.can_edit == True,
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
    current_user: Any = Depends(get_current_user),
):
    _get_or_404(db, notebook_id)
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(422, "user_id is required")

    existing = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id == user_id,
    ).first()

    if existing:
        existing.can_edit   = True
        existing.can_view   = True
        existing.can_submit = True
    else:
        db.add(NotebookPermission(
            id=_uuid(), notebook_id=notebook_id, user_id=user_id,
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
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, notebook_id)
    perm = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id == user_id,
    ).first()
    if perm:
        db.delete(perm)
        db.commit()
    return {"ok": True}
