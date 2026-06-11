"""
Experiment service layer.

Extracts business logic that was previously inlined in routers/experiments.py
into reusable, testable functions.

All functions own their DB flushes but NOT commits — callers own the
transaction so that audit_log rows remain atomic with the business operation.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.base import new_uuid
from app.models.experiment import (
    Experiment,
    ExperimentEquipment,
    ExperimentHistory,
    ExperimentInput,
    ExperimentParameter,
    ExperimentStep,
    ExperimentTLC,
)
from app.models.notebook import Notebook
from app.models.project import Project
from app.models.route import Route, Stage
from app.utils.sequences import next_value


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Code generation ───────────────────────────────────────────────────────────

def build_experiment_code(db: Session, notebook: Notebook) -> tuple[str, str]:
    """
    Build (code, full_code) for a new experiment from the notebook's
    project / route / stage chain.

    Returns:
        ("OQ/R1/S1/E00001", "OQ/R1/S1/E00001/001")
    """
    proj = db.get(Project, notebook.project_id)
    parts = [proj.code if proj else "UNK"]
    if notebook.route_id:
        r = db.get(Route, notebook.route_id)
        if r:
            parts.append(r.code)
    if notebook.stage_id:
        s = db.get(Stage, notebook.stage_id)
        if s:
            parts.append(s.code)
    seq  = next_value(db, "EXP")
    code = "/".join(parts) + f"/E{seq:05d}"
    return code, code + "/001"


# ── Snapshot ──────────────────────────────────────────────────────────────────

def snapshot_experiment(exp: Experiment) -> dict:
    """
    Capture the complete experiment state as a JSON-serialisable dict.

    Stored in ExperimentHistory at every status transition so any prior
    version can be fully reconstructed during regulatory review.
    Includes steps, equipment, and TLC (previously omitted).
    """
    return {
        "title":              exp.title,
        "aim":                exp.aim,
        "objective":          exp.objective,
        "precautions":        exp.precautions,
        "procedure":          exp.procedure,
        "observations":       exp.observations,
        "conclusion":         exp.conclusion,
        "starting_material":  exp.starting_material,
        "target_product":     exp.target_product,
        "reaction_type":      exp.reaction_type,
        "theoretical_yield":  str(exp.theoretical_yield) if exp.theoretical_yield else None,
        "actual_yield":       str(exp.actual_yield) if exp.actual_yield else None,
        "yield_pct":          str(exp.yield_pct) if exp.yield_pct else None,
        "reference_exp_code": exp.reference_exp_code,
        "inputs": [
            {
                "material_name": i.material_name,
                "cas_no":        i.cas_no,
                "formula":       i.formula,
                "quantity":      str(i.quantity) if i.quantity else None,
                "unit":          i.unit,
                "role":          i.role,
                "batch_lot_no":  i.batch_lot_no,
                "vendor_name":   i.vendor_name,
                "moles":         str(i.moles) if i.moles else None,
                "mole_ratio":    str(i.mole_ratio) if i.mole_ratio else None,
                "purity_pct":    str(i.purity_pct) if i.purity_pct else None,
                "density":       str(i.density) if i.density else None,
                "molarity":      str(i.molarity) if i.molarity else None,
            }
            for i in exp.inputs
        ],
        "parameters": [
            {
                "code":               p.code,
                "name":               p.name,
                "value":              p.value,
                "parameter_value":    str(p.parameter_value) if p.parameter_value else None,
                "unit":               p.unit,
                "uom":                p.uom,
                "input_output":       p.input_output,
                "formula_expression": p.formula_expression,
            }
            for p in exp.parameters
        ],
        "steps": [
            {
                "step_no":          s.step_no,
                "procedure_text":   s.procedure_text,
                "observation_text": s.observation_text,
                "qty":              s.qty,
                "temperature":      s.temperature,
            }
            for s in exp.steps
        ],
        "equipment": [
            {
                "instrument_code":    e.instrument_code,
                "instrument_name":    e.instrument_name,
                "instrument_type":    e.instrument_type,
                "calibration_status": e.calibration_status,
                "maintenance_status": e.maintenance_status,
            }
            for e in exp.equipment
        ],
        "tlc_records": [
            {
                "solvent_system":       t.solvent_system,
                "rf_starting_material": str(t.rf_starting_material) if t.rf_starting_material else None,
                "rf_product":           str(t.rf_product) if t.rf_product else None,
                "visualization":        t.visualization,
            }
            for t in exp.tlc_records
        ],
    }


# ── History ───────────────────────────────────────────────────────────────────

def write_history(
    db:                   Session,
    exp:                  Experiment,
    action:               str,
    user_id:              str,
    rejection_reason:     Optional[str] = None,
    revision_note:        Optional[str] = None,
    improvement_suggestions: Optional[str] = None,
    submitted_to_user_id: Optional[str] = None,
    save_comments:        Optional[str] = None,
) -> ExperimentHistory:
    """
    Append one history row to the experiment's audit chain.

    Always linked to the root experiment ID so all versions are
    queryable together. Does NOT commit — caller owns the transaction.
    """
    root_id = exp.root_experiment_id or exp.id
    entry = ExperimentHistory(
        id=new_uuid(),
        experiment_id=root_id,
        version_experiment_id=exp.id,
        action=action,
        action_by=user_id,
        action_at=_now(),
        rejection_reason=rejection_reason,
        revision_note=revision_note,
        improvement_suggestions=improvement_suggestions,
        submitted_to_user_id=submitted_to_user_id,
        save_comments=save_comments,
        snapshot=snapshot_experiment(exp),
    )
    db.add(entry)
    return entry


# ── Version copy ──────────────────────────────────────────────────────────────

def copy_child_relations(
    db:     Session,
    source: Experiment,
    target: Experiment,
) -> None:
    """
    Copy all child relations from source to target experiment.

    Covers: inputs, parameters, steps, equipment, TLC records.
    Attachment binaries and TLC image files are NOT copied — they
    remain anchored to the source version.

    Does NOT commit — caller owns the transaction.
    """
    # ── Inputs ────────────────────────────────────────────────────────────────
    for inp in source.inputs:
        db.add(ExperimentInput(
            id=new_uuid(), experiment_id=target.id,
            sort_order=inp.sort_order,
            material_name=inp.material_name,
            cas_no=inp.cas_no,
            formula=inp.formula,
            mol_weight=inp.mol_weight,
            quantity=inp.quantity,
            unit=inp.unit,
            moles=inp.moles,
            mole_ratio=inp.mole_ratio,
            purity_pct=inp.purity_pct,
            role=inp.role,
            batch_lot_no=inp.batch_lot_no,
            vendor_name=inp.vendor_name,
            batch_no=inp.batch_no,
            available_qty=inp.available_qty,
            required_qty=inp.required_qty,
            required_qty_unit=inp.required_qty_unit,
            density=inp.density,
            strength=inp.strength,
            ww_ratio=inp.ww_ratio,
            molarity=inp.molarity,
            remarks=inp.remarks,
        ))

    # ── Parameters ────────────────────────────────────────────────────────────
    for p in source.parameters:
        db.add(ExperimentParameter(
            id=new_uuid(), experiment_id=target.id,
            sort_order=p.sort_order,
            name=p.name,
            value=p.value,
            unit=p.unit,
            code=p.code,
            input_output=p.input_output,
            user_entered_or_formula=p.user_entered_or_formula,
            param_type=p.param_type,
            formula_expression=p.formula_expression,
            parameter_value=p.parameter_value,
            uom=p.uom,
            remarks=p.remarks,
        ))

    # ── Steps ─────────────────────────────────────────────────────────────────
    for step in source.steps:
        db.add(ExperimentStep(
            id=new_uuid(), experiment_id=target.id,
            step_no=step.step_no,
            procedure_text=step.procedure_text,
            observation_text=step.observation_text,
            qty=step.qty,
            temperature=step.temperature,
            # attachment_path / attachment_name / attachment_size intentionally
            # not copied — binary assets remain anchored to the source version.
        ))

    # ── Equipment ─────────────────────────────────────────────────────────────
    for eq in source.equipment:
        db.add(ExperimentEquipment(
            id=new_uuid(), experiment_id=target.id,
            instrument_code=eq.instrument_code,
            instrument_type=eq.instrument_type,
            instrument_name=eq.instrument_name,
            maintenance_status=eq.maintenance_status,
            calibration_status=eq.calibration_status,
            start_time=eq.start_time,
            end_time=eq.end_time,
            remarks=eq.remarks,
        ))

    # ── TLC records ───────────────────────────────────────────────────────────
    for tlc in source.tlc_records:
        db.add(ExperimentTLC(
            id=new_uuid(), experiment_id=target.id,
            solvent_system=tlc.solvent_system,
            rf_starting_material=tlc.rf_starting_material,
            rf_product=tlc.rf_product,
            visualization=tlc.visualization,
            notes=tlc.notes,
            # image_path / drawing_path not copied — files stay with source version
        ))
