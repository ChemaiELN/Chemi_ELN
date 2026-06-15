"""
Seed script: insert / update ADC Synthesis workflow template.

Run from the backend directory:
    python seed_adc_synthesis.py

Template covers the synthesis workflow up to and including TFF purification.

Fields sourced at runtime (not in template definition):
  - Preliminary:  antibody_lot_id, concentration, monomer_purity_pct, lp_lot_id,
                  lp_concentration, main_peak_purity_pct, disposition fields
                  (read from linked_preliminary_id → experiments.data)
  - Inventory:    batch_no, manufacturer_name, qty_available, expiry_date,
                  mol_weight, purity_pct, location
                  (read from inv_materials + inv_batches at screen load)
  - Auto-stamped: start_time, end_time, operator (system-generated at action time)
  - Carry-forward: output_sample_id from one step becomes input_sample_id of next

Only user-entered and calculated fields are in the template definition.
"""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.workflow_template import WorkflowTemplate

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set.")
    sys.exit(1)

SLUG = "adc-synthesis"

DEFINITION = {
    "sections": [

        # ── 2.1 Pre-Synthesis Planning ─────────────────────────────────────────
        {
            "key":   "pre_synthesis_planning",
            "title": "2.1 Pre-Synthesis Planning",
            "screens": [

                # ── Screen 1: Study Objective ──────────────────────────────────
                {
                    "key":           "syn_study_objective",
                    "title":         "Study Objective",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "study_type",
                            "label": "Study Type",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["PD - Early Stage", "PD - Late Stage", "GMP", "Clinical"],
                        },
                        {
                            "key": "scale",
                            "label": "Scale",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Micro (< 1 mg)", "Small (1–10 mg)", "Medium (10–100 mg)", "Large (> 100 mg)"],
                        },
                        {
                            "key": "target_dar",
                            "label": "Target DAR",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 4",
                            "options": [],
                        },
                        {
                            "key": "conjugation_chemistry",
                            "label": "Conjugation Chemistry",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Cysteine", "Lysine", "Site-specific"],
                        },
                        {
                            "key": "study_rationale",
                            "label": "Study Rationale",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Describe the purpose and scientific rationale…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 2: Material Receipt & Qualification ─────────────────
                {
                    "key":           "syn_material_receipt",
                    "title":         "Material Receipt & Qualification",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {
                            "key": "mab_coa_status",
                            "label": "mAb CoA Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Verified", "Pending", "Failed"],
                        },
                        {
                            "key": "tcep_coa_status",
                            "label": "TCEP CoA Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Verified", "Pending", "Failed"],
                        },
                        {
                            "key": "lp_coa_status",
                            "label": "Linker-Payload CoA Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Verified", "Pending", "Failed"],
                        },
                        {
                            "key": "dmso_coa_status",
                            "label": "DMSO CoA Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Verified", "Pending", "Failed"],
                        },
                        {
                            "key": "nac_coa_status",
                            "label": "NAC CoA Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Verified", "Pending", "Failed"],
                        },
                        {
                            "key": "receipt_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter any receipt observations or discrepancies…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 3: Material Selection & Reservation ─────────────────
                {
                    "key":           "syn_material_reservation",
                    "title":         "Material Selection & Reservation",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "mab_qty_reserved",
                            "label": "mAb Quantity Reserved",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 0.5 mL",
                            "options": [],
                        },
                        {
                            "key": "tcep_qty_reserved",
                            "label": "TCEP Quantity Reserved",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 5 mg",
                            "options": [],
                        },
                        {
                            "key": "lp_qty_reserved",
                            "label": "Linker-Payload Quantity Reserved",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 0.2 mL",
                            "options": [],
                        },
                        {
                            "key": "dmso_qty_reserved",
                            "label": "DMSO Quantity Reserved",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 1 mL",
                            "options": [],
                        },
                        {
                            "key": "nac_qty_reserved",
                            "label": "NAC Quantity Reserved",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 2 mg",
                            "options": [],
                        },
                        {
                            "key": "reservation_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter reservation notes…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 4: Reaction Setup & Planning ────────────────────────
                {
                    "key":           "syn_reaction_setup",
                    "title":         "Reaction Setup & Planning",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "total_reaction_volume_ml",
                            "label": "Total Reaction Volume (mL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "target_mab_mass_mg",
                            "label": "Target mAb Mass (mg)",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "tcep_molar_ratio",
                            "label": "TCEP Molar Ratio (eq)",
                            "type": "text",
                            "required": True,
                            "placeholder": "6.00",
                            "options": [],
                        },
                        {
                            "key": "lp_molar_ratio",
                            "label": "LP Molar Ratio (eq)",
                            "type": "text",
                            "required": True,
                            "placeholder": "12.00",
                            "options": [],
                        },
                        {
                            "key": "nac_molar_ratio",
                            "label": "NAC Molar Ratio (eq vs LP)",
                            "type": "text",
                            "required": True,
                            "placeholder": "5",
                            "options": [],
                        },
                        {
                            "key": "reduction_temp_c",
                            "label": "Reduction Temperature (°C)",
                            "type": "text",
                            "required": True,
                            "placeholder": "37",
                            "options": [],
                        },
                        {
                            "key": "reduction_time_min",
                            "label": "Reduction Time (min)",
                            "type": "text",
                            "required": True,
                            "placeholder": "90",
                            "options": [],
                        },
                        {
                            "key": "conjugation_temp_c",
                            "label": "Conjugation Temperature (°C)",
                            "type": "text",
                            "required": True,
                            "placeholder": "25",
                            "options": [],
                        },
                        {
                            "key": "conjugation_time_min",
                            "label": "Conjugation Time (min)",
                            "type": "text",
                            "required": True,
                            "placeholder": "120",
                            "options": [],
                        },
                        {
                            "key": "quench_time_min",
                            "label": "Quench Time (min)",
                            "type": "text",
                            "required": True,
                            "placeholder": "15",
                            "options": [],
                        },
                        {
                            "key": "setup_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter setup notes or deviations from standard conditions…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 5: System Checks ────────────────────────────────────
                {
                    "key":           "syn_system_checks",
                    "title":         "System Checks",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "training_check",
                            "label": "Training current",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail"],
                        },
                        {
                            "key": "training_ref",
                            "label": "Training Record Reference",
                            "type": "text",
                            "required": False,
                            "placeholder": "e.g. TR-2026-041",
                            "options": [],
                        },
                        {
                            "key": "system_access_check",
                            "label": "System access verified",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail"],
                        },
                        {
                            "key": "template_version_check",
                            "label": "Template version confirmed",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail"],
                        },
                        {
                            "key": "material_availability_check",
                            "label": "Materials available & reserved",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail"],
                        },
                        {
                            "key": "equipment_check",
                            "label": "Equipment calibration current",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail"],
                        },
                        {
                            "key": "bsl_level",
                            "label": "BSL Level",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["BSL-1", "BSL-2"],
                        },
                        {
                            "key": "containment_check",
                            "label": "Containment verified",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail"],
                        },
                        {
                            "key": "system_check_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter system check observations…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 6: Pre-Synthesis E-Signature ───────────────────────
                {
                    "key":           "syn_presynthesis_esig",
                    "title":         "Supervisor Pre-Synthesis Review & E-Signature",
                    "persona":       "Reviewer",
                    "has_signature": True,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "scientist_comments",
                            "label": "Scientist Comments",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter scientist comments…",
                            "options": [],
                        },
                        {
                            "key": "synthesis_approved",
                            "label": "Disposition",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Approved to proceed", "Approved with conditions", "Hold – further review required", "Rejected"],
                        },
                        {
                            "key": "scientist_username",
                            "label": "Scientist Username",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "scientist_password",
                            "label": "Password (2nd component)",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "scientist_sign_reason",
                            "label": "Reason for Signature (Scientist)",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Authored and submitted", "Re-submitted after revision"],
                        },
                        {
                            "key": "scientist_sign_timestamp",
                            "label": "Signature Timestamp (Scientist)",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on signing",
                            "options": [],
                        },
                        {
                            "key": "reviewer_comments",
                            "label": "Reviewer Comments",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter reviewer comments…",
                            "options": [],
                        },
                        {
                            "key": "reviewer_username",
                            "label": "Reviewer Username",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "reviewer_password",
                            "label": "Password (2nd component)",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "reviewer_sign_reason",
                            "label": "Reason for Signature (Reviewer)",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Peer reviewed and approved", "Supervisor reviewed and approved", "Approved with comments"],
                        },
                        {
                            "key": "reviewer_sign_timestamp",
                            "label": "Signature Timestamp (Reviewer)",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on signing",
                            "options": [],
                        },
                    ],
                },
            ],
        },

        # ── 2.2 Manufacturing Steps (through Purification) ─────────────────────
        {
            "key":   "manufacturing_steps",
            "title": "2.2 Manufacturing Steps",
            "screens": [

                # ── Screen 7: Mfg Step 1 — Thaw / Pool / Filter ───────────────
                {
                    "key":           "syn_mfg_step1_thaw",
                    "title":         "Mfg Step 1 — Thaw, Pool & Filter mAb",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "s1_vials_thawed",
                            "label": "Number of Vials Thawed",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "s1_vial_volume_ul",
                            "label": "Volume per Vial (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "s1_total_volume_ul",
                            "label": "Total Pooled Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: vials × volume per vial",
                            "options": [],
                        },
                        {
                            "key": "s1_pooled_conc_mg_ml",
                            "label": "Pooled Concentration (mg/mL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Measured post-pooling",
                            "options": [],
                        },
                        {
                            "key": "s1_filter_membrane_type",
                            "label": "Filter Membrane Type",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 0.22 µm PES",
                            "options": [],
                        },
                        {
                            "key": "s1_post_filter_volume_ul",
                            "label": "Post-filter Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Measured after filtration",
                            "options": [],
                        },
                        {
                            "key": "s1_post_filter_conc_mg_ml",
                            "label": "Post-filter Concentration (mg/mL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Measured after filtration",
                            "options": [],
                        },
                        {
                            "key": "s1_output_sample_id",
                            "label": "Output Sample ID",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. Reduced_Input_001",
                            "options": [],
                        },
                        {
                            "key": "s1_bioburden",
                            "label": "IPC: Bioburden",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail", "Pending"],
                        },
                        {
                            "key": "s1_endotoxin",
                            "label": "IPC: Endotoxin",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail", "Pending"],
                        },
                        {
                            "key": "s1_start_time",
                            "label": "Start Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on start",
                            "options": [],
                        },
                        {
                            "key": "s1_end_time",
                            "label": "End Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on completion",
                            "options": [],
                        },
                        {
                            "key": "s1_operator",
                            "label": "Operator",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-filled from current user",
                            "options": [],
                        },
                        {
                            "key": "s1_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter step observations or deviations…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 8: Mfg Step 2 — Reduction (TCEP) ──────────────────
                {
                    "key":           "syn_mfg_step2_reduction",
                    "title":         "Mfg Step 2 — Reduction Reaction (TCEP)",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "s2_mab_volume_ul",
                            "label": "mAb Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated from target mass ÷ concentration",
                            "options": [],
                        },
                        {
                            "key": "s2_mab_mass_mg",
                            "label": "mAb Mass (mg)",
                            "type": "text",
                            "required": True,
                            "placeholder": "From reaction setup screen",
                            "options": [],
                        },
                        {
                            "key": "s2_mab_moles_nmol",
                            "label": "mAb Moles (nmol)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: mass (mg) ÷ mol_weight × 10⁶",
                            "options": [],
                        },
                        {
                            "key": "s2_tcep_mass_mg",
                            "label": "TCEP Mass (mg)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: moles × ratio × TCEP MW",
                            "options": [],
                        },
                        {
                            "key": "s2_tcep_volume_ul",
                            "label": "TCEP Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated from stock concentration",
                            "options": [],
                        },
                        {
                            "key": "s2_reaction_buffer",
                            "label": "Reaction Buffer",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. PBS pH 7.4",
                            "options": [],
                        },
                        {
                            "key": "s2_reaction_volume_ul",
                            "label": "Final Reaction Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "s2_output_sample_id",
                            "label": "Output Sample ID",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. Reduced_mAb_001",
                            "options": [],
                        },
                        {
                            "key": "s2_observations",
                            "label": "Observations",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter observations during reaction…",
                            "options": [],
                        },
                        {
                            "key": "s2_deviations",
                            "label": "Deviations",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["None", "Yes – documented in remarks"],
                        },
                        {
                            "key": "s2_start_time",
                            "label": "Start Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on start",
                            "options": [],
                        },
                        {
                            "key": "s2_end_time",
                            "label": "End Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on completion",
                            "options": [],
                        },
                        {
                            "key": "s2_operator",
                            "label": "Operator",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-filled from current user",
                            "options": [],
                        },
                        {
                            "key": "s2_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter deviation details or additional notes…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 9: Mfg Step 3 — Conjugation (LP) ──────────────────
                {
                    "key":           "syn_mfg_step3_conjugation",
                    "title":         "Mfg Step 3 — Conjugation Reaction (Linker-Payload)",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "s3_lp_mass_mg",
                            "label": "LP Mass (mg)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: mAb moles × LP ratio × LP MW ÷ purity",
                            "options": [],
                        },
                        {
                            "key": "s3_lp_volume_ul",
                            "label": "LP Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated from stock concentration",
                            "options": [],
                        },
                        {
                            "key": "s3_dma_volume_ul",
                            "label": "DMA Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "s3_reaction_volume_ul",
                            "label": "Final Reaction Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "s3_output_sample_id",
                            "label": "Output Sample ID",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. Crude_ADC_001",
                            "options": [],
                        },
                        {
                            "key": "s3_optional_chromatography",
                            "label": "Optional Intermediate Chromatography",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Not applicable", "Applied – see attached report"],
                        },
                        {
                            "key": "s3_observations",
                            "label": "Observations",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter observations during conjugation…",
                            "options": [],
                        },
                        {
                            "key": "s3_deviations",
                            "label": "Deviations",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["None", "Yes – documented in remarks"],
                        },
                        {
                            "key": "s3_start_time",
                            "label": "Start Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on start",
                            "options": [],
                        },
                        {
                            "key": "s3_end_time",
                            "label": "End Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on completion",
                            "options": [],
                        },
                        {
                            "key": "s3_operator",
                            "label": "Operator",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-filled from current user",
                            "options": [],
                        },
                        {
                            "key": "s3_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter deviation details or additional notes…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 10: Mfg Step 4 — In-Process Analysis (ARD) ─────────
                {
                    "key":           "syn_mfg_step4_inprocess",
                    "title":         "Mfg Step 4 — In-Process Analysis (ARD Handoff)",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {
                            "key": "s4_ard_reference_no",
                            "label": "ARD Reference No",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. ARD-2026-041",
                            "options": [],
                        },
                        {
                            "key": "s4_lc_ms_status",
                            "label": "LC-MS Test Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Submitted", "In Progress", "Complete", "Failed"],
                        },
                        {
                            "key": "s4_lc_ms_result",
                            "label": "LC-MS Result Summary",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Summarise LC-MS findings…",
                            "options": [],
                        },
                        {
                            "key": "s4_rp_hplc_status",
                            "label": "RP-HPLC Test Status",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Submitted", "In Progress", "Complete", "Failed"],
                        },
                        {
                            "key": "s4_rp_hplc_result",
                            "label": "RP-HPLC Result Summary",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Summarise RP-HPLC findings…",
                            "options": [],
                        },
                        {
                            "key": "s4_go_nogo",
                            "label": "Go / No-Go Decision",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Go – proceed to quench", "No-Go – hold for review"],
                        },
                        {
                            "key": "s4_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter additional analytical notes…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 11: Mfg Step 5 — Quench (NAC) ─────────────────────
                {
                    "key":           "syn_mfg_step5_quench",
                    "title":         "Mfg Step 5 — Quench Reaction (NAC)",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "s5_nac_mass_mg",
                            "label": "NAC Mass (mg)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: LP moles × NAC ratio × NAC MW",
                            "options": [],
                        },
                        {
                            "key": "s5_nac_volume_ul",
                            "label": "NAC Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated from stock concentration",
                            "options": [],
                        },
                        {
                            "key": "s5_quench_temp_c",
                            "label": "Quench Temperature (°C)",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 25",
                            "options": [],
                        },
                        {
                            "key": "s5_output_sample_id",
                            "label": "Output Sample ID",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. Quenched_ADC_001",
                            "options": [],
                        },
                        {
                            "key": "s5_observations",
                            "label": "Observations",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter observations during quench…",
                            "options": [],
                        },
                        {
                            "key": "s5_start_time",
                            "label": "Start Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on start",
                            "options": [],
                        },
                        {
                            "key": "s5_end_time",
                            "label": "End Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on completion",
                            "options": [],
                        },
                        {
                            "key": "s5_operator",
                            "label": "Operator",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-filled from current user",
                            "options": [],
                        },
                        {
                            "key": "s5_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter step observations or deviations…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 12: Mfg Step 6 — TFF Purification ─────────────────
                {
                    "key":           "syn_mfg_step6_tff",
                    "title":         "Mfg Step 6 — TFF Purification",
                    "persona":       "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "s6_membrane_type",
                            "label": "Membrane Type (MWCO)",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. 30 kDa PES",
                            "options": [],
                        },
                        {
                            "key": "s6_feed_flow_rate_ml_min",
                            "label": "Feed Flow Rate (mL/min)",
                            "type": "text",
                            "required": True,
                            "placeholder": "12",
                            "options": [],
                        },
                        {
                            "key": "s6_tmp_psi",
                            "label": "Transmembrane Pressure (psi)",
                            "type": "text",
                            "required": True,
                            "placeholder": "8",
                            "options": [],
                        },
                        {
                            "key": "s6_diafiltration_volumes",
                            "label": "Diafiltration Volumes (DV)",
                            "type": "text",
                            "required": True,
                            "placeholder": "7",
                            "options": [],
                        },
                        {
                            "key": "s6_diafiltration_buffer",
                            "label": "Diafiltration Buffer",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. PBS pH 7.4",
                            "options": [],
                        },
                        {
                            "key": "s6_pre_tff_volume_ul",
                            "label": "Pre-TFF Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Carry-forward from Step 5",
                            "options": [],
                        },
                        {
                            "key": "s6_pre_tff_conc_mg_ml",
                            "label": "Pre-TFF Concentration (mg/mL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Measured before TFF",
                            "options": [],
                        },
                        {
                            "key": "s6_post_tff_volume_ul",
                            "label": "Post-TFF Volume (µL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Measured after TFF",
                            "options": [],
                        },
                        {
                            "key": "s6_post_tff_conc_mg_ml",
                            "label": "Post-TFF Concentration (mg/mL)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Measured after TFF",
                            "options": [],
                        },
                        {
                            "key": "s6_yield_pct",
                            "label": "TFF Yield (%)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: (post vol × post conc) ÷ (pre vol × pre conc) × 100",
                            "options": [],
                        },
                        {
                            "key": "s6_output_sample_id",
                            "label": "Output Sample ID",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. Purified_ADC_001",
                            "options": [],
                        },
                        {
                            "key": "s6_bioburden_post_tff",
                            "label": "IPC: Bioburden (post-TFF)",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail", "Pending"],
                        },
                        {
                            "key": "s6_endotoxin_post_tff",
                            "label": "IPC: Endotoxin (post-TFF)",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Pass", "Fail", "Pending"],
                        },
                        {
                            "key": "s6_observations",
                            "label": "Observations",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter TFF process observations…",
                            "options": [],
                        },
                        {
                            "key": "s6_start_time",
                            "label": "Start Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on start",
                            "options": [],
                        },
                        {
                            "key": "s6_end_time",
                            "label": "End Time",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on completion",
                            "options": [],
                        },
                        {
                            "key": "s6_operator",
                            "label": "Operator",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-filled from current user",
                            "options": [],
                        },
                        {
                            "key": "s6_remarks",
                            "label": "Remarks",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter step observations or deviations…",
                            "options": [],
                        },
                    ],
                },

                # ── Screen 13: Purification Review & E-Signature ──────────────
                {
                    "key":           "syn_purification_esig",
                    "title":         "Purification Review & E-Signature",
                    "persona":       "Reviewer",
                    "has_signature": True,
                    "has_files":     False,
                    "fields": [
                        {
                            "key": "purification_summary",
                            "label": "Purification Summary",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Summarise the purification outcome…",
                            "options": [],
                        },
                        {
                            "key": "total_mass_recovered_mg",
                            "label": "Total Mass Recovered (mg)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: post-TFF volume × post-TFF concentration",
                            "options": [],
                        },
                        {
                            "key": "overall_yield_pct",
                            "label": "Overall Yield (%)",
                            "type": "text",
                            "required": True,
                            "placeholder": "Calculated: recovered mass ÷ input mass × 100",
                            "options": [],
                        },
                        {
                            "key": "disposition",
                            "label": "Disposition",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Release for characterization", "Hold – repeat testing required", "Reject"],
                        },
                        {
                            "key": "scientist_comments",
                            "label": "Scientist Comments",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter scientist comments…",
                            "options": [],
                        },
                        {
                            "key": "scientist_username",
                            "label": "Scientist Username",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "scientist_password",
                            "label": "Password (2nd component)",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "scientist_sign_reason",
                            "label": "Reason for Signature (Scientist)",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Authored and submitted", "Re-submitted after revision"],
                        },
                        {
                            "key": "scientist_sign_timestamp",
                            "label": "Signature Timestamp (Scientist)",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on signing",
                            "options": [],
                        },
                        {
                            "key": "reviewer_comments",
                            "label": "Reviewer Comments",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Enter reviewer comments…",
                            "options": [],
                        },
                        {
                            "key": "reviewer_username",
                            "label": "Reviewer Username",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "reviewer_password",
                            "label": "Password (2nd component)",
                            "type": "text",
                            "required": False,
                            "placeholder": "",
                            "options": [],
                        },
                        {
                            "key": "reviewer_sign_reason",
                            "label": "Reason for Signature (Reviewer)",
                            "type": "select",
                            "required": True,
                            "placeholder": "",
                            "options": ["Peer reviewed and approved", "Supervisor reviewed and approved", "Approved with comments"],
                        },
                        {
                            "key": "reviewer_sign_timestamp",
                            "label": "Signature Timestamp (Reviewer)",
                            "type": "text",
                            "required": False,
                            "placeholder": "Auto-stamped on signing",
                            "options": [],
                        },
                    ],
                },
            ],
        },
    ]
}


def main():
    engine = create_engine(DATABASE_URL)
    with Session(engine) as db:
        existing = db.query(WorkflowTemplate).filter(WorkflowTemplate.slug == SLUG).first()
        if existing:
            print(f"Template '{SLUG}' already exists (id={existing.id}). Updating definition...")
            existing.name        = "ADC Synthesis"
            existing.description = (
                "ADC Synthesis workflow covering pre-synthesis planning and manufacturing steps "
                "up to and including TFF purification. "
                "Section 2.1: Study Objective, Material Receipt, Reservation, Reaction Setup, "
                "System Checks, Pre-synthesis E-Signature. "
                "Section 2.2: Mfg Steps 1–6 (Thaw/Pool/Filter → Reduction → Conjugation → "
                "In-Process Analysis → Quench → TFF Purification) + Purification E-Signature. "
                "Preliminary characterization data and inventory batch data are resolved at "
                "runtime via linked_preliminary_id and inv_batches; only user-entered fields "
                "are stored in this template."
            )
            existing.category    = "ADC"
            existing.definition  = DEFINITION
            existing.version     = existing.version + 1
            existing.is_active   = True
            db.commit()
            print(f"Updated to version {existing.version}.")
            _print_summary()
            return

        t = WorkflowTemplate(
            id          = str(uuid.uuid4()),
            name        = "ADC Synthesis",
            slug        = SLUG,
            description = (
                "ADC Synthesis workflow covering pre-synthesis planning and manufacturing steps "
                "up to and including TFF purification. "
                "Section 2.1: Study Objective, Material Receipt, Reservation, Reaction Setup, "
                "System Checks, Pre-synthesis E-Signature. "
                "Section 2.2: Mfg Steps 1–6 (Thaw/Pool/Filter → Reduction → Conjugation → "
                "In-Process Analysis → Quench → TFF Purification) + Purification E-Signature. "
                "Preliminary characterization data and inventory batch data are resolved at "
                "runtime via linked_preliminary_id and inv_batches; only user-entered fields "
                "are stored in this template."
            ),
            category    = "ADC",
            version     = 1,
            is_active   = True,
            definition  = DEFINITION,
            created_by  = None,
        )
        db.add(t)
        db.commit()
        print(f"Inserted template '{SLUG}' — id={t.id}")
        _print_summary()


def _print_summary():
    sections = DEFINITION["sections"]
    total_screens = sum(len(s["screens"]) for s in sections)
    total_fields  = sum(
        len(sc["fields"])
        for s in sections
        for sc in s["screens"]
    )
    esig_screens  = sum(
        1
        for s in sections
        for sc in s["screens"]
        if sc["has_signature"]
    )
    file_screens  = sum(
        1
        for s in sections
        for sc in s["screens"]
        if sc["has_files"]
    )
    print(f"  Sections       : {len(sections)}")
    print(f"  Screens        : {total_screens}")
    print(f"  E-sig screens  : {esig_screens}")
    print(f"  File screens   : {file_screens}")
    print(f"  Fields (total) : {total_fields}")
    for s in sections:
        print(f"\n  [{s['title']}]")
        for sc in s["screens"]:
            flags = []
            if sc["has_signature"]: flags.append("e-sig")
            if sc["has_files"]:     flags.append("files")
            tag = f"  ({', '.join(flags)})" if flags else ""
            print(f"    {sc['title']}: {len(sc['fields'])} fields{tag}")


if __name__ == "__main__":
    main()
