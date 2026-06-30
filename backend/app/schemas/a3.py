from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


# ── Global Settings ───────────────────────────────────────────

class SettingsOut(BaseModel):
    id: int
    auth_type: str
    lock_user_after_x_attempts: int
    password_expiry_days: int
    max_image_kb: int
    max_attachment_kb: int
    experiments_per_notebook: int
    notebooks_per_project: int
    search_limit: int
    qa_role: Optional[str]
    smtp_host: Optional[str]
    smtp_port: Optional[int]
    smtp_from_address: Optional[str]
    smtp_username: Optional[str]
    enable_email_notifications: bool

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    lock_user_after_x_attempts: Optional[int] = None
    password_expiry_days: Optional[int] = None
    max_image_kb: Optional[int] = None
    max_attachment_kb: Optional[int] = None
    experiments_per_notebook: Optional[int] = None
    notebooks_per_project: Optional[int] = None
    search_limit: Optional[int] = None
    qa_role: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_from_address: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    enable_email_notifications: Optional[bool] = None


# ── Admin Master Data ─────────────────────────────────────────

class ChemicalOut(BaseModel):
    id: UUID
    chemical_name: str
    cas_no: Optional[str]
    formula: Optional[str]
    mol_wt: Optional[float]
    vendor_name: Optional[str]
    density: Optional[float]
    purity_pct: Optional[float]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChemicalCreate(BaseModel):
    chemical_name: str
    cas_no: Optional[str] = None
    formula: Optional[str] = None
    mol_wt: Optional[float] = None
    vendor_name: Optional[str] = None
    density: Optional[float] = None
    purity_pct: Optional[float] = None


class ChemicalUpdate(BaseModel):
    chemical_name: Optional[str] = None
    cas_no: Optional[str] = None
    formula: Optional[str] = None
    mol_wt: Optional[float] = None
    vendor_name: Optional[str] = None
    density: Optional[float] = None
    purity_pct: Optional[float] = None
    is_active: Optional[bool] = None


class InstrumentOut(BaseModel):
    id: UUID
    instrument_code: str
    instrument_type: Optional[str]
    instrument_name: str
    maintenance_status: Optional[str]
    calibration_status: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class InstrumentCreate(BaseModel):
    instrument_code: str
    instrument_type: Optional[str] = None
    instrument_name: str
    maintenance_status: Optional[str] = None
    calibration_status: Optional[str] = None


class InstrumentUpdate(BaseModel):
    instrument_type: Optional[str] = None
    instrument_name: Optional[str] = None
    maintenance_status: Optional[str] = None
    calibration_status: Optional[str] = None
    is_active: Optional[bool] = None


class SiteOut(BaseModel):
    id: UUID
    code: str
    name: str
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class SiteCreate(BaseModel):
    code: str
    name: str


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
