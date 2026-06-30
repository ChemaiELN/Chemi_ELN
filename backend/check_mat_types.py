import sys
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("SELECT DISTINCT material_type FROM inv_materials WHERE material_type IS NOT NULL ORDER BY material_type")).fetchall()
    print("Material types in inventory:")
    for r in rows:
        print(f"  {r[0]}")

    print("\nTest master keys:")
    rows2 = conn.execute(text("SELECT type_key, name FROM inv_test_master ORDER BY type_key")).fetchall()
    for r in rows2:
        print(f"  {r[0]} — {r[1]}")
