from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RoleShort(BaseModel):
    id:   str
    code: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class DeptShort(BaseModel):
    id:   str
    code: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class RolePrivilegeCreate(BaseModel):
    role_id:       str
    department_id: Optional[str] = None   # NULL = applies across all departments
    privilege_key: str
    is_granted:    bool = True


class RolePrivilegeUpdate(BaseModel):
    is_granted: bool


class RolePrivilegeResponse(BaseModel):
    id:            str
    role_id:       str
    role:          RoleShort
    department_id: Optional[str]
    department:    Optional[DeptShort]
    privilege_key: str
    is_granted:    bool
    updated_by:    Optional[str]
    updated_at:    Optional[datetime]
    model_config = ConfigDict(from_attributes=True)
