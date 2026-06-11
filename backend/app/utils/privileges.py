"""
Privilege-based access control.

Access decisions are made by querying the role_privileges table, so QA admin
can grant or revoke permissions without a redeployment.

Lookup order:
  1. QA role → always allowed (super-admin bypass).
  2. DB row (role_id + privilege_key) found → use is_granted value.
  3. No DB row → fall back to DEFAULT_GRANTS (matches current hardcoded behaviour).
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import RolePrivilege, User
from app.modules.auth.dependencies import get_current_user

# ── Privilege key constants ───────────────────────────────────────────────────

ADMIN_SETTINGS       = "admin.settings"        # company/CRD settings + sequences
ADMIN_TEMPLATES      = "admin.excel_templates"
ADMIN_NOTIFICATIONS  = "admin.notifications"
ADMIN_ROLE_PRIVS     = "admin.role_privileges"
USERS_MANAGE         = "users.manage"
DEPARTMENTS_MANAGE   = "departments.manage"
MASTER_DATA_MANAGE   = "master_data.manage"    # chemicals, instruments, sites
PROJECTS_MANAGE      = "projects.manage"       # create/edit projects + milestones
PROJECTS_ROUTES      = "projects.routes"       # create/edit routes + stages
NOTEBOOKS_MANAGE     = "notebooks.manage"
ATR_ASSIGN           = "atr.assign"
ATR_UNLOCK           = "atr.unlock"            # approve/reject unlock requests
EXPERIMENTS_VOID     = "experiments.void"
EXPERIMENTS_UNLOCK   = "experiments.unlock"

ALL_PRIVILEGE_KEYS: frozenset[str] = frozenset({
    ADMIN_SETTINGS, ADMIN_TEMPLATES, ADMIN_NOTIFICATIONS, ADMIN_ROLE_PRIVS,
    USERS_MANAGE, DEPARTMENTS_MANAGE, MASTER_DATA_MANAGE,
    PROJECTS_MANAGE, PROJECTS_ROUTES,
    NOTEBOOKS_MANAGE,
    ATR_ASSIGN, ATR_UNLOCK,
    EXPERIMENTS_VOID, EXPERIMENTS_UNLOCK,
})

# Default grants — mirrors the existing hardcoded require_roles() calls so
# behaviour is unchanged until QA explicitly overrides via role_privileges.
DEFAULT_GRANTS: dict[str, frozenset[str]] = {
    ADMIN_SETTINGS:      frozenset({"QA"}),
    ADMIN_TEMPLATES:     frozenset({"QA"}),
    ADMIN_NOTIFICATIONS: frozenset({"QA"}),
    ADMIN_ROLE_PRIVS:    frozenset({"QA"}),
    USERS_MANAGE:        frozenset({"QA"}),
    DEPARTMENTS_MANAGE:  frozenset({"QA"}),
    MASTER_DATA_MANAGE:  frozenset({"QA", "HOD"}),
    PROJECTS_MANAGE:     frozenset({"QA", "TL"}),
    PROJECTS_ROUTES:     frozenset({"QA", "HOD", "TL"}),
    NOTEBOOKS_MANAGE:    frozenset({"QA", "HOD", "TL"}),
    ATR_ASSIGN:          frozenset({"QA", "TL"}),
    ATR_UNLOCK:          frozenset({"QA"}),
    EXPERIMENTS_VOID:    frozenset({"QA"}),
    EXPERIMENTS_UNLOCK:  frozenset({"QA"}),
}


def require_privilege(privilege_key: str):
    """
    FastAPI dependency factory.

    Usage:
        @router.post("/void")
        def void(user = Depends(require_privilege(EXPERIMENTS_VOID))):
            ...
    """
    def _check(
        current_user: User    = Depends(get_current_user),
        db:           Session = Depends(get_db),
    ) -> User:
        # QA is always super-admin
        if current_user.role.code == "QA":
            return current_user

        # Explicit DB override takes priority over defaults
        priv = db.query(RolePrivilege).filter(
            RolePrivilege.role_id       == current_user.role_id,
            RolePrivilege.privilege_key == privilege_key,
        ).first()

        if priv is not None:
            if priv.is_granted:
                return current_user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Privilege '{privilege_key}' has been revoked for your role.",
            )

        # Fall back to hardcoded defaults
        if current_user.role.code in DEFAULT_GRANTS.get(privilege_key, frozenset()):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing privilege: {privilege_key}",
        )

    return _check
