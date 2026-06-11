"""Read helpers for singleton settings rows."""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.settings import CRDSettings, GlobalSettings, SMTPConfig

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".tiff"}


def get_global_settings_row(db: Session) -> GlobalSettings:
    row = db.get(GlobalSettings, 1)
    if not row:
        row = GlobalSettings(id=1)
        db.add(row)
        db.flush()
    return row


def get_crd_settings_row(db: Session) -> CRDSettings:
    row = db.get(CRDSettings, 1)
    if not row:
        row = CRDSettings(id=1)
        db.add(row)
        db.flush()
    return row


def get_smtp_settings_row(db: Session) -> SMTPConfig:
    row = db.get(SMTPConfig, 1)
    if not row:
        row = SMTPConfig(id=1)
        db.add(row)
        db.flush()
    return row


def resolve_upload_limit_bytes(
    db: Optional[Session],
    *,
    filename: Optional[str] = None,
    is_image: Optional[bool] = None,
) -> int:
    """
    Effective upload cap: GlobalSettings KB limits capped by env MAX_UPLOAD_BYTES.
    Falls back to env-only when db is unavailable.
    """
    env_cap = settings.MAX_UPLOAD_BYTES
    if db is None:
        return env_cap

    gs = get_global_settings_row(db)
    if is_image is None and filename:
        from pathlib import Path
        is_image = Path(filename).suffix.lower() in IMAGE_EXTENSIONS

    kb = gs.image_file_size_kb if is_image else gs.attachment_size_kb
    return min(max(kb, 1) * 1024, env_cap)


def experiment_search_limit(db: Session) -> int:
    gs = get_global_settings_row(db)
    return max(1, min(gs.experiment_search_result_limit, 500))
