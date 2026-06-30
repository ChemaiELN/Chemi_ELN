"""Seed: inv_consumable_types — 15 rows."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.inventory import InvConsumableType

CONSUMABLE_TYPES = [
    "Filter",
    "Plastic Ware",
    "Pipette Tips",
    "Glassware",
    "Membrane",
    "Syringe",
    "Tube",
    "Microcentrifuge Tube",
    "Centrifuge Tube",
    "Spin Column",
    "96-Well Plate",
    "Vial",
    "Sealing Film",
    "Sterile Filter Unit",
    "Cuvette",
]

def run():
    db = SessionLocal()
    try:
        added = 0
        for i, name in enumerate(CONSUMABLE_TYPES):
            if not db.query(InvConsumableType).filter_by(name=name).first():
                db.add(InvConsumableType(name=name, sort_order=i))
                added += 1
        db.commit()
        print(f"seed_consumable_types: {added} rows inserted ({len(CONSUMABLE_TYPES) - added} already existed).")
    finally:
        db.close()

if __name__ == "__main__":
    run()
