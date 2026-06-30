from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr


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
    code: Optional[str] = None
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


# ── Users ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    emp_no: Optional[str] = None      # auto-generated if omitted
    email: EmailStr
    password: str = "password@123"    # default password for new users
    role_id: UUID
    department_id: Optional[UUID] = None
    site: Optional[str] = None
    is_active: bool = True


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


# ── Role Privileges ────────────────────────────────────────────

class PrivilegeGrantRow(BaseModel):
    role_id: UUID
    privilege_key: str
    is_granted: bool


class PrivilegeBulkUpdate(BaseModel):
    rows: List[PrivilegeGrantRow]
