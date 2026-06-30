"""Shared file upload / delete helpers used by inventory and admin routers."""
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings

_UPLOAD_ROOT = Path(settings.UPLOAD_DIR)

ALLOWED_DOC_EXTS  = {".pdf", ".doc", ".docx", ".xlsx", ".xls"}
ALLOWED_IMG_EXTS  = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
ALLOWED_ALL_EXTS  = ALLOWED_DOC_EXTS | ALLOWED_IMG_EXTS


def validate_upload(
    file: UploadFile,
    allowed_exts: set[str] = ALLOWED_ALL_EXTS,
    max_bytes: int | None = None,
) -> None:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            400,
            f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(allowed_exts))}",
        )
    if max_bytes is None:
        max_bytes = settings.MAX_UPLOAD_BYTES
    if file.size and file.size > max_bytes:
        raise HTTPException(413, f"File exceeds maximum size of {max_bytes // 1024 // 1024} MB.")


async def save_upload(file: UploadFile, subdir: str) -> str:
    """Save an uploaded file and return its absolute path string."""
    dest_dir = _UPLOAD_ROOT / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "file").suffix.lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / filename

    content = await file.read()
    dest.write_bytes(content)
    return str(dest)


def delete_file(path: str | None) -> None:
    """Delete a file from disk if it exists. Silent on missing."""
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass
