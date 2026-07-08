"""Shared batch quantity helpers — deduct/restore + event writing."""
import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

_BLOCKED_STATUSES = {"CONSUMED", "EXPIRED", "QUARANTINE"}


def _deduct_from_packs(db: Session, batch_id: int, qty: Decimal) -> None:
    """Apply a whole-batch deduction across a batch's packs (FIFO by seq_no)
    so pack-level qty_available stays reconciled with the batch total."""
    from app.models.inventory import InvBatchPack

    remaining = qty
    packs = (
        db.query(InvBatchPack)
        .filter(InvBatchPack.batch_id == batch_id, InvBatchPack.qty_available > 0)
        .order_by(InvBatchPack.seq_no)
        .all()
    )
    for pack in packs:
        if remaining <= 0:
            break
        take = min(pack.qty_available, remaining)
        pack.qty_available = pack.qty_available - take
        remaining -= take


def _restore_to_packs(db: Session, batch_id: int, qty: Decimal) -> None:
    """Return a whole-batch restore across a batch's packs (fill least-full first,
    capped at each pack's original qty_per_pack)."""
    from app.models.inventory import InvBatchPack

    remaining = qty
    packs = (
        db.query(InvBatchPack)
        .filter(InvBatchPack.batch_id == batch_id)
        .order_by(InvBatchPack.seq_no)
        .all()
    )
    for pack in packs:
        if remaining <= 0:
            break
        room = (pack.qty_per_pack or Decimal("0")) - (pack.qty_available or Decimal("0"))
        if room <= 0:
            continue
        give = min(room, remaining)
        pack.qty_available = (pack.qty_available or Decimal("0")) + give
        remaining -= give


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

    if batch.include_pack:
        _deduct_from_packs(db, batch_id, qty)

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


def deduct_pack_qty(
    db: Session,
    pack_id: int,
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
    """Deduct qty from a specific pack's own quantity (not the whole batch),
    keeping the parent batch's aggregate qty_available in sync, and write a
    batch event row. Use this whenever the consumer picked one specific
    SKU/Pack ID rather than the batch as a whole.
    """
    from app.models.inventory import InvBatch, InvBatchPack, InvBatchEvent

    pack = db.get(InvBatchPack, pack_id)
    if not pack:
        raise HTTPException(404, f"Pack {pack_id} not found.")
    batch = db.get(InvBatch, pack.batch_id)
    if not batch:
        raise HTTPException(404, f"Parent batch for pack {pack_id} not found.")
    if batch.status in _BLOCKED_STATUSES:
        raise HTTPException(400, f"Batch {batch.id} has status '{batch.status}' and cannot be issued.")

    pack_available = pack.qty_available if pack.qty_available is not None else Decimal("0")
    if qty <= 0:
        raise HTTPException(400, "Quantity must be greater than zero.")
    if qty > pack_available:
        raise HTTPException(
            400,
            f"Insufficient stock in pack '{pack.inhouse_batch_no}'. Available: {pack_available}, requested: {qty}.",
        )

    pack.qty_available = pack_available - qty

    batch_available = batch.qty_available or Decimal("0")
    batch.qty_available = max(batch_available - qty, Decimal("0"))
    if batch.qty_available == 0:
        batch.status = "CONSUMED"
        batch.category = "historic"
    else:
        batch.status = "PARTIALLY_CONSUMED"

    db.add(InvBatchEvent(
        batch_id=batch.id,
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

    if batch.include_pack:
        _restore_to_packs(db, batch_id, qty)

    db.add(InvBatchEvent(
        batch_id=batch_id,
        event_type="ADJUSTMENT",
        qty=qty,
        performed_by=performed_by,
        performed_at=datetime.datetime.utcnow(),
        remarks=remarks,
    ))
