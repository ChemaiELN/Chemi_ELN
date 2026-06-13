from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


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


_ALL_KEYS = [
    # Admin
    "admin.settings",
    "admin.excel_templates",
    "admin.notifications",
    "admin.role_privileges",
    # Users & Org
    "users.manage",
    "departments.manage",
    "master_data.manage",
    # Projects
    "projects.create",
    "projects.edit",
    "projects.routes",
    # Notebooks
    "notebooks.create",
    "notebooks.edit",
    "notebooks.permissions",
    # Experiments
    "experiments.verify",
    "experiments.approve",
    "experiments.unlock",
    "experiments.void",
    # ATR
    "atr.assign",
    "atr.unlock",
]


class BulkPrivilegeItem(BaseModel):
    privilege_key: str = Field(
        description="One of: " + ", ".join(f"`{k}`" for k in _ALL_KEYS),
        examples=["projects.manage"],
    )
    is_granted: bool = Field(default=True, examples=[True])


class BulkPrivilegeCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "role_id": "<paste role id from GET /api/roles/>",
                "department_id": None,
                "privileges": [
                    {"privilege_key": "projects.create",        "is_granted": True},
                    {"privilege_key": "projects.edit",          "is_granted": True},
                    {"privilege_key": "projects.routes",        "is_granted": True},
                    {"privilege_key": "notebooks.create",       "is_granted": True},
                    {"privilege_key": "notebooks.edit",         "is_granted": True},
                    {"privilege_key": "notebooks.permissions",  "is_granted": True},
                    {"privilege_key": "experiments.verify",     "is_granted": True},
                    {"privilege_key": "experiments.approve",    "is_granted": False},
                    {"privilege_key": "experiments.unlock",     "is_granted": False},
                    {"privilege_key": "experiments.void",       "is_granted": False},
                    {"privilege_key": "atr.assign",             "is_granted": True},
                    {"privilege_key": "atr.unlock",             "is_granted": False},
                ],
            }
        }
    )

    role_id:       str            = Field(description="ID of the role to configure. Get IDs from GET /api/roles/")
    department_id: Optional[str]  = Field(default=None, description="Leave null to apply globally across all departments")
    privileges:    List[BulkPrivilegeItem]


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
