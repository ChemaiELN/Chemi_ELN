"""
Sensor Data Generator — HTTPS endpoint.

Simulates 10,000 sensors sending temperature readings once per minute.
For the prototype we send a random batch of `sensors_per_batch` readings
each time GET /readings is called.

Columns match the Parquet schema from the architecture note:
  ts        — unix timestamp (int, seconds, UTC)
  sensor_id — int
  temp_c    — int  (stored as tenths: 101 = 10.1 °C)
"""

import random
import time
from typing import List

from fastapi import FastAPI, Query
from pydantic import BaseModel

app = FastAPI(title="Sensor Data Generator", version="1.0")


class Reading(BaseModel):
    ts: int          # unix timestamp (seconds, UTC)
    sensor_id: int
    temp_c: int      # tenths of a degree: 101 → 10.1 °C


# Stable baseline temperatures per sensor so readings look realistic
_SENSOR_BASE: dict[int, float] = {}


def _base_temp(sensor_id: int) -> float:
    if sensor_id not in _SENSOR_BASE:
        # Each sensor has a baseline between 15 °C and 85 °C
        _SENSOR_BASE[sensor_id] = random.uniform(15.0, 85.0)
    return _SENSOR_BASE[sensor_id]


def _generate_reading(sensor_id: int, ts: int) -> Reading:
    base = _base_temp(sensor_id)
    # Small random walk ±0.5 °C, occasional slow ramp (as noted in PDF)
    drift = random.gauss(0, 0.3)
    temp = round(base + drift, 1)
    # Clamp to a physically plausible range
    temp = max(-50.0, min(150.0, temp))
    return Reading(ts=ts, sensor_id=sensor_id, temp_c=int(temp * 10))


@app.get("/readings", response_model=List[Reading])
def get_readings(
    num_sensors: int = Query(default=100, ge=1, le=10_000),
    total_sensors: int = Query(default=1000, ge=1, le=10_000),
):
    """Return a random batch of sensor readings at the current timestamp."""
    now = int(time.time())
    sensor_ids = random.sample(range(1, total_sensors + 1), min(num_sensors, total_sensors))
    return [_generate_reading(sid, now) for sid in sensor_ids]


@app.get("/health")
def health():
    return {"status": "ok"}
