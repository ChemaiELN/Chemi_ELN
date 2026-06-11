"""Purge stale audit/history rows and orphan upload files."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.atr import ATRAttachment, ATRFinalReport
from app.models.audit import AuditLog
from app.models.experiment import (
    Experiment,
    ExperimentAttachment,
    ExperimentHistory,
    ExperimentStep,
    ExperimentTLC,
)
from app.models.project import MilestoneAttachment, ProjectAttachment
from app.models.route import Route, Stage
from app.models.settings import CompanySettings, ExcelTemplate
from app.utils.files import delete_file, upload_dir


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _add_path(paths: set[str], value: str | None, *, root: Path) -> None:
    if not value:
        return
    try:
        resolved = Path(value).resolve()
    except OSError:
        return
    if resolved.is_relative_to(root):
        paths.add(str(resolved))


def referenced_upload_paths(db: Session) -> set[str]:
    """Collect absolute paths under UPLOAD_DIR that are referenced in the DB."""
    root = upload_dir().resolve()
    paths: set[str] = set()

    for row in db.query(ExperimentAttachment.file_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(ExperimentStep.attachment_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(Experiment.scheme_image_path, Experiment.tlc_drawing_path):
        _add_path(paths, row[0], root=root)
        _add_path(paths, row[1], root=root)
    for row in db.query(ExperimentTLC.image_path, ExperimentTLC.drawing_path):
        _add_path(paths, row[0], root=root)
        _add_path(paths, row[1], root=root)
    for row in db.query(ATRAttachment.file_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(ATRFinalReport.file_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(ProjectAttachment.file_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(MilestoneAttachment.file_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(Route.scheme_image_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(Stage.scheme_image_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(ExcelTemplate.file_path):
        _add_path(paths, row[0], root=root)
    for row in db.query(CompanySettings.logo_path):
        _add_path(paths, row[0], root=root)

    return paths


def purge_stale_audit_log(db: Session, *, retention_days: int = 365) -> dict:
    if retention_days < 1:
        raise ValueError("retention_days must be at least 1")
    cutoff = _utcnow() - timedelta(days=retention_days)
    deleted = (
        db.query(AuditLog)
        .filter(AuditLog.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    return {
        "audit_log_deleted": deleted,
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
    }


def purge_stale_experiment_history(db: Session, *, retention_days: int = 730) -> dict:
    if retention_days < 1:
        raise ValueError("retention_days must be at least 1")
    cutoff = _utcnow() - timedelta(days=retention_days)
    deleted = (
        db.query(ExperimentHistory)
        .filter(ExperimentHistory.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    return {
        "experiment_history_deleted": deleted,
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
    }


def purge_orphan_uploads(
    db: Session,
    *,
    min_age_hours: int = 24,
    dry_run: bool = True,
) -> dict:
    """
    Remove files under UPLOAD_DIR that are not referenced by any DB column.

    Only considers regular files older than min_age_hours to avoid racing
    in-flight uploads.
    """
    if min_age_hours < 0:
        raise ValueError("min_age_hours must be non-negative")

    root = upload_dir().resolve()
    if not root.exists():
        return {
            "orphan_files_found": 0,
            "orphan_files_deleted": 0,
            "orphan_bytes": 0,
            "dry_run": dry_run,
            "min_age_hours": min_age_hours,
        }

    referenced = referenced_upload_paths(db)
    cutoff_ts = _utcnow().timestamp() - (min_age_hours * 3600)
    found: list[str] = []
    total_bytes = 0

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        resolved = str(path.resolve())
        if resolved in referenced:
            continue
        if path.stat().st_mtime > cutoff_ts:
            continue
        found.append(resolved)
        total_bytes += path.stat().st_size

    deleted = 0
    if not dry_run:
        for path in found:
            delete_file(path)
            deleted += 1

    return {
        "orphan_files_found": len(found),
        "orphan_files_deleted": deleted,
        "orphan_bytes": total_bytes,
        "dry_run": dry_run,
        "min_age_hours": min_age_hours,
        "sample_paths": found[:10],
    }
