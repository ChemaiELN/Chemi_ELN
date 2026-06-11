from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, BigInteger, Index, Integer, JSON, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class Experiment(Base):
    __tablename__ = "experiments"
    __table_args__ = (
        Index("ix_exp_notebook_status",  "notebook_id", "status"),
        Index("ix_exp_project_status",   "project_id",  "status"),
        Index("ix_exp_latest_version",   "is_latest_version"),
        Index("ix_exp_code",             "code"),
        Index("ix_exp_created_at",       "created_at"),
        Index("ix_exp_root",             "root_experiment_id"),
        CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','VERIFIED','APPROVED','REJECTED','UNLOCKED','VOID')",
            name="ck_exp_status",
        ),
    )

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    code:          Mapped[str] = mapped_column(String(50), nullable=False)        # OQ/R1/S1/E03166
    version:       Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    full_code:     Mapped[str] = mapped_column(String(60), unique=True, nullable=False)  # OQ/R1/S1/E03166/001
    title:         Mapped[str] = mapped_column(String(255), nullable=False)
    notebook_id:   Mapped[str] = mapped_column(PUUID, ForeignKey("notebooks.id"), nullable=False)
    project_id:    Mapped[str] = mapped_column(PUUID, ForeignKey("projects.id"), nullable=False)
    route_id:      Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("routes.id"))
    stage_id:      Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("stages.id"))

    # Content tabs
    aim:              Mapped[Optional[str]] = mapped_column(Text)
    objective:        Mapped[Optional[str]] = mapped_column(Text)
    procedure:        Mapped[Optional[str]] = mapped_column(Text)
    observations:     Mapped[Optional[str]] = mapped_column(Text)
    conclusion:       Mapped[Optional[str]] = mapped_column(Text)
    precautions:      Mapped[Optional[str]] = mapped_column(Text)                  # FIX-28

    # Scheme tab
    starting_material:  Mapped[Optional[str]] = mapped_column(String(255))
    target_product:     Mapped[Optional[str]] = mapped_column(String(255))
    reaction_type:      Mapped[Optional[str]] = mapped_column(String(100))
    scheme_image_path:  Mapped[Optional[str]] = mapped_column(String(500))

    # Yield (Inputs tab)
    theoretical_yield: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    actual_yield:      Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    yield_pct:         Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))

    # Status: DRAFT / SUBMITTED / VERIFIED / APPROVED / REJECTED / UNLOCKED / VOID / VERIFICATION REQUESTED
    status:         Mapped[str] = mapped_column(String(30), default="DRAFT", nullable=False)

    # True on the most-recent version, False on all prior versions
    is_latest_version: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Highlight / flag (FIX-46)
    is_highlighted:     Mapped[bool]           = mapped_column(Boolean, default=False, nullable=False)
    highlight_comments: Mapped[Optional[str]]  = mapped_column(Text)

    # Who did what and when
    created_by:     Mapped[str]           = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    submitted_by:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    submitted_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    submitted_to:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))       # FIX-06: TL the exp was submitted to
    submitted_to_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))       # FIX-06
    verified_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    verified_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    approved_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejected_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    rejected_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    unlocked_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    unlocked_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Post-verification / review fields
    post_verification_remarks: Mapped[Optional[str]] = mapped_column(Text)       # FIX-30
    improvement_suggestions:   Mapped[Optional[str]] = mapped_column(Text)       # FIX-23
    save_comments:             Mapped[Optional[str]] = mapped_column(Text)       # FIX-47

    # Reference & TLC drawing
    reference_exp_code: Mapped[Optional[str]] = mapped_column(String(60))        # FIX-21
    tlc_drawing_path:   Mapped[Optional[str]] = mapped_column(String(500))       # FIX-29

    # Versioning
    # root_experiment_id → always points to v1 (the original). NULL on v1 itself.
    # parent_experiment_id → points to the immediately preceding version.
    # Together they allow: get all versions = WHERE root_experiment_id = v1_id OR id = v1_id
    root_experiment_id:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))
    parent_experiment_id: Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))
    revision_note:        Mapped[Optional[str]] = mapped_column(Text)   # "What changed in this version?"

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    notebook:    Mapped["Notebook"]                  = relationship(back_populates="experiments", foreign_keys=[notebook_id])
    project:     Mapped["Project"]                   = relationship(foreign_keys=[project_id])
    route:       Mapped[Optional["Route"]]           = relationship(foreign_keys=[route_id])
    stage:       Mapped[Optional["Stage"]]           = relationship(foreign_keys=[stage_id])
    creator:     Mapped["User"]                      = relationship(foreign_keys=[created_by])
    submitter:   Mapped[Optional["User"]]            = relationship(foreign_keys=[submitted_to])
    reviewer:    Mapped[Optional["User"]]            = relationship(foreign_keys=[verified_by])
    inputs:      Mapped[List["ExperimentInput"]]     = relationship(back_populates="experiment", cascade="all, delete-orphan")
    parameters:  Mapped[List["ExperimentParameter"]] = relationship(back_populates="experiment", cascade="all, delete-orphan")
    steps:       Mapped[List["ExperimentStep"]]      = relationship(back_populates="experiment", cascade="all, delete-orphan")
    equipment:   Mapped[List["ExperimentEquipment"]] = relationship(back_populates="experiment", cascade="all, delete-orphan")
    tlc_records: Mapped[List["ExperimentTLC"]]       = relationship(back_populates="experiment", cascade="all, delete-orphan")
    attachments: Mapped[List["ExperimentAttachment"]]= relationship(back_populates="experiment", cascade="all, delete-orphan")
    comments:    Mapped[List["ExperimentComment"]]   = relationship(back_populates="experiment", cascade="all, delete-orphan", foreign_keys="ExperimentComment.experiment_id")
    atr_requests:Mapped[List["ATR"]]                 = relationship(back_populates="experiment")
    history:     Mapped[List["ExperimentHistory"]]   = relationship(back_populates="experiment", foreign_keys="ExperimentHistory.experiment_id")


class ExperimentStep(Base):
    """Step-by-step procedure rows for an experiment (FIX-01)."""
    __tablename__ = "experiment_steps"
    __table_args__ = (Index("ix_exp_steps_exp_id", "experiment_id"),)

    id:               Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id:    Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    step_no:          Mapped[int] = mapped_column(Integer, nullable=False)
    procedure_text:   Mapped[Optional[str]] = mapped_column(Text)
    observation_text: Mapped[Optional[str]] = mapped_column(Text)
    qty:              Mapped[Optional[str]] = mapped_column(String(50))
    temperature:      Mapped[Optional[str]] = mapped_column(String(50))
    attachment_path:  Mapped[Optional[str]] = mapped_column(String(500))
    attachment_name:  Mapped[Optional[str]] = mapped_column(String(255))
    attachment_size:  Mapped[Optional[int]] = mapped_column(BigInteger)          # bytes
    created_at:       Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    experiment: Mapped["Experiment"] = relationship(back_populates="steps")


class ExperimentEquipment(Base):
    """Instruments / equipment used in an experiment (FIX-20)."""
    __tablename__ = "experiment_equipment"
    __table_args__ = (Index("ix_exp_equip_exp_id", "experiment_id"),)

    id:                 Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id:      Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    instrument_code:    Mapped[Optional[str]] = mapped_column(String(50))
    instrument_type:    Mapped[Optional[str]] = mapped_column(String(100))
    instrument_name:    Mapped[Optional[str]] = mapped_column(String(255))
    maintenance_status: Mapped[Optional[str]] = mapped_column(String(30))
    calibration_status: Mapped[Optional[str]] = mapped_column(String(30))
    start_time:         Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_time:           Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    remarks:            Mapped[Optional[str]] = mapped_column(String(500))
    added_by:           Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    added_at:           Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    experiment: Mapped["Experiment"] = relationship(back_populates="equipment")
    adder:      Mapped[Optional["User"]] = relationship(foreign_keys=[added_by])


class ExperimentInput(Base):
    """One row in the Inputs (Reactants & Reagents) tab."""
    __tablename__ = "experiment_inputs"
    __table_args__ = (Index("ix_exp_inputs_exp_id", "experiment_id"),)

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    sort_order:    Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cas_no:        Mapped[Optional[str]]     = mapped_column(String(30))        # widened from String(20)
    formula:       Mapped[Optional[str]]     = mapped_column(String(100))
    mol_weight:    Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    quantity:      Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))    # widened from Numeric(10,4)
    unit:          Mapped[Optional[str]]     = mapped_column(String(10))       # g / mL / mg
    moles:         Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 8))   # widened from Numeric(12,6)
    mole_ratio:    Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    purity_pct:    Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    role:          Mapped[Optional[str]]     = mapped_column(String(30))       # Reagent / Substrate / Catalyst / Solvent
    batch_lot_no:  Mapped[Optional[str]]     = mapped_column(String(100))
    vendor_name:   Mapped[Optional[str]]     = mapped_column(String(255))
    batch_no:      Mapped[Optional[str]]     = mapped_column(String(100))
    available_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))
    required_qty:  Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))
    required_qty_unit: Mapped[Optional[str]] = mapped_column(String(20))       # gm / mL / mg
    density:       Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    strength:      Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))    # Strength (%)
    ww_ratio:      Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    molarity:      Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    remarks:       Mapped[Optional[str]]     = mapped_column(Text)

    experiment: Mapped["Experiment"] = relationship(back_populates="inputs")


class ExperimentParameter(Base):
    """One row in the Parameters tab (Temperature, Pressure, etc.)."""
    __tablename__ = "experiment_parameters"
    __table_args__ = (Index("ix_exp_params_exp_id", "experiment_id"),)

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    sort_order:    Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    name:          Mapped[str] = mapped_column(String(100), nullable=False)   # Temperature
    value:         Mapped[Optional[str]] = mapped_column(String(200))         # e.g. "25–30 (ramping)"
    unit:          Mapped[Optional[str]] = mapped_column(String(30))          # °C

    # Formula engine (FIX-03)
    code:                    Mapped[Optional[str]] = mapped_column(String(20))              # P1, P2 … formula references
    input_output:            Mapped[str]           = mapped_column(String(10),  default="INPUT",        nullable=False)
    user_entered_or_formula: Mapped[str]           = mapped_column(String(20),  default="USER ENTERED", nullable=False)
    param_type:              Mapped[str]           = mapped_column(String(10),  default="NUMBER",       nullable=False)
    formula_expression:      Mapped[Optional[str]] = mapped_column(String(500))             # e.g. "P1+P2"
    parameter_value:         Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 6))     # evaluated numeric value
    uom:                     Mapped[Optional[str]] = mapped_column(String(30))              # unit of measure
    remarks:                 Mapped[Optional[str]] = mapped_column(String(500))

    experiment: Mapped["Experiment"] = relationship(back_populates="parameters")


class ExperimentTLC(Base):
    """TLC (Thin Layer Chromatography) observations."""
    __tablename__ = "experiment_tlc"
    __table_args__ = (Index("ix_exp_tlc_exp_id", "experiment_id"),)

    id:                    Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id:         Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    solvent_system:        Mapped[Optional[str]]     = mapped_column(String(255))   # Hexane:EtOAc 7:3
    rf_starting_material:  Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3)) # 0–1
    rf_product:            Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))
    visualization:         Mapped[Optional[str]]     = mapped_column(String(100))   # UV / KMnO4
    image_path:            Mapped[Optional[str]]     = mapped_column(String(500))
    drawing_path:          Mapped[Optional[str]]     = mapped_column(String(500))   # FIX-29: inline TLC drawing
    notes:                 Mapped[Optional[str]]     = mapped_column(Text)
    recorded_at:           Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    experiment: Mapped["Experiment"] = relationship(back_populates="tlc_records")


class ExperimentAttachment(Base):
    __tablename__ = "experiment_attachments"
    __table_args__ = (Index("ix_exp_attach_exp_id", "experiment_id"),)

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    filename:      Mapped[str] = mapped_column(String(255), nullable=False)
    file_path:     Mapped[str] = mapped_column(String(500), nullable=False)
    file_size:     Mapped[Optional[int]]  = mapped_column(BigInteger)     # bytes
    file_type:     Mapped[Optional[str]]  = mapped_column(String(50))    # pdf / xlsx / png
    uploaded_by:   Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    experiment: Mapped["Experiment"] = relationship(back_populates="attachments")


class ExperimentHistory(Base):
    """
    Full audit trail for experiment versioning.


    A row is written every time the experiment status changes or a new
    version is created:
        - Chemist saves / submits   → action = SUBMITTED
        - Team Lead verifies        → action = VERIFIED
        - Team Lead rejects         → action = REJECTED
        - HOD approves              → action = APPROVED
        - HOD rejects               → action = REJECTED
        - QA unlocks                → action = UNLOCKED
        - Chemist creates new ver.  → action = REVISED  (version_number increments)

    snapshot stores the complete experiment fields as JSON at that moment
    so any version can be fully reconstructed for regulatory review.
    """
    __tablename__ = "experiment_history"
    __table_args__ = (
        Index("ix_exp_hist_exp_id",     "experiment_id"),
        Index("ix_exp_hist_action_at",  "action", "action_at"),
    )

    id:                 Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)

    # Which experiment (always the root / v1 id — groups all versions together)
    experiment_id:      Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)

    # Which specific version this event belongs to (join to get version number)
    version_experiment_id: Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))

    # What happened
    # CREATED / SUBMITTED / VERIFIED / APPROVED / REJECTED / UNLOCKED / REVISED / VERIFICATION REQUESTED
    action:             Mapped[str] = mapped_column(String(30), nullable=False)
    action_by:          Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    action_at:          Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    # Context
    rejection_reason:        Mapped[Optional[str]] = mapped_column(Text)
    revision_note:           Mapped[Optional[str]] = mapped_column(Text)
    improvement_suggestions: Mapped[Optional[str]] = mapped_column(Text)          # FIX-23
    submitted_to_user_id:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))  # FIX-06
    save_comments:           Mapped[Optional[str]] = mapped_column(Text)          # FIX-47

    # Full snapshot of the experiment at this point in time (JSON)
    # Stores: title, aim, objective, procedure, observations, conclusion,
    #         inputs[], parameters[], tlc[], yield data, scheme image path
    snapshot:           Mapped[Optional[Dict]] = mapped_column(JSON)

    created_at:         Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    experiment:        Mapped["Experiment"]      = relationship(back_populates="history", foreign_keys=[experiment_id])
    actor:             Mapped["User"]            = relationship(foreign_keys=[action_by])
    submitted_to_user: Mapped[Optional["User"]] = relationship(foreign_keys=[submitted_to_user_id])


class ExperimentComment(Base):
    """
    Comments / notes attached to an experiment (or a specific version).
    Used for reviewer feedback, clarifications, or general discussion.
    """
    __tablename__ = "experiment_comments"
    __table_args__ = (Index("ix_exp_comments_exp_id", "experiment_id"),)

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)
    # Which version this comment was left on (NULL = applies to the whole experiment chain)
    version_experiment_id: Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiments.id"))
    comment:       Mapped[str] = mapped_column(Text, nullable=False)
    # GENERAL / REVIEW_NOTE / REJECTION_REASON / UNLOCK_REQUEST
    comment_type:  Mapped[str] = mapped_column(String(30), default="GENERAL", nullable=False)
    parent_id:     Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("experiment_comments.id"))
    created_by:    Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    is_deleted:    Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    experiment: Mapped["Experiment"] = relationship(back_populates="comments", foreign_keys=[experiment_id])
    creator:    Mapped["User"]       = relationship(foreign_keys=[created_by])


from app.models.notebook import Notebook   # noqa: E402
from app.models.project import Project     # noqa: E402
from app.models.route import Route, Stage  # noqa: E402
from app.models.user import User           # noqa: E402
from app.models.atr import ATR             # noqa: E402
