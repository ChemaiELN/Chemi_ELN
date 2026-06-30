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
    # definition may be {"sections": [...]} or directly a list
    sections = defn.get("sections", defn) if isinstance(defn, dict) else defn
    for sec in sections:
        print(f"\n== Section: {sec['key']} — {sec['title']} ==")
        for scr in sec.get('screens', []):
            print(f"  Screen: {scr['key']} — {scr['title']}")
            for f in scr.get('fields', []):
                cols = ""
                if f.get('columns'):
                    cols = " [" + ", ".join(c.get('type','?') + ':' + c.get('key','') for c in f['columns'][:4]) + "]"
                print(f"    {f['key']:30s} type={f.get('type','?'):25s} {f.get('label','')[:40]}{cols}")
