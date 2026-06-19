from __future__ import annotations
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


# ── Chemical Props ────────────────────────────────────────────────────────────

class ChemicalPropsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:          int
    material_id: int
    purity_pct:  Optional[Decimal] = None
    grade:       Optional[str]     = None
    appearance:  Optional[str]     = None
    solubility:  Optional[str]     = None
    boiling_pt:  Optional[str]     = None
    melting_pt:  Optional[str]     = None
    flash_pt:    Optional[str]     = None
    density:     Optional[Decimal] = None
    ph_range:    Optional[str]     = None


class ChemicalPropsUpsert(BaseModel):
    purity_pct:  Optional[Decimal] = None
    grade:       Optional[str]     = None
    appearance:  Optional[str]     = None
    solubility:  Optional[str]     = None
    boiling_pt:  Optional[str]     = None
    melting_pt:  Optional[str]     = None
    flash_pt:    Optional[str]     = None
    density:     Optional[Decimal] = None
    ph_range:    Optional[str]     = None


# ── Formulation Props ─────────────────────────────────────────────────────────

class FormulationPropsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                  int
    material_id:         int
    role:                Optional[str] = None
    concentration:       Optional[str] = None
    units:               Optional[str] = None
    function:            Optional[str] = None
    compatibility_notes: Optional[str] = None


class FormulationPropsUpsert(BaseModel):
    role:                Optional[str] = None
    concentration:       Optional[str] = None
    units:               Optional[str] = None
    function:            Optional[str] = None
    compatibility_notes: Optional[str] = None


# ── Material ──────────────────────────────────────────────────────────────────

class MaterialCreate(BaseModel):
    code:              str
    name:              str
    material_type:     Optional[str]     = None
    cas_no:            Optional[str]     = None
    molecular_formula: Optional[str]     = None
    mol_weight:        Optional[Decimal] = None
    storage_condition: Optional[str]     = None
    hazard_class:      Optional[str]     = None
    description:       Optional[str]     = None
    is_active:         bool              = True
    department_id:     Optional[str]     = None


class MaterialUpdate(BaseModel):
    name:              Optional[str]     = None
    material_type:     Optional[str]     = None
    cas_no:            Optional[str]     = None
    molecular_formula: Optional[str]     = None
    mol_weight:        Optional[Decimal] = None
    storage_condition: Optional[str]     = None
    hazard_class:      Optional[str]     = None
    description:       Optional[str]     = None
    is_active:         Optional[bool]    = None
    department_id:     Optional[str]     = None


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                int
    code:              str
    name:              str
    material_type:     Optional[str]     = None
    cas_no:            Optional[str]     = None
    molecular_formula: Optional[str]     = None
    mol_weight:        Optional[Decimal] = None
    storage_condition: Optional[str]     = None
    hazard_class:      Optional[str]     = None
    description:       Optional[str]     = None
    is_active:         bool
    department_id:     Optional[str]     = None
    chemical_props:    Optional[ChemicalPropsOut]    = None
    formulation_props: Optional[FormulationPropsOut] = None
