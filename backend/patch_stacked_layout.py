"""
Patch adc-synthesis-v2: set layout='stacked' on any table field
that contains a rich_text column (details/detail/remarks/notes).
Also syncs notebook snapshots.
"""
import sys, copy
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text
import json

SLUG = "adc-synthesis-v2"


def apply_patch(defn: dict) -> tuple[dict, int]:
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn
    count = 0
    for sec in sections:
        for scr in sec.get("screens", []):
            for f in scr.get("fields", []):
                if f.get("type") != "table":
                    continue
                has_rich = any(c.get("type") == "rich_text" for c in f.get("columns", []))
                if has_rich and f.get("layout") != "stacked":
                    f["layout"] = "stacked"
                    print(f"  [OK] {scr['key']}.{f['key']} -> layout=stacked")
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
        print(f"  {n} table field(s) set to stacked layout")

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
