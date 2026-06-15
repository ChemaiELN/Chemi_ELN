"""
Seed script: create linked preliminary + synthesis experiment data for testing.

Creates:
  1. A LOCKED preliminary experiment with correct dispositions
     → used to verify GET /{id}/preliminary-data and the submit gate pass case
  2. A DRAFT synthesis experiment linked to the above
     → used to verify GET /{id}/preliminary-data and submit (should pass gate)
  3. A LOCKED preliminary experiment with WRONG dispositions (Hold)
     → used to verify the submit gate blocks a linked synthesis
  4. A DRAFT synthesis experiment linked to the wrong-disposition preliminary
     → submitting this should return 400 "Release for conjugation"

Run from the backend directory:
    python seed_linked_synthesis.py
"""
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from app.db.session import SessionLocal
from app.models.experiment import Experiment, ExperimentHistory
from app.models.notebook import Notebook

db = SessionLocal()

# ── Constants ──────────────────────────────────────────────────────────────────
ADMIN_ID   = "05ac0012-4730-4bc1-933e-759343b5c3fd"   # sys.admin
PROJECT_ID = "4ad4db60-9b29-4c7c-92db-4f0bc52e7ea5"   # PRJ001
SYNTH_TMPL = "91eae5bf-c642-4b21-b0c1-785e7e7b259e"   # adc-synthesis template

now = datetime.now(timezone.utc)


def make_id():
    return str(uuid.uuid4())


def next_exp_code(db) -> tuple[str, str, int]:
    """Return (base_code, full_code, next_number)."""
    from sqlalchemy import func, text
    codes = [e.base_code for e in db.query(Experiment).all() if e.base_code.startswith("EXP-")]
    nums  = [int(c.split("-")[1]) for c in codes]
    nxt   = max(nums) + 1 if nums else 1
    base  = f"EXP-{nxt:03d}"
    full  = f"{base}-01"
    return base, full, nxt


def log_history(exp_id, action, actor_id=ADMIN_ID):
    return ExperimentHistory(
        id=make_id(),
        experiment_id=exp_id,
        actor_id=actor_id,
        action=action,
        details={},
        created_at=now,
    )


# ──────────────────────────────────────────────────────────────────────────────
print("\n=== Seed: linked preliminary + synthesis data ===\n")

# ── 1. Preliminary notebook (reuse existing or create) ────────────────────────
prelim_nb = db.query(Notebook).filter(
    Notebook.code == "PRELIM-NB-SEED-001"
).first()

if not prelim_nb:
    prelim_nb = Notebook(
        id=make_id(),
        code="PRELIM-NB-SEED-001",
        title="ADC Preliminary Notebook (Seed)",
        project_id=PROJECT_ID,
        type="preliminary",
        created_by=ADMIN_ID,
        status="ACTIVE",
    )
    db.add(prelim_nb)
    db.flush()
    print(f"  Created preliminary notebook: {prelim_nb.id}")
else:
    print(f"  Reusing preliminary notebook: {prelim_nb.id}")


# ── 2. LOCKED preliminary experiment with CORRECT dispositions ────────────────
good_prelim = db.query(Experiment).filter(
    Experiment.notebook_id == prelim_nb.id,
    Experiment.base_code.like("EXP-%"),
    Experiment.status == "LOCKED",
).filter(
    Experiment.data.op("->>")(  # JSONB ->> operator
        "disposition"
    ) == "Release for conjugation"
).first()

if not good_prelim:
    base, full, _ = next_exp_code(db)
    good_prelim = Experiment(
        id=make_id(),
        notebook_id=prelim_nb.id,
        project_id=PROJECT_ID,
        base_code=base,
        version=1,
        full_code=full,
        title="ADC Preliminary — Released (Seed)",
        status="LOCKED",
        is_latest_version=True,
        created_by=ADMIN_ID,
        submitted_by=ADMIN_ID,
        submitted_at=now,
        approved_by=ADMIN_ID,
        approved_at=now,
        data={
            # mAb characterisation
            "antibody_lot_id":      "LOT-MAB-2026-001",
            "antibody_name":        "Trastuzumab",
            "concentration_mg_ml":  10.5,
            "monomer_purity_pct":   98.2,
            "endotoxin_eu_ml":      0.08,
            "mab_acidic_pct":       4.2,
            "mab_main_pct":         91.5,
            "mab_basic_pct":        4.3,
            # LP characterisation
            "lp_lot_id":            "LOT-LP-2026-007",
            "lp_name":              "MMAE-LP-003",
            "lp_concentration_mm":  10.0,
            "lp_main_peak_purity":  97.8,
            "lp_dimer_pct":         0.6,
            # Dispositions
            "disposition":          "Release for conjugation",
            "lp_disposition":       "Release for conjugation",
            "disposition_remarks":  "All specs met. Released by QA.",
        },
        created_at=now,
        updated_at=now,
    )
    db.add(good_prelim)
    db.add(log_history(good_prelim.id, "CREATED"))
    db.add(log_history(good_prelim.id, "SUBMITTED"))
    db.add(log_history(good_prelim.id, "APPROVED"))
    db.flush()
    print(f"  Created LOCKED preliminary (good): {good_prelim.full_code} id={good_prelim.id}")
else:
    print(f"  Reusing LOCKED preliminary (good): {good_prelim.full_code} id={good_prelim.id}")


# ── 3. LOCKED preliminary experiment with WRONG dispositions ──────────────────
bad_prelim = db.query(Experiment).filter(
    Experiment.notebook_id == prelim_nb.id,
    Experiment.status == "LOCKED",
).filter(
    Experiment.data.op("->>")(
        "disposition"
    ) == "Hold"
).first()

if not bad_prelim:
    base, full, _ = next_exp_code(db)
    bad_prelim = Experiment(
        id=make_id(),
        notebook_id=prelim_nb.id,
        project_id=PROJECT_ID,
        base_code=base,
        version=1,
        full_code=full,
        title="ADC Preliminary — Hold (Seed)",
        status="LOCKED",
        is_latest_version=True,
        created_by=ADMIN_ID,
        submitted_by=ADMIN_ID,
        submitted_at=now,
        approved_by=ADMIN_ID,
        approved_at=now,
        data={
            "antibody_lot_id":   "LOT-MAB-2026-002",
            "antibody_name":     "Trastuzumab",
            "concentration_mg_ml": 9.8,
            "monomer_purity_pct":  92.1,
            # Bad dispositions
            "disposition":       "Hold",
            "lp_disposition":    "Hold",
            "disposition_remarks": "Monomer purity below threshold. On hold.",
        },
        created_at=now,
        updated_at=now,
    )
    db.add(bad_prelim)
    db.add(log_history(bad_prelim.id, "CREATED"))
    db.add(log_history(bad_prelim.id, "SUBMITTED"))
    db.add(log_history(bad_prelim.id, "APPROVED"))
    db.flush()
    print(f"  Created LOCKED preliminary (bad/Hold): {bad_prelim.full_code} id={bad_prelim.id}")
else:
    print(f"  Reusing LOCKED preliminary (bad/Hold): {bad_prelim.full_code} id={bad_prelim.id}")


# ── 4. Synthesis notebook ──────────────────────────────────────────────────────
synth_nb = db.query(Notebook).filter(
    Notebook.code == "SYNTH-NB-SEED-001"
).first()

if not synth_nb:
    synth_nb = Notebook(
        id=make_id(),
        code="SYNTH-NB-SEED-001",
        title="ADC Synthesis Notebook (Seed)",
        project_id=PROJECT_ID,
        type="synthesis",
        linked_notebook_id=prelim_nb.id,
        template_id=SYNTH_TMPL,
        created_by=ADMIN_ID,
        status="ACTIVE",
    )
    db.add(synth_nb)
    db.flush()
    print(f"  Created synthesis notebook: {synth_nb.id}")
else:
    print(f"  Reusing synthesis notebook: {synth_nb.id}")


# ── 5. DRAFT synthesis experiment linked to GOOD preliminary ──────────────────
good_synth = db.query(Experiment).filter(
    Experiment.notebook_id == synth_nb.id,
    Experiment.linked_preliminary_id == good_prelim.id,
    Experiment.status == "DRAFT",
).first()

if not good_synth:
    base, full, _ = next_exp_code(db)
    good_synth = Experiment(
        id=make_id(),
        notebook_id=synth_nb.id,
        project_id=PROJECT_ID,
        base_code=base,
        version=1,
        full_code=full,
        title="ADC Synthesis — Linked to Released Prelim (Seed)",
        status="DRAFT",
        is_latest_version=True,
        linked_preliminary_id=good_prelim.id,
        created_by=ADMIN_ID,
        data={
            "_workflow_screen":   "syn_study_objective",
            "_workflow_section":  "pre_synthesis_planning",
            "study_type":         "ADC Synthesis — Phase I",
        },
        created_at=now,
        updated_at=now,
    )
    db.add(good_synth)
    db.add(log_history(good_synth.id, "CREATED"))
    db.flush()
    print(f"  Created DRAFT synthesis (good link): {good_synth.full_code} id={good_synth.id}")
else:
    print(f"  Reusing DRAFT synthesis (good link): {good_synth.full_code} id={good_synth.id}")


# ── 6. DRAFT synthesis experiment linked to BAD preliminary ───────────────────
bad_synth = db.query(Experiment).filter(
    Experiment.notebook_id == synth_nb.id,
    Experiment.linked_preliminary_id == bad_prelim.id,
    Experiment.status == "DRAFT",
).first()

if not bad_synth:
    base, full, _ = next_exp_code(db)
    bad_synth = Experiment(
        id=make_id(),
        notebook_id=synth_nb.id,
        project_id=PROJECT_ID,
        base_code=base,
        version=1,
        full_code=full,
        title="ADC Synthesis — Linked to Held Prelim (Seed)",
        status="DRAFT",
        is_latest_version=True,
        linked_preliminary_id=bad_prelim.id,
        created_by=ADMIN_ID,
        data={
            "_workflow_screen":   "syn_study_objective",
            "_workflow_section":  "pre_synthesis_planning",
        },
        created_at=now,
        updated_at=now,
    )
    db.add(bad_synth)
    db.add(log_history(bad_synth.id, "CREATED"))
    db.flush()
    print(f"  Created DRAFT synthesis (bad link): {bad_synth.full_code} id={bad_synth.id}")
else:
    print(f"  Reusing DRAFT synthesis (bad link): {bad_synth.full_code} id={bad_synth.id}")


# Capture IDs before closing session
good_prelim_id   = good_prelim.id
good_prelim_code = good_prelim.full_code
bad_prelim_id    = bad_prelim.id
bad_prelim_code  = bad_prelim.full_code
good_synth_id    = good_synth.id
good_synth_code  = good_synth.full_code
bad_synth_id     = bad_synth.id
bad_synth_code   = bad_synth.full_code

db.commit()
db.close()

print("\n=== Done ===")
print(f"\n  Good preliminary  : {good_prelim_code}  ({good_prelim_id})")
print(f"  Bad preliminary   : {bad_prelim_code}   ({bad_prelim_id})")
print(f"  Good synthesis    : {good_synth_code}  ({good_synth_id})")
print(f"  Bad synthesis     : {bad_synth_code}   ({bad_synth_id})")
print()
print("  Test cases:")
print(f"  GET  /api/experiments/{good_synth_id}/preliminary-data  -> 200 with mAb + LP data")
print(f"  POST /api/experiments/{good_synth_id}/submit            -> 200 (gate passes)")
print(f"  POST /api/experiments/{bad_synth_id}/submit             -> 400 disposition blocked")
