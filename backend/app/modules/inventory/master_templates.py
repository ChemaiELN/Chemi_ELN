"""Inventory – Master Templates: downloadable Excel templates served from disk (Phase 4).

Templates live under backend/uploads/excel_templates/ so this works fully
offline on an intranet deployment. Generated once (idempotent) on first
import if missing.
"""
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.dependencies import get_current_user

router = APIRouter(prefix="/inventory/master-templates", tags=["inventory-master-templates"])

TEMPLATES_DIR = os.environ.get(
    "MASTER_TEMPLATES_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "excel_templates"),
)

TEMPLATES = [
    {"key": "maintenance-planner", "name": "Maintenance Planner Template", "filename": "maintenance_planner_template.xlsx"},
    {"key": "calibration-planner", "name": "Calibration Planner Template", "filename": "calibration_planner_template.xlsx"},
]


def _ensure_templates() -> None:
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    from openpyxl import Workbook

    headers_by_key = {
        "maintenance-planner": ["Equipment Code", "Schedule Type", "Due Date"],
        "calibration-planner": ["Instrument Code", "Schedule Type", "Due Date"],
    }
    for t in TEMPLATES:
        path = os.path.join(TEMPLATES_DIR, t["filename"])
        if os.path.isfile(path):
            continue
        wb = Workbook()
        ws = wb.active
        ws.title = "Template"
        ws.append(headers_by_key[t["key"]])
        ws.append(["e.g. CPL/MFG/FBE-110", "MONTHLY", "2026-12-31"])
        for col, width in zip("ABC", (28, 16, 14)):
            ws.column_dimensions[col].width = width
        wb.save(path)


_ensure_templates()


@router.get("")
def list_templates(_: Any = Depends(get_current_user)):
    return TEMPLATES


@router.get("/{key}/download")
def download_template(key: str, _: Any = Depends(get_current_user)):
    match = next((t for t in TEMPLATES if t["key"] == key), None)
    if not match:
        raise HTTPException(404, "Template not found.")
    path = os.path.join(TEMPLATES_DIR, match["filename"])
    if not os.path.isfile(path):
        _ensure_templates()
    return FileResponse(path, filename=match["filename"], media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
