"""
FIX-41: Lookup / Master Data module
FIX-55: Sites master data
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class LookupChemical(Base):
    """Chemical catalogue — source for the Chemical Name dropdown in experiment inputs."""
    __tablename__ = "lookup_chemicals"

    id:            Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    chemical_name: Mapped[str]           = mapped_column(String(255), nullable=False)
    cas_no:        Mapped[Optional[str]] = mapped_column(String(30))
    formula:       Mapped[Optional[str]] = mapped_column(String(100))
    mol_wt:        Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    vendor_name:   Mapped[Optional[str]] = mapped_column(String(255))
    density:       Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    purity_pct:    Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    is_active:     Mapped[bool]           = mapped_column(Boolean, default=True, nullable=False)
    created_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    created_at:    Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:    Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])


class LookupInstrument(Base):
    """Instrument catalogue — source for the Equipment Code dropdown in experiment equipment."""
    __tablename__ = "lookup_instruments"

    id:                 Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    instrument_code:    Mapped[str]           = mapped_column(String(50), unique=True, nullable=False)
    instrument_type:    Mapped[Optional[str]] = mapped_column(String(100))   # HPLC / Balance / Reactor
    instrument_name:    Mapped[str]           = mapped_column(String(255), nullable=False)
    maintenance_status: Mapped[Optional[str]] = mapped_column(String(30))    # Ok / Due
    calibration_status: Mapped[Optional[str]] = mapped_column(String(30))    # Ok / Due / Expired
    is_active:          Mapped[bool]           = mapped_column(Boolean, default=True, nullable=False)
    created_by:         Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    created_at:         Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:         Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])


class Site(Base):
    """Sites master data — used for user.site field (FIX-55)."""
    __tablename__ = "sites"

    id:         Mapped[str]     = mapped_column(PUUID, primary_key=True, default=new_uuid)
    code:       Mapped[str]     = mapped_column(String(20), unique=True, nullable=False)
    name:       Mapped[str]     = mapped_column(String(100), nullable=False)
    is_active:  Mapped[bool]    = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ExperimentExcelTemplate(Base):
    """Links an ExcelTemplate to a specific experiment (FIX-40)."""
    __tablename__ = "experiment_excel_templates"

    id:            Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str]           = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    template_id:   Mapped[str]           = mapped_column(PUUID, ForeignKey("excel_templates.id"), nullable=False)
    linked_at:     Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=now_utc)
    linked_by:     Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))


from app.models.user import User  # noqa: E402
