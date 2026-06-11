"""
Inventory Master — Maintenance / Calibration Schedules + Equipment / Instrument
Verification Pydantic schemas
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Maintenance Schedule ──────────────────────────────────────────────────────

class MaintenanceScheduleCreate(BaseModel):
    equipment_id:     int
    maintenance_type: Optional[str] = None
    scheduled_date:   date
    technician:       Optional[str] = None
    notes:            Optional[str] = None


class MaintenanceScheduleUpdate(BaseModel):
    maintenance_type: Optional[str]  = None
    scheduled_date:   Optional[date] = None
    technician:       Optional[str]  = None
    notes:            Optional[str]  = None
    status:           Optional[str]  = None


class MaintenanceCompleteRequest(BaseModel):
    completed_date: date
    technician:     Optional[str] = None
    notes:          Optional[str] = None


class MaintenanceScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    equipment_id:     int
    maintenance_type: Optional[str]  = None
    scheduled_date:   date
    completed_date:   Optional[date] = None
    technician:       Optional[str]  = None
    status:           str
    notes:            Optional[str]  = None

    # denormalised
    equipment_asset_id: Optional[str] = None
    equipment_name:     Optional[str] = None


# ── Calibration Schedule ──────────────────────────────────────────────────────

class CalibrationScheduleCreate(BaseModel):
    instrument_id:    int
    calibration_type: Optional[str] = None
    scheduled_date:   date
    technician:       Optional[str] = None
    certificate_no:   Optional[str] = None
    notes:            Optional[str] = None


class CalibrationScheduleUpdate(BaseModel):
    calibration_type: Optional[str]  = None
    scheduled_date:   Optional[date] = None
    technician:       Optional[str]  = None
    certificate_no:   Optional[str]  = None
    notes:            Optional[str]  = None
    status:           Optional[str]  = None


class CalibrationCompleteRequest(BaseModel):
    completed_date: date
    technician:     Optional[str] = None
    certificate_no: Optional[str] = None
    notes:          Optional[str] = None


class CalibrationScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    instrument_id:    int
    calibration_type: Optional[str]  = None
    scheduled_date:   date
    completed_date:   Optional[date] = None
    technician:       Optional[str]  = None
    certificate_no:   Optional[str]  = None
    status:           str
    notes:            Optional[str]  = None

    # denormalised
    instrument_asset_id: Optional[str] = None
    instrument_name:     Optional[str] = None


# ── Equipment Verification ────────────────────────────────────────────────────

class EquipVerificationCreate(BaseModel):
    request_no:   str
    equipment_id: int
    remarks:      Optional[str] = None


class VerificationDecision(BaseModel):
    remarks: Optional[str] = None


class EquipVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    request_no:   str
    equipment_id: int
    requested_by: Optional[str]      = None
    requested_at: Optional[datetime] = None
    verified_by:  Optional[str]      = None
    verified_at:  Optional[datetime] = None
    status:       str
    remarks:      Optional[str]      = None

    # denormalised
    equipment_asset_id: Optional[str] = None
    equipment_name:     Optional[str] = None


# ── Instrument Verification ───────────────────────────────────────────────────

class InstrVerificationCreate(BaseModel):
    request_no:    str
    instrument_id: int
    remarks:       Optional[str] = None


class InstrVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:            int
    request_no:    str
    instrument_id: int
    requested_by:  Optional[str]      = None
    requested_at:  Optional[datetime] = None
    verified_by:   Optional[str]      = None
    verified_at:   Optional[datetime] = None
    status:        str
    remarks:       Optional[str]      = None

    # denormalised
    instrument_asset_id: Optional[str] = None
    instrument_name:     Optional[str] = None
