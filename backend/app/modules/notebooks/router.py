"""
Notebooks router.

Endpoints:
    POST   /api/notebooks/                              Create notebook (HOD / TL)
    GET    /api/notebooks/                              List notebooks (filtered by access)
    GET    /api/notebooks/{notebook_id}                 Get single notebook
    PATCH  /api/notebooks/{notebook_id}                 Update notebook (HOD / TL)

    POST   /api/notebooks/{notebook_id}/permissions     Grant user access
    GET    /api/notebooks/{notebook_id}/permissions     List all permissions
    PATCH  /api/notebooks/{notebook_id}/permissions/{user_id}   Update flags
    DELETE /api/notebooks/{notebook_id}/permissions/{user_id}   Revoke access
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.notebook import Notebook, NotebookPermission
from app.models.project import Project
from app.models.route import Route, Stage
from app.models.user import User
from app.models.workflow_template import WorkflowTemplate
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.notebook import (
    NotebookCreate, NotebookResponse, NotebookUpdate,
    PermissionGrant, PermissionResponse, PermissionUpdate,
)
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.privileges import (
    require_privilege,
    NOTEBOOKS_CREATE, NOTEBOOKS_EDIT, NOTEBOOKS_PERMISSIONS,
)
from app.utils.sequences import next_notebook_code

router = APIRouter()

_nb_create = require_privilege(NOTEBOOKS_CREATE)
_nb_edit   = require_privilege(NOTEBOOKS_EDIT)
_nb_perms  = require_privilege(NOTEBOOKS_PERMISSIONS)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _role_code(user: Optional[User]) -> Optional[str]:
    if not user or not user.role:
        return None
    return user.role.code


def _load_notebook(db: Session, notebook_id: str) -> Notebook:
    nb = (
        db.query(Notebook)
        .options(
            selectinload(Notebook.creator).selectinload(User.role),
            selectinload(Notebook.template),
        )
        .filter(Notebook.id == notebook_id)
        .first()
    )
    if not nb:
        raise HTTPException(404, "Notebook not found")
    return nb


def _build_response(nb: Notebook) -> NotebookResponse:
    from app.schemas.notebook import UserShort
    creator = None
    if nb.creator:
        creator = UserShort(
            id=nb.creator.id,
            emp_no=nb.creator.emp_no,
            display_name=nb.creator.display_name,
            role=_role_code(nb.creator),
        )
    return NotebookResponse(
        id=nb.id, code=nb.code, title=nb.title,
        description=nb.description,
        project_id=nb.project_id, route_id=nb.route_id, stage_id=nb.stage_id,
        notebook_type=nb.type,
        template_id=nb.template_id,
        template_name=nb.template.name if nb.template else None,
        template_slug=nb.template.slug if nb.template else None,
        template_snapshot=nb.template_snapshot,
        created_by=nb.created_by, creator=creator,
        status=nb.status, created_at=nb.created_at, updated_at=nb.updated_at,
    )


def _perm_response(p: NotebookPermission) -> PermissionResponse:
    from app.schemas.notebook import UserShort
    user = None
    if p.user:
        user = UserShort(
            id=p.user.id,
            emp_no=p.user.emp_no,
            display_name=p.user.display_name,
            role=_role_code(p.user),
        )
    return PermissionResponse(
        id=p.id, notebook_id=p.notebook_id, user_id=p.user_id, user=user,
        can_view=p.can_view, can_edit=p.can_edit, can_submit=p.can_submit,
        can_verify=p.can_verify, can_approve=p.can_approve, can_clone=p.can_clone,
        can_export=p.can_export, can_attach=p.can_attach, can_comment=p.can_comment,
        can_request_unlock=p.can_request_unlock, can_deactivate=p.can_deactivate,
        granted_by=p.granted_by, granted_at=p.granted_at,
    )


# ── POST /  — Create notebook ─────────────────────────────────────────────────

@router.post(
    "/",
    response_model=NotebookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a notebook (QA / HOD / TL)",
)
def create_notebook(
    body:    NotebookCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_nb_create),
):
    # Validate project exists
    project = db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Validate route/stage if provided
    route_code = stage_code = None
    if body.route_id:
        route = db.get(Route, body.route_id)
        if not route:
            raise HTTPException(404, "Route not found")
        route_code = route.code
    if body.stage_id:
        stage = db.get(Stage, body.stage_id)
        if not stage:
            raise HTTPException(404, "Stage not found")
        stage_code = stage.code

    # Validate workflow template if provided
    template_snapshot = None
    if body.template_id:
        tmpl = db.get(WorkflowTemplate, body.template_id)
        if not tmpl:
            raise HTTPException(404, "Workflow template not found")
        if not tmpl.is_active:
            raise HTTPException(400, "Workflow template is inactive")
        template_snapshot = tmpl.definition

    # Generate unique notebook code e.g. OQ-R1-S1-NB001
    code = next_notebook_code(db, project.code, route_code, stage_code)

    nb = Notebook(
        code              = code,
        title             = body.title,
        description       = body.description,
        project_id        = body.project_id,
        route_id          = body.route_id,
        stage_id          = body.stage_id,
        type              = body.notebook_type,
        template_id       = body.template_id,
        template_snapshot = template_snapshot,
        created_by        = actor.id,
        status            = "ACTIVE",
    )
    db.add(nb)
    db.flush()

    # Auto-grant creator full access
    db.add(NotebookPermission(
        notebook_id        = nb.id,
        user_id            = actor.id,
        can_view           = True,
        can_edit           = True,
        can_submit         = True,
        can_verify         = True,
        can_approve        = True,
        can_clone          = True,
        can_export         = True,
        can_attach         = True,
        can_comment        = True,
        can_request_unlock = True,
        can_deactivate     = True,
        granted_by         = actor.id,
    ))

    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "Notebooks",
        action       = "CREATED",
        target_type  = "notebook",
        target_id    = nb.id,
        target_label = code,
        detail       = f"Created notebook '{body.title}'",
        ip_address   = get_ip(request),
    )
    db.commit()
    return _build_response(_load_notebook(db, nb.id))


# ── GET /  — List notebooks ───────────────────────────────────────────────────

@router.get(
    "/",
    response_model=PaginatedResponse[NotebookResponse],
    summary="List notebooks (only those the current user has view access to)",
)
def list_notebooks(
    page:       int            = Query(1, ge=1),
    page_size:  int            = Query(20, ge=1, le=100),
    search:     Optional[str]  = Query(None),
    project_id: Optional[str]  = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db:         Session        = Depends(get_db),
    actor:      User           = Depends(get_current_user),
):
    actor_roles = {actor.role.code}

    q = db.query(Notebook).options(selectinload(Notebook.creator).selectinload(User.role))

    # QA and HOD see all notebooks; others only see ones they have permission on
    if "QA" not in actor_roles and "HOD" not in actor_roles:
        q = q.join(
            NotebookPermission,
            (NotebookPermission.notebook_id == Notebook.id) &
            (NotebookPermission.user_id == actor.id) &
            (NotebookPermission.can_view == True),
        )

    if search:
        term = f"%{search}%"
        q = q.filter(or_(Notebook.title.ilike(term), Notebook.code.ilike(term)))
    if project_id:
        q = q.filter(Notebook.project_id == project_id)
    if status_filter:
        q = q.filter(Notebook.status == status_filter.upper())

    total = q.with_entities(func.count(Notebook.id)).scalar() or 0
    items = (
        q.order_by(Notebook.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedResponse[NotebookResponse](
        items=[_build_response(nb) for nb in items],
        **paginate(total, page, page_size),
    )


# ── GET /{notebook_id} ────────────────────────────────────────────────────────

@router.get(
    "/{notebook_id}",
    response_model=NotebookResponse,
    summary="Get a single notebook",
)
def get_notebook(
    notebook_id: str,
    db:   Session = Depends(get_db),
    actor: User   = Depends(get_current_user),
):
    nb = _load_notebook(db, notebook_id)
    _assert_can_view(db, notebook_id, actor)
    return _build_response(nb)


@router.get(
    "/{notebook_id}/overview",
    response_model=NotebookResponse,
    summary="Get notebook overview (alias for GET /{notebook_id})",
)
def get_notebook_overview(
    notebook_id: str,
    db:   Session = Depends(get_db),
    actor: User   = Depends(get_current_user),
):
    nb = _load_notebook(db, notebook_id)
    _assert_can_view(db, notebook_id, actor)
    return _build_response(nb)


# ── PATCH /{notebook_id} ──────────────────────────────────────────────────────

@router.patch(
    "/{notebook_id}",
    response_model=NotebookResponse,
    summary="Update a notebook (QA / HOD / TL)",
)
def update_notebook(
    notebook_id: str,
    body:        NotebookUpdate,
    request:     Request,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(_nb_edit),
):
    nb = _load_notebook(db, notebook_id)

    valid_statuses = {"ACTIVE", "ARCHIVED", "LOCKED"}
    if body.status and body.status.upper() not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Use: {valid_statuses}")

    updates = body.model_dump(exclude_unset=True)

    # When template_id changes, validate and refresh the snapshot
    if "template_id" in updates and updates["template_id"] != nb.template_id:
        new_template_id = updates["template_id"]
        if new_template_id:
            tmpl = db.get(WorkflowTemplate, new_template_id)
            if not tmpl:
                raise HTTPException(404, "Workflow template not found")
            if not tmpl.is_active:
                raise HTTPException(400, "Workflow template is inactive")
            nb.template_snapshot = tmpl.definition
        else:
            nb.template_snapshot = None

    changed = []
    for field, value in updates.items():
        if field == "status":
            value = value.upper()
        if getattr(nb, field) != value:
            changed.append(field)
        setattr(nb, field, value)

    if changed:
        log_action(
            db,
            user_id      = actor.id,
            username     = actor.username,
            module       = "Notebooks",
            action       = "UPDATED",
            target_type  = "notebook",
            target_id    = notebook_id,
            target_label = nb.code,
            detail       = f"Updated: {', '.join(changed)}",
            ip_address   = get_ip(request),
        )
        db.commit()
    return _build_response(_load_notebook(db, notebook_id))


# ── Permissions ───────────────────────────────────────────────────────────────

def _assert_can_view(db: Session, notebook_id: str, actor: User) -> None:
    """Raise 403 if actor has no view permission on this notebook."""
    roles = {actor.role.code}
    if "QA" in roles or "HOD" in roles:
        return  # QA and HOD always have access
    perm = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id     == actor.id,
        NotebookPermission.can_view    == True,
    ).first()
    if not perm:
        raise HTTPException(403, "You do not have access to this notebook")


@router.post(
    "/{notebook_id}/permissions",
    response_model=PermissionResponse,
    status_code=201,
    summary="Grant a user access to a notebook (QA / HOD / TL)",
)
def grant_permission(
    notebook_id: str,
    body:        PermissionGrant,
    request:     Request,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(_nb_perms),
):
    if not _load_notebook(db, notebook_id):
        raise HTTPException(404, "Notebook not found")

    # Verify user exists
    if not db.get(User, body.user_id):
        raise HTTPException(404, "User not found")

    existing = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id     == body.user_id,
    ).first()
    if existing:
        raise HTTPException(400, "User already has permissions on this notebook. Use PATCH to update.")

    perm = NotebookPermission(
        notebook_id        = notebook_id,
        user_id            = body.user_id,
        can_view           = body.can_view,
        can_edit           = body.can_edit,
        can_submit         = body.can_submit,
        can_verify         = body.can_verify,
        can_approve        = body.can_approve,
        can_clone          = body.can_clone,
        can_export         = body.can_export,
        can_attach         = body.can_attach,
        can_comment        = body.can_comment,
        can_request_unlock = body.can_request_unlock,
        can_deactivate     = body.can_deactivate,
        granted_by         = actor.id,
    )
    db.add(perm)

    nb = _load_notebook(db, notebook_id)
    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "Notebooks",
        action       = "PERMISSION_GRANTED",
        target_type  = "notebook",
        target_id    = notebook_id,
        target_label = nb.code,
        detail       = f"Granted access to user {body.user_id}",
        ip_address   = get_ip(request),
    )
    db.commit()
    db.refresh(perm)

    # Load user for response
    perm = (
        db.query(NotebookPermission)
        .options(selectinload(NotebookPermission.user).selectinload(User.role))
        .filter(NotebookPermission.id == perm.id)
        .first()
    )
    return _perm_response(perm)


@router.get(
    "/{notebook_id}/permissions",
    response_model=List[PermissionResponse],
    summary="List all user permissions for a notebook",
)
def list_permissions(
    notebook_id: str,
    db:    Session = Depends(get_db),
    actor: User    = Depends(_nb_perms),
):
    _load_notebook(db, notebook_id)
    perms = (
        db.query(NotebookPermission)
        .options(selectinload(NotebookPermission.user).selectinload(User.role))
        .filter(NotebookPermission.notebook_id == notebook_id)
        .all()
    )
    return [_perm_response(p) for p in perms]


@router.patch(
    "/{notebook_id}/permissions/{user_id}",
    response_model=PermissionResponse,
    summary="Update permission flags for a user on a notebook",
)
def update_permission(
    notebook_id: str,
    user_id:     str,
    body:        PermissionUpdate,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(_nb_perms),
):
    perm = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id     == user_id,
    ).first()
    if not perm:
        raise HTTPException(404, "Permission record not found for this user")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(perm, field, value)

    db.commit()
    perm = (
        db.query(NotebookPermission)
        .options(selectinload(NotebookPermission.user).selectinload(User.role))
        .filter(
            NotebookPermission.notebook_id == notebook_id,
            NotebookPermission.user_id     == user_id,
        )
        .first()
    )
    return _perm_response(perm)


@router.delete(
    "/{notebook_id}/permissions/{user_id}",
    response_model=MessageResponse,
    summary="Revoke a user's access to a notebook (QA / HOD / TL)",
)
def revoke_permission(
    notebook_id: str,
    user_id:     str,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(_nb_perms),
):
    perm = db.query(NotebookPermission).filter(
        NotebookPermission.notebook_id == notebook_id,
        NotebookPermission.user_id     == user_id,
    ).first()
    if not perm:
        raise HTTPException(404, "Permission record not found for this user")

    # Prevent revoking the creator's access
    nb = _load_notebook(db, notebook_id)
    if nb.created_by == user_id:
        raise HTTPException(400, "Cannot revoke the notebook creator's access")

    db.delete(perm)
    db.commit()
    return MessageResponse(message="Access revoked")
