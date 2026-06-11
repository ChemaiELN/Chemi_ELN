from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


# ── Master type tables ────────────────────────────────────────────────────────

class InvEquipmentType(Base):
    __tablename__ = "inv_equipment_types"

    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String(50), unique=True, nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)

    equipment = relationship("InvEquipmentCatalogue", back_populates="equipment_type")


class InvInstrumentType(Base):
    __tablename__ = "inv_instrument_types"

    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String(50), unique=True, nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)

    instruments = relationship("InvInstrumentCatalogue", back_populates="instrument_type")


class InvColumnType(Base):
    __tablename__ = "inv_column_types"

    id                   = Column(Integer, primary_key=True, index=True)
    code                 = Column(String(50), unique=True, nullable=False, index=True)
    name                 = Column(String(255), nullable=False)
    description          = Column(Text, nullable=True)
    length_mm            = Column(Numeric(8, 2), nullable=True)
    particle_size_um     = Column(Numeric(8, 2), nullable=True)
    pore_size_angstrom   = Column(Numeric(8, 2), nullable=True)
    is_active            = Column(Boolean, default=True, nullable=False)

    columns = relationship("InvColumnCatalogue", back_populates="column_type")


# ── Catalogue tables ──────────────────────────────────────────────────────────

class InvEquipmentCatalogue(Base):
    __tablename__ = "inv_equipment_catalogue"

    id                    = Column(Integer, primary_key=True, index=True)
    asset_id              = Column(String(100), unique=True, nullable=False, index=True)
    name                  = Column(String(255), nullable=False)
    equipment_type_id     = Column(Integer, ForeignKey("inv_equipment_types.id"), nullable=True)
    serial_no             = Column(String(100), nullable=True)
    manufacturer          = Column(String(200), nullable=True)
    model                 = Column(String(200), nullable=True)
    location              = Column(String(200), nullable=True)
    purchase_date         = Column(Date, nullable=True)
    last_maintenance_date = Column(Date, nullable=True)
    maintenance_due_date  = Column(Date, nullable=True)
    # maintenance_status: OK, DUE, OVERDUE
    maintenance_status    = Column(String(20), nullable=False, default="OK")
    # status: ACTIVE, INACTIVE, UNDER_MAINTENANCE, DECOMMISSIONED
    status                = Column(String(30), nullable=False, default="ACTIVE")
    is_active             = Column(Boolean, default=True, nullable=False)

    equipment_type    = relationship("InvEquipmentType", back_populates="equipment")
    maintenance_schedules = relationship("InvMaintenanceSchedule", back_populates="equipment", cascade="all, delete-orphan")
    verifications     = relationship("InvEquipmentVerification", back_populates="equipment", cascade="all, delete-orphan")


class InvInstrumentCatalogue(Base):
    __tablename__ = "inv_instrument_catalogue"

    id                   = Column(Integer, primary_key=True, index=True)
    asset_id             = Column(String(100), unique=True, nullable=False, index=True)
    name                 = Column(String(255), nullable=False)
    instrument_type_id   = Column(Integer, ForeignKey("inv_instrument_types.id"), nullable=True)
    serial_no            = Column(String(100), nullable=True)
    manufacturer         = Column(String(200), nullable=True)
    model                = Column(String(200), nullable=True)
    location             = Column(String(200), nullable=True)
    purchase_date        = Column(Date, nullable=True)
    last_calibration_date = Column(Date, nullable=True)
    calibration_due_date = Column(Date, nullable=True)
    # calibration_status: OK, DUE, EXPIRED
    calibration_status   = Column(String(20), nullable=False, default="OK")
    # status: ACTIVE, INACTIVE, UNDER_CALIBRATION, DECOMMISSIONED
    status               = Column(String(30), nullable=False, default="ACTIVE")
    is_active            = Column(Boolean, default=True, nullable=False)

    instrument_type      = relationship("InvInstrumentType", back_populates="instruments")
    calibration_schedules = relationship("InvCalibrationSchedule", back_populates="instrument", cascade="all, delete-orphan")
    verifications        = relationship("InvInstrumentVerification", back_populates="instrument", cascade="all, delete-orphan")


class InvColumnCatalogue(Base):
    __tablename__ = "inv_column_catalogue"

    id                    = Column(Integer, primary_key=True, index=True)
    column_id             = Column(String(100), unique=True, nullable=False, index=True)
    name                  = Column(String(255), nullable=False)
    column_type_id        = Column(Integer, ForeignKey("inv_column_types.id"), nullable=True)
    serial_no             = Column(String(100), nullable=True)
    manufacturer          = Column(String(200), nullable=True)
    part_no               = Column(String(100), nullable=True)
    purchased_date        = Column(Date, nullable=True)
    max_injections        = Column(Integer, nullable=True, default=500)
    cumulative_injections = Column(Integer, nullable=False, default=0)
    # status: ACTIVE, INACTIVE, EXHAUSTED, RETIRED
    status                = Column(String(20), nullable=False, default="ACTIVE")
    is_active             = Column(Boolean, default=True, nullable=False)

    column_type = relationship("InvColumnType", back_populates="columns")


# ── Schedule & verification tables ────────────────────────────────────────────

class InvMaintenanceSchedule(Base):
    __tablename__ = "inv_maintenance_schedules"

    id               = Column(Integer, primary_key=True, index=True)
    equipment_id     = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=False)
    maintenance_type = Column(String(100), nullable=True)
    scheduled_date   = Column(Date, nullable=False)
    completed_date   = Column(Date, nullable=True)
    technician       = Column(String(200), nullable=True)
    # status: DUE, IN_PROGRESS, COMPLETED, CANCELLED
    status           = Column(String(20), nullable=False, default="DUE")
    notes            = Column(Text, nullable=True)

    equipment = relationship("InvEquipmentCatalogue", back_populates="maintenance_schedules")


class InvCalibrationSchedule(Base):
    __tablename__ = "inv_calibration_schedules"

    id               = Column(Integer, primary_key=True, index=True)
    instrument_id    = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=False)
    calibration_type = Column(String(100), nullable=True)
    scheduled_date   = Column(Date, nullable=False)
    completed_date   = Column(Date, nullable=True)
    technician       = Column(String(200), nullable=True)
    certificate_no   = Column(String(100), nullable=True)
    # status: DUE, COMPLETED, CANCELLED
    status           = Column(String(20), nullable=False, default="DUE")
    notes            = Column(Text, nullable=True)

    instrument = relationship("InvInstrumentCatalogue", back_populates="calibration_schedules")


class InvEquipmentVerification(Base):
    __tablename__ = "inv_equipment_verifications"

    id           = Column(Integer, primary_key=True, index=True)
    request_no   = Column(String(100), unique=True, nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(String(200), nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_by  = Column(String(200), nullable=True)
    verified_at  = Column(DateTime(timezone=True), nullable=True)
    # status: PENDING, VERIFIED, REJECTED
    status       = Column(String(20), nullable=False, default="PENDING")
    remarks      = Column(Text, nullable=True)

    equipment = relationship("InvEquipmentCatalogue", back_populates="verifications")


class InvInstrumentVerification(Base):
    __tablename__ = "inv_instrument_verifications"

    id            = Column(Integer, primary_key=True, index=True)
    request_no    = Column(String(100), unique=True, nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=False)
    requested_by  = Column(String(200), nullable=True)
    requested_at  = Column(DateTime(timezone=True), server_default=func.now())
    verified_by   = Column(String(200), nullable=True)
    verified_at   = Column(DateTime(timezone=True), nullable=True)
    # status: PENDING, VERIFIED, REJECTED
    status        = Column(String(20), nullable=False, default="PENDING")
    remarks       = Column(Text, nullable=True)

    instrument = relationship("InvInstrumentCatalogue", back_populates="verifications")


# ── Audit Trail ───────────────────────────────────────────────────────────────

class InvAuditTrail(Base):
    __tablename__ = "inv_audit_trail"

    id           = Column(Integer, primary_key=True, index=True)
    # event_type: MATERIAL_CREATED, BATCH_RECEIVED, BATCH_ISSUED, etc.
    event_type   = Column(String(100), nullable=False, index=True)
    # entity_type: material, batch, stock_request, equipment, etc.
    entity_type  = Column(String(50), nullable=False)
    entity_id    = Column(Integer, nullable=True)
    entity_ref   = Column(String(200), nullable=True)   # human-readable ref (batch_no, code, etc.)
    performed_by = Column(String(200), nullable=True)
    performed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    old_value    = Column(Text, nullable=True)
    new_value    = Column(Text, nullable=True)
    details      = Column(Text, nullable=True)
