"""
Export ALL inventory (inv_*) tables from THIS database to a portable SQL file
(inventory_data.sql) that can be loaded on another server with import_inventory.py.

Run on the DEV machine (reads DATABASE_URL from backend/.env):
    python export_inventory.py

The output file:
  - disables FK/trigger checks (SET session_replication_role = replica)
  - clears the inv_* tables on the target
  - re-inserts every row with explicit primary keys
  - fixes each table's id sequence
so the target ends up with an exact copy of this database's inventory tables.
"""
import os
import psycopg2

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "inventory_data.sql")


def get_dsn():
    with open(os.path.join(HERE, ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL not found in .env")


def main():
    conn = psycopg2.connect(get_dsn())
    cur = conn.cursor()

    # Discover all inv_* tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'inv%'
        ORDER BY table_name
    """)
    tables = [r[0] for r in cur.fetchall()]

    total = 0
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("-- Laurus ELN inventory data export\n")
        f.write("SET session_replication_role = replica;\n")

        # Clear target tables (order irrelevant under replica role)
        for t in tables:
            f.write('DELETE FROM "%s";\n' % t)

        # Insert every row
        for t in tables:
            cur.execute('SELECT * FROM "%s"' % t)
            cols = [d[0] for d in cur.description]
            collist = ",".join('"%s"' % c for c in cols)
            ph = "(" + ",".join(["%s"] * len(cols)) + ")"
            rows = cur.fetchall()
            for r in rows:
                stmt = cur.mogrify(
                    'INSERT INTO "%s" (%s) VALUES %s' % (t, collist, ph), r
                ).decode("utf-8")
                f.write(stmt + ";\n")
            f.write("-- %s: %d rows\n" % (t, len(rows)))
            total += len(rows)

        # Reset id sequences for inv_* tables
        cur.execute("""
            SELECT table_name, column_name,
                   pg_get_serial_sequence('public.'||quote_ident(table_name), column_name)
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name LIKE 'inv%'
              AND column_default LIKE 'nextval%'
        """)
        for tbl, coln, seq in cur.fetchall():
            if seq:
                f.write(
                    "SELECT setval('%s', COALESCE((SELECT MAX(\"%s\") FROM \"%s\"),1), "
                    "(SELECT MAX(\"%s\") FROM \"%s\") IS NOT NULL);\n"
                    % (seq, coln, tbl, coln, tbl)
                )

        f.write("SET session_replication_role = DEFAULT;\n")

    conn.close()
    print("Exported %d tables, %d total rows -> %s" % (len(tables), total, OUT))


if __name__ == "__main__":
    main()
