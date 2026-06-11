"""
Fetcher / Listener.

Polls the generator HTTPS endpoint on a fixed interval.
For each batch of readings it:
  1. Writes time-series data to partitioned Parquet files
  2. (PostgreSQL sensor metadata is pre-seeded at startup)
  3. Triggers the Verifier on any newly written file
  4. Registers the verified file in PostgreSQL (optional secondary path)
"""

import logging
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from config import settings
from src.storage import parquet_writer
from src.storage import postgres
from src.verification.verifier import verify_file

log = logging.getLogger(__name__)


def fetch_once(
    client: httpx.Client,
    sensor_to_set: dict[int, int],
    data_dir: Path,
) -> None:
    url = f"{settings.generator_url}/readings"
    params = {
        "num_sensors": settings.sensors_per_batch,
        "total_sensors": settings.num_sensors,
    }
    try:
        resp = client.get(url, params=params, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        log.warning("Generator request failed: %s", exc)
        return

    readings = resp.json()
    log.info("Fetched %d readings.", len(readings))

    # Write to Parquet (grouped by sensor_set, partitioned by date)
    written = parquet_writer.write_batch(
        data_dir=data_dir,
        readings=readings,
        sensor_to_set=sensor_to_set,
    )

    # Verify + register each written file
    for file_path, info in written.items():
        result = verify_file(file_path)
        if result.passed:
            # Optional secondary path: register in PostgreSQL
            postgres.register_parquet_file(
                db_url=settings.db_url,
                file_path=file_path,
                sensor_set_id=info["sensor_set_id"],
                year=info.get("year", 0),
                month=info.get("month", 0),
                row_count=info["row_count"],
                size_bytes=info["size_bytes"],
                compression=result.compression or "unknown",
                verified=True,
            )
        else:
            log.warning("Verification FAILED for %s: %s", file_path, result.issues)


def run() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    log.info("Fetcher starting. Connecting to PostgreSQL…")

    # Bootstrap schema and seed sensors
    schema_path = Path(__file__).resolve().parents[2] / "schema.sql"
    postgres.bootstrap(settings.db_url, schema_path)
    postgres.seed_sensors(settings.db_url, settings.num_sensors)

    # Build sensor → sensor_set map (cached for the session)
    sensor_to_set = parquet_writer.build_sensor_to_set_map(settings.db_url)
    log.info("Loaded sensor→set map for %d sensors.", len(sensor_to_set))

    data_dir = settings.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)

    log.info(
        "Polling generator at %s every %.1fs…",
        settings.generator_url,
        settings.fetch_interval_seconds,
    )

    with httpx.Client() as client:
        while True:
            fetch_once(client, sensor_to_set, data_dir)
            time.sleep(settings.fetch_interval_seconds)


if __name__ == "__main__":
    run()
