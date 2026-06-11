"""
Department schemas.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DepartmentCreate(BaseModel):
    code:        str
    name:        str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    is_active:   Optional[bool] = None


class DepartmentResponse(BaseModel):
    id:          str
    code:        str
    name:        str
    description: Optional[str]
    is_active:   bool
    created_by:  Optional[str]
    created_at:  datetime
    updated_at:  datetime

    model_config = ConfigDict(from_attributes=True)
