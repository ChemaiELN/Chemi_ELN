"""
Audit logging helper.

Every significant action (status changes, user management, settings,
approvals, rejections) should be recorded via log_action().

The audit_log table is append-only — rows are never updated or deleted.
"""
from typing import Any, Dict, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.base import new_uuid


def log_action(
    db:           Session,
    *,
    user_id:      Optional[str],
    username:     str,
    module:       str,
    action:       str,
    target_type:  Optional[str] = None,
    target_id:    Optional[str] = None,
    target_label: Optional[str] = None,
    detail:       Optional[str] = None,
    ip_address:   Optional[str] = None,
) -> AuditLog:
    """
    Write one audit row.  Does NOT commit — caller owns the transaction.

    Args:
        db:           Active SQLAlchemy session.
        user_id:      ID of the acting user (None for system actions).
        username:     Snapshot of the username (survives user deletion).
        module:       High-level module name — "Experiments", "Users", "Admin"…
        action:       Event verb — "SUBMITTED", "APPROVED", "CREATED", "UPDATED"…
        target_type:  Entity type — "experiment", "user", "notebook"…
        target_id:    PK of the affected record.
        target_label: Human-readable identifier — "OQ/R1/S1/E03166/001".
        detail:       Free-text description of what changed.
        ip_address:   Client IP from the request.

    Returns:
        The AuditLog ORM instance (already added to session, not committed).
    """
    entry = AuditLog(
        id           = new_uuid(),
        user_id      = user_id,
        username     = username,
        module       = module,
        action       = action,
        target_type  = target_type,
        target_id    = target_id,
        target_label = target_label,
        detail       = detail,
        ip_address   = ip_address,
    )
    db.add(entry)
    return entry


def get_ip(request: Request) -> Optional[str]:
    """
    Extract the real client IP from the request.
    Checks X-Forwarded-For first (for reverse-proxy setups), then falls back
    to the direct connection IP.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can be a comma-separated list; first entry is the client
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
