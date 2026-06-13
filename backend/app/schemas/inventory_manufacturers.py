from __future__ import annotations
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


# ── Manufacturer ──────────────────────────────────────────────────────────────

class ManufacturerCreate(BaseModel):
    code:           str
    name:           str
    country:        Optional[str] = None
    contact_person: Optional[str] = None
    email:          Optional[str] = None
    phone:          Optional[str] = None
    website:        Optional[str] = None
    address:        Optional[str] = None
    is_active:      bool          = True


class ManufacturerUpdate(BaseModel):
    name:           Optional[str]  = None
    country:        Optional[str]  = None
    contact_person: Optional[str]  = None
    email:          Optional[str]  = None
    phone:          Optional[str]  = None
    website:        Optional[str]  = None
    address:        Optional[str]  = None
    is_active:      Optional[bool] = None


class ManufacturerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:             int
    code:           str
    name:           str
    country:        Optional[str] = None
    contact_person: Optional[str] = None
    email:          Optional[str] = None
    phone:          Optional[str] = None
    website:        Optional[str] = None
    address:        Optional[str] = None
    is_active:      bool


# ── Manufacturer Mapping ──────────────────────────────────────────────────────

class MappingCreate(BaseModel):
    material_id:     int
    manufacturer_id: int
    catalogue_no:    Optional[str]     = None
    technical_grade: Optional[str]     = None
    lead_time_days:  Optional[int]     = None
    min_order_qty:   Optional[Decimal] = None


class MappingUpdate(BaseModel):
    catalogue_no:    Optional[str]     = None
    technical_grade: Optional[str]     = None
    lead_time_days:  Optional[int]     = None
    min_order_qty:   Optional[Decimal] = None


class MappingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:              int
    material_id:     int
    manufacturer_id: int
    catalogue_no:    Optional[str]     = None
    technical_grade: Optional[str]     = None
    lead_time_days:  Optional[int]     = None
    min_order_qty:   Optional[Decimal] = None
    # Joined fields — populated by router
    material_name:     Optional[str] = None
    material_code:     Optional[str] = None
    manufacturer_name: Optional[str] = None
    manufacturer_code: Optional[str] = None
