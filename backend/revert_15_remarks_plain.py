"""
Revert screen 1.5 (mat_equipment) 'remarks' table columns from rich_text back to
a normal text input, in the adc-synthesis-v2 template definition and all notebook
snapshots. Scoped strictly to screen key 'mat_equipment' + column key 'remarks'.
"""
import sys, copy, json
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

SLUG = "adc-synthesis-v2"
TARGET_SCREEN = "mat_equipment"     # "1.5 Equipment/Instrument Details"
TARGET_COL = "remarks"


def apply_patch(defn: dict) -> tuple[dict, int]:
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn
    count = 0
    for sec in sections:
        for scr in sec.get("screens", []):
            if scr.get("key") != TARGET_SCREEN:
                continue
            for f in scr.get("fields", []):
                if f.get("type") != "table":
                    continue
                for col in f.get("columns", []):
                    if col.get("key") == TARGET_COL and col.get("type") == "rich_text":
                        col["type"] = "text"
                        print(f"  [OK] {scr['key']}.{f['key']}.{col['key']} -> text")
                        count += 1
    return defn, count


def run():
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, definition FROM workflow_templates WHERE slug = :slug"),
            {"slug": SLUG},
        ).fetchone()
        if not row:
            print(f"Template '{SLUG}' not found!")
            return

        template_id = str(row[0])
        print(f"Patching template: {SLUG} ({template_id})")
        patched, n = apply_patch(row[1])
        print(f"  {n} column(s) reverted to text")
        conn.execute(
            text("UPDATE workflow_templates SET definition = :d, updated_at = NOW() WHERE id = :id"),
            {"d": json.dumps(patched), "id": template_id},
        )
        print("[OK] Template definition updated.")

        nb_rows = conn.execute(
            text("SELECT id, template_snapshot FROM notebooks WHERE template_snapshot IS NOT NULL")
        ).fetchall()
        print(f"Found {len(nb_rows)} notebook(s) with snapshots - patching...")
        for nb_id, snapshot in nb_rows:
            if not snapshot:
                continue
            patched_snap, c = apply_patch(snapshot)
            if c:
                conn.execute(
                    text("UPDATE notebooks SET template_snapshot = :s WHERE id = :id"),
                    {"s": json.dumps(patched_snap), "id": nb_id},
                )
                print(f"  [OK] Notebook {nb_id} snapshot updated ({c} col).")
        print("All done.")


if __name__ == "__main__":
    run()
