"""
One-time fix: set qty_per_pack = parent batch qty_received for all packs
that were incorrectly stored as qty_received / pack_number.

Run once:
    python seeds/fix_pack_qty.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import SessionLocal
from app.models.inventory import InvBatch, InvBatchPack

def run():
    db = SessionLocal()
    try:
        packs = (
            db.query(InvBatchPack)
            .join(InvBatch, InvBatchPack.batch_id == InvBatch.id)
            .filter(InvBatch.include_pack == True)
            .all()
        )

        updated = 0
        for pack in packs:
            correct_qty = pack.batch.qty_received
            if pack.qty_per_pack != correct_qty:
                pack.qty_per_pack = correct_qty
                updated += 1

        db.commit()
        print(f"Fixed {updated} pack(s) out of {len(packs)} total.")
    finally:
        db.close()

if __name__ == '__main__':
    run()
