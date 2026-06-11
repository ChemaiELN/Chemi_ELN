from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import NotificationSetting
from app.models.user import User
from app.schemas.notification_setting import (
    NotificationSettingCreate,
    NotificationSettingResponse,
    NotificationSettingUpdate,
)
from app.utils.deps import get_current_user, require_roles

router = APIRouter()


def _get_or_404(db: Session, setting_id: str) -> NotificationSetting:
    s = db.get(NotificationSetting, setting_id)
    if not s:
        raise HTTPException(404, "Notification setting not found")
    return s


@router.post("/", status_code=201, response_model=NotificationSettingResponse)
def create_notification_setting(
    body: NotificationSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    existing = db.query(NotificationSetting).filter(NotificationSetting.key == body.key).first()
    if existing:
        raise HTTPException(400, f"Notification setting with key '{body.key}' already exists")
    s = NotificationSetting(
        key=body.key,
        label=body.label,
        module=body.module,
        is_enabled=body.is_enabled,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/", response_model=List[NotificationSettingResponse])
def list_notification_settings(
    module: Optional[str] = Query(None),
    is_enabled: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(NotificationSetting)
    if module:
        q = q.filter(NotificationSetting.module == module)
    if is_enabled is not None:
        q = q.filter(NotificationSetting.is_enabled == is_enabled)
    return q.order_by(NotificationSetting.module, NotificationSetting.key).all()


@router.get("/{setting_id}", response_model=NotificationSettingResponse)
def get_notification_setting(
    setting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(db, setting_id)


@router.patch("/{setting_id}", response_model=NotificationSettingResponse)
def update_notification_setting(
    setting_id: str,
    body: NotificationSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    s = _get_or_404(db, setting_id)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return s


@router.post("/{setting_id}/toggle", response_model=NotificationSettingResponse)
def toggle_notification_setting(
    setting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    """Flip is_enabled."""
    s = _get_or_404(db, setting_id)
    s.is_enabled = not s.is_enabled
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{setting_id}", status_code=204)
def delete_notification_setting(
    setting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    s = _get_or_404(db, setting_id)
    db.delete(s)
    db.commit()
