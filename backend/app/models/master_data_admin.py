"""Admin master data lookup tables — chemicals, instruments, sites."""
import uuid
from decimal import Decimal
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class LookupChemical(Base):
    """Reagents / solvents / chemicals reference catalogue."""
    __tablename__ = "lookup_chemicals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    chemical_name = Column(String(255), nullable=False)
    cas_no = Column(String(50), nullable=True)
    formula = Column(String(100), nullable=True)
    mol_wt = Column(Numeric(10, 4), nullable=True)
    vendor_name = Column(String(200), nullable=True)
    density = Column(Numeric(10, 4), nullable=True)
    purity_pct = Column(Numeric(5, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LookupInstrument(Base):
    """Instruments reference catalogue."""
    __tablename__ = "lookup_instruments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    instrument_code = Column(String(50), unique=True, nullable=False)
    instrument_type = Column(String(100), nullable=True)
    instrument_name = Column(String(200), nullable=False)
    maintenance_status = Column(String(50), nullable=True)
    calibration_status = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Site(Base):
    """Lab sites / locations."""
    __tablename__ = "sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
