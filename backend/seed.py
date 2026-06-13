"""
Seed script — run once to populate a default department and QA admin user.
Usage:  python seed.py
"""
from app.database import SessionLocal
from app.models.user import Role, User
from app.models.department import Department
from app.core.security import hash_password
from app.models.base import new_uuid

db = SessionLocal()

# ── Default Department ────────────────────────────────────────────────────────
dept = db.query(Department).filter(Department.code == "RD").first()
if not dept:
    dept = Department(id=new_uuid(), code="RD", name="Research & Development", is_active=True)
    db.add(dept)
    db.flush()
    print("  [+] Department     : RD — Research & Development")
else:
    print("  [=] Department     : RD already exists")

# ── QA Admin User ─────────────────────────────────────────────────────────────
qa_role = db.query(Role).filter(Role.code == "QA").first()
qa_user = db.query(User).filter(User.username == "qa.admin").first()
if not qa_user:
    db.add(User(
        id            = new_uuid(),
        username      = "qa.admin",
        emp_no        = "EMP001",
        first_name    = "QA",
        last_name     = "Admin",
        display_name  = "QA Admin",
        email         = "qa@chemia.local",
        password_hash = hash_password("Admin@123"),
        role_id       = qa_role.id,
        designation   = "QA Administrator",
        department_id = dept.id,
        is_active     = True,
    ))
    print("  [+] QA admin user  : qa.admin  /  Admin@123")
else:
    print("  [=] QA admin user  : qa.admin already exists")

db.commit()
print("\nSeed complete.")
db.close()
