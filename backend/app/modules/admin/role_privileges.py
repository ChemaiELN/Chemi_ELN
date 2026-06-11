from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.department import Department
from app.models.user import Role, RolePrivilege, User
from app.schemas.role_privilege import (
    RolePrivilegeCreate, RolePrivilegeResponse, RolePrivilegeUpdate, RoleShort,
)
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.privileges import require_privilege, ADMIN_ROLE_PRIVS

router = APIRouter()

_QA = require_privilege(ADMIN_ROLE_PRIVS)


# ── GET /roles/ — list all roles (utility for dropdowns) ─────────────────────

roles_router = APIRouter()

@roles_router.get("/", response_model=List[RoleShort])
def list_roles(
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    return db.query(Role).order_by(Role.code).all()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build(db: Session, rp: RolePrivilege) -> RolePrivilegeResponse:
    dept = db.get(Department, rp.department_id) if rp.department_id else None
    return RolePrivilegeResponse(
        id            = rp.id,
        role_id       = rp.role_id,
        role          = rp.role,
        department_id = rp.department_id,
        department    = dept,
        privilege_key = rp.privilege_key,
        is_granted    = rp.is_granted,
        updated_by    = rp.updated_by,
        updated_at    = rp.updated_at,
    )


# ── POST / — create ───────────────────────────────────────────────────────────

@router.post("/", response_model=RolePrivilegeResponse, status_code=201)
def create_privilege(
    body:    RolePrivilegeCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_QA),
):
    role = db.get(Role, body.role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    if body.department_id and not db.get(Department, body.department_id):
        raise HTTPException(404, "Department not found")

    exists = db.query(RolePrivilege).filter(
        RolePrivilege.role_id       == body.role_id,
        RolePrivilege.department_id == body.department_id,
        RolePrivilege.privilege_key == body.privilege_key,
    ).first()
    if exists:
        raise HTTPException(400, "Privilege already defined for this role/department/key combination")

    rp = RolePrivilege(
        role_id       = body.role_id,
        department_id = body.department_id,
        privilege_key = body.privilege_key,
        is_granted    = body.is_granted,
        updated_by    = actor.id,
        updated_at    = datetime.now(timezone.utc),
    )
    db.add(rp)
    db.flush()

    dept_label = f" (dept: {body.department_id})" if body.department_id else " (global)"
    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "RolePrivileges",
        action       = "CREATED",
        target_type  = "role_privilege",
        target_id    = rp.id,
        target_label = f"{role.code} — {body.privilege_key}{dept_label}",
        detail       = f"Granted={body.is_granted}: '{body.privilege_key}' to role {role.code}",
        ip_address   = get_ip(request),
    )
    db.commit()

    rp = db.query(RolePrivilege).options(selectinload(RolePrivilege.role)).filter(
        RolePrivilege.id == rp.id
    ).first()
    return _build(db, rp)


# ── GET / — list ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[RolePrivilegeResponse])
def list_privileges(
    role_id:       Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    privilege_key: Optional[str] = Query(None),
    db:            Session       = Depends(get_db),
    _:             User          = Depends(get_current_user),
):
    q = db.query(RolePrivilege).options(selectinload(RolePrivilege.role))
    if role_id:
        q = q.filter(RolePrivilege.role_id == role_id)
    if department_id:
        q = q.filter(RolePrivilege.department_id == department_id)
    if privilege_key:
        q = q.filter(RolePrivilege.privilege_key == privilege_key)
    items = q.order_by(RolePrivilege.privilege_key).all()
    return [_build(db, rp) for rp in items]


# ── GET /{id} — single ────────────────────────────────────────────────────────

@router.get("/{privilege_id}", response_model=RolePrivilegeResponse)
def get_privilege(
    privilege_id: str,
    db:           Session = Depends(get_db),
    _:            User    = Depends(get_current_user),
):
    rp = db.query(RolePrivilege).options(selectinload(RolePrivilege.role)).filter(
        RolePrivilege.id == privilege_id
    ).first()
    if not rp:
        raise HTTPException(404, "Role privilege not found")
    return _build(db, rp)


# ── PATCH /{id} — update is_granted ──────────────────────────────────────────

@router.patch("/{privilege_id}", response_model=RolePrivilegeResponse)
def update_privilege(
    privilege_id: str,
    body:         RolePrivilegeUpdate,
    request:      Request,
    db:           Session = Depends(get_db),
    actor:        User    = Depends(_QA),
):
    rp = db.query(RolePrivilege).options(selectinload(RolePrivilege.role)).filter(
        RolePrivilege.id == privilege_id
    ).first()
    if not rp:
        raise HTTPException(404, "Role privilege not found")

    old_val       = rp.is_granted
    rp.is_granted = body.is_granted
    rp.updated_by = actor.id
    rp.updated_at = datetime.now(timezone.utc)

    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "RolePrivileges",
        action       = "UPDATED",
        target_type  = "role_privilege",
        target_id    = privilege_id,
        target_label = f"{rp.role.code} — {rp.privilege_key}",
        detail       = f"is_granted changed: {old_val} → {body.is_granted}",
        ip_address   = get_ip(request),
    )
    db.commit()
    return _build(db, rp)


# ── DELETE /{id} ──────────────────────────────────────────────────────────────

@router.delete("/{privilege_id}", status_code=204)
def delete_privilege(
    privilege_id: str,
    request:      Request,
    db:           Session = Depends(get_db),
    actor:        User    = Depends(_QA),
):
    rp = db.query(RolePrivilege).options(selectinload(RolePrivilege.role)).filter(
        RolePrivilege.id == privilege_id
    ).first()
    if not rp:
        raise HTTPException(404, "Role privilege not found")

    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "RolePrivileges",
        action       = "DELETED",
        target_type  = "role_privilege",
        target_id    = privilege_id,
        target_label = f"{rp.role.code} — {rp.privilege_key}",
        detail       = f"Deleted privilege '{rp.privilege_key}' from role {rp.role.code}",
        ip_address   = get_ip(request),
    )
    db.delete(rp)
    db.commit()
