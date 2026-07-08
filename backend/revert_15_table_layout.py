"""
Revert screen 1.5 (mat_equipment) equipment/instrument tables from layout='stacked'
back to the normal table layout so their column headers render again.

Only removes stacked layout from tables on 'mat_equipment' that no longer contain
any rich_text column (they were made stacked solely because of the rich_text
remarks column, which has since been reverted to plain text).
"""
import sys, copy, json
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

SLUG = "adc-synthesis-v2"
TARGET_SCREEN = "mat_equipment"


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
                has_rich = any(c.get("type") == "rich_text" for c in f.get("columns", []))
                if f.get("layout") == "stacked" and not has_rich:
                    f.pop("layout", None)
                    print(f"  [OK] {scr['key']}.{f['key']} -> normal table layout")
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
        print(f"  {n} table(s) reverted to normal layout")
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
                print(f"  [OK] Notebook {nb_id} snapshot updated ({c} table).")
        print("All done.")


if __name__ == "__main__":
    run()
