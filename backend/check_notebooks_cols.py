import sys
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'notebooks'
        ORDER BY ordinal_position
    """)).fetchall()
    for r in rows:
        print(f"  {r[0]:35s} {r[1]}")
