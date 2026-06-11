from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.database import get_db
from app.models.base import new_uuid
from app.models.user import Role, User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.user import DepartmentShort, UserCreate, UserResponse, UserSummary, UserUpdate
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles

router = APIRouter()


def _load_user(db: Session, user_id: str) -> User:
    user = (
        db.query(User)
        .options(selectinload(User.role), selectinload(User.department))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _resolve_role(db: Session, code: str) -> Role:
    role = db.query(Role).filter(Role.code == code.upper()).first()
    if not role:
        raise HTTPException(400, f"Invalid role: {code}")
    return role


def _build_response(user: User) -> UserResponse:
    dept = None
    if user.department:
        dept = DepartmentShort(
            id=user.department.id,
            code=user.department.code,
            name=user.department.name,
        )
    return UserResponse(
        id                    = user.id,
        username              = user.username,
        emp_no                = user.emp_no,
        title                 = user.title,
        first_name            = user.first_name,
        middle_initials       = user.middle_initials,
        last_name             = user.last_name,
        display_name          = user.display_name,
        email                 = user.email,
        role                  = user.role.code,
        designation           = user.designation,
        contact_no            = user.contact_no,
        department_id         = user.department_id,
        department            = dept,
        site                  = user.site,
        dashboard_reference   = user.dashboard_reference,
        allow_settings_update = user.allow_settings_update,
        must_reset_password   = user.must_reset_password,
        is_active             = user.is_active,
        last_login_at         = user.last_login_at,
        created_at            = user.created_at,
        updated_at            = user.updated_at,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body:    UserCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(require_roles("QA")),
):
    conflict = db.query(User).filter(
        or_(
            User.username == body.username,
            User.emp_no   == body.emp_no,
            User.email    == body.email,
        )
    ).first()
    if conflict:
        if conflict.username == body.username:
            raise HTTPException(400, "Username already taken")
        if conflict.emp_no == body.emp_no:
            raise HTTPException(400, "Employee number already registered")
        raise HTTPException(400, "Email already registered")

    parts = [p for p in [body.title, body.first_name, body.last_name] if p]
    user = User(
        id            = new_uuid(),
        username      = body.username,
        emp_no        = body.emp_no,
        title         = body.title,
        first_name    = body.first_name,
        last_name     = body.last_name,
        display_name  = " ".join(parts),
        email         = body.email,
        password_hash = hash_password(body.password),
        role_id       = _resolve_role(db, body.role).id,
        designation   = body.designation,
        department_id = body.department_id,
        is_active     = True,
    )
    db.add(user)
    db.flush()
    log_action(
        db,
        user_id=actor.id, username=actor.username,
        module="Users", action="CREATED",
        target_type="user", target_id=user.id, target_label=user.username,
        detail=f"Created user {user.emp_no} with role {body.role}",
        ip_address=get_ip(request),
    )
    db.commit()
    return _build_response(_load_user(db, user.id))


@router.get("/", response_model=PaginatedResponse[UserResponse])
def list_users(
    page:          int           = Query(1, ge=1),
    page_size:     int           = Query(20, ge=1, le=100),
    search:        Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    role_code:     Optional[str] = Query(None),
    is_active:     Optional[bool]= Query(None),
    db:            Session       = Depends(get_db),
    _:             User          = Depends(get_current_user),
):
    q = db.query(User).options(selectinload(User.role), selectinload(User.department))

    if search:
        term = f"%{search}%"
        q = q.filter(or_(
            User.display_name.ilike(term),
            User.username.ilike(term),
            User.emp_no.ilike(term),
            User.email.ilike(term),
        ))
    if department_id:
        q = q.filter(User.department_id == department_id)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if role_code:
        role_obj = db.query(Role).filter(Role.code == role_code.upper()).first()
        if role_obj:
            q = q.filter(User.role_id == role_obj.id)

    total = q.with_entities(func.count(User.id)).scalar() or 0
    users = q.order_by(User.display_name).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[UserResponse](
        items=[_build_response(u) for u in users],
        **paginate(total, page, page_size),
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(get_current_user),
):
    return _build_response(_load_user(db, user_id))


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body:    UserUpdate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(get_current_user),
):
    if actor.id != user_id and actor.role.code != "QA":
        raise HTTPException(403, "Only QA can update other users")

    user = _load_user(db, user_id)

    if body.is_active is not None and actor.role.code != "QA":
        raise HTTPException(403, "Only QA can change active status")

    if body.role is not None and actor.role.code != "QA":
        raise HTTPException(403, "Only QA can change user roles")

    if body.email and body.email != user.email:
        if db.query(User).filter(User.email == body.email, User.id != user_id).first():
            raise HTTPException(400, "Email already registered to another user")

    changed: dict = {}
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "role":
            new_role = _resolve_role(db, value)
            if user.role_id != new_role.id:
                changed["role"] = {"from": user.role.code, "to": value}
                user.role_id = new_role.id
            continue
        old = getattr(user, field)
        if value != old:
            changed[field] = {"from": old, "to": value}
        setattr(user, field, value)

    parts = [p for p in [user.title, user.first_name, user.last_name] if p]
    user.display_name = " ".join(parts)

    if changed:
        log_action(
            db,
            user_id=actor.id, username=actor.username,
            module="Users", action="UPDATED",
            target_type="user", target_id=user.id, target_label=user.username,
            detail=f"Updated fields: {', '.join(changed.keys())}",
            ip_address=get_ip(request),
        )
    db.commit()
    return _build_response(_load_user(db, user_id))


@router.post("/{user_id}/activate", response_model=MessageResponse)
def activate_user(
    user_id: str,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(require_roles("QA")),
):
    user = _load_user(db, user_id)
    if user.is_active:
        raise HTTPException(400, "User is already active")
    user.is_active = True
    log_action(db, user_id=actor.id, username=actor.username,
               module="Users", action="ACTIVATED",
               target_type="user", target_id=user_id, target_label=user.username,
               ip_address=get_ip(request))
    db.commit()
    return MessageResponse(message=f"User '{user.username}' activated")


@router.post("/{user_id}/deactivate", response_model=MessageResponse)
def deactivate_user(
    user_id: str,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(require_roles("QA")),
):
    user = _load_user(db, user_id)
    if not user.is_active:
        raise HTTPException(400, "User is already inactive")
    if actor.id == user_id:
        raise HTTPException(400, "You cannot deactivate your own account")
    user.is_active = False
    log_action(db, user_id=actor.id, username=actor.username,
               module="Users", action="DEACTIVATED",
               target_type="user", target_id=user_id, target_label=user.username,
               ip_address=get_ip(request))
    db.commit()
    return MessageResponse(message=f"User '{user.username}' deactivated")
