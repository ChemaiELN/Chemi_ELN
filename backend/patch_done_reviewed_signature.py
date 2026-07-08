"""Patch adc-synthesis-v2 template: replace the old username/password/reason/
timestamp signature field block with a single `done_reviewed_signature` field
(Done By — Chemist/Analyst, then Reviewed By — Team Lead/HOD, each password-
re-authenticated and timestamped) on every screen that has one.
Then syncs notebook snapshots the same way the other patch_*.py scripts do.
"""
import sys, copy, json
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

SLUG = "adc-synthesis-v2"

OLD_SUFFIXES = ("_username", "_password")
OLD_SHARED_KEYS = {"reason_for_signature", "signature_timestamp"}


def apply_patch(defn: dict) -> tuple[dict, list[str]]:
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn
    patched = []
    for sec in sections:
        for scr in sec.get("screens", []):
            fields = scr.get("fields", [])
            hdr_idx = next((i for i, f in enumerate(fields) if f["key"].endswith("_sig_hdr")), None)
            if hdr_idx is None:
                continue
            prefix = fields[hdr_idx]["key"][: -len("_sig_hdr")]
            old_keys = {f"{prefix}{suf}" for suf in OLD_SUFFIXES} | OLD_SHARED_KEYS
            if not any(f["key"] in old_keys for f in fields):
                continue  # already patched (or a differently-shaped block)

            new_field = {
                "key": f"{prefix}_signature",
                "label": "Electronic Signature — Done By / Reviewed By",
                "type": "done_reviewed_signature",
                "required": False,
                "placeholder": "",
                "options": [],
            }
            new_fields = []
            inserted = False
            for f in fields:
                if f["key"] in old_keys:
                    if not inserted:
                        new_fields.append(new_field)
                        inserted = True
                    continue
                new_fields.append(f)
            scr["fields"] = new_fields
            patched.append(scr["key"])
    return defn, patched


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
        patched_defn, screens = apply_patch(row[1])
        print(f"  replaced signature block on: {screens}")

        conn.execute(
            text("UPDATE workflow_templates SET definition = :d, updated_at = NOW() WHERE id = :id"),
            {"d": json.dumps(patched_defn), "id": template_id}
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
            patched_snap, screens2 = apply_patch(snapshot)
            conn.execute(
                text("UPDATE notebooks SET template_snapshot = :s WHERE id = :id"),
                {"s": json.dumps(patched_snap), "id": nb_id}
            )
            print(f"  [OK] Notebook {nb_id}: {screens2}")

        print("All done.")


if __name__ == "__main__":
    run()
