from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    row = conn.execute(text("SELECT definition FROM workflow_templates WHERE slug = 'adc-synthesis-v2'")).fetchone()
    defn = row[0]
    for sec in defn.get('sections', []):
        for scr in sec.get('screens', []):
            for f in scr.get('fields', []):
                if f.get('type') == 'table':
                    for col in f.get('columns', []):
                        lbl = col.get('label','').lower()
                        if 'detail' in lbl or 'step' in lbl or 'check' in lbl or 'process' in lbl or 'observation' in lbl or 'remark' in lbl or 'note' in lbl or 'procedure' in lbl:
                            print(f"screen={scr['key']}  field={f['key']}  col={col['key']}  label={col['label']}  type={col['type']}")
