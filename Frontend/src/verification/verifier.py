"""
Verifier — checks Parquet files after writing.

Two categories of checks (per user requirement):
  1. Compression   — confirm Snappy or Zstd codec is present in file metadata
  2. Data quality  — temp range valid, no nulls, correct schema, timestamps sane

Returns a VerificationResult dataclass for each file.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pyarrow as pa
import pyarrow.parquet as pq

log = logging.getLogger(__name__)

# Valid temp_c range: -50 °C to 150 °C → stored as -500 to 1500
TEMP_MIN = -500
TEMP_MAX = 1500
VALID_COMPRESSIONS = {"snappy", "zstd", "gzip", "lz4"}


@dataclass
class VerificationResult:
    file_path: str
    passed: bool
    compression: Optional[str] = None
    row_count: int = 0
    issues: list[str] = field(default_factory=list)

    def summary(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        return (
            f"[{status}] {self.file_path} | "
            f"codec={self.compression} rows={self.row_count} "
            f"issues={self.issues or 'none'}"
        )


def verify_file(file_path: str | Path) -> VerificationResult:
    path = str(file_path)
    issues: list[str] = []

    try:
        pf = pq.ParquetFile(path)
        meta = pf.metadata
    except Exception as exc:
        return VerificationResult(path, passed=False, issues=[f"Cannot open file: {exc}"])

    # ── 1. Compression check ──────────────────────────────────────────────────
    codec = None
    for i in range(meta.num_row_groups):
        rg = meta.row_group(i)
        for j in range(rg.num_columns):
            col = rg.column(j)
            codec = col.compression.lower()   # e.g. "snappy"
            break
        break

    if codec not in VALID_COMPRESSIONS:
        issues.append(f"Unexpected compression codec: '{codec}'")

    # ── 2. Schema check ───────────────────────────────────────────────────────
    schema = pf.schema_arrow
    expected_fields = {"ts": pa.int32(), "sensor_id": pa.int32(), "temp_c": pa.int16()}
    for col_name, expected_type in expected_fields.items():
        if col_name not in schema.names:
            issues.append(f"Missing column: {col_name}")
        elif schema.field(col_name).type != expected_type:
            issues.append(
                f"Column '{col_name}' has type {schema.field(col_name).type}, "
                f"expected {expected_type}"
            )

    # ── 3. Data quality checks ────────────────────────────────────────────────
    table = pf.read()
    row_count = len(table)

    if row_count == 0:
        issues.append("File is empty (0 rows)")

    for col_name in ["ts", "sensor_id", "temp_c"]:
        if col_name in table.column_names:
            null_count = table.column(col_name).null_count
            if null_count > 0:
                issues.append(f"Column '{col_name}' has {null_count} null value(s)")

    if "temp_c" in table.column_names:
        temp_col = table.column("temp_c").to_pylist()
        out_of_range = [v for v in temp_col if v < TEMP_MIN or v > TEMP_MAX]
        if out_of_range:
            issues.append(
                f"{len(out_of_range)} temp_c value(s) out of range "
                f"[{TEMP_MIN}, {TEMP_MAX}], e.g. {out_of_range[:3]}"
            )

    if "ts" in table.column_names:
        ts_col = table.column("ts").to_pylist()
        if ts_col:
            min_ts, max_ts = min(ts_col), max(ts_col)
            # Sanity: timestamps should be in plausible range (year 2020–2035)
            if min_ts < 1_577_836_800 or max_ts > 2_051_222_400:
                issues.append(f"Timestamps look implausible: min={min_ts}, max={max_ts}")

    passed = len(issues) == 0
    result = VerificationResult(
        file_path=path,
        passed=passed,
        compression=codec,
        row_count=row_count,
        issues=issues,
    )
    log.info(result.summary())
    return result


def verify_directory(data_dir: Path) -> list[VerificationResult]:
    """Verify all Parquet files under data_dir."""
    results = []
    for p in sorted(data_dir.rglob("*.parquet")):
        results.append(verify_file(p))
    return results
