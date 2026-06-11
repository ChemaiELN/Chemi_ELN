"""
Projects router.

Endpoints:
    POST   /api/projects/                          Create project (QA / TL)
    GET    /api/projects/                          List projects (paginated + search)
    GET    /api/projects/{project_id}              Get single project
    PATCH  /api/projects/{project_id}              Update project (QA / TL)

    POST   /api/projects/{project_id}/members      Add team members
    DELETE /api/projects/{project_id}/members/{user_id}  Remove member
    GET    /api/projects/{project_id}/members      List team members

    POST   /api/projects/{project_id}/milestones   Create milestone
    GET    /api/projects/{project_id}/milestones   List milestones
    PATCH  /api/projects/{project_id}/milestones/{ms_id}   Update milestone
    DELETE /api/projects/{project_id}/milestones/{ms_id}   Delete milestone
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.base import new_uuid
from app.models.project import Milestone, Project, ProjectUser
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.project import (
    MilestoneCreate, MilestoneResponse, MilestoneUpdate,
    ProjectCreate, ProjectResponse, ProjectSummary, ProjectUpdate,
    ProjectUserAdd, ProjectUserResponse,
)
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles

router = APIRouter()

_QA_HOD = require_roles("QA", "TL")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_project(db: Session, project_id: str) -> Project:
    proj = (
        db.query(Project)
        .options(
            selectinload(Project.department),
            selectinload(Project.manager),
            selectinload(Project.creator),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj


def _project_response(p: Project) -> ProjectResponse:
    from app.schemas.project import DeptShort, UserShort

    dept = DeptShort(id=p.department.id, code=p.department.code, name=p.department.name) if p.department else None
    mgr  = UserShort(id=p.manager.id, emp_no=p.manager.emp_no, display_name=p.manager.display_name) if p.manager else None
    creator = UserShort(id=p.creator.id, emp_no=p.creator.emp_no, display_name=p.creator.display_name) if p.creator else None

    return ProjectResponse(
        id=p.id, code=p.code, name=p.name, product_name=p.product_name,
        project_type=p.project_type, market=p.market,
        department_id=p.department_id, department=dept,
        manager_id=p.manager_id, manager=mgr,
        created_by=p.created_by, creator=creator,
        start_date=p.start_date, target_date=p.target_date,
        status=p.status, description=p.description,
        created_at=p.created_at, updated_at=p.updated_at,
    )


# ── POST /  — Create project ──────────────────────────────────────────────────

@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project (QA / TL)",
)
def create_project(
    body:    ProjectCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_QA_HOD),
):
    if db.query(Project).filter(Project.code == body.code.upper()).first():
        raise HTTPException(400, f"Project code '{body.code}' already exists")

    proj = Project(
        code         = body.code.upper(),
        name         = body.name,
        product_name = body.product_name,
        project_type = body.project_type,
        market       = body.market,
        department_id= body.department_id,
        manager_id   = body.manager_id,
        created_by   = actor.id,
        start_date   = body.start_date,
        target_date  = body.target_date,
        status       = "ACTIVE",
        description  = body.description,
    )
    db.add(proj)
    db.flush()

    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "Projects",
        action       = "CREATED",
        target_type  = "project",
        target_id    = proj.id,
        target_label = proj.code,
        detail       = f"Created project '{proj.name}'",
        ip_address   = get_ip(request),
    )
    db.commit()
    return _project_response(_load_project(db, proj.id))


# ── GET /  — List projects ────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=PaginatedResponse[ProjectResponse],
    summary="List projects",
)
def list_projects(
    page:          int            = Query(1, ge=1),
    page_size:     int            = Query(20, ge=1, le=100),
    search:        Optional[str]  = Query(None),
    status_filter: Optional[str]  = Query(None, alias="status"),
    department_id: Optional[str]  = Query(None),
    db:            Session        = Depends(get_db),
    _:             User           = Depends(get_current_user),
):
    q = db.query(Project).options(
        selectinload(Project.department),
        selectinload(Project.manager),
        selectinload(Project.creator),
    )
    if search:
        term = f"%{search}%"
        q = q.filter(or_(Project.name.ilike(term), Project.code.ilike(term)))
    if status_filter:
        q = q.filter(Project.status == status_filter.upper())
    if department_id:
        q = q.filter(Project.department_id == department_id)

    total = q.with_entities(func.count(Project.id)).scalar() or 0
    items = q.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[ProjectResponse](
        items=[_project_response(p) for p in items],
        **paginate(total, page, page_size),
    )


# ── GET /{project_id} ─────────────────────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectResponse, summary="Get a project")
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    return _project_response(_load_project(db, project_id))


# ── PATCH /{project_id} ───────────────────────────────────────────────────────

@router.patch("/{project_id}", response_model=ProjectResponse, summary="Update a project (QA / TL)")
def update_project(
    project_id: str,
    body:       ProjectUpdate,
    request:    Request,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD),
):
    proj = _load_project(db, project_id)

    valid_statuses = {"ACTIVE", "ON HOLD", "COMPLETED", "CANCELLED"}
    if body.status and body.status.upper() not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Choose from: {valid_statuses}")

    changed = []
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "status" and value:
            value = value.upper()
        if getattr(proj, field) != value:
            changed.append(field)
        setattr(proj, field, value)

    if changed:
        log_action(
            db,
            user_id      = actor.id,
            username     = actor.username,
            module       = "Projects",
            action       = "UPDATED",
            target_type  = "project",
            target_id    = project_id,
            target_label = proj.code,
            detail       = f"Updated: {', '.join(changed)}",
            ip_address   = get_ip(request),
        )
        db.commit()
    return _project_response(_load_project(db, project_id))


# ── Team Members ──────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/members",
    response_model=MessageResponse,
    summary="Add team members to project (QA / TL)",
)
def add_members(
    project_id: str,
    body:       ProjectUserAdd,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    existing = {pu.user_id for pu in db.query(ProjectUser).filter(ProjectUser.project_id == project_id).all()}
    added = 0
    for uid in body.user_ids:
        if uid not in existing:
            db.add(ProjectUser(project_id=project_id, user_id=uid, added_by=actor.id))
            added += 1
    db.commit()
    return MessageResponse(message=f"Added {added} member(s) to project")


@router.delete(
    "/{project_id}/members/{user_id}",
    response_model=MessageResponse,
    summary="Remove a team member (QA / TL)",
)
def remove_member(
    project_id: str,
    user_id:    str,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD),
):
    pu = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id    == user_id,
    ).first()
    if not pu:
        raise HTTPException(404, "Member not found in this project")
    db.delete(pu)
    db.commit()
    return MessageResponse(message="Member removed")


@router.get(
    "/{project_id}/members",
    response_model=List[ProjectUserResponse],
    summary="List project team members",
)
def list_members(
    project_id: str,
    db:         Session = Depends(get_db),
    _:          User    = Depends(get_current_user),
):
    rows = (
        db.query(ProjectUser)
        .options(selectinload(ProjectUser.user))
        .filter(ProjectUser.project_id == project_id)
        .all()
    )
    result = []
    for pu in rows:
        from app.schemas.project import UserShort
        u = UserShort(
            id=pu.user.id,
            emp_no=pu.user.emp_no,
            display_name=pu.user.display_name,
        ) if pu.user else None
        result.append(ProjectUserResponse(user_id=pu.user_id, user=u, added_at=pu.added_at))
    return result


# ── Milestones ────────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/milestones",
    response_model=MilestoneResponse,
    status_code=201,
    summary="Create a milestone",
)
def create_milestone(
    project_id: str,
    body:       MilestoneCreate,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")

    ms = Milestone(
        project_id = project_id,
        name       = body.name,
        due_date   = body.due_date,
        owner_id   = body.owner_id,
        status     = body.status,
        pct        = body.pct,
    )
    db.add(ms)
    db.commit()
    db.refresh(ms)
    return ms


@router.get(
    "/{project_id}/milestones",
    response_model=List[MilestoneResponse],
    summary="List milestones for a project",
)
def list_milestones(
    project_id: str,
    db:         Session = Depends(get_db),
    _:          User    = Depends(get_current_user),
):
    return (
        db.query(Milestone)
        .options(selectinload(Milestone.owner))
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.due_date)
        .all()
    )


@router.patch(
    "/{project_id}/milestones/{ms_id}",
    response_model=MilestoneResponse,
    summary="Update a milestone",
)
def update_milestone(
    project_id: str,
    ms_id:      str,
    body:       MilestoneUpdate,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD),
):
    ms = db.query(Milestone).filter(
        Milestone.id == ms_id, Milestone.project_id == project_id
    ).first()
    if not ms:
        raise HTTPException(404, "Milestone not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ms, field, value)

    db.commit()
    db.refresh(ms)
    return ms


@router.delete(
    "/{project_id}/milestones/{ms_id}",
    response_model=MessageResponse,
    summary="Delete a milestone",
)
def delete_milestone(
    project_id: str,
    ms_id:      str,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD),
):
    ms = db.query(Milestone).filter(
        Milestone.id == ms_id, Milestone.project_id == project_id
    ).first()
    if not ms:
        raise HTTPException(404, "Milestone not found")
    db.delete(ms)
    db.commit()
    return MessageResponse(message="Milestone deleted")
