"""Shared batch quantity helpers — deduct/restore + event writing."""
import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

_BLOCKED_STATUSES = {"CONSUMED", "EXPIRED", "QUARANTINE"}


def deduct_qty(
    db: Session,
    batch_id: int,
    qty: Decimal,
    *,
    event_type: str,
    performed_by: str,
    ref_no: Optional[str] = None,
    module: Optional[str] = None,
    issued_to: Optional[str] = None,
    purpose: Optional[str] = None,
    project_code: Optional[str] = None,
    remarks: Optional[str] = None,
) -> None:
    """Deduct qty from batch, update status, write a batch event row."""
    from app.models.inventory import InvBatch, InvBatchEvent

    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, f"Batch {batch_id} not found.")
    if batch.status in _BLOCKED_STATUSES or not batch:
        raise HTTPException(400, f"Batch {batch_id} has status '{batch.status}' and cannot be issued.")

    available = batch.qty_available or Decimal("0")
    if qty <= 0:
        raise HTTPException(400, "Quantity must be greater than zero.")
    if qty > available:
        raise HTTPException(
            400,
            f"Insufficient stock. Available: {available}, requested: {qty}.",
        )

    batch.qty_available = available - qty
    if batch.qty_available == 0:
        batch.status = "CONSUMED"
        batch.category = "historic"
    else:
        batch.status = "PARTIALLY_CONSUMED"

    db.add(InvBatchEvent(
        batch_id=batch_id,
        event_type=event_type,
        qty=qty,
        ref_no=ref_no,
        module=module,
        issued_to=issued_to,
        purpose=purpose,
        project_code=project_code,
        performed_by=performed_by,
        performed_at=datetime.datetime.utcnow(),
        remarks=remarks,
    ))


def restore_qty(
    db: Session,
    batch_id: int,
    qty: Decimal,
    *,
    performed_by: str,
    remarks: Optional[str] = None,
) -> None:
    """Return qty to batch (e.g. on allocation cancel) and write ADJUSTMENT event."""
    from app.models.inventory import InvBatch, InvBatchEvent

    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, f"Batch {batch_id} not found.")

    batch.qty_available = (batch.qty_available or Decimal("0")) + qty
    if batch.status in ("CONSUMED", "PARTIALLY_CONSUMED"):
        batch.status = "PARTIALLY_CONSUMED" if batch.qty_available < batch.qty_received else "AVAILABLE"
        batch.category = "available"

    db.add(InvBatchEvent(
        batch_id=batch_id,
        event_type="ADJUSTMENT",
        qty=qty,
        performed_by=performed_by,
        performed_at=datetime.datetime.utcnow(),
        remarks=remarks,
    ))
