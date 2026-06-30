from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.shared.privileges import require_privilege, PRIVILEGE_CATALOG
from app.models.admin import Role, RolePrivilege, User
from app.schemas.admin import PrivilegeBulkUpdate, RoleOut, RoleCreate, RoleUpdate

router = APIRouter()
roles_router = APIRouter()


# ── /api/roles ────────────────────────────────────────────────

def _role_out(role: Role, db: Session) -> dict:
    user_count = db.query(func.count(User.id)).filter_by(role_id=role.id, is_active=True).scalar() or 0
    return {
        "id": str(role.id),
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "is_active": role.is_active,
        "user_count": user_count,
    }


@roles_router.get("", tags=["roles"])
def list_roles(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Role)
    if not include_inactive:
        q = q.filter_by(is_active=True)
    roles = q.order_by(Role.code).all()
    return [_role_out(r, db) for r in roles]


@roles_router.post("", tags=["roles"], response_model=RoleOut)
def create_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    _: User = require_privilege("admin.role_privileges"),
):
    code = body.code.upper().strip()
    if db.query(Role).filter_by(code=code).first():
        raise HTTPException(status_code=409, detail=f"Role code '{code}' already exists.")
    role = Role(code=code, name=body.name.strip(), description=body.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_out(role, db)


@roles_router.patch("/{role_id}", tags=["roles"], response_model=RoleOut)
def update_role(
    role_id: UUID,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    _: User = require_privilege("admin.role_privileges"),
):
    role = db.query(Role).filter_by(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    if body.name is not None:
        role.name = body.name.strip()
    if body.description is not None:
        role.description = body.description
    if body.is_active is not None:
        role.is_active = body.is_active
    db.commit()
    db.refresh(role)
    return _role_out(role, db)


@roles_router.delete("/{role_id}", tags=["roles"], status_code=204)
def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("admin.role_privileges"),
):
    role = db.query(Role).filter_by(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    active_users = db.query(func.count(User.id)).filter_by(role_id=role_id, is_active=True).scalar() or 0
    if active_users > 0:
        raise HTTPException(status_code=409, detail=f"Cannot delete: {active_users} active user(s) assigned to this role.")
    role.is_active = False
    db.commit()


# ── /api/role-privileges ──────────────────────────────────────

@router.get("")
def get_privilege_matrix(
    db: Session = Depends(get_db),
    _: User = require_privilege("admin.role_privileges"),
):
    roles = db.query(Role).filter_by(is_active=True).order_by(Role.code).all()
    grant_rows = (
        db.query(RolePrivilege)
        .filter(RolePrivilege.department_id.is_(None))
        .all()
    )

    # Build map: role_id → {privilege_key: is_granted}
    grants: dict[str, dict[str, bool]] = {
        str(r.id): {key: False for key in PRIVILEGE_CATALOG}
        for r in roles
    }
    for row in grant_rows:
        rid = str(row.role_id)
        if rid in grants and row.privilege_key in grants[rid]:
            grants[rid][row.privilege_key] = row.is_granted

    return {
        "roles": [{"id": str(r.id), "code": r.code, "name": r.name} for r in roles],
        "privileges": PRIVILEGE_CATALOG,
        "grants": grants,
    }


@router.put("", status_code=200)
def save_privilege_matrix(
    payload: PrivilegeBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("admin.role_privileges"),
):
    for row in payload.rows:
        existing = (
            db.query(RolePrivilege)
            .filter_by(role_id=row.role_id, privilege_key=row.privilege_key, department_id=None)
            .first()
        )
        if existing:
            existing.is_granted = row.is_granted
            existing.updated_by = current_user.id
        else:
            db.add(RolePrivilege(
                role_id=row.role_id,
                privilege_key=row.privilege_key,
                is_granted=row.is_granted,
                updated_by=current_user.id,
            ))
    db.commit()
    return {"message": "Privileges saved."}
