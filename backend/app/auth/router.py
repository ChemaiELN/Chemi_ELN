from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.schemas import LoginRequest, RefreshRequest, TokenResponse
from app.auth.utils import verify_password, create_access_token, create_refresh_token, decode_token
from app.models.admin import User
from app.models.settings import GlobalSettings

router = APIRouter()


def _get_settings(db: Session) -> GlobalSettings:
    row = db.query(GlobalSettings).filter_by(id=1).first()
    return row if row else GlobalSettings()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.username))
        .first()
    )
    cfg = _get_settings(db)

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account locked. Try again later.")

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_count += 1
        if cfg.lock_user_after_x_attempts and user.failed_login_count >= cfg.lock_user_after_x_attempts:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
            user.failed_login_count = 0
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    user.failed_login_count = 0
    user.locked_until = None
    db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")
    user = db.query(User).filter_by(id=data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWT — tokens expire naturally; client discards them
    return None


@router.post("/verify-password")
def verify_current_password(
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    """Re-authenticate the already-logged-in caller for an electronic signature
    (Done By / Reviewed By) — checks their password without issuing new tokens."""
    password = payload.get("password")
    if not password or not verify_password(password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")
    return {
        "verified":   True,
        "user_id":    str(current_user.id),
        "username":   current_user.username,
        "role_code":  current_user.role.code,
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "emp_no": current_user.emp_no,
        "email": current_user.email,
        "role_id": str(current_user.role_id),
        "role_code": current_user.role.code,
        "role_name": current_user.role.name,
        "department_id": str(current_user.department_id) if current_user.department_id else None,
        "department_code": current_user.department.code if current_user.department else None,
        "department_name": current_user.department.name if current_user.department else None,
        "is_active": current_user.is_active,
        "must_reset_password": current_user.must_reset_password,
        "site": current_user.site,
        "dashboard_reference": current_user.dashboard_reference,
    }
