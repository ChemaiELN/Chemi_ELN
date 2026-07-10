"""Inventory – Checklist template endpoints (Phase 2).

Checklist templates with a versioned, role-free maker-checker approval flow:
DRAFT -> PENDING_VERIFICATION -> PENDING_APPROVAL -> APPROVED.  Any authenticated
user may act on any transition; each transition records the acting user, comment
and timestamp.  Approval bumps the version (0.x -> 1.0).
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvChecklist, InvChecklistItem, InvChecklistApproval
from app.schemas.inventory import (
    ChecklistCreate,
    ChecklistDetailOut,
    ChecklistItemCreate,
    ChecklistItemOut,
    ChecklistItemUpdate,
    ChecklistOut,
    ChecklistUpdate,
    ChecklistWorkflowAction,
)
from app.shared.inv_audit import write_inv_audit

router = APIRouter(prefix="/inventory/checklists", tags=["inventory-checklists"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _bump_version(version: str) -> str:
    """0.x -> 1.0 on first approval; otherwise keep the existing published number."""
    try:
        major, _minor = version.split(".", 1)
        if major == "0":
            return "1.0"
    except ValueError:
        pass
    return version


def _next_version(version: str) -> str:
    """Compute the next draft version for a cloned copy: 1.0 -> 1.1."""
    try:
        major, minor = version.split(".", 1)
        return f"{major}.{int(minor) + 1}"
    except ValueError:
        return "0.1"


# ── Checklist header CRUD ─────────────────────────────────────────────────────
@router.get("", response_model=list[ChecklistOut])
def list_checklists(
    search: Optional[str] = Query(None),
    checklist_type: Optional[str] = Query(None),
    target_kind: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    active_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvChecklist)
    if active_only:
        q = q.filter(InvChecklist.is_active.is_(True))
    if checklist_type:
        q = q.filter(InvChecklist.checklist_type == checklist_type)
    if target_kind:
        q = q.filter(InvChecklist.target_kind == target_kind)
    if status:
        q = q.filter(InvChecklist.status == status)
    if search:
        q = q.filter(InvChecklist.name.ilike(f"%{search}%"))
    return q.order_by(InvChecklist.id.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=ChecklistDetailOut, status_code=201)
def create_checklist(
    body: ChecklistCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = InvChecklist(**body.model_dump(), version="0.1", status="DRAFT", created_by=_user_ref(current_user))
    db.add(row)
    db.flush()
    write_inv_audit(
        db,
        event_type="CHECKLIST_CREATED",
        entity_type="inv_checklist",
        entity_id=row.id,
        entity_ref=row.name,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/{checklist_id}", response_model=ChecklistDetailOut)
def get_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvChecklist, checklist_id)
    if not row:
        raise HTTPException(404, "Checklist not found.")
    return row


@router.patch("/{checklist_id}", response_model=ChecklistDetailOut)
def update_checklist(
    checklist_id: int,
    body: ChecklistUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvChecklist, checklist_id)
    if not row:
        raise HTTPException(404, "Checklist not found.")
    if row.status != "DRAFT":
        raise HTTPException(409, "Only DRAFT checklists can be edited.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{checklist_id}/toggle", response_model=ChecklistOut)
def toggle_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvChecklist, checklist_id)
    if not row:
        raise HTTPException(404, "Checklist not found.")
    row.is_active = not row.is_active
    db.commit()
    db.refresh(row)
    return row


# ── Checklist items ───────────────────────────────────────────────────────────
def _require_draft(db: Session, checklist_id: int) -> InvChecklist:
    cl = db.get(InvChecklist, checklist_id)
    if not cl:
        raise HTTPException(404, "Checklist not found.")
    if cl.status != "DRAFT":
        raise HTTPException(409, "Items can only be modified while the checklist is in DRAFT.")
    return cl


@router.post("/{checklist_id}/items", response_model=ChecklistItemOut, status_code=201)
def add_item(
    checklist_id: int,
    body: ChecklistItemCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _require_draft(db, checklist_id)
    data = body.model_dump()
    seq = data.pop("seq_no", None)
    if seq is None:
        max_seq = db.query(InvChecklistItem).filter_by(checklist_id=checklist_id).count()
        seq = max_seq + 1
    row = InvChecklistItem(checklist_id=checklist_id, seq_no=seq, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/items/{item_id}", response_model=ChecklistItemOut)
def update_item(
    item_id: int,
    body: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvChecklistItem, item_id)
    if not row:
        raise HTTPException(404, "Checklist item not found.")
    _require_draft(db, row.checklist_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvChecklistItem, item_id)
    if not row:
        raise HTTPException(404, "Checklist item not found.")
    _require_draft(db, row.checklist_id)
    db.delete(row)
    db.commit()


# ── Approval workflow (role-free) ─────────────────────────────────────────────
def _transition(db, cl, *, action, expected, to_state, user, comment, bump=False):
    if cl.status != expected:
        raise HTTPException(409, f"Checklist must be in {expected} to {action.lower()} (currently {cl.status}).")
    old = cl.status
    cl.status = to_state
    if bump:
        cl.version = _bump_version(cl.version)
    db.add(InvChecklistApproval(
        checklist_id=cl.id, action=action, from_state=old, to_state=to_state,
        performed_by=user, comment=comment,
    ))
    write_inv_audit(
        db,
        event_type=f"CHECKLIST_{action}",
        entity_type="inv_checklist",
        entity_id=cl.id,
        entity_ref=cl.name,
        performed_by=user,
        old_value=old,
        new_value=to_state,
        details=comment,
    )


@router.post("/{checklist_id}/submit", response_model=ChecklistDetailOut)
def submit_checklist(
    checklist_id: int,
    body: ChecklistWorkflowAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    cl = db.get(InvChecklist, checklist_id)
    if not cl:
        raise HTTPException(404, "Checklist not found.")
    if not cl.items:
        raise HTTPException(409, "Add at least one checklist item before submitting.")
    _transition(db, cl, action="SUBMIT", expected="DRAFT", to_state="PENDING_VERIFICATION",
                user=_user_ref(current_user), comment=body.comment)
    db.commit()
    db.refresh(cl)
    return cl


@router.post("/{checklist_id}/verify", response_model=ChecklistDetailOut)
def verify_checklist(
    checklist_id: int,
    body: ChecklistWorkflowAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    cl = db.get(InvChecklist, checklist_id)
    if not cl:
        raise HTTPException(404, "Checklist not found.")
    _transition(db, cl, action="VERIFY", expected="PENDING_VERIFICATION", to_state="PENDING_APPROVAL",
                user=_user_ref(current_user), comment=body.comment)
    db.commit()
    db.refresh(cl)
    return cl


@router.post("/{checklist_id}/approve", response_model=ChecklistDetailOut)
def approve_checklist(
    checklist_id: int,
    body: ChecklistWorkflowAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    cl = db.get(InvChecklist, checklist_id)
    if not cl:
        raise HTTPException(404, "Checklist not found.")
    _transition(db, cl, action="APPROVE", expected="PENDING_APPROVAL", to_state="APPROVED",
                user=_user_ref(current_user), comment=body.comment, bump=True)
    db.commit()
    db.refresh(cl)
    return cl


@router.post("/{checklist_id}/reinitiate", response_model=ChecklistDetailOut)
def reinitiate_checklist(
    checklist_id: int,
    body: ChecklistWorkflowAction,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    cl = db.get(InvChecklist, checklist_id)
    if not cl:
        raise HTTPException(404, "Checklist not found.")
    if cl.status not in ("PENDING_VERIFICATION", "PENDING_APPROVAL"):
        raise HTTPException(409, "Only checklists pending review can be re-initiated.")
    _transition(db, cl, action="REINITIATE", expected=cl.status, to_state="DRAFT",
                user=_user_ref(current_user), comment=body.comment)
    db.commit()
    db.refresh(cl)
    return cl


@router.post("/{checklist_id}/new-version", response_model=ChecklistDetailOut, status_code=201)
def create_new_version(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    src = db.get(InvChecklist, checklist_id)
    if not src:
        raise HTTPException(404, "Checklist not found.")
    if src.status != "APPROVED":
        raise HTTPException(409, "New versions can only be created from an APPROVED checklist.")
    clone = InvChecklist(
        name=src.name, checklist_type=src.checklist_type, log_type=src.log_type,
        usage_type=src.usage_type, target_kind=src.target_kind, equipment_code=src.equipment_code,
        version=_next_version(src.version), status="DRAFT", created_by=_user_ref(current_user),
    )
    db.add(clone)
    db.flush()
    for it in src.items:
        db.add(InvChecklistItem(
            checklist_id=clone.id, seq_no=it.seq_no, instruction_type=it.instruction_type,
            data_type=it.data_type, frequencies=it.frequencies, precision=it.precision,
            lower_limit=it.lower_limit, upper_limit=it.upper_limit, options=it.options,
            details=it.details,
        ))
    write_inv_audit(
        db,
        event_type="CHECKLIST_NEW_VERSION",
        entity_type="inv_checklist",
        entity_id=clone.id,
        entity_ref=clone.name,
        performed_by=_user_ref(current_user),
        details=f"cloned from #{src.id} v{src.version}",
    )
    db.commit()
    db.refresh(clone)
    return clone
