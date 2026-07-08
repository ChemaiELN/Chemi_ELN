"""One-off data fix: reconcile InvBatchPack.qty_available with parent InvBatch.qty_available.

Prior to the fix in app/modules/inventory/_qty_ledger.py, issuing/allocating stock
against a packed batch (include_pack=True) only decremented InvBatch.qty_available,
leaving each InvBatchPack.qty_available at its original qty_per_pack. This script
replays that consumed amount across the batch's packs (FIFO by seq_no) so pack-level
totals match what they'd be had the deduction always been applied consistently.

Safe to re-run: batches whose packs already sum to qty_available are left untouched.

    python scripts/reconcile_pack_qty.py [--dry-run]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal

from app.database import SessionLocal
from app.models.inventory import InvBatch, InvBatchPack


def run(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        batches = db.query(InvBatch).filter(InvBatch.include_pack.is_(True)).all()
        fixed = 0
        for batch in batches:
            packs = (
                db.query(InvBatchPack)
                .filter(InvBatchPack.batch_id == batch.id)
                .order_by(InvBatchPack.seq_no)
                .all()
            )
            if not packs:
                continue

            pack_total = sum((p.qty_available or Decimal("0")) for p in packs)
            batch_available = batch.qty_available or Decimal("0")
            if pack_total == batch_available:
                continue

            # Reset packs to full, then replay the batch's actual consumption FIFO.
            consumed = (batch.qty_received or Decimal("0")) - batch_available
            for p in packs:
                p.qty_available = p.qty_per_pack or Decimal("0")

            remaining = consumed
            for p in packs:
                if remaining <= 0:
                    break
                take = min(p.qty_available, remaining)
                p.qty_available = p.qty_available - take
                remaining -= take

            new_total = sum((p.qty_available or Decimal("0")) for p in packs)
            print(
                f"batch {batch.batch_no} ({batch.inhouse_batch_no}): "
                f"pack total {pack_total} -> {new_total} (batch qty_available={batch_available})"
            )
            fixed += 1

        if dry_run:
            db.rollback()
            print(f"\n[dry-run] {fixed} batch(es) would be reconciled. No changes committed.")
        else:
            db.commit()
            print(f"\nreconcile_pack_qty: {fixed} batch(es) reconciled.")
    finally:
        db.close()


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
