"""
PostgreSQL operations.

Handles:
  - Schema bootstrap (idempotent)
  - Seeding sensor → sensor_set → reactor mapping
  - Optional Parquet file registry writes
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)


def get_conn(db_url: str):
    return psycopg2.connect(db_url)


def bootstrap(db_url: str, schema_path: Path) -> None:
    """Run schema.sql against the database (idempotent — uses IF NOT EXISTS)."""
    sql = schema_path.read_text()
    with get_conn(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    log.info("Schema bootstrapped.")


def seed_sensors(db_url: str, num_sensors: int, sensors_per_set: int = 100) -> None:
    """
    Populate the sensors table for the demo.
    Assigns sensors round-robin to sensor_sets and reactors.
    """
    with get_conn(db_url) as conn:
        with conn.cursor() as cur:
            # Ensure enough sensor_sets exist
            num_sets = (num_sensors + sensors_per_set - 1) // sensors_per_set
            for i in range(1, num_sets + 1):
                cur.execute(
                    "INSERT INTO sensor_sets (sensor_set_id, description) "
                    "VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (i, f"sensor_set_{i}"),
                )

            # Insert sensors
            reactor_ids = [1, 2, 3]
            for sensor_id in range(1, num_sensors + 1):
                set_id = ((sensor_id - 1) // sensors_per_set) + 1
                reactor_id = reactor_ids[(sensor_id - 1) % len(reactor_ids)]
                cur.execute(
                    "INSERT INTO sensors (sensor_id, sensor_set_id, reactor_id, description) "
                    "VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
                    (sensor_id, set_id, reactor_id, f"Sensor {sensor_id}"),
                )
        conn.commit()
    log.info("Seeded %d sensors.", num_sensors)


def get_sensor_set_ids_for_reactor(db_url: str, reactor_id: int) -> list[int]:
    """Step 1 of query flow: resolve which sensor_set IDs belong to a reactor."""
    with get_conn(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT s.sensor_set_id "
                "FROM sensors s "
                "WHERE s.reactor_id = %s AND s.valid_to IS NULL",
                (reactor_id,),
            )
            return [row[0] for row in cur.fetchall()]


def get_sensor_ids_for_reactor(db_url: str, reactor_id: int) -> list[int]:
    """Return all sensor_ids for a reactor (for DuckDB WHERE clause)."""
    with get_conn(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT sensor_id FROM sensors "
                "WHERE reactor_id = %s AND valid_to IS NULL",
                (reactor_id,),
            )
            return [row[0] for row in cur.fetchall()]


def register_parquet_file(
    db_url: str,
    file_path: str,
    sensor_set_id: int,
    year: int,
    month: int,
    row_count: int,
    size_bytes: int,
    compression: str,
    verified: bool = False,
) -> None:
    """Optional: record a Parquet file reference in PostgreSQL."""
    now = datetime.now(timezone.utc) if verified else None
    with get_conn(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO parquet_files
                    (file_path, sensor_set_id, year, month, row_count, size_bytes,
                     compression, verified, verified_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (file_path) DO UPDATE SET
                    row_count   = EXCLUDED.row_count,
                    size_bytes  = EXCLUDED.size_bytes,
                    verified    = EXCLUDED.verified,
                    verified_at = EXCLUDED.verified_at
                """,
                (file_path, sensor_set_id, year, month, row_count,
                 size_bytes, compression, verified, now),
            )
        conn.commit()


def list_verified_files(db_url: str) -> list[dict]:
    """Return all verified Parquet files from the registry."""
    with get_conn(db_url) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM parquet_files WHERE verified = TRUE ORDER BY year, month, sensor_set_id"
            )
            return [dict(r) for r in cur.fetchall()]
