from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


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

    @computed_field
    @property
    def url(self) -> str:
        return f"/api/experiments/{self.experiment_id}/files/{self.id}"


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
    actor_name:    Optional[str] = None
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


# ── Experiment Materials (batch reservations) ─────────────────────────────────

class ExperimentMaterialCreate(BaseModel):
    material_role: str     = Field(description="e.g. mAb, TCEP, LP, DMSO, NAC, TFF_filter")
    material_id:   int
    batch_id:      int
    qty_reserved:  float
    unit:          str
    remarks:       Optional[str] = None


class ExperimentMaterialUpdate(BaseModel):
    qty_issued: Optional[float] = None
    status:     Optional[str]   = None   # RESERVED | ISSUED | RETURNED
    remarks:    Optional[str]   = None


class ExperimentMaterialResponse(BaseModel):
    id:            str
    experiment_id: str
    material_role: str
    material_id:   int
    batch_id:      int
    qty_reserved:  float
    unit:          str
    qty_issued:    Optional[float]
    status:        str
    remarks:       Optional[str]
    reserved_by:   str
    reserved_at:   datetime
    # denormalised — filled by router
    material_name:  Optional[str] = None
    material_code:  Optional[str] = None
    batch_no:       Optional[str] = None
    manufacturer_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Preliminary data snapshot ─────────────────────────────────────────────────

class PreliminaryDataResponse(BaseModel):
    preliminary_id:   str
    full_code:        str
    title:            str
    status:           str
    data:             Optional[Dict[str, Any]]
    model_config = ConfigDict(from_attributes=True)


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
    approver:         Optional[_UserShort]
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
    """Lightweight — for notebook experiment list and search."""
    id:                str
    full_code:         str
    base_code:         str
    version:           int
    title:             str
    screen_key:        Optional[str]
    section_key:       Optional[str]
    status:            str
    is_latest_version: bool
    notebook_id:       Optional[str] = None
    project_id:        Optional[str] = None
    created_by:        Optional[str] = None
    creator_name:      Optional[str] = None
    created_at:        datetime
    updated_at:        datetime
    model_config = ConfigDict(from_attributes=True)


def experiment_summary_from_orm(exp) -> ExperimentSummary:
    """Build summary with resolved creator display name."""
    creator = getattr(exp, "creator", None)
    return ExperimentSummary(
        id=exp.id,
        full_code=exp.full_code,
        base_code=exp.base_code,
        version=exp.version,
        title=exp.title,
        screen_key=exp.screen_key,
        section_key=exp.section_key,
        status=exp.status,
        is_latest_version=exp.is_latest_version,
        notebook_id=exp.notebook_id,
        project_id=exp.project_id,
        created_by=exp.created_by,
        creator_name=creator.display_name if creator else None,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )
