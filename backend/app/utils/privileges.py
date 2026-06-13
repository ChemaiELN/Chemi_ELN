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

# ── Admin ─────────────────────────────────────────────────────────────────────
ADMIN_SETTINGS       = "admin.settings"        # company/CRD settings + sequences
ADMIN_TEMPLATES      = "admin.excel_templates"
ADMIN_NOTIFICATIONS  = "admin.notifications"
ADMIN_ROLE_PRIVS     = "admin.role_privileges"

# ── Users & Org ───────────────────────────────────────────────────────────────
USERS_MANAGE         = "users.manage"
DEPARTMENTS_MANAGE   = "departments.manage"
MASTER_DATA_MANAGE   = "master_data.manage"    # chemicals, instruments, sites

# ── Projects ──────────────────────────────────────────────────────────────────
PROJECTS_CREATE      = "projects.create"
PROJECTS_EDIT        = "projects.edit"
PROJECTS_ROUTES      = "projects.routes"       # create/edit routes + stages

# ── Notebooks ─────────────────────────────────────────────────────────────────
NOTEBOOKS_CREATE      = "notebooks.create"
NOTEBOOKS_EDIT        = "notebooks.edit"
NOTEBOOKS_PERMISSIONS = "notebooks.permissions"  # manage who can access a notebook

# ── Experiments ───────────────────────────────────────────────────────────────
EXPERIMENTS_VERIFY   = "experiments.verify"
EXPERIMENTS_APPROVE  = "experiments.approve"
EXPERIMENTS_UNLOCK   = "experiments.unlock"
EXPERIMENTS_VOID     = "experiments.void"

# ── ATR ───────────────────────────────────────────────────────────────────────
ATR_ASSIGN           = "atr.assign"
ATR_UNLOCK           = "atr.unlock"            # approve/reject unlock requests

# ── Human-readable catalog (used by /api/admin/privilege-keys) ───────────────

PRIVILEGE_CATALOG = [
    {
        "module": "Admin",
        "privileges": [
            {"key": ADMIN_SETTINGS,       "label": "Manage Settings",        "description": "Edit company-wide, CRD, and number-sequence settings"},
            {"key": ADMIN_TEMPLATES,      "label": "Manage Excel Templates",  "description": "Upload and configure Excel import templates"},
            {"key": ADMIN_NOTIFICATIONS,  "label": "Manage Notifications",    "description": "Configure email and system notification settings"},
            {"key": ADMIN_ROLE_PRIVS,     "label": "Manage Role Privileges",  "description": "Grant or revoke action privileges for any role"},
        ],
    },
    {
        "module": "Users & Organisation",
        "privileges": [
            {"key": USERS_MANAGE,        "label": "Manage Users",        "description": "Create, edit, and deactivate user accounts"},
            {"key": DEPARTMENTS_MANAGE,  "label": "Manage Departments",  "description": "Create and edit department records"},
            {"key": MASTER_DATA_MANAGE,  "label": "Manage Master Data",  "description": "Add and edit chemicals, instruments, and sites"},
        ],
    },
    {
        "module": "Projects",
        "privileges": [
            {"key": PROJECTS_CREATE,  "label": "Create Projects",         "description": "Create new projects"},
            {"key": PROJECTS_EDIT,    "label": "Edit Projects",           "description": "Edit projects, milestones, and team members"},
            {"key": PROJECTS_ROUTES,  "label": "Manage Routes & Stages",  "description": "Create and edit synthesis routes and their stages"},
        ],
    },
    {
        "module": "Notebooks",
        "privileges": [
            {"key": NOTEBOOKS_CREATE,       "label": "Create Notebooks",   "description": "Create new lab notebooks"},
            {"key": NOTEBOOKS_EDIT,         "label": "Edit Notebooks",     "description": "Edit notebook name, description, and settings"},
            {"key": NOTEBOOKS_PERMISSIONS,  "label": "Manage Access",      "description": "Grant, update, or revoke user access to notebooks"},
        ],
    },
    {
        "module": "Experiments",
        "privileges": [
            {"key": EXPERIMENTS_VERIFY,   "label": "Verify Experiments",  "description": "Mark a submitted experiment as verified"},
            {"key": EXPERIMENTS_APPROVE,  "label": "Approve Experiments", "description": "Approve a verified experiment"},
            {"key": EXPERIMENTS_UNLOCK,   "label": "Unlock Experiments",  "description": "Unlock an approved experiment so a new version can be created"},
            {"key": EXPERIMENTS_VOID,     "label": "Void Experiments",    "description": "Permanently void an experiment"},
        ],
    },
    {
        "module": "ATR (Analytical Test Requests)",
        "privileges": [
            {"key": ATR_ASSIGN,  "label": "Assign ATR",             "description": "Assign ATR requests to analysts"},
            {"key": ATR_UNLOCK,  "label": "Manage Unlock Requests", "description": "Approve or reject experiment unlock requests"},
        ],
    },
]

ALL_PRIVILEGE_KEYS: frozenset[str] = frozenset({
    ADMIN_SETTINGS, ADMIN_TEMPLATES, ADMIN_NOTIFICATIONS, ADMIN_ROLE_PRIVS,
    USERS_MANAGE, DEPARTMENTS_MANAGE, MASTER_DATA_MANAGE,
    PROJECTS_CREATE, PROJECTS_EDIT, PROJECTS_ROUTES,
    NOTEBOOKS_CREATE, NOTEBOOKS_EDIT, NOTEBOOKS_PERMISSIONS,
    EXPERIMENTS_VERIFY, EXPERIMENTS_APPROVE, EXPERIMENTS_UNLOCK, EXPERIMENTS_VOID,
    ATR_ASSIGN, ATR_UNLOCK,
})

# Default grants — used as fallback when no DB row exists for a role+key pair.
DEFAULT_GRANTS: dict[str, frozenset[str]] = {
    # Admin — QA only
    ADMIN_SETTINGS:       frozenset({"QA"}),
    ADMIN_TEMPLATES:      frozenset({"QA"}),
    ADMIN_NOTIFICATIONS:  frozenset({"QA"}),
    ADMIN_ROLE_PRIVS:     frozenset({"QA"}),
    # Users & Org
    USERS_MANAGE:         frozenset({"QA"}),
    DEPARTMENTS_MANAGE:   frozenset({"QA"}),
    MASTER_DATA_MANAGE:   frozenset({"QA", "HOD"}),
    # Projects
    PROJECTS_CREATE:      frozenset({"QA", "HOD", "TL"}),
    PROJECTS_EDIT:        frozenset({"QA", "HOD", "TL"}),
    PROJECTS_ROUTES:      frozenset({"QA", "HOD", "TL"}),
    # Notebooks
    NOTEBOOKS_CREATE:      frozenset({"QA", "HOD", "TL"}),
    NOTEBOOKS_EDIT:        frozenset({"QA", "HOD", "TL"}),
    NOTEBOOKS_PERMISSIONS: frozenset({"QA", "HOD", "TL"}),
    # Experiments
    EXPERIMENTS_VERIFY:   frozenset({"QA", "HOD", "TL"}),
    EXPERIMENTS_APPROVE:  frozenset({"QA", "HOD"}),
    EXPERIMENTS_UNLOCK:   frozenset({"QA"}),
    EXPERIMENTS_VOID:     frozenset({"QA"}),
    # ATR
    ATR_ASSIGN:           frozenset({"QA", "TL"}),
    ATR_UNLOCK:           frozenset({"QA"}),
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
