"""Pydantic schemas for inventory module (Phase B2)."""
from __future__ import annotations
import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


# ── Shared ────────────────────────────────────────────────────────────────────
class _OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Storage Conditions ───────────────────────────────────────────────────────
class StorageConditionCreate(BaseModel):
    label: str
    temperature_min: Optional[Decimal] = None
    temperature_max: Optional[Decimal] = None
    temperature_unit: str = "°C"
    description: Optional[str] = None
    sort_order: int = 0


class StorageConditionUpdate(BaseModel):
    label: Optional[str] = None
    temperature_min: Optional[Decimal] = None
    temperature_max: Optional[Decimal] = None
    temperature_unit: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class StorageConditionOut(_OrmBase):
    id: int
    label: str
    temperature_min: Optional[Decimal] = None
    temperature_max: Optional[Decimal] = None
    temperature_unit: str
    description: Optional[str] = None
    sort_order: int
    is_active: bool


# ── Consumable Types (read-only in B2, seeded) ────────────────────────────────
class ConsumableTypeOut(_OrmBase):
    id: int
    name: str
    description: Optional[str] = None
    sort_order: int
    is_active: bool


# ── Materials ─────────────────────────────────────────────────────────────────
class MaterialCreate(BaseModel):
    code: str
    name: str
    material_type: Optional[str] = None
    cas_no: Optional[str] = None
    molecular_formula: Optional[str] = None
    mol_weight: Optional[Decimal] = None
    storage_condition: Optional[str] = None
    hazard_class: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    consumable_type_id: Optional[int] = None


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    material_type: Optional[str] = None
    cas_no: Optional[str] = None
    molecular_formula: Optional[str] = None
    mol_weight: Optional[Decimal] = None
    storage_condition: Optional[str] = None
    hazard_class: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    consumable_type_id: Optional[int] = None


class ChemicalPropsOut(_OrmBase):
    purity_pct: Optional[Decimal] = None
    grade: Optional[str] = None
    appearance: Optional[str] = None
    solubility: Optional[str] = None
    boiling_pt: Optional[Decimal] = None
    melting_pt: Optional[Decimal] = None
    flash_pt: Optional[Decimal] = None
    density: Optional[Decimal] = None
    ph_range: Optional[str] = None


class ChemicalPropsUpsert(BaseModel):
    purity_pct: Optional[Decimal] = None
    grade: Optional[str] = None
    appearance: Optional[str] = None
    solubility: Optional[str] = None
    boiling_pt: Optional[Decimal] = None
    melting_pt: Optional[Decimal] = None
    flash_pt: Optional[Decimal] = None
    density: Optional[Decimal] = None
    ph_range: Optional[str] = None


class FormulationPropsOut(_OrmBase):
    role: Optional[str] = None
    concentration: Optional[Decimal] = None
    units: Optional[str] = None
    function: Optional[str] = None
    compatibility_notes: Optional[str] = None


class FormulationPropsUpsert(BaseModel):
    role: Optional[str] = None
    concentration: Optional[Decimal] = None
    units: Optional[str] = None
    function: Optional[str] = None
    compatibility_notes: Optional[str] = None


class MaterialOut(_OrmBase):
    id: int
    code: str
    name: str
    material_type: Optional[str] = None
    cas_no: Optional[str] = None
    molecular_formula: Optional[str] = None
    mol_weight: Optional[Decimal] = None
    storage_condition: Optional[str] = None
    hazard_class: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    department_id: Optional[UUID] = None
    consumable_type_id: Optional[int] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    chemical_props: Optional[ChemicalPropsOut] = None
    formulation_props: Optional[FormulationPropsOut] = None


# ── Manufacturers ─────────────────────────────────────────────────────────────
class ManufacturerCreate(BaseModel):
    code: str
    name: str
    country: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None


class ManufacturerUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None


class ManufacturerOut(_OrmBase):
    id: int
    code: str
    name: str
    country: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── Mappings ──────────────────────────────────────────────────────────────────
class MappingCreate(BaseModel):
    material_id: int
    manufacturer_id: int
    catalogue_no: Optional[str] = None
    technical_grade: Optional[str] = None
    lead_time_days: Optional[int] = None
    min_order_qty: Optional[Decimal] = None


class MappingUpdate(BaseModel):
    catalogue_no: Optional[str] = None
    technical_grade: Optional[str] = None
    lead_time_days: Optional[int] = None
    min_order_qty: Optional[Decimal] = None


class MappingOut(_OrmBase):
    id: int
    material_id: int
    manufacturer_id: int
    catalogue_no: Optional[str] = None
    technical_grade: Optional[str] = None
    lead_time_days: Optional[int] = None
    min_order_qty: Optional[Decimal] = None
    dsd_file_path: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── Equipment / Instrument / Column Types (shared shape) ──────────────────────
class TypeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class TypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TypeOut(_OrmBase):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime


class ColumnTypeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    length_mm: Optional[Decimal] = None
    particle_size_um: Optional[Decimal] = None
    pore_size_angstrom: Optional[Decimal] = None


class ColumnTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    length_mm: Optional[Decimal] = None
    particle_size_um: Optional[Decimal] = None
    pore_size_angstrom: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ColumnTypeOut(_OrmBase):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    length_mm: Optional[Decimal] = None
    particle_size_um: Optional[Decimal] = None
    pore_size_angstrom: Optional[Decimal] = None
    is_active: bool
    created_at: datetime.datetime


# ── Equipment Catalogue ───────────────────────────────────────────────────────
class EquipmentCatalogueCreate(BaseModel):
    asset_id: str
    equipment_type_id: Optional[int] = None
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    next_maintenance_date: Optional[datetime.date] = None


class EquipmentCatalogueUpdate(BaseModel):
    equipment_type_id: Optional[int] = None
    name: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    maintenance_status: Optional[str] = None
    status: Optional[str] = None
    last_maintenance_date: Optional[datetime.date] = None
    next_maintenance_date: Optional[datetime.date] = None


class EquipmentCatalogueOut(_OrmBase):
    id: int
    asset_id: str
    equipment_type_id: Optional[int] = None
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    maintenance_status: str
    status: str
    last_maintenance_date: Optional[datetime.date] = None
    next_maintenance_date: Optional[datetime.date] = None
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── Instrument Catalogue ──────────────────────────────────────────────────────
class InstrumentCatalogueCreate(BaseModel):
    asset_id: str
    instrument_type_id: Optional[int] = None
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    next_calibration_date: Optional[datetime.date] = None


class InstrumentCatalogueUpdate(BaseModel):
    instrument_type_id: Optional[int] = None
    name: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    calibration_status: Optional[str] = None
    status: Optional[str] = None
    last_calibration_date: Optional[datetime.date] = None
    next_calibration_date: Optional[datetime.date] = None


class InstrumentCatalogueOut(_OrmBase):
    id: int
    asset_id: str
    instrument_type_id: Optional[int] = None
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    calibration_status: str
    status: str
    last_calibration_date: Optional[datetime.date] = None
    next_calibration_date: Optional[datetime.date] = None
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── Column Catalogue ──────────────────────────────────────────────────────────
class ColumnCatalogueCreate(BaseModel):
    column_id: str
    column_type_id: Optional[int] = None
    name: str
    serial_no: Optional[str] = None
    lot_no: Optional[str] = None
    max_injections: int = 500


class ColumnCatalogueUpdate(BaseModel):
    column_type_id: Optional[int] = None
    name: Optional[str] = None
    serial_no: Optional[str] = None
    lot_no: Optional[str] = None
    max_injections: Optional[int] = None
    cumulative_injections: Optional[int] = None
    status: Optional[str] = None


class ColumnCatalogueOut(_OrmBase):
    id: int
    column_id: str
    column_type_id: Optional[int] = None
    name: str
    serial_no: Optional[str] = None
    lot_no: Optional[str] = None
    max_injections: int
    cumulative_injections: int
    injections_remaining: int = 0
    status: str
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ══════════════════════════════════════════════════════════════════════════════
# Phase B3 schemas
# ══════════════════════════════════════════════════════════════════════════════

# ── Batch Packs ───────────────────────────────────────────────────────────────
class BatchPackOut(_OrmBase):
    id: int
    batch_id: int
    seq_no: int
    pack_no: str
    qty_per_pack: Decimal
    inhouse_batch_no: str


# ── Batches ───────────────────────────────────────────────────────────────────
class BatchCreate(BaseModel):
    batch_no: str
    material_id: int
    manufacturer_id: Optional[int] = None
    qty_received: Decimal
    unit: str = "g"
    measuring_unit: Optional[str] = None
    measuring_unit_value: Optional[Decimal] = None
    include_pack: bool = False
    pack_number: Optional[int] = None
    inhouse_batch_no: Optional[str] = None
    mfg_date: Optional[datetime.date] = None
    expiry_date: Optional[datetime.date] = None
    retest_date: Optional[datetime.date] = None
    gr_date: Optional[datetime.date] = None
    pack_type: Optional[str] = None
    pack_mode: Optional[str] = None
    location: Optional[str] = None
    invoice_no: Optional[str] = None
    po_no: Optional[str] = None
    clone: Optional[str] = None
    iso_type: Optional[str] = None
    price: Optional[Decimal] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime.datetime] = None
    remarks: Optional[str] = None


class BatchUpdate(BaseModel):
    manufacturer_id: Optional[int] = None
    unit: Optional[str] = None
    measuring_unit: Optional[str] = None
    measuring_unit_value: Optional[Decimal] = None
    status: Optional[str] = None
    category: Optional[str] = None
    mfg_date: Optional[datetime.date] = None
    expiry_date: Optional[datetime.date] = None
    retest_date: Optional[datetime.date] = None
    gr_date: Optional[datetime.date] = None
    pack_type: Optional[str] = None
    pack_mode: Optional[str] = None
    location: Optional[str] = None
    invoice_no: Optional[str] = None
    po_no: Optional[str] = None
    clone: Optional[str] = None
    iso_type: Optional[str] = None
    price: Optional[Decimal] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime.datetime] = None
    remarks: Optional[str] = None


class BatchOut(_OrmBase):
    id: int
    batch_no: str
    material_id: int
    manufacturer_id: Optional[int] = None
    qty_received: Decimal
    qty_available: Decimal
    unit: str
    status: str
    category: str
    measuring_unit: Optional[str] = None
    measuring_unit_value: Optional[Decimal] = None
    include_pack: bool
    pack_number: Optional[int] = None
    inhouse_batch_no: Optional[str] = None
    mfg_date: Optional[datetime.date] = None
    expiry_date: Optional[datetime.date] = None
    retest_date: Optional[datetime.date] = None
    gr_date: Optional[datetime.date] = None
    coa_file_path: Optional[str] = None
    other_docs_file_path: Optional[str] = None
    pack_type: Optional[str] = None
    pack_mode: Optional[str] = None
    location: Optional[str] = None
    invoice_no: Optional[str] = None
    po_no: Optional[str] = None
    clone: Optional[str] = None
    iso_type: Optional[str] = None
    price: Optional[Decimal] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime.datetime] = None
    remarks: Optional[str] = None
    coa_filename: Optional[str] = None
    other_docs_filename: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    packs: list[BatchPackOut] = []
    manufacturer_name: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def _extract_manufacturer_name(cls, data):
        if not isinstance(data, dict):
            mfr = getattr(data, 'manufacturer', None)
            if mfr is not None:
                data.__dict__['manufacturer_name'] = getattr(mfr, 'name', None)
        return data


class BatchIssueRequest(BaseModel):
    qty: Decimal
    issued_to: Optional[str] = None
    purpose: Optional[str] = None
    project_code: Optional[str] = None
    ref_no: Optional[str] = None
    module: Optional[str] = None
    remarks: Optional[str] = None


class BatchAllocateRequest(BaseModel):
    qty: Decimal
    ref_no: Optional[str] = None
    module: Optional[str] = None
    issued_to: Optional[str] = None
    purpose: Optional[str] = None
    project_code: Optional[str] = None
    remarks: Optional[str] = None


class BatchEventOut(_OrmBase):
    id: int
    batch_id: int
    event_type: str
    qty: Optional[Decimal] = None
    ref_no: Optional[str] = None
    module: Optional[str] = None
    issued_to: Optional[str] = None
    purpose: Optional[str] = None
    project_code: Optional[str] = None
    performed_by: str
    performed_at: datetime.datetime
    remarks: Optional[str] = None


# ── Batch Verifications ───────────────────────────────────────────────────────
class BatchVerificationCreate(BaseModel):
    batch_id: int
    remarks: Optional[str] = None


class BatchVerificationAction(BaseModel):
    remarks: Optional[str] = None


class BatchVerificationOut(_OrmBase):
    id: int
    request_no: str
    batch_id: int
    requested_by: str
    requested_at: datetime.datetime
    verified_by: Optional[str] = None
    verified_at: Optional[datetime.datetime] = None
    status: str
    remarks: Optional[str] = None


# ── Stock Requests ────────────────────────────────────────────────────────────
class StockRequestCreate(BaseModel):
    material_id: int
    qty_required: Decimal
    unit: str = "g"
    criticality: str = "MEDIUM"
    required_by_date: Optional[datetime.date] = None
    purpose: Optional[str] = None
    requested_by: Optional[str] = None
    remarks: Optional[str] = None


class StockRequestUpdate(BaseModel):
    qty_required: Optional[Decimal] = None
    unit: Optional[str] = None
    criticality: Optional[str] = None
    required_by_date: Optional[datetime.date] = None
    purpose: Optional[str] = None
    requested_by: Optional[str] = None
    remarks: Optional[str] = None


class StockRequestAction(BaseModel):
    remarks: Optional[str] = None


class StockRequestEventOut(_OrmBase):
    id: int
    request_id: int
    event_type: str
    performed_by: str
    performed_at: datetime.datetime
    remarks: Optional[str] = None


class StockRequestOut(_OrmBase):
    id: int
    request_no: str
    material_id: int
    qty_required: Decimal
    unit: str
    criticality: str
    status: str
    required_by_date: Optional[datetime.date] = None
    purpose: Optional[str] = None
    requested_by: Optional[str] = None
    requested_at: Optional[datetime.datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime.datetime] = None
    remarks: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    events: list[StockRequestEventOut] = []


# ── Maintenance Schedules ─────────────────────────────────────────────────────
class MaintenanceScheduleCreate(BaseModel):
    equipment_id: int
    scheduled_date: datetime.date
    notes: Optional[str] = None


class MaintenanceScheduleUpdate(BaseModel):
    scheduled_date: Optional[datetime.date] = None
    notes: Optional[str] = None


class MaintenanceCompleteRequest(BaseModel):
    completed_date: datetime.date
    notes: Optional[str] = None


class MaintenanceScheduleOut(_OrmBase):
    id: int
    equipment_id: int
    scheduled_date: datetime.date
    completed_date: Optional[datetime.date] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── Calibration Schedules ─────────────────────────────────────────────────────
class CalibrationScheduleCreate(BaseModel):
    instrument_id: int
    scheduled_date: datetime.date
    certificate_no: Optional[str] = None


class CalibrationScheduleUpdate(BaseModel):
    scheduled_date: Optional[datetime.date] = None
    certificate_no: Optional[str] = None


class CalibrationCompleteRequest(BaseModel):
    completed_date: datetime.date
    certificate_no: Optional[str] = None


class CalibrationScheduleOut(_OrmBase):
    id: int
    instrument_id: int
    scheduled_date: datetime.date
    completed_date: Optional[datetime.date] = None
    certificate_no: Optional[str] = None
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── Equipment / Instrument Verifications ──────────────────────────────────────
class EquipVerificationCreate(BaseModel):
    equipment_id: int
    remarks: Optional[str] = None


class InstrVerificationCreate(BaseModel):
    instrument_id: int
    remarks: Optional[str] = None


class VerificationAction(BaseModel):
    remarks: Optional[str] = None


class EquipVerificationOut(_OrmBase):
    id: int
    request_no: str
    equipment_id: int
    requested_by: str
    requested_at: datetime.datetime
    verified_by: Optional[str] = None
    verified_at: Optional[datetime.datetime] = None
    status: str
    remarks: Optional[str] = None


class InstrVerificationOut(_OrmBase):
    id: int
    request_no: str
    instrument_id: int
    requested_by: str
    requested_at: datetime.datetime
    verified_by: Optional[str] = None
    verified_at: Optional[datetime.datetime] = None
    status: str
    remarks: Optional[str] = None


# ── General Lookup ────────────────────────────────────────────────────────────
class LookupCreate(BaseModel):
    lookup_type: str
    lookup_value: str
    lookup_code: str


class LookupUpdate(BaseModel):
    lookup_value: Optional[str] = None
    lookup_code: Optional[str] = None


class LookupOut(_OrmBase):
    id: int
    lookup_type: str
    lookup_value: str
    lookup_code: str
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ── UOM Master ────────────────────────────────────────────────────────────────
class UomDimensionCreate(BaseModel):
    dimension_key: str
    display_name: str
    base_unit: str
    sort_order: int = 0


class UomDimensionUpdate(BaseModel):
    display_name: Optional[str] = None
    base_unit: Optional[str] = None
    sort_order: Optional[int] = None


class UomUnitCreate(BaseModel):
    symbol: str
    name: str
    sort_order: int = 0


class UomUnitUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class UomUnitOut(_OrmBase):
    id: int
    dimension_id: int
    symbol: str
    name: str
    sort_order: int
    is_active: bool


class UomDimensionOut(_OrmBase):
    id: int
    dimension_key: str
    display_name: str
    base_unit: str
    sort_order: int
    is_active: bool
    units: list[UomUnitOut] = []


# ── Consumable Types (full CRUD) ───────────────────────────────────────────────
class ConsumableTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class ConsumableTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


# ── Test Master ───────────────────────────────────────────────────────────────
class TestTypeCreate(BaseModel):
    type_key: str
    name: str


class TestTypeUpdate(BaseModel):
    name: Optional[str] = None


class TestNameCreate(BaseModel):
    name: str


class TestNameUpdate(BaseModel):
    name: Optional[str] = None


class TestMethodCreate(BaseModel):
    method_name: str


class TestMethodUpdate(BaseModel):
    method_name: Optional[str] = None


class TestMethodOut(_OrmBase):
    id: int
    test_name_id: int
    method_name: str


class TestNameOut(_OrmBase):
    id: int
    test_type_id: int
    name: str
    methods: list[TestMethodOut] = []


class TestTypeOut(_OrmBase):
    id: int
    type_key: str
    name: str
    names: list[TestNameOut] = []


# ── Dashboard ─────────────────────────────────────────────────────────────────
class DashboardKPIs(BaseModel):
    active_materials: int
    available_batches: int
    low_stock: int
    expiring_soon: int
    expired: int
    pending_stock_requests: int
    critical_stock_requests: int
    maintenance_due: int
    calibration_due: int
    pending_verifications: int
