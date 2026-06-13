from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.user import VALID_ROLES


def _validate_email(v: str) -> str:
    if "@" not in v or v.count("@") != 1:
        raise ValueError("Invalid email address")
    local, domain = v.split("@")
    if not local or not domain or "." not in domain:
        raise ValueError("Invalid email address")
    return v.lower()


class UserCreate(BaseModel):
    username:            str
    emp_no:              str
    title:               Optional[str] = None
    first_name:          str
    middle_initials:     Optional[str] = None
    last_name:           str
    email:               str
    password:            str
    role:                str = "CHEM"
    designation:         Optional[str] = None
    contact_no:          Optional[str] = None
    department_id:       Optional[str] = None
    site:                Optional[str] = None
    dashboard_reference: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email(v)

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v


class UserUpdate(BaseModel):
    title:                Optional[str]  = None
    first_name:           Optional[str]  = None
    middle_initials:      Optional[str]  = None
    last_name:            Optional[str]  = None
    email:                Optional[str]  = None
    designation:          Optional[str]  = None
    contact_no:           Optional[str]  = None
    department_id:        Optional[str]  = None
    site:                 Optional[str]  = None
    dashboard_reference:  Optional[str]  = None
    allow_settings_update: Optional[bool] = None
    must_reset_password:  Optional[bool] = None
    role:                 Optional[str]  = None
    is_active:            Optional[bool] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        return _validate_email(v) if v else v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.upper()
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v


class DepartmentShort(BaseModel):
    id:   str
    code: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id:                   str
    username:             str
    emp_no:               str
    title:                Optional[str]
    first_name:           str
    middle_initials:      Optional[str]
    last_name:            str
    display_name:         str
    email:                str
    role:                 str
    designation:          Optional[str]
    contact_no:           Optional[str]
    department_id:        Optional[str]
    department:           Optional[DepartmentShort]
    site:                 Optional[str]
    dashboard_reference:  Optional[str]
    allow_settings_update: bool
    must_reset_password:  bool
    is_active:            bool
    last_login_at:        Optional[datetime]
    created_at:           datetime
    updated_at:           datetime
    model_config = ConfigDict(from_attributes=True)


class UserSummary(BaseModel):
    id:           str
    emp_no:       str
    display_name: str
    designation:  Optional[str]
    department_id: Optional[str]
    model_config = ConfigDict(from_attributes=True)
