"""
Import inventory data produced by export_inventory.py into THIS database.

Run on the TARGET server (reads DATABASE_URL from backend/.env, or the
DATABASE_URL environment variable if set):
    python import_inventory.py

WARNING: this REPLACES the contents of every inv_* table with the data in
inventory_data.sql (it clears then reloads them). Other tables are untouched.
Requires a superuser DB account (the file toggles session_replication_role).
"""
import os
import sys
import psycopg2

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_FILE = os.path.join(HERE, "inventory_data.sql")


def get_dsn():
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    with open(os.path.join(HERE, ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL not found in .env")


def main():
    if not os.path.isfile(SQL_FILE):
        raise SystemExit("Data file not found: %s" % SQL_FILE)
    with open(SQL_FILE, encoding="utf-8") as f:
        sql = f.read()

    conn = psycopg2.connect(get_dsn())
    try:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print("Inventory data imported successfully.")
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print("IMPORT FAILED - no changes committed:", exc)
        conn.close()
        sys.exit(1)

    # Report row counts after import
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE 'inv%'
        ORDER BY table_name
    """)
    tables = [r[0] for r in cur.fetchall()]
    print("\n%-40s %s" % ("TABLE", "ROWS"))
    print("-" * 52)
    for t in tables:
        cur.execute('SELECT COUNT(*) FROM "%s"' % t)
        print("%-40s %s" % (t, cur.fetchone()[0]))
    conn.close()


if __name__ == "__main__":
    main()
