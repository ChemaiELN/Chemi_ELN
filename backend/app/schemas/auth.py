from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    username: str       # emp_no, username, or email
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id:              str
    emp_no:          str
    username:        str
    title:           Optional[str] = None
    first_name:      str
    middle_initials: Optional[str] = None
    last_name:       str
    display_name:    str
    email:           str
    designation:     Optional[str] = None
    department_id:   Optional[str] = None
    department_name: Optional[str] = None
    role:            str            # QA | HOD | TL | CHEM | ARD_TL | ARD_ANALYST | ARD_HOD
    is_active:       bool

    # v2 fields
    contact_no:            Optional[str] = None
    site:                  Optional[str] = None
    dashboard_reference:   Optional[str] = None
    allow_settings_update: bool = False
    must_reset_password:   bool = False
    privileges:            List[str] = []

    model_config = ConfigDict(from_attributes=True)


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str
