"""
Inventory Master — Stock Requests & Batch Verification Pydantic schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── Stock Request Event ───────────────────────────────────────────────────────

class StockRequestEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    request_id:   int
    event_type:   str
    performed_by: Optional[str]     = None
    performed_at: Optional[datetime] = None
    remarks:      Optional[str]     = None


# ── Stock Request ─────────────────────────────────────────────────────────────

class StockRequestCreate(BaseModel):
    request_no:       str
    material_id:      int
    qty_required:     Decimal
    unit:             str               = "g"
    required_by_date: Optional[date]    = None
    criticality:      str               = "MEDIUM"
    purpose:          Optional[str]     = None
    remarks:          Optional[str]     = None


class StockRequestUpdate(BaseModel):
    qty_required:     Optional[Decimal] = None
    unit:             Optional[str]     = None
    required_by_date: Optional[date]    = None
    criticality:      Optional[str]     = None
    purpose:          Optional[str]     = None
    remarks:          Optional[str]     = None


class ApproveRequest(BaseModel):
    remarks: Optional[str] = None


class RejectRequest(BaseModel):
    remarks: Optional[str] = None


class FulfillRequest(BaseModel):
    remarks: Optional[str] = None


class StockRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    request_no:       str
    material_id:      int
    qty_required:     Decimal
    unit:             str
    required_by_date: Optional[date]    = None
    criticality:      str
    purpose:          Optional[str]     = None
    requested_by:     Optional[str]     = None
    requested_at:     Optional[datetime] = None
    approved_by:      Optional[str]     = None
    approved_at:      Optional[datetime] = None
    status:           str
    remarks:          Optional[str]     = None

    # denormalised
    material_name: Optional[str] = None
    material_code: Optional[str] = None

    # nested events (detail endpoint only)
    events: Optional[List[StockRequestEventOut]] = None


# ── Batch Verification ────────────────────────────────────────────────────────

class BatchVerificationCreate(BaseModel):
    request_no: str
    batch_id:   int
    remarks:    Optional[str] = None


class BatchVerificationVerify(BaseModel):
    remarks: Optional[str] = None


class BatchVerificationReject(BaseModel):
    remarks: Optional[str] = None


class BatchVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    request_no:   str
    batch_id:     int
    requested_by: Optional[str]     = None
    requested_at: Optional[datetime] = None
    verified_by:  Optional[str]     = None
    verified_at:  Optional[datetime] = None
    status:       str
    remarks:      Optional[str]     = None

    # denormalised
    batch_no:      Optional[str] = None
    material_name: Optional[str] = None
