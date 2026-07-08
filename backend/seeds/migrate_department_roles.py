"""One-time migration: rebuild Roles/Departments to the new business rules.

- Roles become exactly: HOD, TL, Chemist (CHEM), Analyst (ANALYST), Store Incharge
  (STORE_INCHARGE). The old QA/ARD_TL/ARD_ANALYST/ARD_HOD roles are retired — any
  user on one of them is reassigned to its closest replacement first, so the role
  row can then be deleted without violating the users.role_id FK.
- Departments become exactly: QA (kept) + ADC PD, AD, QC, CGT, Inventory (new).
  Every other existing department is deleted; department_id / role FKs are
  SET NULL by the DB except Project.department_id, which this script nulls out
  explicitly before deleting a department (that FK has no ON DELETE clause).
- Seeds department_role_mapping (which roles are selectable per department).
- Creates the 19 default users, one per (department, role) pair, all with the
  default password `password@123`. Idempotent — safe to re-run.

Run with: python backend/seeds/migrate_department_roles.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.admin import Role, Department, User, RolePrivilege, DepartmentRoleMapping
from app.models.project import Project
# Registers every ORM class so cross-module relationship() strings resolve
# (mirrors the import set in app/main.py).
from app.models import workflow_template as _wt   # noqa: F401
from app.models import notebook as _nb            # noqa: F401
from app.models import experiment as _exp         # noqa: F401
from app.models import adc as _adc                # noqa: F401
from app.models import inventory as _inv          # noqa: F401
from app.auth.utils import hash_password

DEFAULT_PASSWORD = "password@123"

# Final role set: (code, name)
ROLES_FINAL = [
    ("HOD", "Head of Department"),
    ("TL", "Team Lead"),
    ("CHEM", "Chemist"),
    ("ANALYST", "Analyst"),
    ("STORE_INCHARGE", "Store Incharge"),
]

# Old roles being retired -> their closest replacement (users get reassigned first)
ROLE_REASSIGN = {
    "QA": "HOD",
    "ARD_TL": "TL",
    "ARD_ANALYST": "ANALYST",
    "ARD_HOD": "HOD",
}

# Final department set: (code, name) — QA is kept (reused if it already exists)
DEPARTMENTS_FINAL = [
    ("QA", "QA"),
    ("ADC_PD", "ADC PD"),
    ("AD", "AD"),
    ("QC", "QC"),
    ("CGT", "CGT"),
    ("INVENTORY", "Inventory"),
]

DEPT_ROLE_MAPPING = {
    "QA": ["HOD", "TL", "CHEM", "ANALYST"],
    "ADC_PD": ["HOD", "TL", "CHEM"],
    "AD": ["HOD", "TL", "CHEM", "ANALYST"],
    "QC": ["HOD", "TL", "CHEM", "ANALYST"],
    "CGT": ["HOD", "TL", "CHEM"],
    "INVENTORY": ["STORE_INCHARGE"],
}

# (department_code, role_code) pairs — one default user each, 19 total
DEFAULT_USER_PAIRS = [
    ("ADC_PD", "HOD"), ("ADC_PD", "TL"), ("ADC_PD", "CHEM"),
    ("AD", "HOD"), ("AD", "TL"), ("AD", "CHEM"), ("AD", "ANALYST"),
    ("QA", "HOD"), ("QA", "TL"), ("QA", "CHEM"), ("QA", "ANALYST"),
    ("QC", "HOD"), ("QC", "TL"), ("QC", "CHEM"), ("QC", "ANALYST"),
    ("CGT", "HOD"), ("CGT", "TL"), ("CGT", "CHEM"),
    ("INVENTORY", "STORE_INCHARGE"),
]


def _username_for(dept_code: str, role_code: str) -> str:
    dept_slug = dept_code.lower().replace("_", "")
    role_slug = role_code.lower().replace("_", "")
    return f"{dept_slug}.{role_slug}"


def _next_emp_no(db) -> str:
    last = db.query(User.emp_no).filter(User.emp_no.like("EMP%")).order_by(User.emp_no.desc()).first()
    if last and last[0]:
        try:
            return f"EMP{int(last[0][3:]) + 1:04d}"
        except ValueError:
            pass
    return "EMP0001"


def migrate():
    db = SessionLocal()
    created_users = []
    try:
        roles_by_code = {r.code: r for r in db.query(Role).all()}

        # 1. Create any missing final roles up front (ANALYST, STORE_INCHARGE) so
        #    reassignment in step 2 always has a valid target.
        for code, name in ROLES_FINAL:
            if code not in roles_by_code:
                role = Role(code=code, name=name)
                db.add(role)
                db.flush()
                roles_by_code[code] = role
                print(f"Created role: {code} - {name}")

        # 2. Reassign users off retiring roles, then delete those role rows.
        for old_code, new_code in ROLE_REASSIGN.items():
            old_role = roles_by_code.get(old_code)
            if not old_role:
                continue
            new_role = roles_by_code[new_code]
            moved = db.query(User).filter_by(role_id=old_role.id).update({"role_id": new_role.id})
            if moved:
                print(f"Reassigned {moved} user(s) from role {old_code} -> {new_code}")
            db.query(RolePrivilege).filter_by(role_id=old_role.id).delete()
            db.delete(old_role)
            print(f"Removed role: {old_code}")
        db.commit()

        # 3. Ensure the QA department exists (reused if already present).
        depts_by_code = {d.code: d for d in db.query(Department).all()}
        if "QA" not in depts_by_code:
            qa_dept = Department(code="QA", name="QA")
            db.add(qa_dept)
            db.flush()
            depts_by_code["QA"] = qa_dept
            print("Created department: QA")
        else:
            print("Kept existing department: QA")

        # 4. Every other existing department gets removed. Project.department_id
        #    has no ON DELETE clause, so null it out first; User/RolePrivilege/
        #    InvMaterial FKs are already ON DELETE SET NULL at the DB level.
        for code, dept in list(depts_by_code.items()):
            if code == "QA":
                continue
            moved_projects = db.query(Project).filter_by(department_id=dept.id).update({"department_id": None})
            if moved_projects:
                print(f"Cleared department on {moved_projects} project(s) previously in {code}")
            db.delete(dept)
            del depts_by_code[code]
            print(f"Removed department: {code}")
        db.commit()

        # 5. Create the remaining new departments.
        for code, name in DEPARTMENTS_FINAL:
            if code not in depts_by_code:
                dept = Department(code=code, name=name)
                db.add(dept)
                db.flush()
                depts_by_code[code] = dept
                print(f"Created department: {code} - {name}")
        db.commit()

        # 6. Reassign qa.admin (if present) into the QA department so it isn't
        #    left with a null department after the RD cleanup above.
        qa_admin = db.query(User).filter_by(username="qa.admin").first()
        if qa_admin and qa_admin.department_id != depts_by_code["QA"].id:
            qa_admin.department_id = depts_by_code["QA"].id
            print("Reassigned qa.admin -> department QA")
        db.commit()

        # 7. Rebuild department_role_mapping from scratch (idempotent).
        db.query(DepartmentRoleMapping).delete()
        for dept_code, role_codes in DEPT_ROLE_MAPPING.items():
            dept = depts_by_code[dept_code]
            for role_code in role_codes:
                db.add(DepartmentRoleMapping(department_id=dept.id, role_id=roles_by_code[role_code].id))
        db.commit()
        print("Rebuilt department_role_mapping.")

        # 8. Create the 19 default users (skip any that already exist by username).
        for dept_code, role_code in DEFAULT_USER_PAIRS:
            username = _username_for(dept_code, role_code)
            if db.query(User).filter_by(username=username).first():
                continue
            email = f"{username}@laurus.com"
            emp_no = _next_emp_no(db)
            user = User(
                username=username,
                emp_no=emp_no,
                email=email,
                password_hash=hash_password(DEFAULT_PASSWORD),
                role_id=roles_by_code[role_code].id,
                department_id=depts_by_code[dept_code].id,
            )
            db.add(user)
            db.commit()
            created_users.append({
                "username": username, "password": DEFAULT_PASSWORD,
                "department": dept_code, "role": role_code, "emp_no": emp_no,
            })

        print(f"\nCreated {len(created_users)} new default user(s).")
        print("\n| Username | Password | Department | Role |")
        print("|---|---|---|---|")
        for u in created_users:
            print(f"| {u['username']} | {u['password']} | {u['department']} | {u['role']} |")

    finally:
        db.close()


if __name__ == "__main__":
    migrate()
