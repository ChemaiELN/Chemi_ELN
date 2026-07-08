import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Text, Date,
    DateTime, ForeignKey, Numeric, BigInteger, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import relationship
from app.database import Base

def _now():
    return datetime.datetime.utcnow()


# ── PostgreSQL native enum (DDL managed by migration) ─────────────────────────
measuring_unit_enum = ENUM(
    "molarity", "concentration", "percentage", "ipa",
    name="measuring_unit_enum",
    create_type=False,
)


# ── Storage Conditions ───────────────────────────────────────────────────────
class InvStorageCondition(Base):
    __tablename__ = "inv_storage_conditions"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    label            = Column(String(100), unique=True, nullable=False)
    temperature_min  = Column(Numeric(6, 1), nullable=True)
    temperature_max  = Column(Numeric(6, 1), nullable=True)
    temperature_unit = Column(String(10), nullable=False, default="°C")
    description      = Column(Text, nullable=True)
    sort_order       = Column(Integer, nullable=False, default=0)
    is_active        = Column(Boolean, nullable=False, default=True)
    created_at       = Column(DateTime, nullable=False, default=_now)
    updated_at       = Column(DateTime, nullable=False, default=_now, onupdate=_now)


# ── Consumable Types ──────────────────────────────────────────────────────────
class InvConsumableType(Base):
    __tablename__ = "inv_consumable_types"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    sort_order  = Column(Integer, nullable=False, default=0)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime, nullable=False, default=_now)
    updated_at  = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    materials = relationship("InvMaterial", back_populates="consumable_type")


# ── Materials ─────────────────────────────────────────────────────────────────
class InvMaterial(Base):
    __tablename__ = "inv_materials"
    __table_args__ = (
        Index("ix_inv_materials_code", "code"),
    )

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    code                = Column(String(50), unique=True, nullable=False)
    name                = Column(String(255), nullable=False)
    material_type       = Column(String(100), nullable=True)
    cas_no              = Column(String(100), nullable=True)
    molecular_formula   = Column(String(200), nullable=True)
    mol_weight          = Column(Numeric(12, 4), nullable=True)
    storage_condition   = Column(String(200), nullable=True)
    hazard_class        = Column(String(100), nullable=True)
    description         = Column(Text, nullable=True)
    is_active           = Column(Boolean, nullable=False, default=True)
    department_id       = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    consumable_type_id  = Column(Integer, ForeignKey("inv_consumable_types.id", ondelete="SET NULL"), nullable=True)
    created_at          = Column(DateTime, nullable=False, default=_now)
    updated_at          = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    consumable_type      = relationship("InvConsumableType", back_populates="materials")
    chemical_props       = relationship("InvMaterialChemicalProps", back_populates="material", uselist=False, cascade="all, delete-orphan")
    formulation_props    = relationship("InvMaterialFormulationProps", back_populates="material", uselist=False, cascade="all, delete-orphan")
    manufacturer_mappings = relationship("InvManufacturerMapping", back_populates="material", cascade="all, delete-orphan")
    batches              = relationship("InvBatch", back_populates="material")
    stock_requests       = relationship("InvStockRequest", back_populates="material")


class InvMaterialChemicalProps(Base):
    __tablename__ = "inv_material_chemical_props"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("inv_materials.id", ondelete="CASCADE"), unique=True, nullable=False)
    purity_pct  = Column(Numeric(6, 2), nullable=True)
    grade       = Column(String(100), nullable=True)
    appearance  = Column(String(200), nullable=True)
    solubility  = Column(String(200), nullable=True)
    boiling_pt  = Column(Numeric(8, 2), nullable=True)
    melting_pt  = Column(Numeric(8, 2), nullable=True)
    flash_pt    = Column(Numeric(8, 2), nullable=True)
    density     = Column(Numeric(8, 4), nullable=True)
    ph_range    = Column(String(50), nullable=True)

    material = relationship("InvMaterial", back_populates="chemical_props")


class InvMaterialFormulationProps(Base):
    __tablename__ = "inv_material_formulation_props"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    material_id         = Column(Integer, ForeignKey("inv_materials.id", ondelete="CASCADE"), unique=True, nullable=False)
    role                = Column(String(100), nullable=True)
    concentration       = Column(Numeric(10, 4), nullable=True)
    units               = Column(String(50), nullable=True)
    function            = Column(String(200), nullable=True)
    compatibility_notes = Column(Text, nullable=True)

    material = relationship("InvMaterial", back_populates="formulation_props")


# ── Manufacturers & Mappings ───────────────────────────────────────────────────
class InvManufacturer(Base):
    __tablename__ = "inv_manufacturers"
    __table_args__ = (
        Index("ix_inv_manufacturers_code", "code"),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    code           = Column(String(50), unique=True, nullable=False)
    name           = Column(String(255), nullable=False)
    country        = Column(String(100), nullable=True)
    contact_person = Column(String(200), nullable=True)
    email          = Column(String(255), nullable=True)
    phone          = Column(String(50), nullable=True)
    website        = Column(String(255), nullable=True)
    address        = Column(Text, nullable=True)
    is_active      = Column(Boolean, nullable=False, default=True)
    created_at     = Column(DateTime, nullable=False, default=_now)
    updated_at     = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    mappings = relationship("InvManufacturerMapping", back_populates="manufacturer", cascade="all, delete-orphan")
    batches  = relationship("InvBatch", back_populates="manufacturer")


class InvManufacturerMapping(Base):
    __tablename__ = "inv_manufacturer_mapping"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    material_id     = Column(Integer, ForeignKey("inv_materials.id", ondelete="CASCADE"), nullable=False)
    manufacturer_id = Column(Integer, ForeignKey("inv_manufacturers.id", ondelete="CASCADE"), nullable=False)
    catalogue_no    = Column(String(100), nullable=True)
    technical_grade = Column(String(100), nullable=True)
    lead_time_days  = Column(Integer, nullable=True)
    min_order_qty   = Column(Numeric(10, 3), nullable=True)
    dsd_file_path   = Column(String(500), nullable=True)
    created_at      = Column(DateTime, nullable=False, default=_now)
    updated_at      = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    material     = relationship("InvMaterial", back_populates="manufacturer_mappings")
    manufacturer = relationship("InvManufacturer", back_populates="mappings")


# ── Inhouse Batch Number Counter — global per year, shared across all prefixes ─
class InvBatchNoCounter(Base):
    __tablename__ = "inv_batch_no_counter"
    year     = Column(String(2), primary_key=True)
    last_seq = Column(Integer, nullable=False, default=10000)


# ── Material Code Counter — global per year (MAT/{YY}/{SEQ}) ──────────────────
class InvMaterialCodeCounter(Base):
    __tablename__ = "inv_material_code_counter"
    year     = Column(String(2), primary_key=True)
    last_seq = Column(Integer, nullable=False, default=10000)


# ── Batch Number Counter — global per year (MCE/{YY}/{SEQ}) ───────────────────
class InvBatchNumberCounter(Base):
    __tablename__ = "inv_batch_number_counter"
    year     = Column(String(2), primary_key=True)
    last_seq = Column(Integer, nullable=False, default=0)


# ── Batches ───────────────────────────────────────────────────────────────────
class InvBatch(Base):
    __tablename__ = "inv_batches"
    __table_args__ = (
        Index("ix_inv_batches_inhouse_batch_no", "inhouse_batch_no"),
    )

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    batch_no             = Column(String(100), unique=True, nullable=False, index=True)
    material_id          = Column(Integer, ForeignKey("inv_materials.id"), nullable=False)
    manufacturer_id      = Column(Integer, ForeignKey("inv_manufacturers.id"), nullable=True)
    qty_received         = Column(Numeric(12, 4), nullable=False)
    qty_available        = Column(Numeric(12, 4), nullable=False)
    unit                 = Column(String(20), nullable=False, default="g")
    status               = Column(String(30), nullable=False, default="AVAILABLE")
    category             = Column(String(30), nullable=False, default="available")
    measuring_unit       = Column(measuring_unit_enum, nullable=True)
    measuring_unit_value = Column(Numeric(12, 4), nullable=True)
    include_pack         = Column(Boolean, nullable=False, default=False)
    pack_number          = Column(Integer, nullable=True)
    pack_type            = Column(String(100), nullable=True)
    pack_mode            = Column(String(20), nullable=True)
    inhouse_batch_no     = Column(String(100), nullable=True)
    mfg_date             = Column(Date, nullable=True)
    expiry_date          = Column(Date, nullable=True)
    retest_date          = Column(Date, nullable=True)
    gr_date              = Column(Date, nullable=True)
    location             = Column(String(200), nullable=True)
    invoice_no           = Column(String(100), nullable=True)
    po_no                = Column(String(100), nullable=True)
    clone                = Column(String(200), nullable=True)
    iso_type             = Column(String(50), nullable=True)
    price                = Column(Numeric(14, 4), nullable=True)
    received_by          = Column(String(200), nullable=True)
    received_at          = Column(DateTime, nullable=True)
    remarks              = Column(Text, nullable=True)
    coa_file_path        = Column(String(500), nullable=True)
    coa_filename         = Column(String(255), nullable=True)
    other_docs_file_path = Column(String(500), nullable=True)
    other_docs_filename  = Column(String(255), nullable=True)
    created_at           = Column(DateTime, nullable=False, default=_now)
    updated_at           = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    material      = relationship("InvMaterial", back_populates="batches")
    manufacturer  = relationship("InvManufacturer", back_populates="batches")
    events        = relationship("InvBatchEvent", back_populates="batch", cascade="all, delete-orphan")
    packs         = relationship("InvBatchPack", back_populates="batch", cascade="all, delete-orphan")
    verifications = relationship("InvBatchVerification", back_populates="batch", cascade="all, delete-orphan")


class InvBatchEvent(Base):
    __tablename__ = "inv_batch_events"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    batch_id     = Column(Integer, ForeignKey("inv_batches.id", ondelete="CASCADE"), nullable=False)
    event_type   = Column(String(30), nullable=False)
    qty          = Column(Numeric(12, 4), nullable=True)
    ref_no       = Column(String(100), nullable=True)
    module       = Column(String(100), nullable=True)
    issued_to    = Column(String(200), nullable=True)
    purpose      = Column(String(500), nullable=True)
    project_code = Column(String(100), nullable=True)
    performed_by = Column(String(200), nullable=False)
    performed_at = Column(DateTime, nullable=False, default=_now)
    remarks      = Column(Text, nullable=True)

    batch = relationship("InvBatch", back_populates="events")


class InvBatchPack(Base):
    __tablename__ = "inv_batch_packs"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    batch_id         = Column(Integer, ForeignKey("inv_batches.id", ondelete="CASCADE"), nullable=False)
    seq_no           = Column(Integer, nullable=False)
    pack_no          = Column(String(100), nullable=False)
    qty_per_pack     = Column(Numeric(12, 4), nullable=False)
    qty_available    = Column(Numeric(12, 4), nullable=False)
    inhouse_batch_no = Column(String(100), nullable=False)

    batch = relationship("InvBatch", back_populates="packs")


class InvBatchVerification(Base):
    __tablename__ = "inv_batch_verifications"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    request_no   = Column(String(100), unique=True, nullable=False, index=True)
    batch_id     = Column(Integer, ForeignKey("inv_batches.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(String(200), nullable=False)
    requested_at = Column(DateTime, nullable=False, default=_now)
    verified_by  = Column(String(200), nullable=True)
    verified_at  = Column(DateTime, nullable=True)
    status       = Column(String(20), nullable=False, default="PENDING")
    remarks      = Column(Text, nullable=True)

    batch = relationship("InvBatch", back_populates="verifications")


# ── Stock Requests ────────────────────────────────────────────────────────────
class InvStockRequest(Base):
    __tablename__ = "inv_stock_requests"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    request_no       = Column(String(100), unique=True, nullable=False, index=True)
    material_id      = Column(Integer, ForeignKey("inv_materials.id"), nullable=False)
    qty_required     = Column(Numeric(12, 4), nullable=False)
    unit             = Column(String(20), nullable=False, default="g")
    required_by_date = Column(Date, nullable=True)
    criticality      = Column(String(20), nullable=False, default="MEDIUM")
    purpose          = Column(Text, nullable=True)
    requested_by     = Column(String(200), nullable=True)
    requested_at     = Column(DateTime, nullable=True)
    approved_by      = Column(String(200), nullable=True)
    approved_at      = Column(DateTime, nullable=True)
    status           = Column(String(20), nullable=False, default="PENDING")
    remarks          = Column(Text, nullable=True)
    created_at       = Column(DateTime, nullable=False, default=_now)
    updated_at       = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    material = relationship("InvMaterial", back_populates="stock_requests")
    events   = relationship("InvStockRequestEvent", back_populates="request", cascade="all, delete-orphan")


class InvStockRequestEvent(Base):
    __tablename__ = "inv_stock_request_events"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    request_id   = Column(Integer, ForeignKey("inv_stock_requests.id", ondelete="CASCADE"), nullable=False)
    event_type   = Column(String(30), nullable=False)
    performed_by = Column(String(200), nullable=False)
    performed_at = Column(DateTime, nullable=False, default=_now)
    remarks      = Column(Text, nullable=True)

    request = relationship("InvStockRequest", back_populates="events")


# ── Equipment / Instrument / Column Types ─────────────────────────────────────
class InvEquipmentType(Base):
    __tablename__ = "inv_equipment_types"
    __table_args__ = (Index("ix_inv_equipment_types_code", "code"),)

    id          = Column(Integer, primary_key=True, autoincrement=True)
    code        = Column(String(50), unique=True, nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime, nullable=False, default=_now)

    catalogue = relationship("InvEquipmentCatalogue", back_populates="equipment_type")


class InvInstrumentType(Base):
    __tablename__ = "inv_instrument_types"
    __table_args__ = (Index("ix_inv_instrument_types_code", "code"),)

    id          = Column(Integer, primary_key=True, autoincrement=True)
    code        = Column(String(50), unique=True, nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime, nullable=False, default=_now)

    catalogue = relationship("InvInstrumentCatalogue", back_populates="instrument_type")


class InvColumnType(Base):
    __tablename__ = "inv_column_types"
    __table_args__ = (Index("ix_inv_column_types_code", "code"),)

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    code               = Column(String(50), unique=True, nullable=False)
    name               = Column(String(255), nullable=False)
    description        = Column(Text, nullable=True)
    length_mm          = Column(Numeric(8, 2), nullable=True)
    particle_size_um   = Column(Numeric(8, 2), nullable=True)
    pore_size_angstrom = Column(Numeric(8, 2), nullable=True)
    is_active          = Column(Boolean, nullable=False, default=True)
    created_at         = Column(DateTime, nullable=False, default=_now)

    catalogue = relationship("InvColumnCatalogue", back_populates="column_type")


# ── Equipment / Instrument / Column Catalogue ─────────────────────────────────
class InvEquipmentCatalogue(Base):
    __tablename__ = "inv_equipment_catalogue"
    __table_args__ = (Index("ix_inv_equipment_catalogue_asset_id", "asset_id"),)

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    asset_id             = Column(String(100), unique=True, nullable=False)
    equipment_type_id    = Column(Integer, ForeignKey("inv_equipment_types.id", ondelete="SET NULL"), nullable=True)
    name                 = Column(String(255), nullable=False)
    make                 = Column(String(100), nullable=True)
    model                = Column(String(100), nullable=True)
    serial_no            = Column(String(100), nullable=True)
    location             = Column(String(200), nullable=True)
    maintenance_status   = Column(String(20), nullable=False, default="OK")
    status               = Column(String(30), nullable=False, default="ACTIVE")
    last_maintenance_date = Column(Date, nullable=True)
    next_maintenance_date = Column(Date, nullable=True)
    is_active            = Column(Boolean, nullable=False, default=True)
    created_at           = Column(DateTime, nullable=False, default=_now)
    updated_at           = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    equipment_type        = relationship("InvEquipmentType", back_populates="catalogue")
    maintenance_schedules = relationship("InvMaintenanceSchedule", back_populates="equipment", cascade="all, delete-orphan")
    verifications         = relationship("InvEquipmentVerification", back_populates="equipment", cascade="all, delete-orphan")


class InvInstrumentCatalogue(Base):
    __tablename__ = "inv_instrument_catalogue"
    __table_args__ = (Index("ix_inv_instrument_catalogue_asset_id", "asset_id"),)

    id                    = Column(Integer, primary_key=True, autoincrement=True)
    asset_id              = Column(String(100), unique=True, nullable=False)
    instrument_type_id    = Column(Integer, ForeignKey("inv_instrument_types.id", ondelete="SET NULL"), nullable=True)
    name                  = Column(String(255), nullable=False)
    make                  = Column(String(100), nullable=True)
    model                 = Column(String(100), nullable=True)
    serial_no             = Column(String(100), nullable=True)
    location              = Column(String(200), nullable=True)
    calibration_status    = Column(String(20), nullable=False, default="OK")
    status                = Column(String(30), nullable=False, default="ACTIVE")
    last_calibration_date = Column(Date, nullable=True)
    next_calibration_date = Column(Date, nullable=True)
    is_active             = Column(Boolean, nullable=False, default=True)
    created_at            = Column(DateTime, nullable=False, default=_now)
    updated_at            = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    instrument_type        = relationship("InvInstrumentType", back_populates="catalogue")
    calibration_schedules  = relationship("InvCalibrationSchedule", back_populates="instrument", cascade="all, delete-orphan")
    verifications          = relationship("InvInstrumentVerification", back_populates="instrument", cascade="all, delete-orphan")


class InvColumnCatalogue(Base):
    __tablename__ = "inv_column_catalogue"
    __table_args__ = (Index("ix_inv_column_catalogue_column_id", "column_id"),)

    id                    = Column(Integer, primary_key=True, autoincrement=True)
    column_id             = Column(String(100), unique=True, nullable=False)
    column_type_id        = Column(Integer, ForeignKey("inv_column_types.id", ondelete="SET NULL"), nullable=True)
    name                  = Column(String(255), nullable=False)
    serial_no             = Column(String(100), nullable=True)
    lot_no                = Column(String(100), nullable=True)
    max_injections        = Column(Integer, nullable=False, default=500)
    cumulative_injections = Column(Integer, nullable=False, default=0)
    status                = Column(String(20), nullable=False, default="ACTIVE")
    is_active             = Column(Boolean, nullable=False, default=True)
    created_at            = Column(DateTime, nullable=False, default=_now)
    updated_at            = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    column_type = relationship("InvColumnType", back_populates="catalogue")


# ── Schedules ─────────────────────────────────────────────────────────────────
class InvMaintenanceSchedule(Base):
    __tablename__ = "inv_maintenance_schedules"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    equipment_id   = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    completed_date = Column(Date, nullable=True)
    notes          = Column(Text, nullable=True)
    status         = Column(String(20), nullable=False, default="DUE")
    created_at     = Column(DateTime, nullable=False, default=_now)
    updated_at     = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    equipment = relationship("InvEquipmentCatalogue", back_populates="maintenance_schedules")


class InvCalibrationSchedule(Base):
    __tablename__ = "inv_calibration_schedules"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    instrument_id  = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    completed_date = Column(Date, nullable=True)
    certificate_no = Column(String(100), nullable=True)
    status         = Column(String(20), nullable=False, default="DUE")
    created_at     = Column(DateTime, nullable=False, default=_now)
    updated_at     = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    instrument = relationship("InvInstrumentCatalogue", back_populates="calibration_schedules")


# ── Verifications ─────────────────────────────────────────────────────────────
class InvEquipmentVerification(Base):
    __tablename__ = "inv_equipment_verifications"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    request_no   = Column(String(100), unique=True, nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(String(200), nullable=False)
    requested_at = Column(DateTime, nullable=False, default=_now)
    verified_by  = Column(String(200), nullable=True)
    verified_at  = Column(DateTime, nullable=True)
    status       = Column(String(20), nullable=False, default="PENDING")
    remarks      = Column(Text, nullable=True)

    equipment = relationship("InvEquipmentCatalogue", back_populates="verifications")


class InvInstrumentVerification(Base):
    __tablename__ = "inv_instrument_verifications"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    request_no    = Column(String(100), unique=True, nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=False)
    requested_by  = Column(String(200), nullable=False)
    requested_at  = Column(DateTime, nullable=False, default=_now)
    verified_by   = Column(String(200), nullable=True)
    verified_at   = Column(DateTime, nullable=True)
    status        = Column(String(20), nullable=False, default="PENDING")
    remarks       = Column(Text, nullable=True)

    instrument = relationship("InvInstrumentCatalogue", back_populates="verifications")


# ── Audit Trail ───────────────────────────────────────────────────────────────
class InvAuditTrail(Base):
    __tablename__ = "inv_audit_trail"
    __table_args__ = (
        Index("ix_inv_audit_trail_event_type", "event_type"),
        Index("ix_inv_audit_trail_performed_at", "performed_at"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    event_type   = Column(String(50), nullable=False)
    entity_type  = Column(String(50), nullable=False)
    entity_id    = Column(String(100), nullable=True)
    entity_ref   = Column(String(200), nullable=True)
    performed_by = Column(String(200), nullable=False)
    performed_at = Column(DateTime, nullable=False, default=_now)
    old_value    = Column(Text, nullable=True)
    new_value    = Column(Text, nullable=True)
    details      = Column(Text, nullable=True)


# ── General Lookup ────────────────────────────────────────────────────────────
class InvGeneralLookup(Base):
    __tablename__ = "inv_general_lookup"
    __table_args__ = (
        Index("ix_inv_general_lookup_type", "lookup_type"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    lookup_type  = Column(String(100), nullable=False)
    lookup_value = Column(String(255), nullable=False)
    lookup_code  = Column(String(100), nullable=False)
    is_active    = Column(Boolean, nullable=False, default=True)
    created_by   = Column(String(200), nullable=True)
    created_at   = Column(DateTime, nullable=False, default=_now)
    updated_at   = Column(DateTime, nullable=False, default=_now, onupdate=_now)


# ── UOM Master ────────────────────────────────────────────────────────────────
class InvUomDimension(Base):
    __tablename__ = "inv_uom_dimensions"
    __table_args__ = (Index("ix_inv_uom_dimensions_key", "dimension_key"),)

    id            = Column(Integer, primary_key=True, autoincrement=True)
    dimension_key = Column(String(100), unique=True, nullable=False)
    display_name  = Column(String(200), nullable=False)
    base_unit     = Column(String(50), nullable=False)
    sort_order    = Column(Integer, nullable=False, default=0)
    is_active     = Column(Boolean, nullable=False, default=True)

    units = relationship("InvUomUnit", back_populates="dimension", cascade="all, delete-orphan")


class InvUomUnit(Base):
    __tablename__ = "inv_uom_units"
    __table_args__ = (Index("ix_inv_uom_units_dimension_id", "dimension_id"),)

    id           = Column(Integer, primary_key=True, autoincrement=True)
    dimension_id = Column(Integer, ForeignKey("inv_uom_dimensions.id", ondelete="CASCADE"), nullable=False)
    symbol       = Column(String(50), nullable=False)
    name         = Column(String(100), nullable=True)
    sort_order   = Column(Integer, nullable=False, default=0)
    is_active    = Column(Boolean, nullable=False, default=True)

    dimension = relationship("InvUomDimension", back_populates="units")


# ── Test Master ───────────────────────────────────────────────────────────────
class InvTestType(Base):
    __tablename__ = "inv_test_types"
    __table_args__ = (Index("ix_inv_test_types_key", "type_key"),)

    id       = Column(Integer, primary_key=True, autoincrement=True)
    type_key = Column(String(100), unique=True, nullable=False)
    name     = Column(String(255), nullable=False)

    names = relationship("InvTestName", back_populates="test_type", cascade="all, delete-orphan")


class InvTestName(Base):
    __tablename__ = "inv_test_names"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    test_type_id = Column(Integer, ForeignKey("inv_test_types.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(255), nullable=False)

    test_type = relationship("InvTestType", back_populates="names")
    methods   = relationship("InvTestMethod", back_populates="test_name", cascade="all, delete-orphan")


class InvTestMethod(Base):
    __tablename__ = "inv_test_methods"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    test_name_id = Column(Integer, ForeignKey("inv_test_names.id", ondelete="CASCADE"), nullable=False)
    method_name  = Column(String(255), nullable=False)

    test_name = relationship("InvTestName", back_populates="methods")
