import re
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator

# Password policy: min 6 chars, at least one uppercase letter, one digit,
# and one special (non-alphanumeric) character. Mirrors the client-side rule
# on the Reset Password / Create User forms so the API can't be bypassed.
_PASSWORD_POLICY = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$")
_PASSWORD_MESSAGE = (
    "Password must be at least 6 characters and include an uppercase letter, "
    "a number, and a special character."
)


def _validate_password(value: str) -> str:
    if not _PASSWORD_POLICY.match(value or ""):
        raise ValueError(_PASSWORD_MESSAGE)
    return value


# ── Roles ──────────────────────────────────────────────────────

class RoleOut(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    user_count: int = 0


class RoleCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# ── Departments ────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    # `code` is intentionally omitted: a department's code is a stable system
    # identifier that RBAC / module-access / workflow logic keys off (e.g. QA, QC),
    # so it is immutable after creation. Any `code` sent by a client is ignored.
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    user_count: int = 0
    created_at: datetime


class DepartmentLookupOut(BaseModel):
    """Minimal, unprivileged shape for populating dropdowns/pickers."""
    id: UUID
    name: str


# ── Users ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    emp_no: Optional[str] = None      # auto-generated if omitted
    email: EmailStr
    password: str = "Password@123"    # default password for new users (policy-compliant)
    role_id: UUID
    department_id: Optional[UUID] = None
    site: Optional[str] = None
    is_active: bool = True

    # Only validates an explicitly-provided password; the "Password@123" default
    # is a temporary credential the new user is expected to reset, so it is exempt.
    _check_password = field_validator("password")(_validate_password)


class UserUpdate(BaseModel):
    username: Optional[str] = None
    emp_no: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    site: Optional[str] = None
    is_active: Optional[bool] = None
    must_reset_password: Optional[bool] = None


class UserPasswordReset(BaseModel):
    new_password: str

    _check_password = field_validator("new_password")(_validate_password)


class UserOut(BaseModel):
    id: UUID
    username: str
    emp_no: str
    email: str
    role_id: UUID
    role_code: str
    role_name: str
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    is_active: bool
    must_reset_password: bool
    site: Optional[str] = None
    created_at: datetime


# ── Department ↔ Role Mapping ────────────────────────────────────

class DepartmentRoleMappingOut(BaseModel):
    department_id: UUID
    role_ids: List[UUID]


# ── Role Privileges ────────────────────────────────────────────

class PrivilegeGrantRow(BaseModel):
    role_id: UUID
    privilege_key: str
    is_granted: bool


class PrivilegeBulkUpdate(BaseModel):
    rows: List[PrivilegeGrantRow]
