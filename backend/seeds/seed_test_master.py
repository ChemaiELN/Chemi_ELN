"""Seed: inv_test_types → inv_test_names → inv_test_methods."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.inventory import InvTestType, InvTestName, InvTestMethod

# Structure: (type_key, type_name, [(test_name, [method1, method2, ...]), ...])
TEST_DATA = [
    (
        "TEST_ANTIBODY",
        "TEST - Antibody",
        [
            ("Appearance",              ["Visual Inspection"]),
            ("pH",                      ["Potentiometric"]),
            ("Protein Concentration",   ["UV Absorbance A280", "BCA Assay", "Bradford Assay"]),
            ("Purity (SE-HPLC)",        ["SEC-HPLC"]),
            ("Purity (CE-SDS)",         ["CE-SDS (Reduced)", "CE-SDS (Non-Reduced)"]),
            ("Aggregation (DLS)",       ["Dynamic Light Scattering"]),
            ("Endotoxin",               ["LAL Kinetic Turbidimetric", "LAL Gel-Clot"]),
            ("Sterility",               ["Membrane Filtration", "Direct Inoculation"]),
            ("Osmolality",              ["Freezing Point Depression"]),
            ("Bioburden",               ["Membrane Filtration"]),
            ("Identity (Peptide Map)", ["LC-MS/MS Peptide Mapping"]),
            ("Potency / Binding",       ["ELISA", "SPR (Surface Plasmon Resonance)", "Cell-Based Assay"]),
            ("Glycosylation",           ["LC-MS Glycan Analysis", "HILIC-HPLC"]),
            ("Sub-visible Particles",   ["MFI (Micro-Flow Imaging)", "Light Obscuration"]),
            ("Residual Protein A",      ["ELISA"]),
        ],
    ),
    (
        "TEST_LINKER_PAYLOAD",
        "TEST - Linker Payload",
        [
            ("Appearance",              ["Visual Inspection"]),
            ("Identity (NMR)",          ["¹H NMR", "¹³C NMR"]),
            ("Identity (MS)",           ["ESI-MS", "MALDI-TOF"]),
            ("Purity (HPLC)",           ["RP-HPLC", "HILIC-HPLC"]),
            ("Assay / Potency",         ["UV-Vis Spectrophotometry", "HPLC Area %"]),
            ("Water Content",           ["Karl Fischer Titration"]),
            ("Residual Solvents",       ["GC Headspace"]),
            ("Heavy Metals",            ["ICP-MS"]),
            ("pH (Solution)",           ["Potentiometric"]),
            ("Solubility",              ["Nephelometry", "Kinetic Solubility"]),
            ("Drug-to-Linker Ratio",    ["UV-Vis", "RP-HPLC"]),
            ("Stability Indicating",    ["Forced Degradation RP-HPLC"]),
        ],
    ),
]


def run():
    db = SessionLocal()
    try:
        type_added = name_added = method_added = 0

        for type_key, type_name, test_names in TEST_DATA:
            tt = db.query(InvTestType).filter_by(type_key=type_key).first()
            if not tt:
                tt = InvTestType(type_key=type_key, name=type_name)
                db.add(tt)
                db.flush()
                type_added += 1

            for tname, methods in test_names:
                tn = db.query(InvTestName).filter_by(test_type_id=tt.id, name=tname).first()
                if not tn:
                    tn = InvTestName(test_type_id=tt.id, name=tname)
                    db.add(tn)
                    db.flush()
                    name_added += 1

                for method in methods:
                    exists = db.query(InvTestMethod).filter_by(test_name_id=tn.id, method_name=method).first()
                    if not exists:
                        db.add(InvTestMethod(test_name_id=tn.id, method_name=method))
                        method_added += 1

        db.commit()
        print(f"seed_test_master: {type_added} types, {name_added} names, {method_added} methods inserted.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
