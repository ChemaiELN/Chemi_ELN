from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.dependencies import get_db, get_current_user
from app.shared.privileges import require_privilege
from app.auth.utils import hash_password
from app.models.admin import User, Role
from app.schemas.admin import UserCreate, UserUpdate, UserPasswordReset, UserOut
from app.schemas.common import PaginatedResponse

router = APIRouter()


def _out(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "emp_no": u.emp_no,
        "email": u.email,
        "role_id": u.role_id,
        "role_code": u.role.code,
        "role_name": u.role.name,
        "department_id": u.department_id,
        "department_name": u.department.name if u.department else None,
        "is_active": u.is_active,
        "must_reset_password": u.must_reset_password,
        "site": u.site,
        "created_at": u.created_at,
    }


def _base_query(db: Session):
    return db.query(User).options(joinedload(User.role), joinedload(User.department))


@router.get("", response_model=PaginatedResponse[UserOut])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role_id: Optional[UUID] = None,
    dept_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = require_privilege("users.manage"),
):
    q = _base_query(db)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (User.username.ilike(like)) | (User.email.ilike(like)) | (User.emp_no.ilike(like))
        )
    if role_id:
        q = q.filter(User.role_id == role_id)
    if dept_id:
        q = q.filter(User.department_id == dept_id)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)

    total = q.count()
    users = q.order_by(User.emp_no).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse[UserOut](
        items=[UserOut(**_out(u)) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = require_privilege("users.manage"),
):
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(400, f"Username '{payload.username}' already exists.")
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(400, f"Email '{payload.email}' already exists.")
    if not db.query(Role).filter_by(id=payload.role_id, is_active=True).first():
        raise HTTPException(400, "Invalid or inactive role.")

    # Auto-generate emp_no if not provided
    emp_no = payload.emp_no
    if not emp_no:
        last = db.query(User.emp_no).filter(User.emp_no.like("EMP%")).order_by(User.emp_no.desc()).first()
        if last and last[0]:
            try:
                next_n = int(last[0][3:]) + 1
            except ValueError:
                next_n = 1
        else:
            next_n = 1
        emp_no = f"EMP{next_n:04d}"
    elif db.query(User).filter_by(emp_no=emp_no).first():
        raise HTTPException(400, f"Employee number '{emp_no}' already exists.")

    user = User(
        username=payload.username,
        emp_no=emp_no,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
        department_id=payload.department_id,
        site=payload.site,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(**_out(_base_query(db).filter_by(id=user.id).first()))


@router.get("/lookup")
def lookup_users(
    search: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lightweight user search for pickers — requires authentication only."""
    q = _base_query(db).filter(User.is_active == True)
    if search:
        like = f"%{search}%"
        q = q.filter(
            User.username.ilike(like) | User.emp_no.ilike(like)
        )
    users = q.order_by(User.username).limit(limit).all()
    return {
        "total": len(users),
        "items": [{"id": str(u.id), "username": u.username, "emp_no": u.emp_no, "role_name": u.role.name} for u in users],
    }


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("users.manage"),
):
    user = _base_query(db).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    return UserOut(**_out(user))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("users.manage"),
):
    user = _base_query(db).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")

    updates = payload.model_dump(exclude_unset=True)
    if "username" in updates and updates["username"] != user.username:
        if db.query(User).filter(User.username == updates["username"], User.id != user_id).first():
            raise HTTPException(400, f"Username '{updates['username']}' already exists.")
    if "email" in updates and str(updates["email"]) != user.email:
        if db.query(User).filter(User.email == str(updates["email"]), User.id != user_id).first():
            raise HTTPException(400, f"Email '{updates['email']}' already exists.")
    if "emp_no" in updates and updates["emp_no"] != user.emp_no:
        if db.query(User).filter(User.emp_no == updates["emp_no"], User.id != user_id).first():
            raise HTTPException(400, f"Employee number '{updates['emp_no']}' already exists.")
    if "role_id" in updates:
        if not db.query(Role).filter_by(id=updates["role_id"], is_active=True).first():
            raise HTTPException(400, "Invalid or inactive role.")

    for k, v in updates.items():
        setattr(user, k, str(v) if k == "email" else v)

    db.commit()
    return UserOut(**_out(_base_query(db).filter_by(id=user_id).first()))


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    user_id: UUID,
    payload: UserPasswordReset,
    db: Session = Depends(get_db),
    _: User = require_privilege("users.manage"),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    user.password_hash = hash_password(payload.new_password)
    user.must_reset_password = False
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("users.manage"),
):
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot deactivate your own account.")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    user.is_active = False
    db.commit()
