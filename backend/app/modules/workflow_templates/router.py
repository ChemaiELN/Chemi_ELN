from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import new_uuid
from app.models.workflow_template import WorkflowTemplate
from app.models.user import User
from app.schemas.workflow_template import (
    WorkflowTemplateCreate, WorkflowTemplateResponse,
    WorkflowTemplateSummary, WorkflowTemplateUpdate,
)
from app.utils.deps import get_current_user
from app.utils.privileges import require_privilege, ADMIN_SETTINGS

router = APIRouter()

_admin = require_privilege(ADMIN_SETTINGS)


def _get_or_404(db: Session, template_id: str) -> WorkflowTemplate:
    t = db.get(WorkflowTemplate, template_id)
    if not t:
        raise HTTPException(404, "Workflow template not found")
    return t


# ── Public: list active templates (for notebook creation dropdown) ─────────────

@router.get("/", response_model=List[WorkflowTemplateSummary])
def list_templates(
    category:  Optional[str]  = Query(None),
    is_active: Optional[bool] = Query(None),
    db:        Session        = Depends(get_db),
    _:         User           = Depends(get_current_user),
):
    q = db.query(WorkflowTemplate)
    if category:
        q = q.filter(WorkflowTemplate.category == category)
    if is_active is not None:
        q = q.filter(WorkflowTemplate.is_active == is_active)
    else:
        q = q.filter(WorkflowTemplate.is_active.is_(True))
    return q.order_by(WorkflowTemplate.category, WorkflowTemplate.name).all()


# ── Get full template (including definition) ──────────────────────────────────

@router.get("/{template_id}", response_model=WorkflowTemplateResponse)
def get_template(
    template_id: str,
    db:          Session = Depends(get_db),
    _:           User    = Depends(get_current_user),
):
    return _get_or_404(db, template_id)


# ── Admin: create ─────────────────────────────────────────────────────────────

@router.post("/", response_model=WorkflowTemplateResponse, status_code=201)
def create_template(
    body:  WorkflowTemplateCreate,
    db:    Session = Depends(get_db),
    actor: User    = Depends(_admin),
):
    if db.query(WorkflowTemplate).filter(WorkflowTemplate.slug == body.slug).first():
        raise HTTPException(400, f"Template with slug '{body.slug}' already exists")

    t = WorkflowTemplate(
        id          = new_uuid(),
        name        = body.name,
        slug        = body.slug,
        description = body.description,
        category    = body.category,
        definition  = body.definition,
        is_active   = True,
        version     = 1,
        created_by  = actor.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# ── Admin: update ─────────────────────────────────────────────────────────────

@router.patch("/{template_id}", response_model=WorkflowTemplateResponse)
def update_template(
    template_id: str,
    body:        WorkflowTemplateUpdate,
    db:          Session = Depends(get_db),
    _:           User    = Depends(_admin),
):
    t = _get_or_404(db, template_id)
    updates = body.model_dump(exclude_unset=True)
    if "definition" in updates:
        # Bump template version whenever the definition changes
        t.version += 1
    for field, value in updates.items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t


# ── Admin: delete ─────────────────────────────────────────────────────────────

@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db:          Session = Depends(get_db),
    _:           User    = Depends(_admin),
):
    t = _get_or_404(db, template_id)
    db.delete(t)
    db.commit()
