"""
Parquet Writer.

Groups readings by sensor_set and writes partitioned Parquet files:
  <data_dir>/year=YYYY/month=MM/sensor_set=N/readings.parquet

Schema (matches architecture note):
  ts        — int32  (unix seconds, UTC)
  sensor_id — int32
  temp_c    — int16  (tenths of °C: 101 → 10.1 °C)

File-level metadata:
  timezone  — "Asia/Kolkata"

Compression: Snappy (can switch to Zstd via COMPRESSION constant).
Encoding: Delta+RLE applied automatically by pyarrow for int columns.
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

import pyarrow as pa
import pyarrow.parquet as pq

log = logging.getLogger(__name__)

COMPRESSION = "snappy"   # or "zstd"
TIMEZONE_META = "Asia/Kolkata"

# Parquet schema matching the architecture note
SCHEMA = pa.schema([
    pa.field("ts",        pa.int32()),
    pa.field("sensor_id", pa.int32()),
    pa.field("temp_c",    pa.int16()),
])


class ReadingRow(NamedTuple):
    ts: int
    sensor_id: int
    temp_c: int


def _parquet_path(data_dir: Path, year: int, month: int, sensor_set_id: int) -> Path:
    p = data_dir / f"year={year}" / f"month={month:02d}" / f"sensor_set={sensor_set_id}"
    p.mkdir(parents=True, exist_ok=True)
    return p / "readings.parquet"


def write_batch(
    data_dir: Path,
    readings: list[dict],
    sensor_to_set: dict[int, int],
    year: int | None = None,
    month: int | None = None,
) -> dict[str, dict]:
    """
    Write a batch of readings to Parquet, grouped by sensor_set.

    Returns a dict of { file_path: { sensor_set_id, row_count, size_bytes } }
    for each file written (used by the Verifier).
    """
    now = datetime.now(timezone.utc)
    year  = year  or now.year
    month = month or now.month

    # Group rows by sensor_set
    groups: dict[int, list[ReadingRow]] = defaultdict(list)
    for r in readings:
        sid = r["sensor_id"]
        set_id = sensor_to_set.get(sid)
        if set_id is None:
            continue
        groups[set_id].append(ReadingRow(r["ts"], sid, r["temp_c"]))

    written: dict[str, dict] = {}

    for set_id, rows in groups.items():
        path = _parquet_path(data_dir, year, month, set_id)

        ts_arr        = pa.array([r.ts        for r in rows], type=pa.int32())
        sensor_id_arr = pa.array([r.sensor_id for r in rows], type=pa.int32())
        temp_c_arr    = pa.array([r.temp_c    for r in rows], type=pa.int16())

        table = pa.table(
            {"ts": ts_arr, "sensor_id": sensor_id_arr, "temp_c": temp_c_arr},
            schema=SCHEMA,
        )

        # Attach timezone as file-level metadata (stored once, not per row)
        existing_meta = table.schema.metadata or {}
        table = table.replace_schema_metadata({**existing_meta, b"timezone": TIMEZONE_META.encode()})

        # Append to existing file if it exists, otherwise create it
        if path.exists():
            existing = pq.read_table(path)
            table = pa.concat_tables([existing, table])

        pq.write_table(
            table,
            path,
            compression=COMPRESSION,
            # write_statistics=True enables column stats for predicate pushdown
            write_statistics=True,
            use_dictionary=False,   # delta+RLE works better without dictionary for ints
        )

        size = path.stat().st_size
        written[str(path)] = {
            "sensor_set_id": set_id,
            "row_count": len(table),
            "size_bytes": size,
        }
        log.debug("Wrote %d rows to %s (%d bytes)", len(rows), path, size)

    return written


def build_sensor_to_set_map(db_url: str) -> dict[int, int]:
    """Build a sensor_id → sensor_set_id lookup from PostgreSQL."""
    import psycopg2
    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT sensor_id, sensor_set_id FROM sensors WHERE valid_to IS NULL")
            return {row[0]: row[1] for row in cur.fetchall()}
