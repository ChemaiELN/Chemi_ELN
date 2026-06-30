import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.admin import Role, RolePrivilege
from app.shared.privileges import DEFAULT_GRANTS


def seed():
    db = SessionLocal()
    try:
        roles = {r.code: r for r in db.query(Role).all()}
        count = 0
        for privilege_key, role_codes in DEFAULT_GRANTS.items():
            for code in role_codes:
                role = roles.get(code)
                if not role:
                    print(f"  [WARN] Role '{code}' not found — skipping '{privilege_key}'")
                    continue
                exists = (
                    db.query(RolePrivilege)
                    .filter_by(role_id=role.id, privilege_key=privilege_key, department_id=None)
                    .first()
                )
                if not exists:
                    db.add(
                        RolePrivilege(
                            role_id=role.id,
                            privilege_key=privilege_key,
                            is_granted=True,
                        )
                    )
                    count += 1
        db.commit()
        print(f"Seeded {count} privilege rows.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
