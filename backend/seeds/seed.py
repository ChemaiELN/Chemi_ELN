import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.admin import Role, User, Department
from app.auth.utils import hash_password

ROLES = [
    {"code": "QA", "name": "Quality Assurance"},
    {"code": "HOD", "name": "Head of Department"},
    {"code": "TL", "name": "Team Lead"},
    {"code": "CHEM", "name": "Chemist"},
    {"code": "ARD_TL", "name": "ARD Team Lead"},
    {"code": "ARD_ANALYST", "name": "ARD Analyst"},
    {"code": "ARD_HOD", "name": "ARD Head of Department"},
]


def seed():
    db = SessionLocal()
    try:
        for r in ROLES:
            if not db.query(Role).filter_by(code=r["code"]).first():
                db.add(Role(**r))
        db.commit()
        print(f"Seeded {len(ROLES)} roles.")

        dept = db.query(Department).filter_by(code="RD").first()
        if not dept:
            dept = Department(code="RD", name="Research & Development")
            db.add(dept)
            db.commit()
            print("Seeded department: RD — Research & Development")

        qa_role = db.query(Role).filter_by(code="QA").first()
        if not db.query(User).filter_by(username="qa.admin").first():
            db.add(
                User(
                    username="qa.admin",
                    emp_no="EMP0001",
                    email="qa.admin@laurus.com",
                    password_hash=hash_password("Admin@123"),
                    role_id=qa_role.id,
                    department_id=dept.id,
                )
            )
            db.commit()
            print("Seeded QA admin user:  qa.admin / Admin@123")
        else:
            print("QA admin user already exists — skipped.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
