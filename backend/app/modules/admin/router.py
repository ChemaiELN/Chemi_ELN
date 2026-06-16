from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload  # noqa: F401 (selectinload used inside endpoint)

from app.database import get_db
from app.models.audit import AuditLog
from app.models.sequence import SequenceCounter
from app.models.settings import CompanySettings, CRDSettings, GlobalSettings, SMTPConfig
from app.models.user import User
from app.schemas.admin import (
    AuditLogResponse,
    CRDSettingsResponse,
    CRDSettingsUpdate,
    CompanySettingsResponse,
    CompanySettingsUpdate,
    GlobalSettingsResponse,
    GlobalSettingsUpdate,
    SMTPConfigResponse,
    SMTPConfigUpdate,
    SequenceCounterResponse,
)
from app.schemas.common import PaginatedResponse, paginate
from app.schemas.user import UserResponse
from app.utils.deps import get_current_user, require_roles
from app.utils.privileges import require_privilege, ADMIN_SETTINGS, USERS_MANAGE

router = APIRouter()


def _get_or_create_company(db: Session) -> CompanySettings:
    row = db.get(CompanySettings, 1)
    if not row:
        row = CompanySettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_crd(db: Session) -> CRDSettings:
    row = db.get(CRDSettings, 1)
    if not row:
        row = CRDSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_global(db: Session) -> GlobalSettings:
    row = db.get(GlobalSettings, 1)
    if not row:
        row = GlobalSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_smtp(db: Session) -> SMTPConfig:
    row = db.get(SMTPConfig, 1)
    if not row:
        row = SMTPConfig(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ── Company Settings ──────────────────────────────────────────────────────────

@router.get("/settings/company", response_model=CompanySettingsResponse)
def get_company_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    return _get_or_create_company(db)


@router.patch("/settings/company", response_model=CompanySettingsResponse)
def update_company_settings(
    body: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    row = _get_or_create_company(db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(row, field, val)
    db.commit()
    db.refresh(row)
    return row


# ── CRD Settings ──────────────────────────────────────────────────────────────

@router.get("/settings/crd", response_model=CRDSettingsResponse)
def get_crd_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    return _get_or_create_crd(db)


@router.patch("/settings/crd", response_model=CRDSettingsResponse)
def update_crd_settings(
    body: CRDSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    row = _get_or_create_crd(db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(row, field, val)
    db.commit()
    db.refresh(row)
    return row


# ── Global Settings ───────────────────────────────────────────────────────────

@router.get("/settings/global", response_model=GlobalSettingsResponse)
def get_global_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    return _get_or_create_global(db)


@router.patch("/settings/global", response_model=GlobalSettingsResponse)
def update_global_settings(
    body: GlobalSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    row = _get_or_create_global(db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(row, field, val)
    db.commit()
    db.refresh(row)
    return row


# ── SMTP Config ───────────────────────────────────────────────────────────────

@router.get("/settings/smtp", response_model=SMTPConfigResponse)
def get_smtp_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    return _get_or_create_smtp(db)


@router.patch("/settings/smtp", response_model=SMTPConfigResponse)
def update_smtp_settings(
    body: SMTPConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    row = _get_or_create_smtp(db)
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        row.password_encrypted = data.pop("password")
    for field, val in data.items():
        setattr(row, field, val)
    db.commit()
    db.refresh(row)
    return row


# ── Sequence Counters ─────────────────────────────────────────────────────────

@router.get("/sequences", response_model=List[SequenceCounterResponse])
def list_sequences(
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    return db.query(SequenceCounter).order_by(SequenceCounter.scope_key).all()


@router.get("/sequences/{scope_key:path}", response_model=SequenceCounterResponse)
def get_sequence(
    scope_key: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_privilege(ADMIN_SETTINGS)),
):
    from fastapi import HTTPException
    row = db.query(SequenceCounter).filter(SequenceCounter.scope_key == scope_key).first()
    if not row:
        raise HTTPException(404, f"Sequence '{scope_key}' not found")
    return row


# ── Privilege Keys catalogue ─────────────────────────────────────────────────

class _PrivilegeInfo(BaseModel):
    key:           str
    label:         str
    description:   str
    default_roles: List[str]

class _PrivilegeGroup(BaseModel):
    module:     str
    privileges: List[_PrivilegeInfo]


@router.get("/privilege-keys", response_model=List[_PrivilegeGroup])
def list_privilege_keys(
    _: User = Depends(get_current_user),
):
    """Return all privileges grouped by module with labels, descriptions, and default roles.
    Use this to know what each key does before assigning it to a role.
    """
    from app.utils.privileges import PRIVILEGE_CATALOG, DEFAULT_GRANTS
    groups = []
    for group in PRIVILEGE_CATALOG:
        privs = []
        for p in group["privileges"]:
            defaults = sorted(DEFAULT_GRANTS.get(p["key"], set()))
            privs.append(_PrivilegeInfo(
                key=p["key"],
                label=p["label"],
                description=p["description"],
                default_roles=defaults,
            ))
        groups.append(_PrivilegeGroup(module=group["module"], privileges=privs))
    return groups


# ── Users (admin view) ────────────────────────────────────────────────────────

@router.get("/users", response_model=PaginatedResponse[UserResponse])
def admin_list_users(
    page:          int           = Query(1, ge=1),
    page_size:     int           = Query(20, ge=1, le=100),
    search:        Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    role_code:     Optional[str] = Query(None),
    is_active:     Optional[bool]= Query(None),
    db:            Session       = Depends(get_db),
    _:             User          = Depends(require_privilege(USERS_MANAGE)),
):
    """Admin user management — full user list with filters (requires USERS_MANAGE privilege)."""
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
    if role_code:
        from app.models.user import Role
        role = db.query(Role).filter(Role.code == role_code.upper()).first()
        if role:
            q = q.filter(User.role_id == role.id)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)

    total = q.with_entities(func.count(User.id)).scalar() or 0
    items = q.order_by(User.display_name).offset((page - 1) * page_size).limit(page_size).all()

    from app.modules.users.router import _build_response as _user_resp
    return PaginatedResponse[UserResponse](
        items=[_user_resp(u) for u in items],
        **paginate(total, page, page_size),
    )


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_log(
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    username: Optional[str] = Query(None),   # ilike search on stored username snapshot
    target_type: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),  # YYYY-MM-DD
    date_to: Optional[str] = Query(None),    # YYYY-MM-DD
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # any authenticated user
):
    from sqlalchemy import or_ as _or
    roles = {current_user.role.code}
    q = db.query(AuditLog)

    # Non-QA/TL users only see their own actions
    if "QA" not in roles and "TL" not in roles:
        q = q.filter(AuditLog.user_id == current_user.id)

    if module:
        q = q.filter(AuditLog.module.ilike(f"%{module}%"))
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if username:
        # search across username snapshot AND target label
        q = q.filter(_or(
            AuditLog.username.ilike(f"%{username}%"),
            AuditLog.target_label.ilike(f"%{username}%"),
            AuditLog.detail.ilike(f"%{username}%"),
        ))
    if target_type:
        q = q.filter(AuditLog.target_type == target_type)
    if target_id:
        q = q.filter(AuditLog.target_id == target_id)
    if date_from:
        try:
            from datetime import date as _date
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(f"{date_to}T23:59:59"))
        except ValueError:
            pass

    total = q.count()
    pg = paginate(total, page, page_size)
    items = (
        q.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedResponse(items=items, **pg)
