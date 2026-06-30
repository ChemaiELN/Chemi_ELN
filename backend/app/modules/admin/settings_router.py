from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.settings import GlobalSettings
from app.schemas.a3 import SettingsOut, SettingsUpdate
from app.shared.privileges import require_privilege
from app.models.admin import User

router = APIRouter()


def _get_or_create(db: Session) -> GlobalSettings:
    s = db.query(GlobalSettings).filter_by(id=1).first()
    if not s:
        s = GlobalSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = require_privilege("admin.settings"),
):
    return _get_or_create(db)


@router.patch("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("admin.settings"),
):
    s = _get_or_create(db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s
