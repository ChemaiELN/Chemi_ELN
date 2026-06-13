"""
Query API Server — FastAPI + DuckDB.

Serves verified sensor data stored in Parquet files.
Query flow (2 steps per architecture note):
  ① Resolve sensor_set IDs + sensor IDs from PostgreSQL  (milliseconds)
  ② DuckDB scans only the matching Parquet files          (seconds)

Endpoints:
  GET /query           — query by reactor, time range
  GET /verify          — run verifier across all Parquet files
  GET /files           — list registered Parquet files from PostgreSQL
  GET /alt-read        — alt read path: direct DuckDB query on a Parquet file
  GET /health
"""

import glob as _glob
import sys
from pathlib import Path
from typing import Optional

import duckdb
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from config import settings
from src.storage.postgres import (
    get_sensor_ids_for_reactor,
    get_sensor_set_ids_for_reactor,
    list_verified_files,
)
from src.verification.verifier import verify_directory

app = FastAPI(title="Sensor Data Lake — Query API", version="1.0")


def _parquet_glob(year: int, month: int, sensor_set_ids: list[int]) -> list[str]:
    """Return file paths for the given year/month/sensor_set combination."""
    paths = []
    for sid in sensor_set_ids:
        pattern = str(
            settings.data_dir / f"year={year}" / f"month={month:02d}" / f"sensor_set={sid}" / "*.parquet"
        )
        paths.extend(_glob.glob(pattern))
    return paths


@app.get("/query")
def query_readings(
    reactor_id: int = Query(..., description="Reactor ID to query"),
    year: int       = Query(..., description="Year, e.g. 2025"),
    month: int      = Query(..., ge=1, le=12, description="Month 1–12"),
    limit: int      = Query(default=1000, le=100_000),
):
    """
    Query temperature readings for all sensors on a reactor.

    Step 1: resolve sensor_set IDs + sensor IDs from PostgreSQL.
    Step 2: DuckDB scans only the relevant Parquet partitions.
    """
    # Step 1 — PostgreSQL lookup (milliseconds)
    sensor_set_ids = get_sensor_set_ids_for_reactor(settings.db_url, reactor_id)
    if not sensor_set_ids:
        raise HTTPException(404, f"No sensor_sets found for reactor_id={reactor_id}")

    sensor_ids = get_sensor_ids_for_reactor(settings.db_url, reactor_id)
    if not sensor_ids:
        raise HTTPException(404, f"No sensors found for reactor_id={reactor_id}")

    # Step 2 — DuckDB reads matching Parquet files
    parquet_paths = _parquet_glob(year, month, sensor_set_ids)
    if not parquet_paths:
        raise HTTPException(
            404,
            f"No Parquet files found for reactor={reactor_id} "
            f"year={year} month={month}",
        )

    # Build IN list for DuckDB
    id_list = ", ".join(str(s) for s in sensor_ids)
    file_list = ", ".join(f"'{p}'" for p in parquet_paths)

    sql = f"""
        SELECT
            sensor_id,
            ts,
            CAST(temp_c AS DOUBLE) / 10.0 AS temp_celsius
        FROM read_parquet([{file_list}])
        WHERE sensor_id IN ({id_list})
        ORDER BY sensor_id, ts
        LIMIT {limit}
    """

    try:
        con = duckdb.connect()
        rows = con.execute(sql).fetchall()
        con.close()
    except Exception as exc:
        raise HTTPException(500, f"DuckDB query failed: {exc}") from exc

    return {
        "reactor_id": reactor_id,
        "year": year,
        "month": month,
        "sensor_set_ids": sensor_set_ids,
        "files_scanned": len(parquet_paths),
        "row_count": len(rows),
        "rows": [
            {"sensor_id": r[0], "ts": r[1], "temp_celsius": r[2]}
            for r in rows
        ],
    }


@app.get("/alt-read")
def alt_read(
    file_path: str = Query(..., description="Absolute path to a Parquet file"),
    sensor_id: Optional[int] = Query(default=None),
    limit: int = Query(default=500, le=10_000),
):
    """
    Alt Read Path — direct DuckDB query on a specific Parquet file.
    Trigger and use-case are TBD; exposed here for flexibility.
    """
    if not Path(file_path).exists():
        raise HTTPException(404, f"File not found: {file_path}")

    where = f"WHERE sensor_id = {sensor_id}" if sensor_id else ""
    sql = f"""
        SELECT sensor_id, ts, CAST(temp_c AS DOUBLE) / 10.0 AS temp_celsius
        FROM read_parquet('{file_path}')
        {where}
        ORDER BY sensor_id, ts
        LIMIT {limit}
    """
    try:
        con = duckdb.connect()
        rows = con.execute(sql).fetchall()
        con.close()
    except Exception as exc:
        raise HTTPException(500, f"DuckDB query failed: {exc}") from exc

    return {
        "file_path": file_path,
        "row_count": len(rows),
        "rows": [{"sensor_id": r[0], "ts": r[1], "temp_celsius": r[2]} for r in rows],
    }


@app.get("/verify")
def run_verification():
    """Run the verifier across all Parquet files and return results."""
    results = verify_directory(settings.data_dir)
    return {
        "total_files": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "results": [
            {
                "file": r.file_path,
                "passed": r.passed,
                "compression": r.compression,
                "rows": r.row_count,
                "issues": r.issues,
            }
            for r in results
        ],
    }


@app.get("/files")
def list_files():
    """List Parquet files registered in PostgreSQL (the optional secondary store)."""
    return list_verified_files(settings.db_url)


@app.get("/health")
def health():
    return {"status": "ok"}
