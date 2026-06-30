"""
Patch adc-synthesis-v2: make parent_lineage and parent_sample fields
read-only in downstream screens — they're auto-derived from the lineage
chain in AdcSectionPage so users should never edit them.
"""
import sys, copy
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text
import json

SLUG = "adc-synthesis-v2"

# (screen_key, field_key) pairs to make read-only
READONLY_FIELDS = {
    "mfg_conjugation":  {"parent_lineage", "parent_sample"},
    "mfg_quench":       {"parent_lineage", "parent_sample"},
    "pur_purification": {"parent_lineage", "parent_sample"},
    "pur_ufdf":         {"parent_lineage", "parent_sample"},
}


def apply_patch(defn: dict) -> tuple[dict, int]:
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn
    count = 0
    for sec in sections:
        for scr in sec.get("screens", []):
            target_fields = READONLY_FIELDS.get(scr["key"])
            if not target_fields:
                continue
            for f in scr.get("fields", []):
                if f.get("key") in target_fields:
                    f["read_only"] = True
                    print(f"  [OK] {scr['key']}.{f['key']} -> read_only=True")
                    count += 1
    return defn, count


def run():
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, definition FROM workflow_templates WHERE slug = :slug"),
            {"slug": SLUG}
        ).fetchone()
        if not row:
            print(f"Template '{SLUG}' not found!")
            return

        template_id = str(row[0])
        print(f"Patching template: {SLUG} ({template_id})")
        patched, n = apply_patch(row[1])
        print(f"  {n} field(s) set to read_only")

        conn.execute(
            text("UPDATE workflow_templates SET definition = :d, updated_at = NOW() WHERE id = :id"),
            {"d": json.dumps(patched), "id": template_id}
        )
        print("[OK] Template definition updated.")

        nb_rows = conn.execute(
            text("SELECT id, template_snapshot FROM notebooks WHERE template_id = :tid"),
            {"tid": template_id}
        ).fetchall()
        print(f"Found {len(nb_rows)} notebook(s) - patching snapshots...")
        for nb_row in nb_rows:
            nb_id = nb_row[0]
            snapshot = nb_row[1]
            if not snapshot:
                continue
            patched_snap, _ = apply_patch(snapshot)
            conn.execute(
                text("UPDATE notebooks SET template_snapshot = :s WHERE id = :id"),
                {"s": json.dumps(patched_snap), "id": nb_id}
            )
            print(f"  [OK] Notebook {nb_id} snapshot updated.")

        print("All done.")


if __name__ == "__main__":
    run()
