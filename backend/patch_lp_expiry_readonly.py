"""Patch mfg_conjugation: make lp_expiry_retest read_only (auto-filled from lp_lot_select)."""
import sys, copy
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text
import json

SLUG = "adc-synthesis-v2"

def apply_patch(defn: dict) -> tuple[dict, int]:
    defn = copy.deepcopy(defn)
    count = 0
    for sec in defn.get("sections", defn) if isinstance(defn, dict) else defn:
        for scr in sec.get("screens", []):
            if scr["key"] != "mfg_conjugation":
                continue
            for f in scr.get("fields", []):
                if f.get("key") == "lp_expiry_retest":
                    f["read_only"] = True
                    print(f"  [OK] mfg_conjugation.lp_expiry_retest -> read_only=True")
                    count += 1
    return defn, count

def run():
    with engine.begin() as conn:
        row = conn.execute(text("SELECT id, definition FROM workflow_templates WHERE slug = :slug"), {"slug": SLUG}).fetchone()
        if not row:
            print("Template not found"); return
        template_id = str(row[0])
        patched, n = apply_patch(row[1])
        conn.execute(text("UPDATE workflow_templates SET definition = :d, updated_at = NOW() WHERE id = :id"), {"d": json.dumps(patched), "id": template_id})
        print(f"[OK] Template updated ({n} field(s)).")
        for nb_row in conn.execute(text("SELECT id, template_snapshot FROM notebooks WHERE template_id = :tid"), {"tid": template_id}).fetchall():
            if not nb_row[1]: continue
            ps, _ = apply_patch(nb_row[1])
            conn.execute(text("UPDATE notebooks SET template_snapshot = :s WHERE id = :id"), {"s": json.dumps(ps), "id": nb_row[0]})
            print(f"  [OK] Notebook {nb_row[0]} updated.")
        print("Done.")

if __name__ == "__main__":
    run()
