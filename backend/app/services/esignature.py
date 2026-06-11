"""
E-Signature verification service (FIX-06, FIX-47).

The original system requires password re-entry (e-signature) before significant
workflow actions (Save, Submit, Verify, Approve). The CRD settings control
which actions trigger this check via reauth_* flags.

Usage:
    from app.services.esignature import verify_esignature, ESignatureRequired
    verify_esignature(db, current_user, body.password, require=settings.reauth_submit)
"""
from typing import Optional

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models.settings import CRDSettings
from app.models.user import User

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


class ESignatureRequired(HTTPException):
    def __init__(self, action: str = "this action"):
        super().__init__(
            status_code=403,
            detail=f"E-Signature required for {action}. Please provide your password.",
        )


def verify_esignature(
    db: Session,
    user: User,
    password: Optional[str],
    *,
    require: bool = True,
    action: str = "this action",
) -> None:
    """
    Verify e-signature password if required.

    Args:
        db:       Database session (not used directly; reserved for future LDAP support).
        user:     Currently logged-in user (holds password_hash).
        password: The password provided in the request body. May be None.
        require:  If False, skip verification entirely (controlled by reauth_* setting).
        action:   Human-readable action name for error messages.

    Raises:
        ESignatureRequired: If `require` is True but no password was provided.
        HTTPException(403): If the password does not match.
    """
    if not require:
        return

    if not password:
        raise ESignatureRequired(action)

    if not _pwd_ctx.verify(password, user.password_hash):
        raise HTTPException(status_code=403, detail="E-Signature verification failed: incorrect password.")


def get_crd_settings(db: Session) -> CRDSettings:
    """Return the singleton CRD settings row (creates default if missing)."""
    settings = db.get(CRDSettings, 1)
    if not settings:
        settings = CRDSettings(id=1)
        db.add(settings)
        db.flush()
    return settings
