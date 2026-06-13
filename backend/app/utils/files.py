"""
File upload utilities — validation, storage, and cleanup.

Storage layout on disk:
  {UPLOAD_DIR}/experiments/{exp_id}/{uuid_hex}_{safe_filename}
  {UPLOAD_DIR}/atr/{atr_id}/{uuid_hex}_{safe_filename}

Design notes:
  - UUID prefix prevents filename collisions and hides originals from direct guessing.
  - Absolute paths are stored in the DB so serving requires no reconstruction.
  - Files are streamed in 1 MB chunks to keep memory usage flat for large uploads.
  - Path-traversal is prevented because stored paths come from this module only,
    never from user input directly.
"""
import os
import re
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED_EXTENSIONS: set[str] = {
    ".pdf", ".xlsx", ".xls", ".csv", ".txt",
    ".png", ".jpg", ".jpeg", ".gif", ".tiff",
    ".docx", ".doc", ".pptx", ".ppt",
}

# application/octet-stream is a catch-all; extension check is the real gate.
_ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/vnd.openxmlformats",
    "application/vnd.ms-",
    "application/msword",
    "text/",
    "image/",
    "application/octet-stream",
)


def sanitize_filename(name: str) -> str:
    """Return a filesystem-safe filename (no path components, no special chars)."""
    name = os.path.basename(name or "upload")
    name = re.sub(r"[^\w.\- ]", "_", name)
    name = re.sub(r"[\s_]+", "_", name).strip("_.")
    return (name[:200] or "upload")


def _check_mime(content_type: str | None) -> None:
    if not content_type:
        return
    ct = content_type.split(";")[0].strip().lower()
    if not any(ct.startswith(p) for p in _ALLOWED_MIME_PREFIXES):
        raise HTTPException(400, f"MIME type '{ct}' is not permitted")


def validate_upload(file: UploadFile) -> str:
    """
    Validate extension and MIME type.
    Returns the lowercase extension (e.g. '.pdf').
    Raises HTTP 400 on failure.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Extension '{ext or 'none'}' is not allowed. "
            f"Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    _check_mime(file.content_type)
    return ext


async def save_upload(file: UploadFile, subdir: Path) -> Tuple[str, int]:
    """
    Stream *file* to disk inside *subdir*.

    Returns:
        (absolute_file_path, file_size_in_bytes)

    Raises:
        HTTP 400 if the file exceeds settings.MAX_UPLOAD_BYTES.
        HTTP 500 on unexpected I/O errors.
    """
    subdir.mkdir(parents=True, exist_ok=True)
    safe_name = sanitize_filename(file.filename or "upload")
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    dest = subdir / stored_name

    size = 0
    try:
        with open(dest, "wb") as fh:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.MAX_UPLOAD_BYTES:
                    fh.close()
                    dest.unlink(missing_ok=True)
                    mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
                    raise HTTPException(400, f"File exceeds the {mb} MB size limit")
                fh.write(chunk)
    except HTTPException:
        raise
    except OSError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Failed to write file: {exc}") from exc

    return str(dest.resolve()), size


def delete_file(file_path: str) -> None:
    """Remove a file from disk. Silently ignores missing files."""
    try:
        Path(file_path).unlink(missing_ok=True)
    except OSError:
        pass


def upload_dir() -> Path:
    """Resolve the configured UPLOAD_DIR to an absolute Path."""
    p = Path(settings.UPLOAD_DIR)
    return p if p.is_absolute() else Path.cwd() / p
