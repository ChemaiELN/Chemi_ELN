"""
Inventory Master — Equipment / Instrument / Column Type Pydantic schemas
"""
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Equipment Type ────────────────────────────────────────────────────────────

class EquipmentTypeCreate(BaseModel):
    code:        str
    name:        str
    description: Optional[str] = None


class EquipmentTypeUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None


class EquipmentTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          int
    code:        str
    name:        str
    description: Optional[str] = None
    is_active:   bool


# ── Instrument Type ───────────────────────────────────────────────────────────

class InstrumentTypeCreate(BaseModel):
    code:        str
    name:        str
    description: Optional[str] = None


class InstrumentTypeUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None


class InstrumentTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          int
    code:        str
    name:        str
    description: Optional[str] = None
    is_active:   bool


# ── Column Type ───────────────────────────────────────────────────────────────

class ColumnTypeCreate(BaseModel):
    code:                str
    name:                str
    description:         Optional[str]     = None
    length_mm:           Optional[Decimal] = None
    particle_size_um:    Optional[Decimal] = None
    pore_size_angstrom:  Optional[Decimal] = None


class ColumnTypeUpdate(BaseModel):
    name:                Optional[str]     = None
    description:         Optional[str]     = None
    length_mm:           Optional[Decimal] = None
    particle_size_um:    Optional[Decimal] = None
    pore_size_angstrom:  Optional[Decimal] = None


class ColumnTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                  int
    code:                str
    name:                str
    description:         Optional[str]     = None
    length_mm:           Optional[Decimal] = None
    particle_size_um:    Optional[Decimal] = None
    pore_size_angstrom:  Optional[Decimal] = None
    is_active:           bool
