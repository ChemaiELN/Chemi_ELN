from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.shared.privileges import require_privilege
from app.models.admin import Department, User
from app.schemas.admin import DepartmentCreate, DepartmentUpdate, DepartmentOut

router = APIRouter()


def _out(d: Department, db: Session) -> dict:
    user_count = db.query(User).filter_by(department_id=d.id, is_active=True).count()
    return {
        "id": d.id,
        "code": d.code,
        "name": d.name,
        "description": d.description,
        "is_active": d.is_active,
        "user_count": user_count,
        "created_at": d.created_at,
    }


@router.get("", response_model=List[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    _: User = require_privilege("departments.manage"),
):
    depts = db.query(Department).order_by(Department.name).all()
    return [DepartmentOut(**_out(d, db)) for d in depts]


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("departments.manage"),
):
    if db.query(Department).filter_by(code=payload.code.upper()).first():
        raise HTTPException(400, f"Department code '{payload.code}' already exists.")
    dept = Department(
        code=payload.code.upper(),
        name=payload.name,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return DepartmentOut(**_out(dept, db))


@router.get("/{dept_id}", response_model=DepartmentOut)
def get_department(
    dept_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("departments.manage"),
):
    dept = db.query(Department).filter_by(id=dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found.")
    return DepartmentOut(**_out(dept, db))


@router.patch("/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: UUID,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = require_privilege("departments.manage"),
):
    dept = db.query(Department).filter_by(id=dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(dept, k, v)
    db.commit()
    return DepartmentOut(**_out(dept, db))


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_department(
    dept_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("departments.manage"),
):
    dept = db.query(Department).filter_by(id=dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found.")
    active_users = db.query(User).filter_by(department_id=dept_id, is_active=True).count()
    if active_users > 0:
        raise HTTPException(400, f"Cannot deactivate — {active_users} active user(s) assigned.")
    dept.is_active = False
    db.commit()
