"""Purge expired and stale auth token rows."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.user import PasswordResetToken, RefreshToken


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def purge_stale_tokens(db: Session, *, retention_days: int = 30) -> dict:
    """
    Delete refresh and password-reset rows that are no longer needed.

    Refresh tokens: expired or revoked longer than retention_days ago.
    Reset tokens: used or expired longer than retention_days ago.
    """
    if retention_days < 1:
        raise ValueError("retention_days must be at least 1")

    cutoff = _utcnow() - timedelta(days=retention_days)

    refresh_deleted = (
        db.query(RefreshToken)
        .filter(
            (RefreshToken.expires_at < cutoff)
            | (
                RefreshToken.revoked_at.isnot(None)
                & (RefreshToken.revoked_at < cutoff)
            )
        )
        .delete(synchronize_session=False)
    )

    reset_deleted = (
        db.query(PasswordResetToken)
        .filter(
            (PasswordResetToken.expires_at < cutoff)
            | (
                PasswordResetToken.used_at.isnot(None)
                & (PasswordResetToken.used_at < cutoff)
            )
        )
        .delete(synchronize_session=False)
    )

    return {
        "refresh_tokens_deleted": refresh_deleted,
        "password_reset_tokens_deleted": reset_deleted,
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
    }
