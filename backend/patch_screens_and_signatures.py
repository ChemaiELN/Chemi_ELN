"""Patch adc-synthesis-v2 template:
1. Remove the standalone "Review and Approval" screens (4.4, 5.4, 7.4) — dual
   reviewer/QA sign-off is superseded by inline scientist signatures below.
2. Add a "Scientist Electronic Signature (21 CFR Part 11)" block (mirroring the
   one already on 5.3 Scientist Conclusion) to screens 1.5, 2.1, 3.7, 4.3, 6.4,
   7.3, and mark them has_signature=True.
Then syncs notebook snapshots the same way patch_stacked_layout.py etc. do.
"""
import sys, copy, json
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

SLUG = "adc-synthesis-v2"

# Screens whose "Review and Approval" dual sign-off is being removed outright.
REMOVE_SCREEN_KEYS = {"pur_peer_review", "analytical_review_approval", "dp_review_approval"}

# screen_key -> (field-key prefix, reason-for-signature options)
SIGNATURE_TARGETS = {
    "mat_equipment": ("scientist", [
        "Equipment/instrument details verified", "Reviewed with comments",
    ]),
    "buf_preparation": ("scientist", [
        "Buffer preparation complete", "Reviewed with comments",
    ]),
    "mfg_scientist_conclusion": ("scientist", [
        "Manufacturing step complete", "Reviewed with comments", "Re-submitted after revision",
    ]),
    "pur_conclusion": ("scientist", [
        "Purification step complete", "Reviewed with comments", "Re-submitted after revision",
    ]),
    "form_scientist_conclusion": ("scientist", [
        "Formulation step complete", "Reviewed with comments", "Re-submitted after revision",
    ]),
    "dp_scientist_conclusion": ("scientist", [
        "DP characterization complete", "Reviewed with comments", "Re-submitted after revision",
    ]),
}


def _signature_fields(prefix: str, reasons: list[str]) -> list[dict]:
    return [
        {"key": f"{prefix}_sig_hdr", "label": "Scientist Electronic Signature (21 CFR Part 11)",
         "type": "section_header", "required": False, "placeholder": "", "options": []},
        {"key": f"{prefix}_username", "label": "Username", "type": "text",
         "required": True, "placeholder": "Enter your username", "options": []},
        {"key": f"{prefix}_password", "label": "Password", "type": "password",
         "required": True, "placeholder": "Enter your password", "options": []},
        {"key": "reason_for_signature", "label": "Reason for signature", "type": "select",
         "required": True, "placeholder": "", "options": reasons},
        {"key": "signature_timestamp", "label": "Signature timestamp", "type": "text",
         "required": False, "placeholder": "Auto-generated on sign", "options": []},
    ]


def apply_patch(defn: dict) -> tuple[dict, dict]:
    defn = copy.deepcopy(defn)
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn
    removed, signed = [], []
    for sec in sections:
        screens = sec.get("screens", [])
        kept = []
        for scr in screens:
            if scr["key"] in REMOVE_SCREEN_KEYS:
                removed.append(scr["key"])
                continue
            kept.append(scr)
        sec["screens"] = kept

        for scr in sec["screens"]:
            target = SIGNATURE_TARGETS.get(scr["key"])
            if not target:
                continue
            prefix, reasons = target
            existing_keys = {f["key"] for f in scr.get("fields", [])}
            if f"{prefix}_sig_hdr" in existing_keys:
                continue  # already has a signature block (e.g. 5.3)
            scr["fields"] = list(scr.get("fields", [])) + _signature_fields(prefix, reasons)
            scr["has_signature"] = True
            signed.append(scr["key"])
    return defn, {"removed": removed, "signed": signed}


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
        patched, info = apply_patch(row[1])
        print(f"  removed screens: {info['removed']}")
        print(f"  added signature block to: {info['signed']}")

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
            patched_snap, info2 = apply_patch(snapshot)
            conn.execute(
                text("UPDATE notebooks SET template_snapshot = :s WHERE id = :id"),
                {"s": json.dumps(patched_snap), "id": nb_id}
            )
            print(f"  [OK] Notebook {nb_id}: removed={info2['removed']} signed={info2['signed']}")

        print("All done.")


if __name__ == "__main__":
    run()
