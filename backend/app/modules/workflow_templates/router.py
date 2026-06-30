"""Workflow Templates — CRUD + definition version snapshotting.

Admin-gated writes (admin.settings). Reads available to all authenticated users.
"""
from typing import Any, Optional
import uuid
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.shared.privileges import require_privilege
from app.models.workflow_template import WorkflowTemplate, WorkflowTemplateVersion

router = APIRouter(prefix="/workflow-templates", tags=["workflow-templates"])


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, template_id: str) -> WorkflowTemplate:
    t = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404, "Workflow template not found")
    return t


def _snapshot(db: Session, template: WorkflowTemplate, user_id: Any) -> None:
    ver = WorkflowTemplateVersion(
        id=_uuid(),
        template_id=template.id,
        version=template.version,
        definition=template.definition,
        saved_by=user_id,
        saved_at=_now(),
    )
    db.add(ver)


def _tmpl_dict(t: WorkflowTemplate, include_def: bool = False) -> dict:
    d: dict = {
        "id":          str(t.id),
        "name":        t.name,
        "slug":        t.slug,
        "description": t.description,
        "category":    t.category,
        "version":     t.version,
        "is_active":   t.is_active,
        "created_by":  str(t.created_by) if t.created_by else None,
        "created_at":  t.created_at.isoformat(),
        "updated_at":  t.updated_at.isoformat(),
    }
    if include_def:
        d["definition"] = t.definition
    return d


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_templates(
    category: Optional[str]  = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(WorkflowTemplate)
    if category is not None:
        q = q.filter(WorkflowTemplate.category == category)
    if is_active is not None:
        q = q.filter(WorkflowTemplate.is_active == is_active)
    return [_tmpl_dict(t) for t in q.order_by(WorkflowTemplate.category, WorkflowTemplate.name).all()]


@router.get("/{template_id}")
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    return _tmpl_dict(_get_or_404(db, template_id), include_def=True)


@router.post("")
def create_template(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_privilege("admin.settings"),
):
    if not body.get("slug"):
        raise HTTPException(422, "slug is required")
    if db.query(WorkflowTemplate).filter(WorkflowTemplate.slug == body["slug"]).first():
        raise HTTPException(409, f"Template with slug '{body['slug']}' already exists")

    now = _now()
    t = WorkflowTemplate(
        id=_uuid(),
        name=body["name"],
        slug=body["slug"],
        description=body.get("description"),
        category=body.get("category"),
        version=1,
        is_active=body.get("is_active", True),
        definition=body.get("definition"),
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(t)
    if t.definition:
        _snapshot(db, t, current_user.id)
    db.commit()
    db.refresh(t)
    return _tmpl_dict(t, include_def=True)


@router.patch("/{template_id}")
def update_template(
    template_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_privilege("admin.settings"),
):
    t = _get_or_404(db, template_id)
    definition_changed = "definition" in body and body["definition"] != t.definition

    for field in ("name", "description", "category", "is_active", "definition"):
        if field in body:
            setattr(t, field, body[field])

    if definition_changed:
        t.version = (t.version or 1) + 1
        _snapshot(db, t, current_user.id)

    t.updated_at = _now()
    db.commit()
    db.refresh(t)
    return _tmpl_dict(t, include_def=True)


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: Any = require_privilege("admin.settings"),
):
    t = _get_or_404(db, template_id)
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/{template_id}/versions")
def list_versions(
    template_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, template_id)
    versions = (
        db.query(WorkflowTemplateVersion)
        .filter(WorkflowTemplateVersion.template_id == template_id)
        .order_by(WorkflowTemplateVersion.version.desc())
        .all()
    )
    return [
        {
            "id":         str(v.id),
            "version":    v.version,
            "saved_by":   str(v.saved_by) if v.saved_by else None,
            "saved_at":   v.saved_at.isoformat(),
            "definition": v.definition,
        }
        for v in versions
    ]
