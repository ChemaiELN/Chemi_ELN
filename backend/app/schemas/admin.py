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
    logo_path: Optional[str] = None


# ── CRD Settings ──────────────────────────────────────────────────────────────

class CRDSettingsResponse(BaseModel):
    id: int
    # Calculation
    precision: int
    mw_precision: int
    qty_unit: str
    moles_format: str
    mole_ratio_base: Decimal
    auto_calc: bool
    display_mw: bool
    # Notebook code
    code_format: int
    sample_notebook_code: Optional[str] = None
    # Workflow
    mandate_tl_approval_atr: bool
    verification_request_flow: bool
    route_and_stage: bool
    # Experiment editor
    sample_auto_gen: bool
    grace_period: int
    amber_threshold: int
    red_threshold: int
    clone_procedure_without_numerical_data: bool
    closing_stage: str
    experiment_report_stage: str
    scheme_type: str
    procedure_display: str
    include_observation_start_end_time: bool
    tlc_type: str
    tlc_row_count: int
    reference_experiment_link_code: Optional[str] = None
    include_reference_for_cloned_experiments: bool
    # SLA
    sla_experiments_days: int
    sla_delayed_submission_days: int
    sla_delayed_approval_days: int
    # Re-authentication
    reauth_approval: bool
    reauth_save_draft: bool
    reauth_save: bool
    reauth_submit: bool
    reauth_submit_for_verification: bool
    reauth_verification: bool
    reauth_void: bool
    reauth_export: bool
    reauth_delete: bool
    reauth_deactivate: bool
    reauth_attachment_upload: bool
    # Input defaults
    input_default_mol_weight: Optional[Decimal] = None
    input_default_quantity: Optional[Decimal] = None
    input_auto_calc_moles: bool
    input_default_mole_ratio: Optional[Decimal] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CRDSettingsUpdate(BaseModel):
    # Calculation
    precision: Optional[int] = None
    mw_precision: Optional[int] = None
    qty_unit: Optional[str] = None
    moles_format: Optional[str] = None
    mole_ratio_base: Optional[Decimal] = None
    auto_calc: Optional[bool] = None
    display_mw: Optional[bool] = None
    # Notebook code
    code_format: Optional[int] = None
    sample_notebook_code: Optional[str] = None
    # Workflow
    mandate_tl_approval_atr: Optional[bool] = None
    verification_request_flow: Optional[bool] = None
    route_and_stage: Optional[bool] = None
    # Experiment editor
    sample_auto_gen: Optional[bool] = None
    grace_period: Optional[int] = None
    amber_threshold: Optional[int] = None
    red_threshold: Optional[int] = None
    clone_procedure_without_numerical_data: Optional[bool] = None
    closing_stage: Optional[str] = None
    experiment_report_stage: Optional[str] = None
    scheme_type: Optional[str] = None
    procedure_display: Optional[str] = None
    include_observation_start_end_time: Optional[bool] = None
    tlc_type: Optional[str] = None
    tlc_row_count: Optional[int] = None
    reference_experiment_link_code: Optional[str] = None
    include_reference_for_cloned_experiments: Optional[bool] = None
    # SLA
    sla_experiments_days: Optional[int] = None
    sla_delayed_submission_days: Optional[int] = None
    sla_delayed_approval_days: Optional[int] = None
    # Re-authentication
    reauth_approval: Optional[bool] = None
    reauth_save_draft: Optional[bool] = None
    reauth_save: Optional[bool] = None
    reauth_submit: Optional[bool] = None
    reauth_submit_for_verification: Optional[bool] = None
    reauth_verification: Optional[bool] = None
    reauth_void: Optional[bool] = None
    reauth_export: Optional[bool] = None
    reauth_delete: Optional[bool] = None
    reauth_deactivate: Optional[bool] = None
    reauth_attachment_upload: Optional[bool] = None
    # Input defaults
    input_default_mol_weight: Optional[Decimal] = None
    input_default_quantity: Optional[Decimal] = None
    input_auto_calc_moles: Optional[bool] = None
    input_default_mole_ratio: Optional[Decimal] = None


# ── Global Settings ───────────────────────────────────────────────────────────

class GlobalSettingsResponse(BaseModel):
    id: int
    auth_type: str
    use_random_password_through_mail: bool
    default_password: Optional[str] = None
    lock_user_after_x_attempts: int
    password_expiry_days: int
    image_file_size_kb: int
    attachment_size_kb: int
    configure_customer_enabled: bool
    include_equipment_inventory: bool
    instrument_service_ip: Optional[str] = None
    qa_privilege_role: str
    email_notification_enabled: bool
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_pool_address: Optional[str] = None
    smtp_auth_enabled: bool
    experiment_qa_remarks_enabled: bool
    experiment_report_stage: str
    experiment_per_limit: int
    notebook_experiment_limit: int
    experiment_search_result_limit: int
    company_logo_path: Optional[str] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GlobalSettingsUpdate(BaseModel):
    auth_type: Optional[str] = None
    use_random_password_through_mail: Optional[bool] = None
    default_password: Optional[str] = None
    lock_user_after_x_attempts: Optional[int] = None
    password_expiry_days: Optional[int] = None
    image_file_size_kb: Optional[int] = None
    attachment_size_kb: Optional[int] = None
    configure_customer_enabled: Optional[bool] = None
    include_equipment_inventory: Optional[bool] = None
    instrument_service_ip: Optional[str] = None
    qa_privilege_role: Optional[str] = None
    email_notification_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_pool_address: Optional[str] = None
    smtp_auth_enabled: Optional[bool] = None
    experiment_qa_remarks_enabled: Optional[bool] = None
    experiment_report_stage: Optional[str] = None
    experiment_per_limit: Optional[int] = None
    notebook_experiment_limit: Optional[int] = None
    experiment_search_result_limit: Optional[int] = None
    company_logo_path: Optional[str] = None


# ── SMTP Config ───────────────────────────────────────────────────────────────

class SMTPConfigResponse(BaseModel):
    id: int
    host: Optional[str] = None
    port: Optional[int] = None
    from_address: Optional[str] = None
    username: Optional[str] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SMTPConfigUpdate(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    from_address: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None   # stored in password_encrypted column


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
