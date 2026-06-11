from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import (
    verify_password, hash_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.config import settings
from app.database import get_db
from app.models.user import User, RefreshToken, PasswordResetToken
from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    MeResponse, ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest,
)
from app.utils.deps import get_current_user

import hashlib, secrets

router = APIRouter()


def _utcnow() -> datetime:
    """Always return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def _refresh_expiry() -> datetime:
    return _utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


def _hash(token: str) -> str:
    """Store only the SHA-256 hash — never the raw token."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── POST /login ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user: Optional[User] = db.query(User).filter(
        or_(User.username == body.username,
            User.emp_no   == body.username,
            User.email    == body.username)
    ).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account is inactive. Contact your QA administrator.")

    access_token  = create_access_token(sub=user.id)
    refresh_token = create_refresh_token(sub=user.id)

    db.add(RefreshToken(
        user_id    = user.id,
        token_hash = _hash(refresh_token),
        expires_at = _refresh_expiry(),
    ))
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ── POST /refresh ─────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_hash = _hash(body.refresh_token)
    stored: Optional[RefreshToken] = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked_at.is_(None),
    ).first()

    if not stored or stored.expires_at < _utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired or revoked")

    user: Optional[User] = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate — revoke old, issue new
    stored.revoked_at = _utcnow()

    new_access  = create_access_token(sub=user.id)
    new_refresh = create_refresh_token(sub=user.id)

    db.add(RefreshToken(
        user_id    = user.id,
        token_hash = _hash(new_refresh),
        expires_at = _refresh_expiry(),
    ))
    db.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


# ── POST /logout ──────────────────────────────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    stored = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash(body.refresh_token)
    ).first()
    if stored:
        stored.revoked_at = _utcnow()
        db.commit()


# ── GET /me ───────────────────────────────────────────────────────────────────
@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        id              = current_user.id,
        emp_no          = current_user.emp_no,
        username        = current_user.username,
        title           = current_user.title,
        first_name      = current_user.first_name,
        last_name       = current_user.last_name,
        display_name    = current_user.display_name,
        email           = current_user.email,
        designation     = current_user.designation,
        department_id   = current_user.department_id,
        department_name = current_user.department.name if current_user.department else None,
        role            = current_user.role.code,
        is_active       = current_user.is_active,
    )


# ── POST /forgot-password ─────────────────────────────────────────────────────
@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        return  # Never reveal whether email exists

    raw_token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        user_id    = user.id,
        token_hash = _hash(raw_token),
        expires_at = _utcnow() + timedelta(hours=2),
    ))
    db.commit()
    # TODO: send_reset_email(user.email, raw_token)


# ── POST /reset-password ──────────────────────────────────────────────────────
@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    stored: Optional[PasswordResetToken] = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == _hash(body.token),
        PasswordResetToken.used_at.is_(None),
    ).first()

    if not stored or stored.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    user = db.get(User, stored.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.password_hash = hash_password(body.new_password)
    stored.used_at = _utcnow()
    db.commit()


# ── POST /change-password ─────────────────────────────────────────────────────
@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
