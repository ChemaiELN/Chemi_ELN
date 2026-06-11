"""
Inventory Master — Equipment / Instrument / Column Catalogue Pydantic schemas
"""
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Equipment Catalogue ───────────────────────────────────────────────────────

class EquipmentCatalogueCreate(BaseModel):
    asset_id:             str
    name:                 str
    equipment_type_id:    Optional[int]  = None
    serial_no:            Optional[str]  = None
    manufacturer:         Optional[str]  = None
    model:                Optional[str]  = None
    location:             Optional[str]  = None
    purchase_date:        Optional[date] = None
    last_maintenance_date: Optional[date] = None
    maintenance_due_date: Optional[date] = None
    maintenance_status:   str            = "OK"
    status:               str            = "ACTIVE"


class EquipmentCatalogueUpdate(BaseModel):
    name:                 Optional[str]  = None
    equipment_type_id:    Optional[int]  = None
    serial_no:            Optional[str]  = None
    manufacturer:         Optional[str]  = None
    model:                Optional[str]  = None
    location:             Optional[str]  = None
    purchase_date:        Optional[date] = None
    last_maintenance_date: Optional[date] = None
    maintenance_due_date: Optional[date] = None
    maintenance_status:   Optional[str]  = None
    status:               Optional[str]  = None


class EquipmentCatalogueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                   int
    asset_id:             str
    name:                 str
    equipment_type_id:    Optional[int]  = None
    serial_no:            Optional[str]  = None
    manufacturer:         Optional[str]  = None
    model:                Optional[str]  = None
    location:             Optional[str]  = None
    purchase_date:        Optional[date] = None
    last_maintenance_date: Optional[date] = None
    maintenance_due_date: Optional[date] = None
    maintenance_status:   str
    status:               str
    is_active:            bool

    # denormalised
    equipment_type_name: Optional[str] = None
    equipment_type_code: Optional[str] = None


# ── Instrument Catalogue ──────────────────────────────────────────────────────

class InstrumentCatalogueCreate(BaseModel):
    asset_id:              str
    name:                  str
    instrument_type_id:    Optional[int]  = None
    serial_no:             Optional[str]  = None
    manufacturer:          Optional[str]  = None
    model:                 Optional[str]  = None
    location:              Optional[str]  = None
    purchase_date:         Optional[date] = None
    last_calibration_date: Optional[date] = None
    calibration_due_date:  Optional[date] = None
    calibration_status:    str            = "OK"
    status:                str            = "ACTIVE"


class InstrumentCatalogueUpdate(BaseModel):
    name:                  Optional[str]  = None
    instrument_type_id:    Optional[int]  = None
    serial_no:             Optional[str]  = None
    manufacturer:          Optional[str]  = None
    model:                 Optional[str]  = None
    location:              Optional[str]  = None
    purchase_date:         Optional[date] = None
    last_calibration_date: Optional[date] = None
    calibration_due_date:  Optional[date] = None
    calibration_status:    Optional[str]  = None
    status:                Optional[str]  = None


class InstrumentCatalogueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                    int
    asset_id:              str
    name:                  str
    instrument_type_id:    Optional[int]  = None
    serial_no:             Optional[str]  = None
    manufacturer:          Optional[str]  = None
    model:                 Optional[str]  = None
    location:              Optional[str]  = None
    purchase_date:         Optional[date] = None
    last_calibration_date: Optional[date] = None
    calibration_due_date:  Optional[date] = None
    calibration_status:    str
    status:                str
    is_active:             bool

    # denormalised
    instrument_type_name: Optional[str] = None
    instrument_type_code: Optional[str] = None


# ── Column Catalogue ──────────────────────────────────────────────────────────

class ColumnCatalogueCreate(BaseModel):
    column_id:             str
    name:                  str
    column_type_id:        Optional[int] = None
    serial_no:             Optional[str] = None
    manufacturer:          Optional[str] = None
    part_no:               Optional[str] = None
    purchased_date:        Optional[date] = None
    max_injections:        Optional[int] = 500
    cumulative_injections: int           = 0
    status:                str           = "ACTIVE"


class ColumnCatalogueUpdate(BaseModel):
    name:                  Optional[str]  = None
    column_type_id:        Optional[int]  = None
    serial_no:             Optional[str]  = None
    manufacturer:          Optional[str]  = None
    part_no:               Optional[str]  = None
    purchased_date:        Optional[date] = None
    max_injections:        Optional[int]  = None
    cumulative_injections: Optional[int]  = None
    status:                Optional[str]  = None


class ColumnCatalogueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                    int
    column_id:             str
    name:                  str
    column_type_id:        Optional[int]  = None
    serial_no:             Optional[str]  = None
    manufacturer:          Optional[str]  = None
    part_no:               Optional[str]  = None
    purchased_date:        Optional[date] = None
    max_injections:        Optional[int]  = None
    cumulative_injections: int
    status:                str
    is_active:             bool

    # denormalised
    column_type_name: Optional[str] = None
    column_type_code: Optional[str] = None

    # computed
    injections_remaining: Optional[int] = None
