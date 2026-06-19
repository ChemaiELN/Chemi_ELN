"""
Seed script: ADC Synthesis v2 WorkflowTemplate.

Covers:
  - Scheme screen (experiments.scheme_mol via Ketcher)
  - Section 2: Materials & Consumables (2.1–2.5)
  - Section 3: Buffer Preparation (3.1)
  - Section 4: Manufacturing Steps (4.1–4.5)
  - Section 5: Purification & Analysis (5.1–5.4)
  - Section 6: Formulation & Lyo Studies (6.1–6.3)

Run from backend/:
    python seed_adc_synthesis_v2.py

screen_type field tells the frontend how to render/store the screen:
  "scheme"             → Ketcher editor, saves to experiments.scheme_mol
  "material_selection" → experiment_materials table (material_role discriminator)
  "equipment_selection"→ inv_equipment_catalogue lookup
  "form"               → experiments.data JSON (default for all other screens)
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

SLUG = "adc-synthesis-v2"

DEFINITION = {
    "sections": [

        # ── Scheme ────────────────────────────────────────────────────────────
        {
            "key":   "scheme",
            "title": "Scheme",
            "screens": [
                {
                    "key":         "scheme_mol",
                    "title":       "Chemical Scheme",
                    "screen_type": "scheme",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [],
                },
            ],
        },

        # ── Section 2: Materials & Consumables ───────────────────────────────
        {
            "key":   "materials_consumables",
            "title": "2. Materials & Consumables",
            "screens": [

                # 2.1 Antibody (mAb)
                {
                    "key":         "mat_antibody",
                    "title":       "2.1 Antibody (mAb)",
                    "screen_type": "material_selection",
                    "material_role": "mAb",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "mab_lot_id",          "label": "Lot ID",                    "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "mab_conc_mg_ml",      "label": "Concentration (mg/mL)",     "type": "text",   "required": True,  "placeholder": "From batch record",     "options": []},
                        {"key": "mab_volume_ul",       "label": "Volume Required (µL)",      "type": "text",   "required": True,  "placeholder": "",                     "options": []},
                        {"key": "mab_monomer_purity",  "label": "Monomer Purity (%)",        "type": "text",   "required": False, "placeholder": "From CoA",             "options": []},
                        {"key": "mab_coa_status",      "label": "CoA Status",                "type": "select", "required": True,  "placeholder": "", "options": ["Verified", "Pending", "Failed"]},
                        {"key": "mab_remarks",         "label": "Remarks",                   "type": "textarea","required": False,"placeholder": "", "options": []},
                    ],
                },

                # 2.2 Linker-Payload
                {
                    "key":         "mat_linker_payload",
                    "title":       "2.2 Linker-Payload",
                    "screen_type": "material_selection",
                    "material_role": "LP",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "lp_lot_id",      "label": "Lot ID",                  "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "lp_conc_mm",     "label": "Concentration (mM)",      "type": "text",   "required": True,  "placeholder": "From batch record",     "options": []},
                        {"key": "lp_volume_ul",   "label": "Volume Required (µL)",    "type": "text",   "required": True,  "placeholder": "",                     "options": []},
                        {"key": "lp_purity_pct",  "label": "Purity (%)",              "type": "text",   "required": False, "placeholder": "From CoA",             "options": []},
                        {"key": "lp_coa_status",  "label": "CoA Status",              "type": "select", "required": True,  "placeholder": "", "options": ["Verified", "Pending", "Failed"]},
                        {"key": "lp_storage",     "label": "Storage Conditions",      "type": "text",   "required": False, "placeholder": "e.g. -80°C, amber vial","options": []},
                        {"key": "lp_remarks",     "label": "Remarks",                 "type": "textarea","required": False,"placeholder": "", "options": []},
                    ],
                },

                # 2.3 Reagents & Salts
                {
                    "key":         "mat_reagents",
                    "title":       "2.3 Reagents & Salts",
                    "screen_type": "material_selection",
                    "material_role": "reagent",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "tcep_lot_id",     "label": "TCEP Lot ID",          "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "tcep_coa_status", "label": "TCEP CoA Status",      "type": "select", "required": True,  "placeholder": "", "options": ["Verified", "Pending", "Failed"]},
                        {"key": "dmso_lot_id",     "label": "DMSO Lot ID",          "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "dmso_coa_status", "label": "DMSO CoA Status",      "type": "select", "required": True,  "placeholder": "", "options": ["Verified", "Pending", "Failed"]},
                        {"key": "nac_lot_id",      "label": "NAC Lot ID",           "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "nac_coa_status",  "label": "NAC CoA Status",       "type": "select", "required": True,  "placeholder": "", "options": ["Verified", "Pending", "Failed"]},
                        {"key": "buffer_lot_id",   "label": "Buffer Lot ID",        "type": "text",   "required": False, "placeholder": "Select from inventory", "options": []},
                        {"key": "reagents_remarks","label": "Remarks",              "type": "textarea","required": False,"placeholder": "", "options": []},
                    ],
                },

                # 2.4 Consumables
                {
                    "key":         "mat_consumables",
                    "title":       "2.4 Consumables",
                    "screen_type": "material_selection",
                    "material_role": "consumable",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "filter_type",        "label": "Filter Type / MWCO",      "type": "text",   "required": True,  "placeholder": "e.g. 0.22 µm PES", "options": []},
                        {"key": "filter_lot_id",      "label": "Filter Lot ID",           "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "tff_membrane_type",  "label": "TFF Membrane (MWCO)",     "type": "text",   "required": True,  "placeholder": "e.g. 30 kDa PES",  "options": []},
                        {"key": "tff_membrane_lot_id","label": "TFF Membrane Lot ID",     "type": "text",   "required": True,  "placeholder": "Select from inventory", "options": []},
                        {"key": "tubes_type",         "label": "Tube Type",               "type": "text",   "required": False, "placeholder": "e.g. 15 mL LoBind", "options": []},
                        {"key": "consumables_remarks","label": "Remarks",                 "type": "textarea","required": False,"placeholder": "", "options": []},
                    ],
                },

                # 2.5 Equipment
                {
                    "key":         "mat_equipment",
                    "title":       "2.5 Equipment",
                    "screen_type": "equipment_selection",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "spectrophotometer_id",  "label": "Spectrophotometer ID",       "type": "text", "required": True,  "placeholder": "Select from equipment register", "options": []},
                        {"key": "thermoshaker_id",       "label": "Thermoshaker ID",            "type": "text", "required": True,  "placeholder": "Select from equipment register", "options": []},
                        {"key": "centrifuge_id",         "label": "Centrifuge ID",              "type": "text", "required": True,  "placeholder": "Select from equipment register", "options": []},
                        {"key": "tff_system_id",         "label": "TFF System ID",              "type": "text", "required": True,  "placeholder": "Select from equipment register", "options": []},
                        {"key": "balance_id",            "label": "Balance ID",                 "type": "text", "required": False, "placeholder": "Select from equipment register", "options": []},
                        {"key": "equipment_remarks",     "label": "Remarks",                    "type": "textarea","required": False,"placeholder": "", "options": []},
                    ],
                },
            ],
        },

        # ── Section 3: Buffer Preparation ────────────────────────────────────
        {
            "key":   "buffer_preparation",
            "title": "3. Buffer Preparation",
            "screens": [

                # 3.1 Buffer Preparation
                {
                    "key":         "buf_preparation",
                    "title":       "3.1 Buffer Preparation",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "buf_name",          "label": "Buffer Name",               "type": "text",    "required": True,  "placeholder": "e.g. PBS pH 7.4",         "options": []},
                        {"key": "buf_composition",   "label": "Composition",               "type": "textarea","required": True,  "placeholder": "List components and concentrations", "options": []},
                        {"key": "buf_ph_target",     "label": "Target pH",                 "type": "text",    "required": True,  "placeholder": "e.g. 7.4",               "options": []},
                        {"key": "buf_ph_actual",     "label": "Actual pH (measured)",      "type": "text",    "required": True,  "placeholder": "Measured after preparation","options": []},
                        {"key": "buf_volume_ml",     "label": "Volume Prepared (mL)",      "type": "text",    "required": True,  "placeholder": "",                        "options": []},
                        {"key": "buf_prep_date",     "label": "Preparation Date",          "type": "text",    "required": True,  "placeholder": "YYYY-MM-DD",              "options": []},
                        {"key": "buf_expiry",        "label": "Expiry / Use-by",           "type": "text",    "required": False, "placeholder": "YYYY-MM-DD",              "options": []},
                        {"key": "buf_storage",       "label": "Storage Conditions",        "type": "text",    "required": False, "placeholder": "e.g. 2–8 °C",            "options": []},
                        {"key": "buf_filter_status", "label": "Sterile filtered",          "type": "select",  "required": True,  "placeholder": "", "options": ["Yes – 0.22 µm", "No"]},
                        {"key": "buf_operator",      "label": "Prepared By",               "type": "text",    "required": False, "placeholder": "Auto-filled from current user","options": []},
                        {"key": "buf_remarks",       "label": "Remarks",                   "type": "textarea","required": False, "placeholder": "",                        "options": []},
                    ],
                },
            ],
        },

        # ── Section 4: Manufacturing Steps ───────────────────────────────────
        {
            "key":   "manufacturing_steps",
            "title": "4. Manufacturing Steps",
            "screens": [

                # 4.1 Thaw / Pool / Filter mAb
                {
                    "key":         "mfg_thaw_pool_filter",
                    "title":       "4.1 Thaw, Pool & Filter mAb",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "s1_vials_thawed",        "label": "Number of Vials Thawed",           "type": "text",    "required": True,  "placeholder": "",                        "options": []},
                        {"key": "s1_vol_per_vial_ul",     "label": "Volume per Vial (µL)",             "type": "text",    "required": True,  "placeholder": "",                        "options": []},
                        {"key": "s1_pooled_vol_ul",       "label": "Total Pooled Volume (µL)",         "type": "text",    "required": True,  "placeholder": "vials × vol per vial",    "options": []},
                        {"key": "s1_pooled_conc_mg_ml",   "label": "Pooled Concentration (mg/mL)",     "type": "text",    "required": True,  "placeholder": "Measured post-pooling",   "options": []},
                        {"key": "s1_filter_membrane",     "label": "Filter Membrane Type",             "type": "text",    "required": True,  "placeholder": "e.g. 0.22 µm PES",       "options": []},
                        {"key": "s1_post_filter_vol_ul",  "label": "Post-filter Volume (µL)",          "type": "text",    "required": True,  "placeholder": "Measured after filtration","options": []},
                        {"key": "s1_post_filter_conc",    "label": "Post-filter Conc (mg/mL)",         "type": "text",    "required": True,  "placeholder": "Measured after filtration","options": []},
                        {"key": "s1_output_sample_id",    "label": "Output Sample ID",                 "type": "text",    "required": True,  "placeholder": "e.g. mAb_Input_001",     "options": []},
                        {"key": "s1_bioburden",           "label": "IPC: Bioburden",                   "type": "select",  "required": True,  "placeholder": "", "options": ["Pass", "Fail", "Pending"]},
                        {"key": "s1_endotoxin",           "label": "IPC: Endotoxin",                   "type": "select",  "required": True,  "placeholder": "", "options": ["Pass", "Fail", "Pending"]},
                        {"key": "s1_start_time",          "label": "Start Time",                       "type": "text",    "required": False, "placeholder": "Auto-stamped",            "options": []},
                        {"key": "s1_end_time",            "label": "End Time",                         "type": "text",    "required": False, "placeholder": "Auto-stamped",            "options": []},
                        {"key": "s1_operator",            "label": "Operator",                         "type": "text",    "required": False, "placeholder": "Auto-filled",             "options": []},
                        {"key": "s1_remarks",             "label": "Remarks",                          "type": "textarea","required": False, "placeholder": "",                        "options": []},
                    ],
                },

                # 4.2 System Checks
                {
                    "key":         "mfg_system_checks",
                    "title":       "4.2 System Checks",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "chk_training",       "label": "Training current",              "type": "select","required": True, "placeholder": "", "options": ["Pass", "Fail"]},
                        {"key": "chk_training_ref",   "label": "Training Record Ref",           "type": "text",  "required": False,"placeholder": "e.g. TR-2026-041","options": []},
                        {"key": "chk_system_access",  "label": "System access verified",        "type": "select","required": True, "placeholder": "", "options": ["Pass", "Fail"]},
                        {"key": "chk_template_ver",   "label": "Template version confirmed",    "type": "select","required": True, "placeholder": "", "options": ["Pass", "Fail"]},
                        {"key": "chk_materials",      "label": "Materials available & reserved","type": "select","required": True, "placeholder": "", "options": ["Pass", "Fail"]},
                        {"key": "chk_equipment",      "label": "Equipment calibration current", "type": "select","required": True, "placeholder": "", "options": ["Pass", "Fail"]},
                        {"key": "chk_bsl_level",      "label": "BSL Level",                    "type": "select","required": True, "placeholder": "", "options": ["BSL-1", "BSL-2"]},
                        {"key": "chk_containment",    "label": "Containment verified",          "type": "select","required": True, "placeholder": "", "options": ["Pass", "Fail"]},
                        {"key": "chk_remarks",        "label": "Remarks",                       "type": "textarea","required": False,"placeholder": "","options": []},
                    ],
                },

                # 4.3 Reduction (TCEP)
                {
                    "key":         "mfg_reduction",
                    "title":       "4.3 Reduction Reaction (TCEP)",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "red_mab_vol_ul",     "label": "mAb Volume (µL)",             "type": "text",    "required": True,  "placeholder": "Calculated",           "options": []},
                        {"key": "red_mab_mass_mg",    "label": "mAb Mass (mg)",               "type": "text",    "required": True,  "placeholder": "From target mass",     "options": []},
                        {"key": "red_mab_moles_nmol", "label": "mAb Moles (nmol)",            "type": "text",    "required": True,  "placeholder": "mass ÷ MW × 10⁶",     "options": []},
                        {"key": "red_tcep_mass_mg",   "label": "TCEP Mass (mg)",              "type": "text",    "required": True,  "placeholder": "moles × ratio × TCEP MW","options": []},
                        {"key": "red_tcep_vol_ul",    "label": "TCEP Volume (µL)",            "type": "text",    "required": True,  "placeholder": "Calculated from stock","options": []},
                        {"key": "red_buffer",         "label": "Reaction Buffer",             "type": "text",    "required": True,  "placeholder": "e.g. PBS pH 7.4",     "options": []},
                        {"key": "red_rxn_vol_ul",     "label": "Final Reaction Volume (µL)",  "type": "text",    "required": True,  "placeholder": "",                     "options": []},
                        {"key": "red_temp_c",         "label": "Reduction Temperature (°C)",  "type": "text",    "required": True,  "placeholder": "37",                   "options": []},
                        {"key": "red_time_min",       "label": "Reduction Time (min)",        "type": "text",    "required": True,  "placeholder": "90",                   "options": []},
                        {"key": "red_output_sample_id","label": "Output Sample ID",           "type": "text",    "required": True,  "placeholder": "e.g. Reduced_mAb_001","options": []},
                        {"key": "red_observations",   "label": "Observations",                "type": "textarea","required": False, "placeholder": "",                     "options": []},
                        {"key": "red_deviations",     "label": "Deviations",                  "type": "select",  "required": True,  "placeholder": "", "options": ["None", "Yes – documented in remarks"]},
                        {"key": "red_start_time",     "label": "Start Time",                  "type": "text",    "required": False, "placeholder": "Auto-stamped",         "options": []},
                        {"key": "red_end_time",       "label": "End Time",                    "type": "text",    "required": False, "placeholder": "Auto-stamped",         "options": []},
                        {"key": "red_operator",       "label": "Operator",                    "type": "text",    "required": False, "placeholder": "Auto-filled",          "options": []},
                        {"key": "red_remarks",        "label": "Remarks",                     "type": "textarea","required": False, "placeholder": "",                     "options": []},
                    ],
                },

                # 4.4 Conjugation (LP)
                {
                    "key":         "mfg_conjugation",
                    "title":       "4.4 Conjugation Reaction (Linker-Payload)",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "conj_lp_mass_mg",     "label": "LP Mass (mg)",                 "type": "text",    "required": True,  "placeholder": "moles × LP ratio × LP MW ÷ purity","options": []},
                        {"key": "conj_lp_vol_ul",      "label": "LP Volume (µL)",               "type": "text",    "required": True,  "placeholder": "Calculated from stock","options": []},
                        {"key": "conj_dma_vol_ul",     "label": "DMA Volume (µL)",              "type": "text",    "required": True,  "placeholder": "",               "options": []},
                        {"key": "conj_rxn_vol_ul",     "label": "Final Reaction Volume (µL)",   "type": "text",    "required": True,  "placeholder": "",               "options": []},
                        {"key": "conj_temp_c",         "label": "Conjugation Temperature (°C)", "type": "text",    "required": True,  "placeholder": "25",             "options": []},
                        {"key": "conj_time_min",       "label": "Conjugation Time (min)",       "type": "text",    "required": True,  "placeholder": "120",            "options": []},
                        {"key": "conj_output_sample_id","label":"Output Sample ID",             "type": "text",    "required": True,  "placeholder": "e.g. Crude_ADC_001","options": []},
                        {"key": "conj_lc_ms_status",   "label": "LC-MS Test Status",           "type": "select",  "required": True,  "placeholder": "", "options": ["Submitted", "In Progress", "Complete", "Failed"]},
                        {"key": "conj_lc_ms_result",   "label": "LC-MS Result Summary",        "type": "textarea","required": False, "placeholder": "Summarise LC-MS findings","options": []},
                        {"key": "conj_rp_hplc_status", "label": "RP-HPLC Test Status",         "type": "select",  "required": True,  "placeholder": "", "options": ["Submitted", "In Progress", "Complete", "Failed"]},
                        {"key": "conj_rp_hplc_result", "label": "RP-HPLC Result Summary",      "type": "textarea","required": False, "placeholder": "Summarise RP-HPLC findings","options": []},
                        {"key": "conj_go_nogo",        "label": "Go / No-Go Decision",         "type": "select",  "required": True,  "placeholder": "", "options": ["Go – proceed to quench", "No-Go – hold for review"]},
                        {"key": "conj_observations",   "label": "Observations",                 "type": "textarea","required": False, "placeholder": "",               "options": []},
                        {"key": "conj_deviations",     "label": "Deviations",                  "type": "select",  "required": True,  "placeholder": "", "options": ["None", "Yes – documented in remarks"]},
                        {"key": "conj_start_time",     "label": "Start Time",                  "type": "text",    "required": False, "placeholder": "Auto-stamped",   "options": []},
                        {"key": "conj_end_time",       "label": "End Time",                    "type": "text",    "required": False, "placeholder": "Auto-stamped",   "options": []},
                        {"key": "conj_operator",       "label": "Operator",                    "type": "text",    "required": False, "placeholder": "Auto-filled",    "options": []},
                        {"key": "conj_remarks",        "label": "Remarks",                     "type": "textarea","required": False, "placeholder": "",               "options": []},
                    ],
                },

                # 4.5 Quench (NAC)
                {
                    "key":         "mfg_quench",
                    "title":       "4.5 Quench Reaction (NAC)",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "qnch_nac_mass_mg",     "label": "NAC Mass (mg)",              "type": "text",    "required": True,  "placeholder": "LP moles × NAC ratio × NAC MW","options": []},
                        {"key": "qnch_nac_vol_ul",      "label": "NAC Volume (µL)",            "type": "text",    "required": True,  "placeholder": "Calculated from stock","options": []},
                        {"key": "qnch_temp_c",          "label": "Quench Temperature (°C)",    "type": "text",    "required": True,  "placeholder": "25",               "options": []},
                        {"key": "qnch_time_min",        "label": "Quench Time (min)",          "type": "text",    "required": True,  "placeholder": "15",               "options": []},
                        {"key": "qnch_output_sample_id","label": "Output Sample ID",           "type": "text",    "required": True,  "placeholder": "e.g. Quenched_ADC_001","options": []},
                        {"key": "qnch_observations",    "label": "Observations",               "type": "textarea","required": False, "placeholder": "",                 "options": []},
                        {"key": "qnch_start_time",      "label": "Start Time",                 "type": "text",    "required": False, "placeholder": "Auto-stamped",     "options": []},
                        {"key": "qnch_end_time",        "label": "End Time",                   "type": "text",    "required": False, "placeholder": "Auto-stamped",     "options": []},
                        {"key": "qnch_operator",        "label": "Operator",                   "type": "text",    "required": False, "placeholder": "Auto-filled",      "options": []},
                        {"key": "qnch_remarks",         "label": "Remarks",                    "type": "textarea","required": False, "placeholder": "",                 "options": []},
                    ],
                },
            ],
        },

        # ── Section 5: Purification & Analysis ───────────────────────────────
        {
            "key":   "purification_analysis",
            "title": "5. Purification & Analysis",
            "screens": [

                # 5.1 TFF Purification
                {
                    "key":         "pur_tff",
                    "title":       "5.1 TFF Purification",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "tff_membrane_mwco",    "label": "Membrane Type (MWCO)",         "type": "text",    "required": True,  "placeholder": "e.g. 30 kDa PES","options": []},
                        {"key": "tff_feed_flow_ml_min", "label": "Feed Flow Rate (mL/min)",      "type": "text",    "required": True,  "placeholder": "12",             "options": []},
                        {"key": "tff_tmp_psi",          "label": "Transmembrane Pressure (psi)", "type": "text",    "required": True,  "placeholder": "8",              "options": []},
                        {"key": "tff_dv",               "label": "Diafiltration Volumes (DV)",   "type": "text",    "required": True,  "placeholder": "7",              "options": []},
                        {"key": "tff_buffer",           "label": "Diafiltration Buffer",         "type": "text",    "required": True,  "placeholder": "e.g. PBS pH 7.4","options": []},
                        {"key": "tff_pre_vol_ul",       "label": "Pre-TFF Volume (µL)",          "type": "text",    "required": True,  "placeholder": "Carry-forward",  "options": []},
                        {"key": "tff_pre_conc_mg_ml",   "label": "Pre-TFF Conc (mg/mL)",         "type": "text",    "required": True,  "placeholder": "Measured",       "options": []},
                        {"key": "tff_post_vol_ul",      "label": "Post-TFF Volume (µL)",         "type": "text",    "required": True,  "placeholder": "Measured",       "options": []},
                        {"key": "tff_post_conc_mg_ml",  "label": "Post-TFF Conc (mg/mL)",        "type": "text",    "required": True,  "placeholder": "Measured",       "options": []},
                        {"key": "tff_yield_pct",        "label": "TFF Yield (%)",                "type": "text",    "required": True,  "placeholder": "(post vol × post conc) ÷ (pre vol × pre conc) × 100","options": []},
                        {"key": "tff_output_sample_id", "label": "Output Sample ID",             "type": "text",    "required": True,  "placeholder": "e.g. Purified_ADC_001","options": []},
                        {"key": "tff_bioburden",        "label": "IPC: Bioburden (post-TFF)",    "type": "select",  "required": True,  "placeholder": "", "options": ["Pass", "Fail", "Pending"]},
                        {"key": "tff_endotoxin",        "label": "IPC: Endotoxin (post-TFF)",    "type": "select",  "required": True,  "placeholder": "", "options": ["Pass", "Fail", "Pending"]},
                        {"key": "tff_observations",     "label": "Observations",                 "type": "textarea","required": False, "placeholder": "", "options": []},
                        {"key": "tff_start_time",       "label": "Start Time",                   "type": "text",    "required": False, "placeholder": "Auto-stamped",   "options": []},
                        {"key": "tff_end_time",         "label": "End Time",                     "type": "text",    "required": False, "placeholder": "Auto-stamped",   "options": []},
                        {"key": "tff_operator",         "label": "Operator",                     "type": "text",    "required": False, "placeholder": "Auto-filled",    "options": []},
                        {"key": "tff_remarks",          "label": "Remarks",                      "type": "textarea","required": False, "placeholder": "", "options": []},
                    ],
                },

                # 5.2 UF/DF (concentration & final buffer exchange)
                {
                    "key":         "pur_ufdf",
                    "title":       "5.2 UF/DF – Concentration & Buffer Exchange",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "ufdf_target_conc_mg_ml","label": "Target Concentration (mg/mL)",  "type": "text",    "required": True,  "placeholder": "",               "options": []},
                        {"key": "ufdf_final_buffer",      "label": "Final Buffer",                  "type": "text",    "required": True,  "placeholder": "e.g. 20 mM His pH 6.0","options": []},
                        {"key": "ufdf_final_vol_ul",      "label": "Final Volume (µL)",             "type": "text",    "required": True,  "placeholder": "Measured",       "options": []},
                        {"key": "ufdf_final_conc_mg_ml",  "label": "Final Conc (mg/mL)",            "type": "text",    "required": True,  "placeholder": "Measured by A280","options": []},
                        {"key": "ufdf_yield_pct",         "label": "UF/DF Yield (%)",              "type": "text",    "required": True,  "placeholder": "Calculated",     "options": []},
                        {"key": "ufdf_output_sample_id",  "label": "Output Sample ID",             "type": "text",    "required": True,  "placeholder": "e.g. Final_ADC_001","options": []},
                        {"key": "ufdf_osmolality",        "label": "Osmolality (mOsm/kg)",         "type": "text",    "required": False, "placeholder": "Measured",       "options": []},
                        {"key": "ufdf_subvisible_particles","label":"Subvisible Particles",          "type": "select",  "required": False, "placeholder": "", "options": ["Pass", "Fail", "Not tested"]},
                        {"key": "ufdf_start_time",        "label": "Start Time",                   "type": "text",    "required": False, "placeholder": "Auto-stamped",   "options": []},
                        {"key": "ufdf_end_time",          "label": "End Time",                     "type": "text",    "required": False, "placeholder": "Auto-stamped",   "options": []},
                        {"key": "ufdf_operator",          "label": "Operator",                     "type": "text",    "required": False, "placeholder": "Auto-filled",    "options": []},
                        {"key": "ufdf_remarks",           "label": "Remarks",                      "type": "textarea","required": False, "placeholder": "", "options": []},
                    ],
                },

                # 5.3 Conclusion
                {
                    "key":         "pur_conclusion",
                    "title":       "5.3 Conclusion",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        {"key": "conc_total_mass_mg",    "label": "Total Mass Recovered (mg)",    "type": "text",    "required": True,  "placeholder": "vol × conc",        "options": []},
                        {"key": "conc_overall_yield_pct","label": "Overall Yield (%)",            "type": "text",    "required": True,  "placeholder": "recovered ÷ input × 100","options": []},
                        {"key": "conc_dar",              "label": "DAR Achieved",                 "type": "text",    "required": True,  "placeholder": "From LC-MS",        "options": []},
                        {"key": "conc_hms_pct",          "label": "High Molecular Species (%)",   "type": "text",    "required": False, "placeholder": "From SEC",          "options": []},
                        {"key": "conc_lms_pct",          "label": "Low Molecular Species (%)",    "type": "text",    "required": False, "placeholder": "From SEC",          "options": []},
                        {"key": "conc_monomer_pct",      "label": "Monomer (%)",                  "type": "text",    "required": True,  "placeholder": "From SEC",          "options": []},
                        {"key": "conc_endotoxin",        "label": "Endotoxin (EU/mg)",            "type": "text",    "required": False, "placeholder": "From LAL assay",    "options": []},
                        {"key": "conc_bioburden",        "label": "Bioburden",                    "type": "select",  "required": False, "placeholder": "", "options": ["Pass", "Fail", "Not tested"]},
                        {"key": "conc_disposition",      "label": "Disposition",                  "type": "select",  "required": True,  "placeholder": "", "options": ["Release for characterization", "Hold – repeat testing required", "Reject"]},
                        {"key": "conc_scientist_comments","label":"Scientist Comments",           "type": "textarea","required": False, "placeholder": "",                   "options": []},
                        {"key": "conc_remarks",          "label": "Remarks",                      "type": "textarea","required": False, "placeholder": "",                   "options": []},
                    ],
                },

                # 5.4 Peer Review (E-Signature)
                {
                    "key":         "pur_peer_review",
                    "title":       "5.4 Peer Review & E-Signature",
                    "screen_type": "form",
                    "persona":     "Reviewer",
                    "has_signature": True,
                    "has_files":     False,
                    "fields": [
                        {"key": "rev_scientist_comments",  "label": "Scientist Comments",           "type": "textarea","required": False,"placeholder": "", "options": []},
                        {"key": "rev_scientist_username",  "label": "Scientist Username",           "type": "text",   "required": False,"placeholder": "", "options": []},
                        {"key": "rev_scientist_password",  "label": "Password (2nd component)",     "type": "password","required": False,"placeholder": "", "options": []},
                        {"key": "rev_scientist_reason",    "label": "Reason for Signature (Scientist)","type": "select","required": True,"placeholder": "", "options": ["Authored and submitted", "Re-submitted after revision"]},
                        {"key": "rev_scientist_timestamp", "label": "Signature Timestamp (Scientist)","type": "text", "required": False,"placeholder": "Auto-stamped", "options": []},
                        {"key": "rev_reviewer_comments",   "label": "Reviewer Comments",           "type": "textarea","required": False,"placeholder": "", "options": []},
                        {"key": "rev_reviewer_username",   "label": "Reviewer Username",           "type": "text",   "required": False,"placeholder": "", "options": []},
                        {"key": "rev_reviewer_password",   "label": "Password (2nd component)",    "type": "password","required": False,"placeholder": "", "options": []},
                        {"key": "rev_reviewer_reason",     "label": "Reason for Signature (Reviewer)","type": "select","required": True,"placeholder": "", "options": ["Peer reviewed and approved", "Supervisor reviewed and approved", "Approved with comments"]},
                        {"key": "rev_reviewer_timestamp",  "label": "Signature Timestamp (Reviewer)","type": "text", "required": False,"placeholder": "Auto-stamped", "options": []},
                        {"key": "rev_overall_disposition", "label": "Overall Disposition",         "type": "select", "required": True,"placeholder": "", "options": ["Approved", "Approved with conditions", "Hold – further review required", "Rejected"]},
                    ],
                },
            ],
        },

        # ── Section 6: Formulation & Lyo Studies ─────────────────────────────
        {
            "key":   "formulation_lyo",
            "title": "6. Formulation & Lyo Studies",
            "screens": [

                # 6.1 HT Formulation Screening
                {
                    "key":         "form_ht_screening",
                    "title":       "6.1 HT Formulation Screening",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "ht_platform",         "label": "Formulation Platform",         "type": "text",    "required": True,  "placeholder": "e.g. Solubility Screen, DLS","options": []},
                        {"key": "ht_conditions_count", "label": "Number of Conditions",         "type": "text",    "required": True,  "placeholder": "e.g. 48",             "options": []},
                        {"key": "ht_buffer_system",    "label": "Buffer System(s)",             "type": "textarea","required": True,  "placeholder": "List buffer systems tested","options": []},
                        {"key": "ht_excipients",       "label": "Excipients Screened",          "type": "textarea","required": True,  "placeholder": "List excipients and concentrations","options": []},
                        {"key": "ht_ph_range",         "label": "pH Range Tested",              "type": "text",    "required": True,  "placeholder": "e.g. 5.5 – 7.0",     "options": []},
                        {"key": "ht_protein_conc_range","label":"Protein Conc Range (mg/mL)",   "type": "text",    "required": True,  "placeholder": "e.g. 5 – 50",         "options": []},
                        {"key": "ht_screening_method", "label": "Screening Method",             "type": "select",  "required": True,  "placeholder": "", "options": ["DLS", "SLS", "Tm by DSF", "SEC", "Other"]},
                        {"key": "ht_top_hits",         "label": "Top Formulation Hits",         "type": "textarea","required": False, "placeholder": "Summarise top candidates","options": []},
                        {"key": "ht_operator",         "label": "Operator",                     "type": "text",    "required": False, "placeholder": "Auto-filled",          "options": []},
                        {"key": "ht_remarks",          "label": "Remarks",                      "type": "textarea","required": False, "placeholder": "",                     "options": []},
                    ],
                },

                # 6.2 Formulation Optimization
                {
                    "key":         "form_optimization",
                    "title":       "6.2 Formulation Optimization",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "opt_selected_formulation","label": "Selected Formulation",      "type": "textarea","required": True,  "placeholder": "Define final formulation composition","options": []},
                        {"key": "opt_rationale",           "label": "Selection Rationale",      "type": "textarea","required": True,  "placeholder": "Why this formulation was selected","options": []},
                        {"key": "opt_stability_criteria",  "label": "Stability Acceptance Criteria","type": "textarea","required": True,"placeholder": "List acceptance criteria","options": []},
                        {"key": "opt_analytical_methods",  "label": "Analytical Methods Used",  "type": "textarea","required": True,  "placeholder": "e.g. SEC, DLS, A280",  "options": []},
                        {"key": "opt_temp_5c_result",      "label": "5°C Stability Result",     "type": "text",    "required": False, "placeholder": "",                     "options": []},
                        {"key": "opt_temp_25c_result",     "label": "25°C Stress Result",       "type": "text",    "required": False, "placeholder": "",                     "options": []},
                        {"key": "opt_temp_40c_result",     "label": "40°C Stress Result",       "type": "text",    "required": False, "placeholder": "",                     "options": []},
                        {"key": "opt_freeze_thaw_cycles",  "label": "Freeze/Thaw Cycles",       "type": "text",    "required": False, "placeholder": "e.g. 3",               "options": []},
                        {"key": "opt_freeze_thaw_result",  "label": "Freeze/Thaw Result",       "type": "text",    "required": False, "placeholder": "",                     "options": []},
                        {"key": "opt_observations",        "label": "Observations",             "type": "textarea","required": False, "placeholder": "",                     "options": []},
                        {"key": "opt_operator",            "label": "Operator",                 "type": "text",    "required": False, "placeholder": "Auto-filled",          "options": []},
                        {"key": "opt_remarks",             "label": "Remarks",                  "type": "textarea","required": False, "placeholder": "",                     "options": []},
                    ],
                },

                # 6.3 Lyophilization Cycle
                {
                    "key":         "form_lyophilization",
                    "title":       "6.3 Lyophilization Cycle",
                    "screen_type": "form",
                    "persona":     "PD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "lyo_fill_vol_ml",        "label": "Fill Volume (mL)",               "type": "text",    "required": True,  "placeholder": "",               "options": []},
                        {"key": "lyo_fill_conc_mg_ml",    "label": "Fill Concentration (mg/mL)",     "type": "text",    "required": True,  "placeholder": "",               "options": []},
                        {"key": "lyo_lyoprotectant",      "label": "Lyoprotectant",                  "type": "text",    "required": True,  "placeholder": "e.g. 5% sucrose","options": []},
                        {"key": "lyo_bulking_agent",      "label": "Bulking Agent",                  "type": "text",    "required": False, "placeholder": "e.g. 2% mannitol","options": []},
                        {"key": "lyo_shelf_temp_freeze_c","label": "Shelf Temp – Freezing (°C)",     "type": "text",    "required": True,  "placeholder": "e.g. -50",       "options": []},
                        {"key": "lyo_shelf_temp_1_dry_c", "label": "Shelf Temp – Primary Dry (°C)", "type": "text",    "required": True,  "placeholder": "e.g. -35",       "options": []},
                        {"key": "lyo_shelf_temp_2_dry_c", "label": "Shelf Temp – Secondary Dry (°C)","type": "text",   "required": True,  "placeholder": "e.g. +25",       "options": []},
                        {"key": "lyo_pressure_mtorr",     "label": "Chamber Pressure (mTorr)",       "type": "text",    "required": True,  "placeholder": "e.g. 100",       "options": []},
                        {"key": "lyo_cycle_time_hrs",     "label": "Total Cycle Time (hrs)",          "type": "text",    "required": True,  "placeholder": "e.g. 48",        "options": []},
                        {"key": "lyo_cake_appearance",    "label": "Cake Appearance",                "type": "select",  "required": True,  "placeholder": "", "options": ["Acceptable – intact cake", "Partial collapse", "Full collapse", "Melt-back"]},
                        {"key": "lyo_moisture_pct",       "label": "Residual Moisture (%)",          "type": "text",    "required": False, "placeholder": "From KF titration","options": []},
                        {"key": "lyo_reconst_time_sec",   "label": "Reconstitution Time (sec)",      "type": "text",    "required": True,  "placeholder": "Measured at 25°C","options": []},
                        {"key": "lyo_reconst_vol_ml",     "label": "Reconstitution Volume (mL)",     "type": "text",    "required": True,  "placeholder": "",               "options": []},
                        {"key": "lyo_reconst_conc_mg_ml", "label": "Reconstituted Conc (mg/mL)",     "type": "text",    "required": True,  "placeholder": "Measured by A280","options": []},
                        {"key": "lyo_reconst_appearance", "label": "Reconstituted Appearance",       "type": "select",  "required": True,  "placeholder": "", "options": ["Clear colourless", "Slight opalescence", "Turbid", "Particulates observed"]},
                        {"key": "lyo_disposition",        "label": "Disposition",                    "type": "select",  "required": True,  "placeholder": "", "options": ["Release for storage", "Hold – further review", "Reject"]},
                        {"key": "lyo_operator",           "label": "Operator",                       "type": "text",    "required": False, "placeholder": "Auto-filled",    "options": []},
                        {"key": "lyo_remarks",            "label": "Remarks",                        "type": "textarea","required": False, "placeholder": "",               "options": []},
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
            existing.name        = "ADC Synthesis v2"
            existing.description = (
                "ADC Synthesis v2 — full workflow from chemical scheme through formulation and lyophilisation. "
                "Scheme: Ketcher structure editor (experiments.scheme_mol). "
                "Section 2: Materials & Consumables (mAb, LP, reagents, consumables, equipment). "
                "Section 3: Buffer Preparation. "
                "Section 4: Manufacturing Steps (thaw/pool/filter, system checks, reduction, conjugation, quench). "
                "Section 5: Purification & Analysis (TFF, UF/DF, conclusion, peer review e-sig). "
                "Section 6: Formulation & Lyo Studies (HT screening, optimisation, lyophilisation cycle)."
            )
            existing.category    = "ADC"
            existing.definition  = DEFINITION
            existing.version     = existing.version + 1
            existing.is_active   = True
            db.commit()
            print(f"Updated to version {existing.version}.")
        else:
            t = WorkflowTemplate(
                id          = str(uuid.uuid4()),
                name        = "ADC Synthesis v2",
                slug        = SLUG,
                description = (
                    "ADC Synthesis v2 — full workflow from chemical scheme through formulation and lyophilisation. "
                    "Scheme: Ketcher structure editor (experiments.scheme_mol). "
                    "Section 2: Materials & Consumables (mAb, LP, reagents, consumables, equipment). "
                    "Section 3: Buffer Preparation. "
                    "Section 4: Manufacturing Steps (thaw/pool/filter, system checks, reduction, conjugation, quench). "
                    "Section 5: Purification & Analysis (TFF, UF/DF, conclusion, peer review e-sig). "
                    "Section 6: Formulation & Lyo Studies (HT screening, optimisation, lyophilisation cycle)."
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
    total_fields  = sum(len(sc["fields"]) for s in sections for sc in s["screens"])
    esig_screens  = sum(1 for s in sections for sc in s["screens"] if sc["has_signature"])
    file_screens  = sum(1 for s in sections for sc in s["screens"] if sc["has_files"])
    print(f"\n  Sections       : {len(sections)}")
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
            st  = sc.get("screen_type", "form")
            print(f"    [{st}] {sc['title']}: {len(sc['fields'])} fields{tag}")


if __name__ == "__main__":
    main()
