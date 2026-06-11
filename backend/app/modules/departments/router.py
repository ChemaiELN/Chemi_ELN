"""
Departments router.

Endpoints:
    POST   /api/departments/           Create department (QA only)
    GET    /api/departments/           List departments
    GET    /api/departments/{dept_id}  Get single department
    PATCH  /api/departments/{dept_id}  Update department (QA only)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.department import (
    DepartmentCreate, DepartmentResponse, DepartmentUpdate,
)
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles

router = APIRouter()


# ── POST /  — Create ─────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department (QA only)",
)
def create_department(
    body:    DepartmentCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(require_roles("QA")),
):
    if db.query(Department).filter(Department.code == body.code.upper()).first():
        raise HTTPException(400, f"Department code '{body.code}' already exists")

    dept = Department(
        code        = body.code.upper(),
        name        = body.name,
        description = body.description,
        is_active   = True,
        created_by  = actor.id,
    )
    db.add(dept)
    db.flush()

    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "Departments",
        action       = "CREATED",
        target_type  = "department",
        target_id    = dept.id,
        target_label = dept.code,
        detail       = f"Created department '{dept.name}'",
        ip_address   = get_ip(request),
    )
    db.commit()
    db.refresh(dept)
    return dept


# ── GET /  — List ─────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=PaginatedResponse[DepartmentResponse],
    summary="List departments",
)
def list_departments(
    page:      int            = Query(1, ge=1),
    page_size: int            = Query(50, ge=1, le=200),
    search:    Optional[str]  = Query(None),
    is_active: Optional[bool] = Query(None),
    db:        Session        = Depends(get_db),
    _:         User           = Depends(get_current_user),
):
    q = db.query(Department)

    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(Department.name.ilike(term), Department.code.ilike(term))
        )
    if is_active is not None:
        q = q.filter(Department.is_active == is_active)

    total = q.with_entities(func.count(Department.id)).scalar() or 0
    items = (
        q.order_by(Department.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedResponse[DepartmentResponse](
        items=items,
        **paginate(total, page, page_size),
    )


# ── GET /{dept_id}  — Single ──────────────────────────────────────────────────

@router.get(
    "/{dept_id}",
    response_model=DepartmentResponse,
    summary="Get a single department",
)
def get_department(
    dept_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(get_current_user),
):
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found")
    return dept


# ── PATCH /{dept_id}  — Update ────────────────────────────────────────────────

@router.patch(
    "/{dept_id}",
    response_model=DepartmentResponse,
    summary="Update a department (QA only)",
)
def update_department(
    dept_id: str,
    body:    DepartmentUpdate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(require_roles("QA")),
):
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found")

    changed = []
    for field, value in body.model_dump(exclude_none=True).items():
        if getattr(dept, field) != value:
            changed.append(field)
        setattr(dept, field, value)

    if changed:
        log_action(
            db,
            user_id      = actor.id,
            username     = actor.username,
            module       = "Departments",
            action       = "UPDATED",
            target_type  = "department",
            target_id    = dept_id,
            target_label = dept.code,
            detail       = f"Updated fields: {', '.join(changed)}",
            ip_address   = get_ip(request),
        )
        db.commit()
        db.refresh(dept)
    return dept
