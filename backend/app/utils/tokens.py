"""Refresh-token helpers shared across auth and user management routers."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user import RefreshToken


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def revoke_all_refresh_tokens(db: Session, user_id: str) -> None:
    """Revoke every active refresh session for a user."""
    now = _utcnow()
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
