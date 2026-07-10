"""Inventory – Equipment/Instrument Usage Logs + derived status history (Phase 7).

Usage logs are entered manually today (Add / Edit / End a usage session).
`source` and `experiment_id` are already on the model so a future
auto-generate-from-Experiments integration (Phase 7 follow-up, once the
Experiments module has an equipment/instrument link) is additive — no
migration needed later.

The "status history" (tabular + calendar) views are computed on read by
merging usage-log sessions with overlapping maintenance/calibration work
order sessions for the same item, filling any remaining time with AVAILABLE.
"""
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import (
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
    InvUsageLog,
    InvWorkOrder,
)
from app.schemas.inventory import UsageLogCreate, UsageLogEnd, UsageLogOut
from app.shared.inv_audit import write_inv_audit

router = APIRouter(prefix="/inventory/usage-logs", tags=["inventory-usage-logs"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _catalogue_item(db: Session, target_kind: str, item_id: int):
    Model = InvEquipmentCatalogue if target_kind == "EQUIPMENT" else InvInstrumentCatalogue
    return db.get(Model, item_id)


@router.get("", response_model=list[UsageLogOut])
def list_usage_logs(
    target_kind: str = Query(...),
    equipment_id: Optional[int] = Query(None),
    instrument_id: Optional[int] = Query(None),
    from_date: Optional[datetime.date] = Query(None),
    to_date: Optional[datetime.date] = Query(None),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvUsageLog).filter(InvUsageLog.target_kind == target_kind)
    if equipment_id is not None:
        q = q.filter(InvUsageLog.equipment_id == equipment_id)
    if instrument_id is not None:
        q = q.filter(InvUsageLog.instrument_id == instrument_id)
    if from_date:
        q = q.filter(InvUsageLog.started_at >= datetime.datetime.combine(from_date, datetime.time.min))
    if to_date:
        q = q.filter(InvUsageLog.started_at <= datetime.datetime.combine(to_date, datetime.time.max))
    return q.order_by(InvUsageLog.started_at.desc()).all()


@router.post("", response_model=UsageLogOut, status_code=201)
def add_usage_log(
    body: UsageLogCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if bool(body.equipment_id) == bool(body.instrument_id):
        raise HTTPException(400, "Provide exactly one of equipment_id or instrument_id.")
    target_kind = "EQUIPMENT" if body.equipment_id else "INSTRUMENT"
    item = _catalogue_item(db, target_kind, body.equipment_id or body.instrument_id)
    if not item:
        raise HTTPException(404, "Equipment/instrument not found.")

    open_log = db.query(InvUsageLog).filter(
        InvUsageLog.equipment_id == body.equipment_id, InvUsageLog.instrument_id == body.instrument_id,
        InvUsageLog.ended_at.is_(None),
    ).first()
    if open_log:
        raise HTTPException(409, "This item already has an open usage session — end it first.")

    row = InvUsageLog(
        target_kind=target_kind, equipment_id=body.equipment_id, instrument_id=body.instrument_id,
        previous_product_code=body.previous_product_code, previous_batch_no=body.previous_batch_no,
        reference_no=body.reference_no, document_name=body.document_name, usage_remarks=body.usage_remarks,
        status="IN_USE", started_by=_user_ref(current_user), started_at=body.started_at, source="MANUAL",
    )
    db.add(row)
    old_status = item.status
    item.status = "IN_USE"
    write_inv_audit(
        db, event_type="USAGE_LOG_STARTED", entity_type=f"inv_{target_kind.lower()}_catalogue",
        entity_id=item.id, entity_ref=item.asset_id, performed_by=_user_ref(current_user),
        old_value=old_status, new_value="IN_USE",
    )
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{log_id}/end", response_model=UsageLogOut)
def end_usage_log(
    log_id: int,
    body: UsageLogEnd,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    row = db.get(InvUsageLog, log_id)
    if not row:
        raise HTTPException(404, "Usage log not found.")
    if row.ended_at:
        raise HTTPException(409, "Usage log already ended.")
    row.ended_by = _user_ref(current_user)
    row.ended_at = body.ended_at
    row.usage_remarks = body.usage_remarks
    row.status = "AVAILABLE"

    item = _catalogue_item(db, row.target_kind, row.equipment_id or row.instrument_id)
    if item and item.status == "IN_USE":
        item.status = "AVAILABLE"
        write_inv_audit(
            db, event_type="USAGE_LOG_ENDED", entity_type=f"inv_{row.target_kind.lower()}_catalogue",
            entity_id=item.id, entity_ref=item.asset_id, performed_by=_user_ref(current_user),
            old_value="IN_USE", new_value="AVAILABLE",
        )
    db.commit()
    db.refresh(row)
    return row


# ── Status history (tabular + calendar) — computed on read ────────────────────
WORK_ORDER_STATUS_LABEL = {"MAINTENANCE": "UNDER_MAINTENANCE", "CLEANING": "UNDER_CLEANING", "CALIBRATION": "UNDER_CALIBRATION"}


def _busy_periods(db: Session, target_kind: str, item_id: int, window_start: datetime.datetime, window_end: datetime.datetime) -> list[dict]:
    periods = []
    id_field = InvUsageLog.equipment_id if target_kind == "EQUIPMENT" else InvUsageLog.instrument_id
    logs = db.query(InvUsageLog).filter(
        id_field == item_id, InvUsageLog.started_at < window_end,
        (InvUsageLog.ended_at.is_(None)) | (InvUsageLog.ended_at > window_start),
    ).all()
    for log in logs:
        periods.append({
            "status": "IN_USE", "start": log.started_at, "end": log.ended_at,
            "started_by": log.started_by, "ended_by": log.ended_by,
            "previous_product_code": log.previous_product_code, "previous_batch_no": log.previous_batch_no,
            "remarks": log.usage_remarks,
        })

    wo_id_field = InvWorkOrder.equipment_id if target_kind == "EQUIPMENT" else InvWorkOrder.instrument_id
    work_orders = db.query(InvWorkOrder).filter(
        wo_id_field == item_id, InvWorkOrder.started_at.isnot(None), InvWorkOrder.started_at < window_end,
        (InvWorkOrder.approved_at.is_(None)) | (InvWorkOrder.approved_at > window_start),
    ).all()
    for wo in work_orders:
        periods.append({
            "status": WORK_ORDER_STATUS_LABEL.get(wo.log_type, "UNDER_MAINTENANCE"),
            "start": wo.started_at, "end": wo.approved_at,
            "started_by": wo.started_by, "ended_by": wo.approved_by,
            "previous_product_code": None, "previous_batch_no": None,
            "remarks": wo.workorder_no,
        })

    periods.sort(key=lambda p: p["start"])
    return periods


def _fill_idle_gaps(periods: list[dict], window_start: datetime.datetime, window_end: datetime.datetime) -> list[dict]:
    rows = []
    cursor = window_start
    for p in periods:
        start = max(p["start"], window_start)
        if start > cursor:
            rows.append({"status": "AVAILABLE", "start": cursor, "end": start, "started_by": None, "ended_by": None,
                         "previous_product_code": None, "previous_batch_no": None, "remarks": None})
        end = min(p["end"], window_end) if p["end"] else window_end
        rows.append({**p, "end": p["end"]})
        cursor = max(cursor, end)
    if cursor < window_end:
        rows.append({"status": "AVAILABLE", "start": cursor, "end": window_end, "started_by": None, "ended_by": None,
                     "previous_product_code": None, "previous_batch_no": None, "remarks": None})
    return rows


def _duration_label(start: datetime.datetime, end: Optional[datetime.datetime]) -> str:
    end = end or datetime.datetime.now()
    seconds = int((end - start).total_seconds())
    if seconds < 0:
        seconds = 0
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m}m {s}s"


@router.get("/status-history")
def status_history(
    target_kind: str = Query(...),
    equipment_id: Optional[int] = Query(None),
    instrument_id: Optional[int] = Query(None),
    from_date: datetime.date = Query(...),
    to_date: datetime.date = Query(...),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    item_id = equipment_id if target_kind == "EQUIPMENT" else instrument_id
    if not item_id:
        raise HTTPException(400, "equipment_id or instrument_id is required.")
    window_start = datetime.datetime.combine(from_date, datetime.time.min)
    window_end = min(datetime.datetime.combine(to_date, datetime.time.max), datetime.datetime.now())
    if window_end < window_start:
        window_end = window_start

    periods = _busy_periods(db, target_kind, item_id, window_start, window_end)
    rows = _fill_idle_gaps(periods, window_start, window_end)
    return [
        {
            "status": r["status"],
            "previous_product_code": r["previous_product_code"],
            "previous_batch_no": r["previous_batch_no"],
            "started_by": r["started_by"], "started_at": r["start"].isoformat(),
            "ended_by": r["ended_by"], "ended_at": r["end"].isoformat() if r["end"] else None,
            "duration": _duration_label(r["start"], r["end"]),
            "remarks": r["remarks"],
        }
        for r in rows
    ]


@router.get("/calendar")
def usage_calendar(
    target_kind: str = Query(...),
    equipment_id: Optional[int] = Query(None),
    instrument_id: Optional[int] = Query(None),
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    item_id = equipment_id if target_kind == "EQUIPMENT" else instrument_id
    if not item_id:
        raise HTTPException(400, "equipment_id or instrument_id is required.")
    try:
        year, mon = (int(x) for x in month.split("-"))
    except ValueError:
        raise HTTPException(400, "month must be in YYYY-MM format.")
    window_start = datetime.datetime(year, mon, 1)
    next_month = datetime.date(year + (mon == 12), (mon % 12) + 1, 1)
    window_end = min(datetime.datetime.combine(next_month, datetime.time.min), datetime.datetime.now())
    if window_end < window_start:
        window_end = window_start

    periods = _busy_periods(db, target_kind, item_id, window_start, window_end)
    rows = _fill_idle_gaps(periods, window_start, window_end)

    days: dict[str, list[dict]] = {}
    for r in rows:
        cur = r["start"]
        end = r["end"] or window_end
        while cur < end:
            day_key = cur.date().isoformat()
            day_end = min(datetime.datetime.combine(cur.date() + datetime.timedelta(days=1), datetime.time.min), end)
            seconds = int((day_end - cur).total_seconds())
            if seconds > 0:
                days.setdefault(day_key, []).append({
                    "status": r["status"], "duration": _duration_label(cur, day_end),
                    "seconds": seconds,
                })
            cur = day_end
    return days
