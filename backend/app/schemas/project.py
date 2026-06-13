"""
Project schemas.
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── Nested ────────────────────────────────────────────────────────────────────

class UserShort(BaseModel):
    id:           str
    emp_no:       str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class DeptShort(BaseModel):
    id:   str
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    code:          str
    name:          str
    product_name:  Optional[str] = None
    project_type:  Optional[str] = None   # Internal / External
    market:        Optional[str] = None
    department_id: Optional[str] = None
    manager_id:    Optional[str] = None
    start_date:    Optional[date] = None
    target_date:   Optional[date] = None
    description:   Optional[str] = None


class ProjectUpdate(BaseModel):
    name:          Optional[str]  = None
    product_name:  Optional[str]  = None
    project_type:  Optional[str]  = None
    market:        Optional[str]  = None
    department_id: Optional[str]  = None
    manager_id:    Optional[str]  = None
    start_date:    Optional[date] = None
    target_date:   Optional[date] = None
    description:   Optional[str]  = None
    status:        Optional[str]  = None   # ACTIVE / ON HOLD / COMPLETED / CANCELLED


class ProjectResponse(BaseModel):
    id:            str
    code:          str
    name:          str
    product_name:  Optional[str]
    project_type:  Optional[str]
    market:        Optional[str]
    department_id: Optional[str]
    department:    Optional[DeptShort]
    manager_id:    Optional[str]
    manager:       Optional[UserShort]
    created_by:    str
    creator:       Optional[UserShort]
    start_date:    Optional[date]
    target_date:   Optional[date]
    status:        str
    description:   Optional[str]
    created_at:    datetime
    updated_at:    datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectSummary(BaseModel):
    """Lightweight — used inside notebook/experiment responses."""
    id:   str
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


# ── Project Users (team members) ──────────────────────────────────────────────

class ProjectUserAdd(BaseModel):
    user_ids: List[str]


class ProjectUserResponse(BaseModel):
    user_id:     str
    user:        Optional[UserShort]
    added_by:    Optional[str] = None
    added_at:    datetime

    model_config = ConfigDict(from_attributes=True)


# ── Milestones ────────────────────────────────────────────────────────────────

class MilestoneCreate(BaseModel):
    name:           str
    due_date:       Optional[date] = None
    owner_id:       Optional[str]  = None
    status:         str = "NOT STARTED"
    pct:            int = 0


class MilestoneUpdate(BaseModel):
    name:           Optional[str]  = None
    due_date:       Optional[date] = None
    completed_date: Optional[date] = None
    owner_id:       Optional[str]  = None
    status:         Optional[str]  = None
    pct:            Optional[int]  = None


class MilestoneResponse(BaseModel):
    id:             str
    project_id:     str
    name:           str
    due_date:       Optional[date]
    completed_date: Optional[date]
    owner_id:       Optional[str]
    owner:          Optional[UserShort]
    status:         str
    pct:            int
    created_at:     datetime

    model_config = ConfigDict(from_attributes=True)
