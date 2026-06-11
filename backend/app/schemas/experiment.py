from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, ConfigDict


# ── Attachments ───────────────────────────────────────────────────────────────

class ExperimentAttachmentResponse(BaseModel):
    id: str
    experiment_id: str
    filename: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Inputs (Reactants & Reagents) ────────────────────────────────────────────

class ExperimentInputCreate(BaseModel):
    sort_order: int = 1
    material_name: str
    cas_no: Optional[str] = None
    mol_weight: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None        # g / mL / mg
    moles: Optional[Decimal] = None
    mole_ratio: Optional[Decimal] = None
    purity_pct: Optional[Decimal] = None
    role: Optional[str] = None        # Reagent / Substrate / Catalyst / Solvent


class ExperimentInputUpdate(BaseModel):
    sort_order: Optional[int] = None
    material_name: Optional[str] = None
    cas_no: Optional[str] = None
    mol_weight: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    moles: Optional[Decimal] = None
    mole_ratio: Optional[Decimal] = None
    purity_pct: Optional[Decimal] = None
    role: Optional[str] = None


class ExperimentInputResponse(BaseModel):
    id: str
    experiment_id: str
    sort_order: int
    material_name: str
    cas_no: Optional[str] = None
    mol_weight: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    moles: Optional[Decimal] = None
    mole_ratio: Optional[Decimal] = None
    purity_pct: Optional[Decimal] = None
    role: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Parameters ───────────────────────────────────────────────────────────────

class ExperimentParameterCreate(BaseModel):
    sort_order: int = 1
    name: str          # Temperature / Pressure / Stirring Speed
    value: Optional[str] = None   # "25–30 (ramping)"
    unit: Optional[str] = None    # °C / bar / rpm


class ExperimentParameterUpdate(BaseModel):
    sort_order: Optional[int] = None
    name: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None


class ExperimentParameterResponse(BaseModel):
    id: str
    experiment_id: str
    sort_order: int
    name: str
    value: Optional[str] = None
    unit: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── TLC ──────────────────────────────────────────────────────────────────────

class ExperimentTLCCreate(BaseModel):
    solvent_system: Optional[str] = None         # Hexane:EtOAc 7:3
    rf_starting_material: Optional[Decimal] = None
    rf_product: Optional[Decimal] = None
    visualization: Optional[str] = None          # UV / KMnO4
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None


class ExperimentTLCUpdate(BaseModel):
    solvent_system: Optional[str] = None
    rf_starting_material: Optional[Decimal] = None
    rf_product: Optional[Decimal] = None
    visualization: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None


class ExperimentTLCResponse(BaseModel):
    id: str
    experiment_id: str
    solvent_system: Optional[str] = None
    rf_starting_material: Optional[Decimal] = None
    rf_product: Optional[Decimal] = None
    visualization: Optional[str] = None
    image_path: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Comments ─────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    comment: str
    comment_type: str = "GENERAL"   # GENERAL / REVIEW_NOTE / REJECTION_REASON
    parent_id: Optional[str] = None


class CommentUpdate(BaseModel):
    comment: str


class CommentResponse(BaseModel):
    id: str
    experiment_id: str
    version_experiment_id: Optional[str] = None
    comment: str
    comment_type: str
    parent_id: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


# ── History ──────────────────────────────────────────────────────────────────

class HistoryResponse(BaseModel):
    id: str
    experiment_id: str
    version_experiment_id: Optional[str] = None
    action: str
    action_by: str
    action_at: datetime
    rejection_reason: Optional[str] = None
    revision_note: Optional[str] = None
    snapshot: Optional[Dict[str, Any]] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Experiment ────────────────────────────────────────────────────────────────

class ExperimentCreate(BaseModel):
    notebook_id: str
    title: str
    aim: Optional[str] = None
    objective: Optional[str] = None
    procedure: Optional[str] = None
    observations: Optional[str] = None
    conclusion: Optional[str] = None
    starting_material: Optional[str] = None
    target_product: Optional[str] = None
    reaction_type: Optional[str] = None
    theoretical_yield: Optional[Decimal] = None
    actual_yield: Optional[Decimal] = None
    yield_pct: Optional[Decimal] = None
    inputs: Optional[List[ExperimentInputCreate]] = None
    parameters: Optional[List[ExperimentParameterCreate]] = None


class ExperimentUpdate(BaseModel):
    title: Optional[str] = None
    aim: Optional[str] = None
    objective: Optional[str] = None
    precautions: Optional[str] = None
    procedure: Optional[str] = None
    observations: Optional[str] = None
    conclusion: Optional[str] = None
    starting_material: Optional[str] = None
    target_product: Optional[str] = None
    reaction_type: Optional[str] = None
    scheme_mol: Optional[str] = None
    theoretical_yield: Optional[Decimal] = None
    actual_yield: Optional[Decimal] = None
    yield_pct: Optional[Decimal] = None
    save_comments: Optional[str] = None


class RejectRequest(BaseModel):
    reason: str


class NewVersionRequest(BaseModel):
    revision_note: str


class ExperimentSummary(BaseModel):
    id: str
    code: str
    full_code: str
    version: int
    title: str
    status: str
    is_latest_version: bool
    notebook_id: str
    project_id: str
    created_by: str          # UUID of creator
    creator_name: Optional[str] = None   # display_name resolved by the router
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExperimentResponse(BaseModel):
    id: str
    code: str
    full_code: str
    version: int
    title: str
    notebook_id: str
    project_id: str
    route_id: Optional[str] = None
    stage_id: Optional[str] = None
    aim: Optional[str] = None
    objective: Optional[str] = None
    precautions: Optional[str] = None
    procedure: Optional[str] = None
    observations: Optional[str] = None
    conclusion: Optional[str] = None
    starting_material: Optional[str] = None
    target_product: Optional[str] = None
    reaction_type: Optional[str] = None
    scheme_mol: Optional[str] = None
    save_comments: Optional[str] = None
    theoretical_yield: Optional[Decimal] = None
    actual_yield: Optional[Decimal] = None
    yield_pct: Optional[Decimal] = None
    status: str
    is_latest_version: bool
    root_experiment_id: Optional[str] = None
    parent_experiment_id: Optional[str] = None
    revision_note: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_by: str
    creator_name: Optional[str] = None        # resolved display name
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_by_name: Optional[str] = None    # resolved display name
    verified_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None    # resolved display name
    approved_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejected_by_name: Optional[str] = None    # resolved display name
    rejected_at: Optional[datetime] = None
    unlocked_by: Optional[str] = None
    unlocked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    inputs: List[ExperimentInputResponse] = []
    parameters: List[ExperimentParameterResponse] = []
    tlc_records: List[ExperimentTLCResponse] = []
    attachments: List[ExperimentAttachmentResponse] = []
    model_config = ConfigDict(from_attributes=True)
