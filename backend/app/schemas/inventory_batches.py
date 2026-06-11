"""
Inventory Master — Batch Pydantic schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── Batch Event ───────────────────────────────────────────────────────────────

class BatchEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    batch_id:     int
    event_type:   str
    qty:          Optional[Decimal] = None
    ref_no:       Optional[str]     = None
    module:       Optional[str]     = None
    issued_to:    Optional[str]     = None
    purpose:      Optional[str]     = None
    project_code: Optional[str]     = None
    performed_by: Optional[str]     = None
    performed_at: Optional[datetime] = None
    remarks:      Optional[str]     = None


class BatchEventCreate(BaseModel):
    event_type:   str
    qty:          Optional[Decimal] = None
    ref_no:       Optional[str]     = None
    module:       Optional[str]     = None
    issued_to:    Optional[str]     = None
    purpose:      Optional[str]     = None
    project_code: Optional[str]     = None
    remarks:      Optional[str]     = None


# ── Issue / Allocate request body ─────────────────────────────────────────────

class IssueRequest(BaseModel):
    qty:          Decimal
    issued_to:    Optional[str] = None
    module:       Optional[str] = None
    purpose:      Optional[str] = None
    project_code: Optional[str] = None
    ref_no:       Optional[str] = None
    remarks:      Optional[str] = None


class AllocateRequest(BaseModel):
    qty:          Decimal
    project_code: str
    module:       Optional[str] = None
    purpose:      Optional[str] = None
    ref_no:       Optional[str] = None
    remarks:      Optional[str] = None


# ── Batch ─────────────────────────────────────────────────────────────────────

class BatchCreate(BaseModel):
    batch_no:        str
    material_id:     int
    manufacturer_id: Optional[int]    = None
    qty_received:    Decimal
    qty_available:   Optional[Decimal] = None   # defaults to qty_received if omitted
    unit:            str               = "g"
    location:        Optional[str]     = None
    mfg_date:        Optional[date]    = None
    expiry_date:     Optional[date]    = None
    retest_date:     Optional[date]    = None
    invoice_no:      Optional[str]     = None
    po_no:           Optional[str]     = None
    remarks:         Optional[str]     = None
    status:          str               = "AVAILABLE"
    category:        str               = "available"
    received_by:     Optional[str]     = None


class BatchUpdate(BaseModel):
    location:    Optional[str]     = None
    mfg_date:    Optional[date]    = None
    expiry_date: Optional[date]    = None
    retest_date: Optional[date]    = None
    invoice_no:  Optional[str]     = None
    po_no:       Optional[str]     = None
    remarks:     Optional[str]     = None
    status:      Optional[str]     = None
    category:    Optional[str]     = None
    unit:        Optional[str]     = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    batch_no:        str
    material_id:     int
    manufacturer_id: Optional[int]     = None
    qty_received:    Decimal
    qty_available:   Decimal
    unit:            str
    location:        Optional[str]     = None
    mfg_date:        Optional[date]    = None
    expiry_date:     Optional[date]    = None
    retest_date:     Optional[date]    = None
    invoice_no:      Optional[str]     = None
    po_no:           Optional[str]     = None
    remarks:         Optional[str]     = None
    status:          str
    category:        str
    received_by:     Optional[str]     = None
    received_at:     Optional[datetime] = None
    is_active:       bool

    # denormalised (filled by router)
    material_name:      Optional[str] = None
    material_code:      Optional[str] = None
    manufacturer_name:  Optional[str] = None

    # nested events (returned on single-batch detail endpoint)
    events: Optional[List[BatchEventOut]] = None
