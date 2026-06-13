"""
Seed default role_privileges rows so the admin UI shows meaningful starting
values instead of an empty table.

Usage:  python seed_privileges.py

Safe to run multiple times — skips rows that already exist.
"""
from app.database import SessionLocal
from app.models.user import Role, RolePrivilege
from app.utils.privileges import DEFAULT_GRANTS

db = SessionLocal()

roles = {r.code: r for r in db.query(Role).all()}
if not roles:
    print("No roles found — run seed.py first.")
    db.close()
    raise SystemExit(1)

added = skipped = 0

for privilege_key, role_codes in DEFAULT_GRANTS.items():
    for code in role_codes:
        role = roles.get(code)
        if not role:
            print(f"  [?] Role '{code}' not in DB, skipping {privilege_key}")
            continue

        exists = db.query(RolePrivilege).filter(
            RolePrivilege.role_id       == role.id,
            RolePrivilege.privilege_key == privilege_key,
            RolePrivilege.department_id.is_(None),
        ).first()

        if exists:
            skipped += 1
        else:
            db.add(RolePrivilege(
                role_id       = role.id,
                privilege_key = privilege_key,
                is_granted    = True,
                department_id = None,
            ))
            print(f"  [+] {code:12s} — {privilege_key}")
            added += 1

db.commit()
print(f"\nDone. {added} rows added, {skipped} already existed.")
db.close()
