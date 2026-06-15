"""
PDF Export router — updated for new template-based Experiment model.

Provides:
  GET /api/experiments/{exp_id}/export-pdf
      Returns a plain-text (or future PDF) representation of the experiment.
"""
import textwrap
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.experiment import Experiment
from app.models.user import User
from app.utils.deps import get_current_user

router = APIRouter()


def _fmt(val, default="—") -> str:
    if val is None:
        return default
    if isinstance(val, datetime):
        return val.strftime("%d %b %Y %H:%M")
    return str(val)


def _strip_html(html: Optional[str]) -> str:
    if not html:
        return ""
    import re
    return re.sub(r"<[^>]+>", "", html).strip()


def _render_text(exp: Experiment) -> str:
    lines: list = []

    def _section(title: str):
        lines.append("")
        lines.append("=" * 72)
        lines.append(f"  {title}")
        lines.append("=" * 72)

    def _kv(key: str, value):
        lines.append(f"  {key:<30} {_fmt(value)}")

    lines.append("=" * 72)
    lines.append("  EXPERIMENT REPORT")
    lines.append(f"  Generated: {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}")
    lines.append("=" * 72)

    _section("EXPERIMENT DETAILS")
    _kv("Code",        exp.full_code)
    _kv("Base Code",   exp.base_code)
    _kv("Version",     exp.version)
    _kv("Title",       exp.title)
    _kv("Status",      exp.status)
    _kv("Screen",      exp.screen_key)
    _kv("Section",     exp.section_key)
    _kv("Created at",  exp.created_at)
    _kv("Updated at",  exp.updated_at)

    if exp.notebook:
        _kv("Notebook",  getattr(exp.notebook, "title", None) or getattr(exp.notebook, "code", "—"))
    if exp.project:
        _kv("Project",   getattr(exp.project, "name", None) or getattr(exp.project, "code", "—"))
    if exp.creator:
        _kv("Created by", exp.creator.display_name)

    # ── JSONB data fields ─────────────────────────────────────────────────────
    if exp.data:
        _section("EXPERIMENT DATA")
        for key, value in exp.data.items():
            if isinstance(value, dict):
                lines.append(f"  {key}:")
                for k2, v2 in value.items():
                    lines.append(f"    {k2:<28} {_fmt(v2)}")
            elif isinstance(value, list):
                lines.append(f"  {key}: [{len(value)} items]")
            else:
                _kv(key, value)

    if exp.observations:
        _section("OBSERVATIONS")
        for ln in textwrap.wrap(_strip_html(exp.observations), 70):
            lines.append(f"  {ln}")

    if exp.conclusion:
        _section("CONCLUSION / RESULTS")
        for ln in textwrap.wrap(_strip_html(exp.conclusion), 70):
            lines.append(f"  {ln}")

    if exp.disposition:
        _section("DISPOSITION")
        lines.append(f"  {exp.disposition}")

    # ── Linked preliminary ────────────────────────────────────────────────────
    if exp.linked_preliminary:
        _section("LINKED PRELIMINARY")
        _kv("Code",   exp.linked_preliminary.full_code)
        _kv("Title",  exp.linked_preliminary.title)
        _kv("Status", exp.linked_preliminary.status)

    # ── Revision history ──────────────────────────────────────────────────────
    if exp.revision_note:
        _section("REVISION NOTE")
        lines.append(f"  {exp.revision_note}")

    # ── Signatures ────────────────────────────────────────────────────────────
    _section("SIGNATURES / WORKFLOW")
    if exp.scientist_signed_by:
        _kv("Scientist signed at", exp.scientist_signed_at)
        if exp.scientist_sign_reason:
            _kv("Reason", exp.scientist_sign_reason)
    for rev in getattr(exp, "reviews", []):
        if rev.signed_at:
            _kv(f"Reviewer {rev.reviewer_id[:8]} signed at", rev.signed_at)
            _kv("Decision", rev.decision)
            if rev.sign_reason:
                _kv("Reason", rev.sign_reason)
    if exp.submitted_at:
        _kv("Submitted at", exp.submitted_at)
    if exp.approved_at:
        _kv("Approved at", exp.approved_at)
    if exp.rejected_at:
        _kv("Rejected at",  exp.rejected_at)
        if exp.rejection_reason:
            _kv("Reason",   exp.rejection_reason)

    # ── Files ─────────────────────────────────────────────────────────────────
    if exp.files:
        _section("ATTACHED FILES")
        for f in exp.files:
            lines.append(f"  {f.filename}  ({_fmt(f.file_type)}  {_fmt(f.file_size)} bytes)")

    lines.append("")
    lines.append("=" * 72)
    lines.append("  END OF REPORT")
    lines.append("=" * 72)
    lines.append("")

    return "\n".join(lines)


@router.get(
    "/{exp_id}/export-pdf",
    summary="Export experiment as a downloadable report",
    response_class=Response,
)
def export_experiment_pdf(
    exp_id: str,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(get_current_user),
):
    exp = (
        db.query(Experiment)
        .options(
            selectinload(Experiment.notebook),
            selectinload(Experiment.project),
            selectinload(Experiment.creator),
            selectinload(Experiment.linked_preliminary),
            selectinload(Experiment.files),
            selectinload(Experiment.reviews),
        )
        .filter(Experiment.id == exp_id)
        .first()
    )
    if not exp:
        raise HTTPException(404, "Experiment not found")

    text_body = _render_text(exp)

    content_type = "text/plain; charset=utf-8"
    suffix = "txt"

    try:
        from weasyprint import HTML
        html_content = (
            "<html><head><meta charset='UTF-8'/>"
            "<style>body{font-family:monospace;font-size:12px;white-space:pre}</style></head>"
            f"<body>{text_body}</body></html>"
        )
        body_bytes   = HTML(string=html_content).write_pdf()
        content_type = "application/pdf"
        suffix       = "pdf"
    except ImportError:
        body_bytes = text_body.encode("utf-8")

    filename = f"{exp.full_code.replace('/', '_')}_report.{suffix}"
    return Response(
        content=body_bytes,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length":      str(len(body_bytes)),
        },
    )
