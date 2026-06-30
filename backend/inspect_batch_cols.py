import sys
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text
import json

with engine.connect() as conn:
    row = conn.execute(
        text("SELECT definition FROM workflow_templates WHERE slug = :slug"),
        {"slug": "adc-synthesis-v2"}
    ).fetchone()
    defn = row[0]
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn

    targets = ["mab_batch_info", "lp_batch_info"]
    for sec in sections:
        for scr in sec.get("screens", []):
            for f in scr.get("fields", []):
                if f["key"] in targets:
                    print(f"\n=== {f['key']} (screen: {scr['key']}) ===")
                    for col in f.get("columns", []):
                        print(f"  key={col['key']:30s} type={col.get('type','text'):20s} label={col.get('label','')}")
