"""
Notebook schemas.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


# ── Nested ────────────────────────────────────────────────────────────────────

class UserShort(BaseModel):
    id:           str
    emp_no:       str
    display_name: str
    role:         Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PermissionFlags(BaseModel):
    """The 11 permission booleans — used both for grant requests and responses."""
    can_view:           bool = True
    can_edit:           bool = False
    can_submit:         bool = False
    can_verify:         bool = False
    can_approve:        bool = False
    can_clone:          bool = False
    can_export:         bool = False
    can_attach:         bool = False
    can_comment:        bool = False
    can_request_unlock: bool = False
    can_deactivate:     bool = False


# ── Notebook ──────────────────────────────────────────────────────────────────

class NotebookCreate(BaseModel):
    title:         str
    description:   Optional[str] = None
    project_id:    str
    route_id:      Optional[str] = None
    stage_id:      Optional[str] = None
    notebook_type: Optional[str] = None   # e.g. "preliminary", "formal", "synthesis"
    template_id:   Optional[str] = None   # workflow template for experiments in this notebook


class NotebookUpdate(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    route_id:    Optional[str] = None
    stage_id:    Optional[str] = None
    status:      Optional[str] = None   # ACTIVE / ARCHIVED / LOCKED
    template_id: Optional[str] = None


class NotebookResponse(BaseModel):
    id:            str
    code:          str
    title:         str
    description:   Optional[str]
    project_id:    str
    route_id:      Optional[str]
    stage_id:      Optional[str]
    notebook_type:     Optional[str]
    template_id:       Optional[str]
    template_name:     Optional[str] = None
    template_slug:     Optional[str] = None
    template_snapshot: Optional[Dict[str, Any]] = None
    created_by:    str
    creator:       Optional[UserShort]
    status:        str
    created_at:    datetime
    updated_at:    datetime

    model_config = ConfigDict(from_attributes=True)


class NotebookSummary(BaseModel):
    """Lightweight — used inside experiment responses."""
    id:   str
    code: str
    title: str

    model_config = ConfigDict(from_attributes=True)


# ── Permissions ───────────────────────────────────────────────────────────────

class PermissionGrant(BaseModel):
    """Grant permissions to a user on a notebook."""
    user_id: str
    can_view:           bool = True
    can_edit:           bool = False
    can_submit:         bool = False
    can_verify:         bool = False
    can_approve:        bool = False
    can_clone:          bool = False
    can_export:         bool = False
    can_attach:         bool = False
    can_comment:        bool = False
    can_request_unlock: bool = False
    can_deactivate:     bool = False


class PermissionUpdate(BaseModel):
    """Update individual permission flags — only provided flags change."""
    can_view:           Optional[bool] = None
    can_edit:           Optional[bool] = None
    can_submit:         Optional[bool] = None
    can_verify:         Optional[bool] = None
    can_approve:        Optional[bool] = None
    can_clone:          Optional[bool] = None
    can_export:         Optional[bool] = None
    can_attach:         Optional[bool] = None
    can_comment:        Optional[bool] = None
    can_request_unlock: Optional[bool] = None
    can_deactivate:     Optional[bool] = None


class PermissionResponse(BaseModel):
    id:                 str
    notebook_id:        str
    user_id:            str
    user:               Optional[UserShort]
    can_view:           bool
    can_edit:           bool
    can_submit:         bool
    can_verify:         bool
    can_approve:        bool
    can_clone:          bool
    can_export:         bool
    can_attach:         bool
    can_comment:        bool
    can_request_unlock: bool
    can_deactivate:     bool
    granted_by:         Optional[str]
    granted_at:         datetime

    model_config = ConfigDict(from_attributes=True)
