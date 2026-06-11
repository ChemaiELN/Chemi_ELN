from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit import AuditLog
from app.models.sequence import SequenceCounter
from app.models.settings import CompanySettings, CRDSettings
from app.models.user import User
from app.schemas.admin import (
    AuditLogResponse,
    CRDSettingsResponse,
    CRDSettingsUpdate,
    CompanySettingsResponse,
    CompanySettingsUpdate,
    SequenceCounterResponse,
)
from app.schemas.common import PaginatedResponse, paginate
from app.utils.deps import get_current_user, require_roles

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


# ── Company Settings ──────────────────────────────────────────────────────────

@router.get("/settings/company", response_model=CompanySettingsResponse)
def get_company_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("QA")),
):
    return _get_or_create_company(db)


@router.patch("/settings/company", response_model=CompanySettingsResponse)
def update_company_settings(
    body: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("QA")),
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
    _: User = Depends(require_roles("QA")),
):
    return _get_or_create_crd(db)


@router.patch("/settings/crd", response_model=CRDSettingsResponse)
def update_crd_settings(
    body: CRDSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("QA")),
):
    row = _get_or_create_crd(db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(row, field, val)
    db.commit()
    db.refresh(row)
    return row


# ── Sequence Counters ─────────────────────────────────────────────────────────

@router.get("/sequences", response_model=List[SequenceCounterResponse])
def list_sequences(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("QA")),
):
    return db.query(SequenceCounter).order_by(SequenceCounter.scope_key).all()


@router.get("/sequences/{scope_key:path}", response_model=SequenceCounterResponse)
def get_sequence(
    scope_key: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("QA")),
):
    from fastapi import HTTPException
    row = db.query(SequenceCounter).filter(SequenceCounter.scope_key == scope_key).first()
    if not row:
        raise HTTPException(404, f"Sequence '{scope_key}' not found")
    return row


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
