from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── ATR Attachments ──────────────────────────────────────────────────────────

class ATRAttachmentResponse(BaseModel):
    id: str
    atr_id: str
    filename: str
    file_path: str
    file_size: Optional[int] = None
    uploaded_by: str
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── ATR ──────────────────────────────────────────────────────────────────────

class ATRCreate(BaseModel):
    experiment_id: Optional[str] = None
    notebook_id: Optional[str] = None
    project_id: Optional[str] = None
    test_type: str       # NMR / HPLC / MS / IR / GC-MS / XRD
    objectives: str
    due_date: Optional[date] = None


class ATRUpdate(BaseModel):
    test_type: Optional[str] = None
    objectives: Optional[str] = None
    due_date: Optional[date] = None


class ATRAssignRequest(BaseModel):
    assigned_to: str
    due_date: Optional[date] = None


class ATRCompleteRequest(BaseModel):
    result: str
    result_observations: Optional[str] = None


class ATRSummary(BaseModel):
    id: str
    atr_no: str
    test_type: str
    status: str
    experiment_id: Optional[str] = None
    notebook_id: Optional[str] = None
    project_id: Optional[str] = None
    raised_by: str
    raised_at: datetime
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ATRResponse(BaseModel):
    id: str
    atr_no: str
    experiment_id: Optional[str] = None
    notebook_id: Optional[str] = None
    project_id: Optional[str] = None
    test_type: str
    objectives: str
    status: str
    raised_by: str
    raised_at: datetime
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    result: Optional[str] = None
    result_observations: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    attachments: List[ATRAttachmentResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ── UnlockRequest ─────────────────────────────────────────────────────────────

class UnlockRequestCreate(BaseModel):
    experiment_id: str
    reason: str


class UnlockReviewRequest(BaseModel):
    review_note: Optional[str] = None


class UnlockRequestResponse(BaseModel):
    id: str
    experiment_id: str
    experiment_full_code: Optional[str] = None   # resolved from experiments table
    reason: str
    status: str
    requested_by: str
    requester_name: Optional[str] = None         # resolved display name
    requested_at: datetime
    reviewed_by: Optional[str] = None
    reviewer_name: Optional[str] = None          # resolved display name
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
