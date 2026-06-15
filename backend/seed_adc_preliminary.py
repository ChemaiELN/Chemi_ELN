"""
Seed script: insert / update ADC Preliminary workflow template.

Run from the backend directory:
    python seed_adc_preliminary.py

Template is derived from:
  src/pages/experiments/preliminary/components/ADCWorkflow.tsx

Definition format: { sections: [ { key, title, screens: [ { key, title, persona,
  has_signature, has_files, fields: [ { key, label, type, required, placeholder,
  options } ] } ] } ] }

Field-type mapping notes
  - multiselect → select  (single choice; template has no multi-select type)
  - upload section        → omitted; has_files=True on the screen signals attachment support
  - button section        → omitted; not a data-capture field
  - textarea (Quill)      → textarea (plain); template renders plain text, not rich-text
  - readonly attribute    → omitted; template fields are always editable
  - ObservationsField     → omitted; rendered by the system on every experiment, not per-template
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
    print("ERROR: DATABASE_URL not set. Add it to .env or set it in environment.")
    sys.exit(1)

SLUG = "adc-preliminary"

# ── Template definition ───────────────────────────────────────────────────────
# Mirrors ADCWorkflow.tsx workflowData exactly, within the constraints listed above.

DEFINITION = {
    "sections": [

        # ── 1.1 Antibody Characterization ─────────────────────────────────────
        {
            "key":   "antibody_char",
            "title": "1.1 Antibody Characterization",
            "screens": [

                # Step 1 of 6
                {
                    "key":           "wf1_sample_registration",
                    "title":         "Antibody Sample Analysis Request",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        # ── Sample identification ─────────────────────────────
                        {"key": "antibody_material_id", "label": "Antibody Material ID",   "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "sample_id",            "label": "Sample ID",              "type": "text",     "required": False, "placeholder": "Auto-assigned by AD", "options": []},
                        {"key": "antibody_lot_id",      "label": "Antibody Lot ID",        "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "concentration",        "label": "Concentration",           "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "storage_conditions",   "label": "Storage conditions",     "type": "select",   "required": True,  "placeholder": "",
                         "options": ["−80°C", "−20°C", "2-8°C", "RT"]},
                        {"key": "source_cell_line",     "label": "Source · cell line","type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "source_batch_lot",     "label": "Source · batch / Lot","type":"text",    "required": True,  "placeholder": "",                    "options": []},
                        {"key": "source_supplier",      "label": "Source · supplier", "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        # ── AD reference & requested methods ──────────────────
                        {"key": "ad_reference",         "label": "AD Reference",           "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        # multiselect → select (single)
                        {"key": "ad_results_methods",   "label": "AD Results methods",     "type": "select",   "required": True,  "placeholder": "Select AD method",
                         "options": ["Concentration", "SEC-HPLC", "CE-SDS", "icIEF"]},
                        # ── Additional traceability ───────────────────────────
                        {"key": "volume_available",     "label": "Volume available",       "type": "text",     "required": False, "placeholder": "",                    "options": []},
                        {"key": "expiry_date",          "label": "Expiry date",            "type": "date",     "required": False, "placeholder": "",                    "options": []},
                        {"key": "coa_attached",         "label": "CoA attached",           "type": "text",     "required": False, "placeholder": "",                    "options": []},
                        # button section omitted
                        {"key": "remarks_to_ad",        "label": "Remarks to AD",          "type": "textarea", "required": False, "placeholder": "Enter remarks to AD…", "options": []},
                    ]
                },

                # Step 2 of 6
                {
                    "key":           "wf1_method_concentration",
                    "title":         "AD Results: Concentration",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "protein_concentration_mg_ml", "label": "Protein concentration (mg/mL)", "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "a280_absorbance",             "label": "A280 absorbance",               "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "a260_a280_ratio",             "label": "A260/A280 ratio",               "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "mass_recovery_pct",           "label": "Mass recovery (%)",             "type": "text", "required": True,  "placeholder": "", "options": []},
                        # upload section omitted (has_files=True)
                        {"key": "observations",                "label": "Observations",                  "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 3 of 6
                {
                    "key":           "wf1_method_sec",
                    "title":         "AD Results: SEC-HPLC",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "monomer_purity_pct", "label": "Monomer purity (%)",      "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "hmw_aggregates_pct", "label": "HMW aggregates (%)",      "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "lmw_species_pct",    "label": "LMW species (%)",         "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "sample_load_mg_ml",  "label": "Sample load (mg/mL)",     "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "observations",       "label": "Observations",            "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 4 of 6
                {
                    "key":           "wf1_method_cesds",
                    "title":         "AD Results: CE-SDS",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "hc_lc_purity_reduced_pct",  "label": "HC + LC purity reduced (%)",   "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "intact_mab_non_reduced_pct","label": "Intact mAb non-reduced (%)",   "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "fragments_reduced_pct",     "label": "Fragments reduced (%)",         "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "aggregates_non_reduced_pct","label": "Aggregates non-reduced (%)",   "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "observations",              "label": "Observations",                  "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 5 of 6
                {
                    "key":           "wf1_method_icief",
                    "title":         "AD Results: icIEF",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "main_species_pct",   "label": "Main species (%)",   "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "acidic_species_pct", "label": "Acidic species (%)", "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "basic_species_pct",  "label": "Basic species (%)",  "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "observations",       "label": "Observations",       "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 6 of 6 — reviewer e-signature
                {
                    "key":           "wf1_review_esig",
                    "title":         "Reviewer Approval with E-Signature",
                    "persona":       "Reviewer",
                    "has_signature": True,
                    "has_files":     False,
                    "fields": [
                        {"key": "scientist_comments",       "label": "Scientist comments",                  "type": "textarea", "required": False, "placeholder": "Enter scientist comments…", "options": []},
                        {"key": "disposition",              "label": "Disposition",                         "type": "select",   "required": True,  "placeholder": "",
                         "options": ["Release for conjugation", "Hold for repeat testing", "Reject"]},
                        {"key": "scientist_username",       "label": "Scientist username",                  "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "scientist_password",       "label": "Password (2nd component)",            "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "scientist_sign_reason",    "label": "Reason for signature (Scientist)",    "type": "select",   "required": True,  "placeholder": "",
                         "options": ["Authored and submitted", "Re-submitted after revision"]},
                        {"key": "scientist_sign_timestamp", "label": "Signature timestamp (Scientist)",     "type": "text",     "required": False, "placeholder": "Auto-stamped on signing",      "options": []},
                        {"key": "reviewer_comments",        "label": "Reviewer comments",                   "type": "textarea", "required": False, "placeholder": "Enter reviewer comments…","options": []},
                        {"key": "reviewer_username",        "label": "Reviewer username",                   "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "reviewer_password",        "label": "Password (2nd component)",            "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "reviewer_sign_reason",     "label": "Reason for signature (Reviewer)",     "type": "select",   "required": True,  "placeholder": "",
                         "options": ["Peer reviewed and approved", "Supervisor reviewed and approved", "Approved with comments"]},
                        {"key": "reviewer_sign_timestamp",  "label": "Signature timestamp (Reviewer)",      "type": "text",     "required": False, "placeholder": "Auto-stamped on signing",      "options": []},
                    ]
                },
            ]
        },

        # ── 1.2 Linker-Payload Characterization ───────────────────────────────
        {
            "key":   "linker_payload_char",
            "title": "1.2 Linker-Payload Characterization",
            "screens": [

                # Step 1 of 5
                {
                    "key":           "wf1_lp_sample_registration",
                    "title":         "Linker-Payload Sample Analysis Request",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     False,
                    "fields": [
                        # ── Sample identification ─────────────────────────────
                        {"key": "lp_material_id",       "label": "Linker-Payload Material ID",     "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "lp_sample_id",         "label": "Sample ID",                      "type": "text",     "required": False, "placeholder": "Auto-assigned by AD", "options": []},
                        {"key": "lp_lot_id",            "label": "Linker-Payload Lot ID",          "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "lp_concentration",     "label": "Concentration",                  "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "lp_storage_conditions","label": "Storage conditions",             "type": "select",   "required": True,  "placeholder": "",
                         "options": ["−80°C", "−20°C", "2-8°C", "RT"]},
                        {"key": "lp_source_supplier",   "label": "Source · supplier",         "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "lp_source_batch_lot",  "label": "Source · batch / Lot",      "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        {"key": "lp_source_catalog_ref","label": "Source · catalog ref",      "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        # ── AD reference & requested methods ──────────────────
                        {"key": "lp_ad_reference",      "label": "AD Reference",                   "type": "text",     "required": True,  "placeholder": "",                    "options": []},
                        # multiselect → select (single)
                        {"key": "lp_ad_results_methods","label": "AD Results methods",             "type": "select",   "required": True,  "placeholder": "Select AD method",
                         "options": ["Reverse-phase", "Mass-SPEC", "NMR"]},
                        # ── Additional traceability ───────────────────────────
                        {"key": "lp_volume_available",  "label": "Volume available",               "type": "text",     "required": False, "placeholder": "",                    "options": []},
                        {"key": "lp_expiry_date",       "label": "Expiry date",                    "type": "date",     "required": False, "placeholder": "",                    "options": []},
                        {"key": "lp_coa_attached",      "label": "CoA attached",                   "type": "text",     "required": False, "placeholder": "",                    "options": []},
                        # button section omitted
                        {"key": "lp_remarks_to_ad",     "label": "Remarks to AD",                  "type": "textarea", "required": False, "placeholder": "Enter remarks to AD…", "options": []},
                    ]
                },

                # Step 2 of 5
                {
                    "key":           "wf1_lp_method_rp",
                    "title":         "AD Results: Reverse-phase",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "main_peak_purity_pct",     "label": "Main peak purity (%)",     "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "free_drug_pct",            "label": "Free drug (%)",            "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "linker_only_impurity_pct", "label": "Linker-only impurity (%)", "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "total_impurities_pct",     "label": "Total impurities (%)",     "type": "text", "required": True,  "placeholder": "", "options": []},
                        {"key": "rp_observations",          "label": "Observations",             "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 3 of 5
                {
                    "key":           "wf1_lp_method_mass_spec",
                    "title":         "AD Results: Mass-SPEC",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "observed_mw",          "label": "Observed MW ([M+H]+, Da)", "type": "text",   "required": True,  "placeholder": "", "options": []},
                        {"key": "theoretical_mw",       "label": "Theoretical MW (Da)",      "type": "text",   "required": True,  "placeholder": "", "options": []},
                        {"key": "mass_accuracy_ppm",    "label": "Mass accuracy (ppm)",      "type": "text",   "required": True,  "placeholder": "", "options": []},
                        {"key": "isotope_pattern_match","label": "Isotope pattern match",    "type": "select", "required": True,  "placeholder": "",
                         "options": ["Match", "Partial match", "Mismatch"]},
                        {"key": "ms_observations",      "label": "Observations",             "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 4 of 5
                {
                    "key":           "wf1_lp_method_nmr",
                    "title":         "AD Results: NMR",
                    "persona":       "ARD Scientist",
                    "has_signature": False,
                    "has_files":     True,
                    "fields": [
                        {"key": "structural_match",         "label": "Structural match",          "type": "select", "required": True,  "placeholder": "",
                         "options": ["Confirmed", "Partial", "Not confirmed"]},
                        {"key": "key_signals_assigned_pct", "label": "Key signals assigned (%)",  "type": "text",   "required": True,  "placeholder": "", "options": []},
                        {"key": "impurity_signals_loq",     "label": "Impurity signals above LOQ","type": "select", "required": True,  "placeholder": "",
                         "options": ["None detected", "Detected (within spec)", "Detected (out of spec)"]},
                        {"key": "nmr_observations",         "label": "Observations",              "type": "textarea", "required": False, "placeholder": "Enter observations…", "options": []},
                    ]
                },

                # Step 5 of 5 — reviewer e-signature
                {
                    "key":           "wf1_lp_review_esig",
                    "title":         "Reviewer Approval with E-Signature",
                    "persona":       "Reviewer",
                    "has_signature": True,
                    "has_files":     False,
                    "fields": [
                        {"key": "lp_scientist_comments",       "label": "Scientist comments",                  "type": "textarea", "required": False, "placeholder": "Enter scientist comments…", "options": []},
                        {"key": "lp_disposition",              "label": "Disposition",                         "type": "select",   "required": True,  "placeholder": "",
                         "options": ["Release for conjugation", "Hold for repeat testing", "Reject"]},
                        {"key": "lp_scientist_username",       "label": "Scientist username",                  "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "lp_scientist_password",       "label": "Password (2nd component)",            "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "lp_scientist_sign_reason",    "label": "Reason for signature (Scientist)",    "type": "select",   "required": True,  "placeholder": "",
                         "options": ["Authored and submitted", "Re-submitted after revision"]},
                        {"key": "lp_scientist_sign_timestamp", "label": "Signature timestamp (Scientist)",     "type": "text",     "required": False, "placeholder": "Auto-stamped on signing",      "options": []},
                        {"key": "lp_reviewer_comments",        "label": "Reviewer comments",                   "type": "textarea", "required": False, "placeholder": "Enter reviewer comments…","options": []},
                        {"key": "lp_reviewer_username",        "label": "Reviewer username",                   "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "lp_reviewer_password",        "label": "Password (2nd component)",            "type": "text",     "required": False, "placeholder": "",                             "options": []},
                        {"key": "lp_reviewer_sign_reason",     "label": "Reason for signature (Reviewer)",     "type": "select",   "required": True,  "placeholder": "",
                         "options": ["Peer reviewed and approved", "Supervisor reviewed and approved", "Approved with comments"]},
                        {"key": "lp_reviewer_sign_timestamp",  "label": "Signature timestamp (Reviewer)",      "type": "text",     "required": False, "placeholder": "Auto-stamped on signing",      "options": []},
                    ]
                },
            ]
        },
    ]
}


def main():
    engine = create_engine(DATABASE_URL)
    with Session(engine) as db:
        existing = db.query(WorkflowTemplate).filter(WorkflowTemplate.slug == SLUG).first()
        if existing:
            print(f"Template '{SLUG}' already exists (id={existing.id}). Updating definition...")
            existing.name        = "ADC Preliminary Characterization"
            existing.description = (
                "Preliminary characterization workflow for Antibody-Drug Conjugates. "
                "Section 1.1 covers Antibody Characterization (Concentration, SEC-HPLC, CE-SDS, icIEF). "
                "Section 1.2 covers Linker-Payload Characterization (RP-HPLC, Mass-SPEC, NMR). "
                "Both sections include e-signature review screens (21 CFR Part 11)."
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
            name        = "ADC Preliminary Characterization",
            slug        = SLUG,
            description = (
                "Preliminary characterization workflow for Antibody-Drug Conjugates. "
                "Section 1.1 covers Antibody Characterization (Concentration, SEC-HPLC, CE-SDS, icIEF). "
                "Section 1.2 covers Linker-Payload Characterization (RP-HPLC, Mass-SPEC, NMR). "
                "Both sections include e-signature review screens (21 CFR Part 11)."
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
    print(f"  Sections : {len(sections)}")
    print(f"  Screens  : {total_screens}")
    print(f"  Fields   : {total_fields}")


if __name__ == "__main__":
    main()
