"""
Patch ADC Synthesis v2 workflow template:
- Set inventory-driven field types (material_select, batch_select, chemical_select)
- Add autofill_map so material selects fill the correct sibling field keys
- Also patches template_snapshot on all notebooks that use this template
"""
import sys, copy
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text
import json

SLUG = "adc-synthesis-v2"

# ── Field patches ──────────────────────────────────────────────────────────────
# Each entry: (screen_key, field_key, patch_dict)
# patch_dict is merged into the field definition
FIELD_PATCHES = [
    # 1.1 Antibody Info — make mAb selector a material_select
    ("mat_antibody", "mab_mat_id", {
        "type": "material_select",
        "label": "Antibody (select from registry)",
        "placeholder": "Search antibody…",
        "material_types": ["Antibody Materials"],
        "autofill_map": {
            "name":              "mab_name",
            "iso_type":          "mab_iso_type",
            "cas_no":            "mab_cas_no",
            "storage_condition": "mab_storage_condition",
        },
    }),
    # Make auto-filled text fields read-only
    ("mat_antibody", "mab_name",              {"read_only": True, "placeholder": "Auto-filled from selection"}),
    ("mat_antibody", "mab_iso_type",          {"read_only": True, "placeholder": "Auto-filled from selection"}),
    ("mat_antibody", "mab_cas_no",            {"read_only": True, "placeholder": "Auto-filled from selection"}),
    ("mat_antibody", "mab_storage_condition", {"read_only": True, "placeholder": "Auto-filled from selection"}),

    # 1.2 Linker-Payload Info
    ("mat_linker_payload", "lp_mat_id", {
        "type": "material_select",
        "label": "Linker-Payload (select from registry)",
        "placeholder": "Search linker-payload…",
        "material_types": ["Linker-Payload"],
        "autofill_map": {
            "name":              "lp_name",
            "cas_no":            "lp_cas_no",
            "storage_condition": "lp_storage_condition",
        },
    }),
    ("mat_linker_payload", "lp_name",              {"read_only": True, "placeholder": "Auto-filled"}),
    ("mat_linker_payload", "lp_cas_no",            {"read_only": True, "placeholder": "Auto-filled"}),
    ("mat_linker_payload", "lp_storage_condition", {"read_only": True, "placeholder": "Auto-filled"}),

    # 3.1 mAb lot table — material + batch columns
    # (handled separately via TABLE_COLUMN_PATCHES below)
]

# Table column patches: (screen_key, field_key, col_key, col_patch)
TABLE_COLUMN_PATCHES = [
    # 1.1 Antibody batch info
    ("mat_antibody", "mab_batch_info", "in_house_lot_batch_no", {
        "type": "batch_select",
        "label": "In-house Lot / Batch No",
    }),

    # 1.2 Linker-payload batch info
    ("mat_linker_payload", "lp_batch_info", "in_house_lot_batch_no", {
        "type": "batch_select",
        "label": "In-house Lot / Batch No",
    }),

    # 1.3 Reagents & Salts — chemicals table
    ("mat_reagents", "rs_chemicals", "chemical", {
        "type": "chemical_select",
        "label": "Chemical",
        "material_types": ["Reagents and Salts", "Chemical & Solvents"],
    }),
    ("mat_reagents", "rs_chemicals", "make", {
        "read_only": True,
        "placeholder": "Auto-filled",
    }),
    ("mat_reagents", "rs_chemicals", "cat_no", {
        "read_only": True,
        "placeholder": "Auto-filled",
    }),
    ("mat_reagents", "rs_chemicals", "cas_no", {
        "read_only": True,
        "placeholder": "Auto-filled",
    }),

    # 3.1 mAb lots table — material select + batch select
    ("mfg_thaw_pool_filter", "mab_lots", "material_id", {
        "type": "material_select",
        "label": "Antibody",
        "material_types": ["Antibody Materials"],
    }),
    ("mfg_thaw_pool_filter", "mab_lots", "lot_no", {
        "type": "batch_select",
        "label": "Lot No",
    }),

    # 3.5 Conjugation — DMSO lots: already have material_select / batch_select in template
    # (no change needed — those columns are already typed correctly)
]


def apply_patches(defn: dict) -> dict:
    """Return a deep-patched copy of the template definition."""
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn

    # Index by screen key for fast lookup
    screen_map: dict[str, dict] = {}
    for sec in sections:
        for scr in sec.get("screens", []):
            screen_map[scr["key"]] = scr

    # Field patches
    for screen_key, field_key, patch in FIELD_PATCHES:
        scr = screen_map.get(screen_key)
        if not scr:
            print(f"  [WARN] Screen not found: {screen_key}")
            continue
        fld = next((f for f in scr.get("fields", []) if f["key"] == field_key), None)
        if not fld:
            print(f"  [WARN] Field not found: {screen_key}.{field_key}")
            continue
        fld.update(patch)
        print(f"  [OK] Patched field {screen_key}.{field_key} -> {patch}")

    # Table column patches
    for screen_key, field_key, col_key, col_patch in TABLE_COLUMN_PATCHES:
        scr = screen_map.get(screen_key)
        if not scr:
            print(f"  [WARN] Screen not found: {screen_key}")
            continue
        fld = next((f for f in scr.get("fields", []) if f["key"] == field_key), None)
        if not fld:
            print(f"  [WARN] Table field not found: {screen_key}.{field_key}")
            continue
        col = next((c for c in fld.get("columns", []) if c["key"] == col_key), None)
        if not col:
            print(f"  [WARN] Column not found: {screen_key}.{field_key}.{col_key}")
            continue
        col.update(col_patch)
        print(f"  [OK] Patched column {screen_key}.{field_key}.{col_key} -> {col_patch}")

    return defn


def run():
    with engine.begin() as conn:
        # Fetch template
        row = conn.execute(
            text("SELECT id, definition FROM workflow_templates WHERE slug = :slug"),
            {"slug": SLUG}
        ).fetchone()
        if not row:
            print(f"Template '{SLUG}' not found!")
            return

        template_id = str(row[0])
        defn = row[1]
        print(f"\nPatching template: {SLUG} ({template_id})")
        patched = apply_patches(defn)

        # Update template definition
        conn.execute(
            text("UPDATE workflow_templates SET definition = :d, updated_at = NOW() WHERE id = :id"),
            {"d": json.dumps(patched), "id": template_id}
        )
        print("\n[OK] Template definition updated.")

        # Patch all notebook snapshots that use this template
        nb_rows = conn.execute(
            text("SELECT id, template_snapshot FROM notebooks WHERE template_id = :tid"),
            {"tid": template_id}
        ).fetchall()
        print(f"\nFound {len(nb_rows)} notebook(s) using this template - patching snapshots...")
        for nb_row in nb_rows:
            nb_id = nb_row[0]
            snapshot = nb_row[1]
            if not snapshot:
                continue
            patched_snap = apply_patches(snapshot)
            conn.execute(
                text("UPDATE notebooks SET template_snapshot = :s WHERE id = :id"),
                {"s": json.dumps(patched_snap), "id": nb_id}
            )
            print(f"  [OK] Notebook {nb_id} snapshot updated.")

        print("\nAll done.")


if __name__ == "__main__":
    run()
