from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class CompanySettings(Base):
    """Single-row table — always id = 1."""
    __tablename__ = "company_settings"

    id:           Mapped[int]  = mapped_column(SmallInteger, primary_key=True, default=1)
    name:         Mapped[Optional[str]] = mapped_column(String(255))
    short_name:   Mapped[Optional[str]] = mapped_column(String(50))        # e.g. Crhance Labs
    code:         Mapped[Optional[str]] = mapped_column(String(20))        # COLS
    phone:        Mapped[Optional[str]] = mapped_column(String(30))
    email:        Mapped[Optional[str]] = mapped_column(String(255))
    website:      Mapped[Optional[str]] = mapped_column(String(255))
    address_line1:Mapped[Optional[str]] = mapped_column(String(255))
    address_line2:Mapped[Optional[str]] = mapped_column(String(255))
    city:         Mapped[Optional[str]] = mapped_column(String(100))
    state:        Mapped[Optional[str]] = mapped_column(String(100))
    country:      Mapped[Optional[str]] = mapped_column(String(100))
    timezone:     Mapped[Optional[str]] = mapped_column(String(60), default="Asia/Kolkata")
    date_format:  Mapped[Optional[str]] = mapped_column(String(30), default="DD MMM YYYY")
    logo_path:    Mapped[Optional[str]] = mapped_column(String(500))
    updated_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class GlobalSettings(Base):
    """
    System-wide settings — single-row table (id=1).
    FIX-26/54: Centralises feature flags, file size limits, SMTP, and search limits.
    """
    __tablename__ = "global_settings"

    id:                           Mapped[int]  = mapped_column(SmallInteger, primary_key=True, default=1)

    # Authentication
    auth_type:                    Mapped[str]  = mapped_column(String(20), default="Application", nullable=False)  # LDAP / Application
    use_random_password_through_mail: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_password:             Mapped[Optional[str]] = mapped_column(String(255))
    lock_user_after_x_attempts:   Mapped[int]  = mapped_column(SmallInteger, default=5, nullable=False)
    password_expiry_days:         Mapped[int]  = mapped_column(SmallInteger, default=90, nullable=False)

    # File size limits
    image_file_size_kb:           Mapped[int]  = mapped_column(SmallInteger, default=2048, nullable=False)   # 2 MB
    attachment_size_kb:           Mapped[int]  = mapped_column(Integer, default=51200, nullable=False)        # 50 MB

    # Feature flags
    configure_customer_enabled:   Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    include_equipment_inventory:  Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Instruments
    instrument_service_ip:        Mapped[Optional[str]] = mapped_column(String(255))

    # QA
    qa_privilege_role:            Mapped[str]  = mapped_column(String(20), default="QA", nullable=False)  # Admin or QA

    # Email / SMTP
    email_notification_enabled:   Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    smtp_host:                    Mapped[Optional[str]] = mapped_column(String(255))
    smtp_port:                    Mapped[Optional[int]] = mapped_column(SmallInteger, default=587)
    smtp_pool_address:            Mapped[Optional[str]] = mapped_column(String(255))
    smtp_auth_enabled:            Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Experiment limits
    experiment_qa_remarks_enabled:Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    experiment_report_stage:      Mapped[str]  = mapped_column(String(30), default="Before Approval", nullable=False)
    experiment_per_limit:         Mapped[int]  = mapped_column(SmallInteger, default=999, nullable=False)
    notebook_experiment_limit:    Mapped[int]  = mapped_column(SmallInteger, default=999, nullable=False)
    experiment_search_result_limit: Mapped[int] = mapped_column(SmallInteger, default=100, nullable=False)

    # Company branding
    company_logo_path:            Mapped[Optional[str]] = mapped_column(String(500))
    updated_at:                   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class CRDSettings(Base):
    """
    CRD calculation and workflow configuration — single-row table (id=1).
    FIX-25: Expanded with missing fields confirmed from screenshots.
    FIX-56: Input default values section.
    """
    __tablename__ = "crd_settings"

    id:               Mapped[int]  = mapped_column(SmallInteger, primary_key=True, default=1)

    # ── Calculation ──────────────────────────────────────────────────────────
    precision:        Mapped[int]  = mapped_column(SmallInteger, default=2, nullable=False)
    mw_precision:     Mapped[int]  = mapped_column(SmallInteger, default=2, nullable=False)
    qty_unit:         Mapped[str]  = mapped_column(String(10), default="g", nullable=False)
    moles_format:     Mapped[str]  = mapped_column(String(20), default="Scientific", nullable=False)
    mole_ratio_base:  Mapped[Decimal] = mapped_column(Numeric(5, 2), default=1.00, nullable=False)
    auto_calc:        Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_mw:       Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Notebook code format ──────────────────────────────────────────────────
    code_format:          Mapped[int]          = mapped_column(SmallInteger, default=1, nullable=False)
    sample_notebook_code: Mapped[Optional[str]] = mapped_column(String(100))

    # ── Other Settings ────────────────────────────────────────────────────────
    mandate_tl_approval_atr:   Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    verification_request_flow: Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    route_and_stage:           Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)

    # ── Experiment Editor Settings ────────────────────────────────────────────
    sample_auto_gen:  Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    grace_period:     Mapped[int]  = mapped_column(SmallInteger, default=2,  nullable=False)
    amber_threshold:  Mapped[int]  = mapped_column(SmallInteger, default=7,  nullable=False)
    red_threshold:    Mapped[int]  = mapped_column(SmallInteger, default=10, nullable=False)
    clone_procedure_without_numerical_data:      Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closing_stage:                               Mapped[str]  = mapped_column(String(20), default="APPROVED",        nullable=False)
    experiment_report_stage:                     Mapped[str]  = mapped_column(String(20), default="APPROVED",        nullable=False)
    scheme_type:                                 Mapped[str]  = mapped_column(String(30), default="INLINE_KETCHER",  nullable=False)
    procedure_display:                           Mapped[str]  = mapped_column(String(20), default="INTEGRATED",      nullable=False)
    include_observation_start_end_time:          Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tlc_type:                                    Mapped[str]  = mapped_column(String(20), default="INLINE",          nullable=False)
    tlc_row_count:                               Mapped[int]  = mapped_column(SmallInteger, default=3, nullable=False)
    reference_experiment_link_code:              Mapped[Optional[str]] = mapped_column(String(50))
    include_reference_for_cloned_experiments:    Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)

    # ── SLA Days ─────────────────────────────────────────────────────────────
    sla_experiments_days:        Mapped[int] = mapped_column(SmallInteger, default=30, nullable=False)
    sla_delayed_submission_days: Mapped[int] = mapped_column(SmallInteger, default=7,  nullable=False)
    sla_delayed_approval_days:   Mapped[int] = mapped_column(SmallInteger, default=14, nullable=False)

    # ── Re-authentication flags ───────────────────────────────────────────────
    reauth_approval:                Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_save_draft:              Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reauth_save:                    Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reauth_submit:                  Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_submit_for_verification: Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_verification:            Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_void:                    Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_export:                  Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reauth_delete:                  Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_deactivate:              Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    reauth_attachment_upload:       Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── FIX-56: Input Default Values ─────────────────────────────────────────
    input_default_mol_weight:  Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    input_default_quantity:    Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))
    input_auto_calc_moles:     Mapped[bool]              = mapped_column(Boolean, default=True, nullable=False)
    input_default_mole_ratio:  Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class SMTPConfig(Base):
    """Email server configuration — single-row table."""
    __tablename__ = "smtp_config"

    id:                Mapped[int]  = mapped_column(SmallInteger, primary_key=True, default=1)
    host:              Mapped[Optional[str]] = mapped_column(String(255))
    port:              Mapped[Optional[int]] = mapped_column(SmallInteger, default=587)
    from_address:      Mapped[Optional[str]] = mapped_column(String(255))
    username:          Mapped[Optional[str]] = mapped_column(String(255))
    password_encrypted:Mapped[Optional[str]] = mapped_column(Text)
    updated_at:        Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id:         Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    key:        Mapped[str]  = mapped_column(String(100), unique=True, nullable=False)  # exp_submitted
    label:      Mapped[Optional[str]] = mapped_column(String(255))
    module:     Mapped[Optional[str]] = mapped_column(String(50))   # Experiments / ATR / Users
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class ExcelTemplate(Base):
    __tablename__ = "excel_templates"

    id:          Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    name:        Mapped[str]  = mapped_column(String(255), nullable=False)
    module:      Mapped[str]  = mapped_column(String(50), nullable=False)   # Experiments / ATR / Projects
    version:     Mapped[Optional[str]] = mapped_column(String(10), default="v1")
    file_path:   Mapped[str]  = mapped_column(String(500), nullable=False)
    file_size:   Mapped[Optional[int]] = mapped_column(BigInteger)          # bytes; widened from String(20)
    uploaded_by: Mapped[str]  = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    is_active:   Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
