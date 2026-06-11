from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Company Settings ──────────────────────────────────────────────────────────

class CompanySettingsResponse(BaseModel):
    id: int
    name: Optional[str] = None
    short_name: Optional[str] = None
    code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    logo_path: Optional[str] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CompanySettingsUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None


# ── CRD Settings ──────────────────────────────────────────────────────────────

class CRDSettingsResponse(BaseModel):
    id: int
    precision: int
    mw_precision: int
    qty_unit: str
    moles_format: str
    mole_ratio_base: Decimal
    auto_calc: bool
    display_mw: bool
    sample_auto_gen: bool
    grace_period: int
    amber_threshold: int
    red_threshold: int
    code_format: int
    reauth_approval: bool
    reauth_save_draft: bool
    reauth_submit: bool
    reauth_void: bool
    reauth_export: bool
    reauth_delete: bool
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CRDSettingsUpdate(BaseModel):
    precision: Optional[int] = None
    mw_precision: Optional[int] = None
    qty_unit: Optional[str] = None
    moles_format: Optional[str] = None
    mole_ratio_base: Optional[Decimal] = None
    auto_calc: Optional[bool] = None
    display_mw: Optional[bool] = None
    sample_auto_gen: Optional[bool] = None
    grace_period: Optional[int] = None
    amber_threshold: Optional[int] = None
    red_threshold: Optional[int] = None
    code_format: Optional[int] = None
    reauth_approval: Optional[bool] = None
    reauth_save_draft: Optional[bool] = None
    reauth_submit: Optional[bool] = None
    reauth_void: Optional[bool] = None
    reauth_export: Optional[bool] = None
    reauth_delete: Optional[bool] = None


# ── Sequence Counters ─────────────────────────────────────────────────────────

class SequenceCounterResponse(BaseModel):
    id: str
    scope_key: str
    prefix: str
    last_value: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: str
    module: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    target_label: Optional[str] = None
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
