import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Text, Date, JSON,
    DateTime, ForeignKey, Numeric, BigInteger, Index, UniqueConstraint, text,
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
    usage_type           = Column(String(50), nullable=True)
    movable              = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    gross_capacity       = Column(Numeric(12, 2), nullable=True)
    capacity_unit        = Column(String(50), nullable=True)
    description          = Column(Text, nullable=True)
    maintenance_status   = Column(String(20), nullable=False, default="OK")
    status               = Column(String(30), nullable=False, default="AVAILABLE")
    last_maintenance_date = Column(Date, nullable=True)
    next_maintenance_date = Column(Date, nullable=True)
    is_active            = Column(Boolean, nullable=False, default=True)
    created_at           = Column(DateTime, nullable=False, default=_now)
    updated_at           = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    equipment_type        = relationship("InvEquipmentType", back_populates="catalogue")


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
    usage_type            = Column(String(50), nullable=True)
    movable               = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    gross_capacity        = Column(Numeric(12, 2), nullable=True)
    capacity_unit         = Column(String(50), nullable=True)
    lower_operating_range = Column(Numeric(12, 4), nullable=True)
    lower_uom             = Column(String(50), nullable=True)
    upper_operating_range = Column(Numeric(12, 4), nullable=True)
    upper_uom             = Column(String(50), nullable=True)
    required_calibration  = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    description           = Column(Text, nullable=True)
    calibration_status    = Column(String(20), nullable=False, default="OK")
    status                = Column(String(30), nullable=False, default="AVAILABLE")
    last_calibration_date = Column(Date, nullable=True)
    next_calibration_date = Column(Date, nullable=True)
    is_active             = Column(Boolean, nullable=False, default=True)
    created_at            = Column(DateTime, nullable=False, default=_now)
    updated_at            = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    instrument_type        = relationship("InvInstrumentType", back_populates="catalogue")


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


# ── Checklist Templates (Phase 2) ─────────────────────────────────────────────
class InvChecklist(Base):
    __tablename__ = "inv_checklists"
    __table_args__ = (Index("ix_inv_checklists_status", "status"),)

    id             = Column(Integer, primary_key=True, autoincrement=True)
    name           = Column(String(255), nullable=False)
    checklist_type = Column(String(50), nullable=False)   # MAINTENANCE / EQUIPMENT_CLEANING / EQUIPMENT_CUSTOM / SCHEDULER / CALIBRATION
    log_type       = Column(String(30), nullable=False, default="CHECKLIST")  # CHECKLIST / SPREADSHEET
    usage_type     = Column(String(30), nullable=True)    # MFG / MAINT / PM ...
    target_kind    = Column(String(20), nullable=False, default="EQUIPMENT")  # EQUIPMENT / INSTRUMENT
    equipment_code = Column(String(100), nullable=True)   # optional reference captured at creation
    version        = Column(String(10), nullable=False, default="0.1")
    status         = Column(String(30), nullable=False, default="DRAFT")  # DRAFT / PENDING_VERIFICATION / PENDING_APPROVAL / APPROVED
    is_active      = Column(Boolean, nullable=False, default=True)
    created_by     = Column(String(200), nullable=True)
    created_at     = Column(DateTime, nullable=False, default=_now)
    updated_at     = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    items     = relationship("InvChecklistItem", back_populates="checklist",
                             cascade="all, delete-orphan", order_by="InvChecklistItem.seq_no")
    approvals = relationship("InvChecklistApproval", back_populates="checklist",
                             cascade="all, delete-orphan", order_by="InvChecklistApproval.performed_at")


class InvChecklistItem(Base):
    __tablename__ = "inv_checklist_items"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    checklist_id     = Column(Integer, ForeignKey("inv_checklists.id", ondelete="CASCADE"), nullable=False)
    seq_no           = Column(Integer, nullable=False, default=1)
    instruction_type = Column(String(20), nullable=False, default="INSTRUCTION")  # INSTRUCTION / HEADING
    data_type        = Column(String(30), nullable=True)  # OBSERVATION / TEXT / INPUT / SINGLE_SELECTION / MULTIPLE_SELECTION
    frequencies      = Column(JSON, nullable=True)         # ["MONTHLY","QUARTERLY","HALF_YEARLY","YEARLY"]
    precision        = Column(Integer, nullable=True)      # INPUT
    lower_limit      = Column(Numeric(14, 4), nullable=True)  # INPUT
    upper_limit      = Column(Numeric(14, 4), nullable=True)  # INPUT
    options          = Column(JSON, nullable=True)         # SINGLE/MULTIPLE selection: ["opt1","opt2"]
    details          = Column(Text, nullable=True)         # instruction/heading body
    created_at       = Column(DateTime, nullable=False, default=_now)

    checklist = relationship("InvChecklist", back_populates="items")


class InvChecklistApproval(Base):
    __tablename__ = "inv_checklist_approvals"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    checklist_id = Column(Integer, ForeignKey("inv_checklists.id", ondelete="CASCADE"), nullable=False)
    action       = Column(String(20), nullable=False)   # SUBMIT / VERIFY / APPROVE / REINITIATE
    from_state   = Column(String(30), nullable=True)
    to_state     = Column(String(30), nullable=True)
    performed_by = Column(String(200), nullable=False)
    comment      = Column(Text, nullable=True)
    performed_at = Column(DateTime, nullable=False, default=_now)

    checklist = relationship("InvChecklist", back_populates="approvals")


# ── Measurement Master / Log Mapping / Instrument Spec (Phase 3) ──────────────
class InvMeasurementMaster(Base):
    __tablename__ = "inv_measurement_master"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(255), nullable=False)
    data_type  = Column(String(20), nullable=False, default="DECIMAL")  # INTEGER / DECIMAL
    uom        = Column(String(50), nullable=True)
    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_now)


class InvLogMapping(Base):
    __tablename__ = "inv_log_mappings"
    __table_args__ = (
        Index("ix_inv_log_mappings_equipment_id", "equipment_id"),
        Index("ix_inv_log_mappings_instrument_id", "instrument_id"),
    )

    id              = Column(Integer, primary_key=True, autoincrement=True)
    equipment_id    = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=True)
    instrument_id   = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=True)
    log_type        = Column(String(30), nullable=False)  # MAINTENANCE / CLEANING / CALIBRATION
    checklist_id    = Column(Integer, ForeignKey("inv_checklists.id", ondelete="SET NULL"), nullable=True)
    tolerance_days  = Column(Integer, nullable=True)   # equipment logs
    alert_limit     = Column(Integer, nullable=True)   # instrument calibration
    deviation_limit = Column(Integer, nullable=True)   # instrument calibration
    created_by      = Column(String(200), nullable=True)
    created_at      = Column(DateTime, nullable=False, default=_now)
    updated_at      = Column(DateTime, nullable=False, default=_now, onupdate=_now)


class InvInstrumentParameter(Base):
    __tablename__ = "inv_instrument_parameters"
    __table_args__ = (Index("ix_inv_instrument_parameters_instrument_id", "instrument_id"),)

    id                        = Column(Integer, primary_key=True, autoincrement=True)
    instrument_id             = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=False)
    measurement_id            = Column(Integer, ForeignKey("inv_measurement_master.id", ondelete="SET NULL"), nullable=True)
    measurement_name          = Column(String(255), nullable=True)
    precision                 = Column(Integer, nullable=True)
    lower_unit                = Column(Numeric(14, 4), nullable=True)
    lower_uom                 = Column(String(50), nullable=True)
    upper_unit                = Column(Numeric(14, 4), nullable=True)
    upper_uom                 = Column(String(50), nullable=True)
    calibration_tolerance_pct = Column(Numeric(8, 4), nullable=True)
    seq_no                    = Column(Integer, nullable=False, default=1)
    created_at                = Column(DateTime, nullable=False, default=_now)


class InvInstrumentSpecDetail(Base):
    __tablename__ = "inv_instrument_spec_details"
    __table_args__ = (Index("ix_inv_instrument_spec_details_instrument_id", "instrument_id"),)

    id            = Column(Integer, primary_key=True, autoincrement=True)
    instrument_id = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=False)
    specification = Column(String(255), nullable=False)
    value         = Column(String(255), nullable=True)
    uom           = Column(String(50), nullable=True)
    seq_no        = Column(Integer, nullable=False, default=1)
    created_at    = Column(DateTime, nullable=False, default=_now)


# ── Schedules / Planner (Phase 4) ──────────────────────────────────────────────
class InvSchedule(Base):
    __tablename__ = "inv_schedules"
    __table_args__ = (
        Index("ix_inv_schedules_equipment_id", "equipment_id"),
        Index("ix_inv_schedules_instrument_id", "instrument_id"),
        Index("ix_inv_schedules_due_date", "due_date"),
    )

    id              = Column(Integer, primary_key=True, autoincrement=True)
    target_kind     = Column(String(20), nullable=False, default="EQUIPMENT")  # EQUIPMENT / INSTRUMENT
    equipment_id    = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=True)
    instrument_id   = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=True)
    log_type        = Column(String(30), nullable=False)  # MAINTENANCE / CLEANING / CALIBRATION
    checklist_id    = Column(Integer, ForeignKey("inv_checklists.id", ondelete="SET NULL"), nullable=True)
    schedule_type   = Column(String(20), nullable=False)  # MONTHLY / QUARTERLY / HALF_YEARLY / YEARLY
    due_date        = Column(Date, nullable=False)
    planned_date    = Column(Date, nullable=True)
    tolerance_days  = Column(Integer, nullable=True)
    alert_limit     = Column(Integer, nullable=True)
    deviation_limit = Column(Integer, nullable=True)
    done_on         = Column(Date, nullable=True)
    status          = Column(String(20), nullable=False, default="DUE")  # DUE / PLANNED / DONE / CANCELLED
    source          = Column(String(20), nullable=False, default="MANUAL")  # MANUAL / EXCEL_UPLOAD / AUTO_GENERATED
    created_by      = Column(String(200), nullable=True)
    created_at      = Column(DateTime, nullable=False, default=_now)
    updated_at      = Column(DateTime, nullable=False, default=_now, onupdate=_now)


# ── Spare Parts / Work Orders (Phase 5) ───────────────────────────────────────
class InvSparePart(Base):
    __tablename__ = "inv_spare_parts"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    part_code   = Column(String(100), unique=True, nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime, nullable=False, default=_now)


class InvWorkOrder(Base):
    __tablename__ = "inv_work_orders"
    __table_args__ = (
        Index("ix_inv_work_orders_equipment_id", "equipment_id"),
        Index("ix_inv_work_orders_instrument_id", "instrument_id"),
        Index("ix_inv_work_orders_status", "status"),
    )

    id               = Column(Integer, primary_key=True, autoincrement=True)
    workorder_no     = Column(String(50), unique=True, nullable=False)
    target_kind      = Column(String(20), nullable=False, default="EQUIPMENT")  # EQUIPMENT / INSTRUMENT
    equipment_id     = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=True)
    instrument_id    = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=True)
    schedule_id      = Column(Integer, ForeignKey("inv_schedules.id", ondelete="SET NULL"), nullable=True)
    checklist_id     = Column(Integer, ForeignKey("inv_checklists.id", ondelete="SET NULL"), nullable=True)
    kind             = Column(String(20), nullable=False)  # PLANNED / UNPLANNED / BREAKDOWN
    log_type         = Column(String(30), nullable=False)  # MAINTENANCE / CLEANING / CALIBRATION
    status           = Column(String(30), nullable=False, default="RAISED")
    # RAISED / IN_PROGRESS / PENDING_VERIFICATION / PENDING_APPROVAL / APPROVED
    deviation        = Column(Boolean, nullable=False, default=False)
    remarks          = Column(Text, nullable=True)
    maintenance_type = Column(String(10), nullable=True)  # MAJOR / MINOR (breakdown)
    breakdown_description = Column(Text, nullable=True)
    spare_parts_used = Column(Boolean, nullable=True)
    calibration_source = Column(String(10), nullable=True)  # INTERNAL / EXTERNAL (instrument calibration only)
    certificate_no   = Column(String(100), nullable=True)  # external calibration certificate reference
    raised_by        = Column(String(200), nullable=True)
    raised_at        = Column(DateTime, nullable=True)
    started_by       = Column(String(200), nullable=True)
    started_at       = Column(DateTime, nullable=True)
    ended_by         = Column(String(200), nullable=True)
    ended_at         = Column(DateTime, nullable=True)
    verified_by      = Column(String(200), nullable=True)
    verified_at      = Column(DateTime, nullable=True)
    approved_by      = Column(String(200), nullable=True)
    approved_at      = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, nullable=False, default=_now)
    updated_at       = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    results       = relationship("InvWorkOrderResult", back_populates="work_order", cascade="all, delete-orphan")
    signatures    = relationship("InvWorkOrderSignature", back_populates="work_order", cascade="all, delete-orphan",
                                  order_by="InvWorkOrderSignature.completed_on")
    spares_used   = relationship("InvWorkOrderSpare", back_populates="work_order", cascade="all, delete-orphan")
    calib_references = relationship("InvCalibrationReference", back_populates="work_order", cascade="all, delete-orphan")


class InvWorkOrderResult(Base):
    __tablename__ = "inv_work_order_results"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    work_order_id     = Column(Integer, ForeignKey("inv_work_orders.id", ondelete="CASCADE"), nullable=False)
    checklist_item_id = Column(Integer, ForeignKey("inv_checklist_items.id", ondelete="SET NULL"), nullable=True)
    observation       = Column(String(255), nullable=True)
    comment           = Column(Text, nullable=True)
    done_by           = Column(String(200), nullable=True)
    done_at           = Column(DateTime, nullable=True)

    work_order = relationship("InvWorkOrder", back_populates="results")


class InvWorkOrderSignature(Base):
    __tablename__ = "inv_work_order_signatures"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    work_order_id = Column(Integer, ForeignKey("inv_work_orders.id", ondelete="CASCADE"), nullable=False)
    signing_for   = Column(String(100), nullable=False)
    name          = Column(String(200), nullable=False)
    comments      = Column(Text, nullable=True)
    completed_on  = Column(DateTime, nullable=False, default=_now)

    work_order = relationship("InvWorkOrder", back_populates="signatures")


class InvWorkOrderSpare(Base):
    __tablename__ = "inv_work_order_spares"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    work_order_id  = Column(Integer, ForeignKey("inv_work_orders.id", ondelete="CASCADE"), nullable=False)
    spare_part_id  = Column(Integer, ForeignKey("inv_spare_parts.id", ondelete="SET NULL"), nullable=True)
    part_code      = Column(String(100), nullable=False)

    work_order = relationship("InvWorkOrder", back_populates="spares_used")


class InvCalibrationReference(Base):
    __tablename__ = "inv_calibration_references"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    work_order_id    = Column(Integer, ForeignKey("inv_work_orders.id", ondelete="CASCADE"), nullable=False)
    measurement_id   = Column(Integer, ForeignKey("inv_measurement_master.id", ondelete="SET NULL"), nullable=True)
    measurement_name = Column(String(255), nullable=True)
    reference_inst_id = Column(String(100), nullable=True)
    reference_reading = Column(Numeric(14, 4), nullable=True)
    instrument_reading = Column(Numeric(14, 4), nullable=True)
    variance_pct     = Column(Numeric(8, 4), nullable=True)
    tolerance_pct    = Column(Numeric(8, 4), nullable=True)
    status           = Column(String(10), nullable=True)  # PASS / FAIL
    done_by          = Column(String(200), nullable=True)
    done_at          = Column(DateTime, nullable=True)

    work_order = relationship("InvWorkOrder", back_populates="calib_references")


# ── Usage Logs (Phase 7) ──────────────────────────────────────────────────────
class InvUsageLog(Base):
    __tablename__ = "inv_usage_logs"
    __table_args__ = (
        Index("ix_inv_usage_logs_equipment_id", "equipment_id"),
        Index("ix_inv_usage_logs_instrument_id", "instrument_id"),
    )

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    target_kind          = Column(String(20), nullable=False, default="EQUIPMENT")  # EQUIPMENT / INSTRUMENT
    equipment_id         = Column(Integer, ForeignKey("inv_equipment_catalogue.id", ondelete="CASCADE"), nullable=True)
    instrument_id        = Column(Integer, ForeignKey("inv_instrument_catalogue.id", ondelete="CASCADE"), nullable=True)
    previous_product_code = Column(String(100), nullable=True)
    previous_batch_no    = Column(String(100), nullable=True)
    reference_no         = Column(String(100), nullable=True)
    document_name        = Column(String(255), nullable=True)
    usage_remarks        = Column(Text, nullable=True)
    status                = Column(String(20), nullable=False, default="IN_USE")  # IN_USE / AVAILABLE / ...
    started_by           = Column(String(200), nullable=True)
    started_at           = Column(DateTime, nullable=True)
    ended_by             = Column(String(200), nullable=True)
    ended_at             = Column(DateTime, nullable=True)
    source                = Column(String(20), nullable=False, default="MANUAL")  # MANUAL / EXPERIMENT
    experiment_id         = Column(UUID(as_uuid=True), nullable=True)  # forward-compatible; no FK yet (Phase 7 follow-up)
    created_at            = Column(DateTime, nullable=False, default=_now)
    updated_at            = Column(DateTime, nullable=False, default=_now, onupdate=_now)


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
