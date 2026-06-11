from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, ConfigDict


# ── Steps ─────────────────────────────────────────────────────────────────────

class ExperimentStepResponse(BaseModel):
    id:               str
    experiment_id:    str
    step_no:          int
    procedure_text:   Optional[str] = None
    observation_text: Optional[str] = None
    qty:              Optional[str] = None
    temperature:      Optional[str] = None
    attachment_path:  Optional[str] = None
    attachment_name:  Optional[str] = None
    attachment_size:  Optional[int] = None
    created_at:       datetime
    model_config = ConfigDict(from_attributes=True)


class ExperimentStepCreate(BaseModel):
    step_no:          int
    procedure_text:   Optional[str] = None
    observation_text: Optional[str] = None
    qty:              Optional[str] = None
    temperature:      Optional[str] = None


class ExperimentStepUpdate(BaseModel):
    step_no:          Optional[int] = None
    procedure_text:   Optional[str] = None
    observation_text: Optional[str] = None
    qty:              Optional[str] = None
    temperature:      Optional[str] = None


# ── Equipment ─────────────────────────────────────────────────────────────────

class ExperimentEquipmentResponse(BaseModel):
    id:                 str
    experiment_id:      str
    instrument_code:    Optional[str] = None
    instrument_type:    Optional[str] = None
    instrument_name:    Optional[str] = None
    maintenance_status: Optional[str] = None
    calibration_status: Optional[str] = None
    start_time:         Optional[datetime] = None
    end_time:           Optional[datetime] = None
    remarks:            Optional[str] = None
    added_by:           Optional[str] = None
    added_at:           datetime
    model_config = ConfigDict(from_attributes=True)


class ExperimentEquipmentCreate(BaseModel):
    instrument_code:    Optional[str] = None
    instrument_type:    Optional[str] = None
    instrument_name:    Optional[str] = None
    maintenance_status: Optional[str] = None
    calibration_status: Optional[str] = None
    start_time:         Optional[datetime] = None
    end_time:           Optional[datetime] = None
    remarks:            Optional[str] = None


class ExperimentEquipmentUpdate(BaseModel):
    instrument_code:    Optional[str] = None
    instrument_type:    Optional[str] = None
    instrument_name:    Optional[str] = None
    maintenance_status: Optional[str] = None
    calibration_status: Optional[str] = None
    start_time:         Optional[datetime] = None
    end_time:           Optional[datetime] = None
    remarks:            Optional[str] = None


# ── Attachments ───────────────────────────────────────────────────────────────

class ExperimentAttachmentResponse(BaseModel):
    id:            str
    experiment_id: str
    filename:      str
    file_size:     Optional[int] = None
    file_type:     Optional[str] = None
    uploaded_by:   str
    uploaded_at:   datetime
    model_config = ConfigDict(from_attributes=True)


# ── Inputs (Reactants & Reagents) ────────────────────────────────────────────

class ExperimentInputCreate(BaseModel):
    # sort_order is Optional so the endpoint can auto-increment when omitted
    sort_order:        Optional[int] = None
    material_name:     str
    cas_no:            Optional[str]     = None
    formula:           Optional[str]     = None
    mol_weight:        Optional[Decimal] = None
    quantity:          Optional[Decimal] = None
    unit:              Optional[str]     = None        # g / mL / mg
    moles:             Optional[Decimal] = None
    mole_ratio:        Optional[Decimal] = None
    purity_pct:        Optional[Decimal] = None
    role:              Optional[str]     = None        # Reagent / Substrate / Catalyst / Solvent
    # v2 fields
    batch_lot_no:      Optional[str]     = None
    vendor_name:       Optional[str]     = None
    batch_no:          Optional[str]     = None
    available_qty:     Optional[Decimal] = None
    required_qty:      Optional[Decimal] = None
    required_qty_unit: Optional[str]     = None
    density:           Optional[Decimal] = None
    strength:          Optional[Decimal] = None
    ww_ratio:          Optional[Decimal] = None
    molarity:          Optional[Decimal] = None
    remarks:           Optional[str]     = None


class ExperimentInputUpdate(BaseModel):
    sort_order:        Optional[int]     = None
    material_name:     Optional[str]     = None
    cas_no:            Optional[str]     = None
    formula:           Optional[str]     = None
    mol_weight:        Optional[Decimal] = None
    quantity:          Optional[Decimal] = None
    unit:              Optional[str]     = None
    moles:             Optional[Decimal] = None
    mole_ratio:        Optional[Decimal] = None
    purity_pct:        Optional[Decimal] = None
    role:              Optional[str]     = None
    # v2 fields
    batch_lot_no:      Optional[str]     = None
    vendor_name:       Optional[str]     = None
    batch_no:          Optional[str]     = None
    available_qty:     Optional[Decimal] = None
    required_qty:      Optional[Decimal] = None
    required_qty_unit: Optional[str]     = None
    density:           Optional[Decimal] = None
    strength:          Optional[Decimal] = None
    ww_ratio:          Optional[Decimal] = None
    molarity:          Optional[Decimal] = None
    remarks:           Optional[str]     = None


class ExperimentInputResponse(BaseModel):
    id:                str
    experiment_id:     str
    sort_order:        int
    material_name:     str
    cas_no:            Optional[str]     = None
    formula:           Optional[str]     = None
    mol_weight:        Optional[Decimal] = None
    quantity:          Optional[Decimal] = None
    unit:              Optional[str]     = None
    moles:             Optional[Decimal] = None
    mole_ratio:        Optional[Decimal] = None
    purity_pct:        Optional[Decimal] = None
    role:              Optional[str]     = None
    # v2 fields
    batch_lot_no:      Optional[str]     = None
    vendor_name:       Optional[str]     = None
    batch_no:          Optional[str]     = None
    available_qty:     Optional[Decimal] = None
    required_qty:      Optional[Decimal] = None
    required_qty_unit: Optional[str]     = None
    density:           Optional[Decimal] = None
    strength:          Optional[Decimal] = None
    ww_ratio:          Optional[Decimal] = None
    molarity:          Optional[Decimal] = None
    remarks:           Optional[str]     = None
    model_config = ConfigDict(from_attributes=True)


# ── Parameters ───────────────────────────────────────────────────────────────

class ExperimentParameterCreate(BaseModel):
    # sort_order is Optional so the endpoint can auto-increment when omitted
    sort_order:              Optional[int] = None
    name:                    str           # Temperature / Pressure / Stirring Speed
    value:                   Optional[str] = None   # "25–30 (ramping)"
    unit:                    Optional[str] = None   # °C / bar / rpm (legacy — prefer uom)
    # v2 formula engine fields
    code:                    Optional[str] = None   # P1, P2 … formula reference code
    input_output:            str = "INPUT"          # INPUT | OUTPUT
    user_entered_or_formula: str = "USER ENTERED"   # USER ENTERED | FORMULA
    param_type:              str = "NUMBER"         # NUMBER | TEXT | DATE
    formula_expression:      Optional[str] = None   # e.g. "P1+P2"
    parameter_value:         Optional[Decimal] = None  # stored numeric result
    uom:                     Optional[str] = None   # canonical unit of measure
    remarks:                 Optional[str] = None


class ExperimentParameterUpdate(BaseModel):
    sort_order:              Optional[int]     = None
    name:                    Optional[str]     = None
    value:                   Optional[str]     = None
    unit:                    Optional[str]     = None
    # v2 formula engine fields
    code:                    Optional[str]     = None
    input_output:            Optional[str]     = None
    user_entered_or_formula: Optional[str]     = None
    param_type:              Optional[str]     = None
    formula_expression:      Optional[str]     = None
    parameter_value:         Optional[Decimal] = None
    uom:                     Optional[str]     = None
    remarks:                 Optional[str]     = None


class ExperimentParameterResponse(BaseModel):
    id:                      str
    experiment_id:           str
    sort_order:              int
    name:                    str
    value:                   Optional[str]     = None
    unit:                    Optional[str]     = None
    # v2 formula engine fields
    code:                    Optional[str]     = None
    input_output:            str
    user_entered_or_formula: str
    param_type:              str
    formula_expression:      Optional[str]     = None
    parameter_value:         Optional[Decimal] = None
    uom:                     Optional[str]     = None
    remarks:                 Optional[str]     = None
    model_config = ConfigDict(from_attributes=True)


# ── TLC ──────────────────────────────────────────────────────────────────────

class ExperimentTLCCreate(BaseModel):
    solvent_system:       Optional[str]     = None   # Hexane:EtOAc 7:3
    rf_starting_material: Optional[Decimal] = None
    rf_product:           Optional[Decimal] = None
    visualization:        Optional[str]     = None   # UV / KMnO4
    notes:                Optional[str]     = None
    recorded_at:          Optional[datetime] = None


class ExperimentTLCUpdate(BaseModel):
    solvent_system:       Optional[str]     = None
    rf_starting_material: Optional[Decimal] = None
    rf_product:           Optional[Decimal] = None
    visualization:        Optional[str]     = None
    notes:                Optional[str]     = None
    recorded_at:          Optional[datetime] = None


class ExperimentTLCResponse(BaseModel):
    id:                   str
    experiment_id:        str
    solvent_system:       Optional[str]     = None
    rf_starting_material: Optional[Decimal] = None
    rf_product:           Optional[Decimal] = None
    visualization:        Optional[str]     = None
    image_path:           Optional[str]     = None
    drawing_path:         Optional[str]     = None
    notes:                Optional[str]     = None
    recorded_at:          Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Comments ─────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    comment:      str
    comment_type: str = "GENERAL"   # GENERAL / REVIEW_NOTE / REJECTION_REASON
    parent_id:    Optional[str] = None


class CommentUpdate(BaseModel):
    comment: str


class CommentResponse(BaseModel):
    id:                      str
    experiment_id:           str
    version_experiment_id:   Optional[str] = None
    comment:                 str
    comment_type:            str
    parent_id:               Optional[str] = None
    created_by:              str
    created_by_name:         Optional[str] = None   # resolved display name
    created_at:              datetime
    updated_at:              datetime
    is_deleted:              bool
    model_config = ConfigDict(from_attributes=True)


# ── History ──────────────────────────────────────────────────────────────────

class HistoryResponse(BaseModel):
    id:                      str
    experiment_id:           str
    version_experiment_id:   Optional[str] = None
    action:                  str
    action_by:               str
    action_by_name:          Optional[str] = None   # resolved display name
    action_at:               datetime
    rejection_reason:        Optional[str] = None
    revision_note:           Optional[str] = None
    # v2 fields
    improvement_suggestions: Optional[str] = None
    submitted_to_user_id:    Optional[str] = None
    save_comments:           Optional[str] = None
    snapshot:                Optional[Dict[str, Any]] = None
    created_at:              datetime
    model_config = ConfigDict(from_attributes=True)


# ── Experiment workflow request bodies ────────────────────────────────────────

class RejectRequest(BaseModel):
    reason: str


class NewVersionRequest(BaseModel):
    revision_note: str


class ESignatureBody(BaseModel):
    """Request body for workflow actions that require e-signature re-authentication."""
    password: str


class SubmitRequest(BaseModel):
    password:           Optional[str] = None   # e-signature (enforced by CRD settings)
    submitted_to:       Optional[str] = None   # target TL user ID (FIX-06)
    save_comments:      Optional[str] = None


class VerifyRequest(BaseModel):
    password:                Optional[str] = None
    improvement_suggestions: Optional[str] = None
    post_verification_remarks: Optional[str] = None


class ApproveRequest(BaseModel):
    password: Optional[str] = None


class VoidRequest(BaseModel):
    password: Optional[str] = None
    reason:   Optional[str] = None


# ── Experiment list / detail ──────────────────────────────────────────────────

class ExperimentSummary(BaseModel):
    id:               str
    code:             str       # OQ/R1/S1/E00001
    full_code:        str       # OQ/R1/S1/E00001/001
    version:          int
    title:            str
    status:           str
    is_latest_version: bool
    is_highlighted:   bool = False
    notebook_id:      str
    project_id:       str
    created_by:       str
    creator_name:     Optional[str] = None   # resolved display name
    created_at:       datetime
    updated_at:       datetime
    model_config = ConfigDict(from_attributes=True)


class ExperimentCreate(BaseModel):
    notebook_id:        str
    title:              str
    aim:                Optional[str] = None
    objective:          Optional[str] = None
    precautions:        Optional[str] = None
    procedure:          Optional[str] = None
    observations:       Optional[str] = None
    conclusion:         Optional[str] = None
    starting_material:  Optional[str] = None
    target_product:     Optional[str] = None
    reaction_type:      Optional[str] = None
    theoretical_yield:  Optional[Decimal] = None
    actual_yield:       Optional[Decimal] = None
    yield_pct:          Optional[Decimal] = None
    reference_exp_code: Optional[str] = None
    inputs:             Optional[List[ExperimentInputCreate]] = None
    parameters:         Optional[List[ExperimentParameterCreate]] = None


class ExperimentUpdate(BaseModel):
    title:                     Optional[str]     = None
    aim:                       Optional[str]     = None
    objective:                 Optional[str]     = None
    precautions:               Optional[str]     = None
    procedure:                 Optional[str]     = None
    observations:              Optional[str]     = None
    conclusion:                Optional[str]     = None
    starting_material:         Optional[str]     = None
    target_product:            Optional[str]     = None
    reaction_type:             Optional[str]     = None
    theoretical_yield:         Optional[Decimal] = None
    actual_yield:              Optional[Decimal] = None
    yield_pct:                 Optional[Decimal] = None
    reference_exp_code:        Optional[str]     = None
    save_comments:             Optional[str]     = None
    tlc_drawing_path:          Optional[str]     = None
    post_verification_remarks: Optional[str]     = None
    improvement_suggestions:   Optional[str]     = None
    route_id:                  Optional[str]     = None
    stage_id:                  Optional[str]     = None


class ExperimentResponse(BaseModel):
    id:               str
    code:             str
    full_code:        str
    version:          int
    title:            str
    notebook_id:      str
    project_id:       str
    route_id:         Optional[str] = None
    stage_id:         Optional[str] = None

    # Content tabs
    aim:          Optional[str] = None
    objective:    Optional[str] = None
    precautions:  Optional[str] = None
    procedure:    Optional[str] = None
    observations: Optional[str] = None
    conclusion:   Optional[str] = None

    # Scheme
    starting_material: Optional[str] = None
    target_product:    Optional[str] = None
    reaction_type:     Optional[str] = None

    # Yield
    theoretical_yield: Optional[Decimal] = None
    actual_yield:      Optional[Decimal] = None
    yield_pct:         Optional[Decimal] = None

    # Status & versioning
    status:               str
    is_latest_version:    bool
    is_highlighted:       bool = False
    highlight_comments:   Optional[str] = None
    root_experiment_id:   Optional[str] = None
    parent_experiment_id: Optional[str] = None
    revision_note:        Optional[str] = None
    rejection_reason:     Optional[str] = None
    reference_exp_code:   Optional[str] = None
    tlc_drawing_path:     Optional[str] = None

    # Post-review fields (v2)
    post_verification_remarks: Optional[str] = None
    improvement_suggestions:   Optional[str] = None
    save_comments:             Optional[str] = None

    # Who did what (UUIDs)
    created_by:    str
    submitted_by:  Optional[str] = None
    submitted_to:  Optional[str] = None
    verified_by:   Optional[str] = None
    approved_by:   Optional[str] = None
    rejected_by:   Optional[str] = None
    unlocked_by:   Optional[str] = None

    # Resolved display names
    creator_name:       Optional[str] = None
    submitted_by_name:  Optional[str] = None
    submitted_to_name:  Optional[str] = None
    verified_by_name:   Optional[str] = None
    approved_by_name:   Optional[str] = None
    rejected_by_name:   Optional[str] = None

    # Timestamps
    created_at:     datetime
    updated_at:     datetime
    submitted_at:   Optional[datetime] = None
    submitted_to_at: Optional[datetime] = None
    verified_at:    Optional[datetime] = None
    approved_at:    Optional[datetime] = None
    rejected_at:    Optional[datetime] = None
    unlocked_at:    Optional[datetime] = None

    # Sub-resources
    inputs:      List[ExperimentInputResponse]     = []
    parameters:  List[ExperimentParameterResponse] = []
    tlc_records: List[ExperimentTLCResponse]       = []
    attachments: List[ExperimentAttachmentResponse] = []
    steps:       List[ExperimentStepResponse]      = []
    equipment:   List[ExperimentEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
