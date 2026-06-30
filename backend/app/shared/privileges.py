from typing import Literal
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user

PrivilegeKey = Literal[
    "admin.settings",
    "admin.excel_templates",
    "admin.notifications",
    "admin.role_privileges",
    "users.manage",
    "departments.manage",
    "master_data.manage",
    # future phases
    "project.manage",
    "notebook.manage",
    "experiment.manage",
    "atr.manage",
]

PRIVILEGE_CATALOG: list[str] = [
    "admin.settings",
    "admin.excel_templates",
    "admin.notifications",
    "admin.role_privileges",
    "users.manage",
    "departments.manage",
    "master_data.manage",
    "project.manage",
    "notebook.manage",
    "experiment.manage",
    "atr.manage",
]

DEFAULT_GRANTS: dict[str, list[str]] = {
    "admin.settings": ["QA"],
    "admin.excel_templates": ["QA"],
    "admin.notifications": ["QA"],
    "admin.role_privileges": ["QA"],
    "users.manage": ["QA"],
    "departments.manage": ["QA"],
    "master_data.manage": ["QA", "HOD"],
}

QA_ROLE_CODE = "QA"


def resolve_user_privileges(db: Session, user) -> set[str]:
    from app.models.admin import RolePrivilege

    rows = (
        db.query(RolePrivilege)
        .filter(
            RolePrivilege.role_id == user.role_id,
            RolePrivilege.is_granted.is_(True),
            RolePrivilege.department_id.is_(None),
        )
        .all()
    )
    if rows:
        return {r.privilege_key for r in rows}
    # Fall back to compiled DEFAULT_GRANTS
    return {key for key, codes in DEFAULT_GRANTS.items() if user.role.code in codes}


def user_has_privilege(db: Session, user, key: str) -> bool:
    if user.role.code == QA_ROLE_CODE:
        return True
    return key in resolve_user_privileges(db, user)


def require_privilege(key: str):
    """FastAPI dependency factory — raises 403 when the caller lacks the privilege."""

    def _dep(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if not user_has_privilege(db, current_user, key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Privilege '{key}' required.",
            )
        return current_user

    return Depends(_dep)
