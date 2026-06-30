from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    row = conn.execute(text("SELECT definition FROM workflow_templates WHERE slug = 'adc-synthesis-v2'")).fetchone()
    defn = row[0]
    for sec in defn.get('sections', []):
        for scr in sec.get('screens', []):
            if scr['key'] in ('mfg_conjugation', 'mat_linker_payload'):
                print(f"\n=== Screen: {scr['key']} ===")
                for f in scr.get('fields', []):
                    if f.get('type') == 'table':
                        print(f"  TABLE {f['key']}:")
                        for col in f.get('columns', []):
                            print(f"    col: {col['key']} | label: {col['label']} | type: {col['type']}")
                    else:
                        print(f"  field: {f['key']} | label: {f['label']} | type: {f['type']}")
