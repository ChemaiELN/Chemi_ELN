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
    "master_data.manage": ["HOD"],
}

# There is no dedicated "QA" role anymore — a HOD in the QA department carries
# the same full-admin authority the old QA role used to bypass every check with.
SUPERADMIN_ROLE_CODE = "HOD"
SUPERADMIN_DEPARTMENT_CODE = "QA"

# The Administration module (Users & Roles, Role Privileges, Settings, Master
# Data) — every `require_privilege(...)` check below belongs to it — is only
# usable by QA/QC department users, regardless of role or any grant in the
# RolePrivilege table. This is a hard precondition, checked before anything else.
ADMIN_MODULE_DEPARTMENT_CODES = {"QA", "QC"}


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
    if not user.department or user.department.code not in ADMIN_MODULE_DEPARTMENT_CODES:
        return False
    if user.role.code == SUPERADMIN_ROLE_CODE and user.department.code == SUPERADMIN_DEPARTMENT_CODE:
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


# ── Project / Notebook / Experiment creation gate ───────────────────────────────
# Only HOD and Team Lead may create Projects, Notebooks, or Experiments. Chemists
# and Analysts work exclusively within experiments already created and assigned
# to them (see ASSIGNMENT_RESTRICTED_ROLES below).
CREATOR_ROLES = {"HOD", "TL"}


def require_creator_role():
    """FastAPI dependency factory — only HOD/TL may pass."""

    def _dep(current_user=Depends(get_current_user)):
        if current_user.role.code not in CREATOR_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only HOD or Team Lead can perform this action.",
            )
        return current_user

    return Depends(_dep)


# ── Notebook/experiment assignment gate ─────────────────────────────────────────
# Chemists and Analysts may only view/work on notebooks (and the experiments that
# live inside them) they have been explicitly assigned to via NotebookPermission.
# HOD/TL keep their existing (project-membership-based) access untouched.
ASSIGNMENT_RESTRICTED_ROLES = {"CHEM", "ANALYST"}


def assert_notebook_access(db: Session, user, notebook) -> None:
    """Raise 403 if `user` is assignment-restricted and not assigned to `notebook`."""
    if user.role.code not in ASSIGNMENT_RESTRICTED_ROLES:
        return
    from app.models.notebook import NotebookPermission

    assigned = (
        db.query(NotebookPermission)
        .filter(
            NotebookPermission.notebook_id == notebook.id,
            NotebookPermission.user_id == user.id,
            NotebookPermission.can_view.is_(True),
        )
        .first()
    )
    if not assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this notebook.",
        )
