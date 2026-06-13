from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── File ──────────────────────────────────────────────────────────────────────

class ExperimentFileResponse(BaseModel):
    id:            str
    experiment_id: str
    section_key:   Optional[str]
    filename:      str
    file_path:     str
    file_size:     Optional[int]
    file_type:     Optional[str]
    uploaded_by:   str
    uploaded_at:   datetime
    model_config = ConfigDict(from_attributes=True)


# ── Review (multi-reviewer) ───────────────────────────────────────────────────

class AssignReviewer(BaseModel):
    reviewer_id: str = Field(description="User ID of the reviewer to assign")


class ExperimentReviewResponse(BaseModel):
    id:            str
    experiment_id: str
    reviewer_id:   str
    assigned_by:   Optional[str]
    assigned_at:   datetime
    signed_at:     Optional[datetime]
    sign_reason:   Optional[str]
    decision:      Optional[str]   # APPROVED | REJECTED | None (pending)
    model_config = ConfigDict(from_attributes=True)


# ── History (audit log) ───────────────────────────────────────────────────────

class ExperimentHistoryResponse(BaseModel):
    id:            str
    experiment_id: str
    actor_id:      str
    action:        str
    details:       Optional[Dict[str, Any]]
    created_at:    datetime
    model_config = ConfigDict(from_attributes=True)


# ── Experiment ────────────────────────────────────────────────────────────────

class ExperimentCreate(BaseModel):
    title:        str
    screen_key:   Optional[str]            = None
    section_key:  Optional[str]            = None
    data:         Optional[Dict[str, Any]] = None
    observations: Optional[str]            = None
    conclusion:   Optional[str]            = None
    scheme_mol:   Optional[str]            = None


class ExperimentUpdate(BaseModel):
    title:        Optional[str]            = None
    data:         Optional[Dict[str, Any]] = None
    observations: Optional[str]            = None
    conclusion:   Optional[str]            = None
    disposition:  Optional[str]            = None
    scheme_mol:   Optional[str]            = None


class ExperimentNewVersion(BaseModel):
    revision_note: Optional[str] = Field(None, description="What changed in this version")


class ExperimentSign(BaseModel):
    role:     str  = Field(description="'scientist' or 'reviewer'")
    password: str  = Field(description="User's password for 21 CFR Part 11 e-signature")
    reason:   str  = Field(description="Reason e.g. 'Authored and submitted'")
    decision: Optional[str] = Field(
        None,
        description="Reviewer decision: 'APPROVED' or 'REJECTED' (required when role='reviewer')",
    )


class ExperimentLinkPreliminary(BaseModel):
    preliminary_experiment_id: str = Field(description="ID of a LOCKED preliminary experiment")


class ExperimentReject(BaseModel):
    reason: str


# ── Nested helpers ────────────────────────────────────────────────────────────

class _UserShort(BaseModel):
    id:           str
    display_name: str
    model_config = ConfigDict(from_attributes=True)


class _LinkedPreliminary(BaseModel):
    id:                str
    full_code:         str
    title:             str
    status:            str
    is_latest_version: bool
    model_config = ConfigDict(from_attributes=True)


# ── Full response ─────────────────────────────────────────────────────────────

class ExperimentResponse(BaseModel):
    id:          str
    notebook_id: str
    project_id:  str

    base_code:  str
    version:    int
    full_code:  str
    title:      str

    screen_key:  Optional[str]
    section_key: Optional[str]

    data:         Optional[Dict[str, Any]]
    observations: Optional[str]
    conclusion:   Optional[str]
    disposition:  Optional[str]
    scheme_mol:   Optional[str]

    status:            str
    is_latest_version: bool

    parent_id:     Optional[str]
    revision_note: Optional[str]

    linked_preliminary_id: Optional[str]
    linked_preliminary:    Optional[_LinkedPreliminary]

    created_by: str
    creator:    Optional[_UserShort]

    submitted_by:     Optional[str]
    submitted_at:     Optional[datetime]
    approved_by:      Optional[str]
    approved_at:      Optional[datetime]
    rejected_by:      Optional[str]
    rejected_at:      Optional[datetime]
    rejection_reason: Optional[str]

    scientist_signed_by:   Optional[str]
    scientist_signed_at:   Optional[datetime]
    scientist_sign_reason: Optional[str]

    reviews: List[ExperimentReviewResponse] = []
    files:   List[ExperimentFileResponse]   = []

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExperimentSummary(BaseModel):
    """Lightweight — for notebook experiment list."""
    id:                str
    full_code:         str
    base_code:         str
    version:           int
    title:             str
    screen_key:        Optional[str]
    section_key:       Optional[str]
    status:            str
    is_latest_version: bool
    created_at:        datetime
    updated_at:        datetime
    model_config = ConfigDict(from_attributes=True)
