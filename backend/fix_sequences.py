"""Reset PostgreSQL sequences for all inv_* tables after seeding with explicit IDs."""
from app.database import engine
from sqlalchemy import text

tables = [
    "inv_materials",
    "inv_manufacturers",
    "inv_manufacturer_mapping",
    "inv_batches",
    "inv_batch_events",
    "inv_batch_verifications",
    "inv_stock_requests",
    "inv_stock_request_events",
    "inv_equipment_types",
    "inv_instrument_types",
    "inv_column_types",
    "inv_equipment_catalogue",
    "inv_instrument_catalogue",
    "inv_column_catalogue",
    "inv_maintenance_schedules",
    "inv_calibration_schedules",
    "inv_equipment_verifications",
    "inv_instrument_verifications",
    "inv_audit_trail",
]

with engine.begin() as conn:
    for tbl in tables:
        seq = f"{tbl}_id_seq"
        sql = f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {tbl}), 1))"
        try:
            result = conn.execute(text(sql))
            val = result.scalar()
            print(f"  {tbl}: sequence -> {val}")
        except Exception as e:
            print(f"  {tbl}: SKIP ({e})")

print("Done.")
