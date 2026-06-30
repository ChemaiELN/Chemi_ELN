"""
Patch ADC Synthesis v2 template:
1. Add batch_table_field to mab_mat_id and lp_mat_id so selecting
   a material auto-populates the batch info table.
2. Rename "PACK TYPE" label -> "SKU/Pack ID" in mab_batch_info and lp_batch_info.
"""
import sys, copy, json
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

SLUG = "adc-synthesis-v2"


def apply(defn):
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn

    screen_map = {}
    for sec in sections:
        for scr in sec.get("screens", []):
            screen_map[scr["key"]] = scr

    changes = []

    # 1. Wire batch_table_field onto the material select fields
    for screen_key, field_key, table_key in [
        ("mat_antibody",      "mab_mat_id", "mab_batch_info"),
        ("mat_linker_payload","lp_mat_id",  "lp_batch_info"),
    ]:
        scr = screen_map.get(screen_key)
        if not scr:
            continue
        fld = next((f for f in scr.get("fields", []) if f["key"] == field_key), None)
        if not fld:
            continue
        fld["batch_table_field"] = table_key
        changes.append(f"  [OK] {screen_key}.{field_key} -> batch_table_field={table_key}")

    # 2. Rename pack_type label in both batch tables
    for screen_key, table_key in [
        ("mat_antibody",      "mab_batch_info"),
        ("mat_linker_payload","lp_batch_info"),
    ]:
        scr = screen_map.get(screen_key)
        if not scr:
            continue
        tbl = next((f for f in scr.get("fields", []) if f["key"] == table_key), None)
        if not tbl:
            continue
        col = next((c for c in tbl.get("columns", []) if c["key"] == "pack_type"), None)
        if not col:
            continue
        col["label"] = "SKU/Pack ID"
        changes.append(f"  [OK] {screen_key}.{table_key}.pack_type label -> SKU/Pack ID")

    return defn, changes


def run():
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, definition FROM workflow_templates WHERE slug = :s"),
            {"s": SLUG}
        ).fetchone()
        if not row:
            print("Template not found"); return

        tid = str(row[0])
        patched, changes = apply(row[1])
        for c in changes:
            print(c)

        conn.execute(
            text("UPDATE workflow_templates SET definition=:d, updated_at=NOW() WHERE id=:id"),
            {"d": json.dumps(patched), "id": tid}
        )
        print("  Template updated.")

        # Patch existing notebook snapshots
        nbs = conn.execute(
            text("SELECT id, template_snapshot FROM notebooks WHERE template_id=:tid"),
            {"tid": tid}
        ).fetchall()
        for nb in nbs:
            if not nb[1]:
                continue
            snap, _ = apply(nb[1])
            conn.execute(
                text("UPDATE notebooks SET template_snapshot=:s WHERE id=:id"),
                {"s": json.dumps(snap), "id": nb[0]}
            )
            print(f"  Notebook {nb[0]} snapshot updated.")

        print("Done.")


if __name__ == "__main__":
    run()
