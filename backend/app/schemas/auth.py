from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str       # emp_no or email
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id:           str
    emp_no:       str
    username:     str
    title:        Optional[str]
    first_name:   str
    last_name:    str
    display_name: str
    email:        str
    designation:  Optional[str]
    department_id:Optional[str]
    department_name: Optional[str]
    role:         str            # e.g. "CHEM"
    is_active:    bool

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str
