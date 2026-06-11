"""
Route and Stage schemas.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── Stage ─────────────────────────────────────────────────────────────────────

class StageCreate(BaseModel):
    code:        str
    name:        str
    description: Optional[str] = None
    sort_order:  int = 1


class StageUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    sort_order:  Optional[int] = None
    status:      Optional[str] = None   # ACTIVE / DRAFT / ARCHIVED


class StageResponse(BaseModel):
    id:          str
    route_id:    str
    project_id:  str
    code:        str
    name:        str
    description: Optional[str]
    sort_order:  int
    status:      str
    created_at:  datetime
    updated_at:  datetime

    model_config = ConfigDict(from_attributes=True)


class StageSummary(BaseModel):
    id:   str
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


# ── Route ─────────────────────────────────────────────────────────────────────

class RouteCreate(BaseModel):
    code:        str
    name:        str
    description: Optional[str] = None
    sort_order:  int = 1
    stages:      List[StageCreate] = []   # optional inline stage creation


class RouteUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    sort_order:  Optional[int] = None
    status:      Optional[str] = None   # ACTIVE / DRAFT / ARCHIVED


class RouteResponse(BaseModel):
    id:          str
    project_id:  str
    code:        str
    name:        str
    description: Optional[str]
    sort_order:  int
    status:      str
    stages:      List[StageResponse] = []
    created_at:  datetime
    updated_at:  datetime

    model_config = ConfigDict(from_attributes=True)


class RouteSummary(BaseModel):
    id:   str
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)
