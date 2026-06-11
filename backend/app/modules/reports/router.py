"""
PDF Export router — FIX-36.

Provides:
  GET /api/experiments/{exp_id}/export-pdf
      Returns a plain-text (or future HTML) representation of the experiment
      as a downloadable file.  WeasyPrint / xhtml2pdf are not mandatory —
      the endpoint works with stdlib only, and can be swapped for a real PDF
      library later by replacing _render_pdf().

Query params:
  include_steps       bool  default True
  include_inputs      bool  default True
  include_parameters  bool  default True
  include_equipment   bool  default True
  include_tlc         bool  default True
  include_comments    bool  default False
"""
import textwrap
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.experiment import Experiment, ExperimentComment
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
    """Very lightweight HTML tag remover — no external deps required."""
    if not html:
        return ""
    import re
    return re.sub(r"<[^>]+>", "", html).strip()


def _render_text(
    exp: Experiment,
    comments: List[ExperimentComment],
    *,
    include_steps: bool,
    include_inputs: bool,
    include_parameters: bool,
    include_equipment: bool,
    include_tlc: bool,
    include_comments: bool,
) -> str:
    lines: list[str] = []

    def _section(title: str):
        lines.append("")
        lines.append("=" * 72)
        lines.append(f"  {title}")
        lines.append("=" * 72)

    def _kv(key: str, value):
        lines.append(f"  {key:<30} {_fmt(value)}")

    # ── Header ───────────────────────────────────────────────────────────────
    lines.append("=" * 72)
    lines.append("  EXPERIMENT REPORT")
    lines.append(f"  Generated: {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}")
    lines.append("=" * 72)

    _section("EXPERIMENT DETAILS")
    _kv("Code",       exp.full_code)
    _kv("Title",      exp.title)
    _kv("Status",     exp.status)
    _kv("Version",    exp.version)
    _kv("Created at", exp.created_at)
    _kv("Updated at", exp.updated_at)

    if exp.notebook:
        _kv("Notebook",   exp.notebook.code)
    if exp.project:
        _kv("Project",    exp.project.code)
    if exp.route:
        _kv("Route",      getattr(exp.route, "code", exp.route_id))
    elif exp.route_id:
        _kv("Route ID",   exp.route_id)
    if exp.stage:
        _kv("Stage",      getattr(exp.stage, "code", exp.stage_id))
    elif exp.stage_id:
        _kv("Stage ID",   exp.stage_id)
    if exp.creator:
        _kv("Created by", exp.creator.display_name)

    # ── Scientific content ────────────────────────────────────────────────────
    for label, attr in [
        ("AIM",         "aim"),
        ("OBJECTIVE",   "objective"),
        ("PRECAUTIONS", "precautions"),
    ]:
        val = _strip_html(getattr(exp, attr, None))
        if val:
            _section(label)
            for ln in textwrap.wrap(val, 70):
                lines.append(f"  {ln}")

    # ── Steps ─────────────────────────────────────────────────────────────────
    if include_steps and exp.steps:
        _section("PROCEDURE STEPS")
        for step in sorted(exp.steps, key=lambda s: s.step_no):
            lines.append(f"\n  Step {step.step_no}")
            if step.procedure_text:
                lines.append(f"    Procedure  : {_strip_html(step.procedure_text)}")
            if step.observation_text:
                lines.append(f"    Observation: {_strip_html(step.observation_text)}")
            if step.qty:
                lines.append(f"    Qty        : {step.qty}")
            if step.temperature:
                lines.append(f"    Temperature: {step.temperature}")

    # ── Inputs ────────────────────────────────────────────────────────────────
    if include_inputs and exp.inputs:
        _section("INPUTS / REAGENTS")
        header = f"  {'#':<4} {'Name':<30} {'CAS':<14} {'MW':<10} {'Qty':<12} {'Unit':<8}"
        lines.append(header)
        lines.append("  " + "-" * 68)
        for i, inp in enumerate(exp.inputs, 1):
            lines.append(
                f"  {i:<4} {_fmt(inp.material_name):<30} {_fmt(inp.cas_no):<14}"
                f" {_fmt(inp.mol_weight):<10} {_fmt(inp.quantity):<12} {_fmt(inp.unit):<8}"
            )

    # ── Parameters ────────────────────────────────────────────────────────────
    if include_parameters and exp.parameters:
        _section("PARAMETERS")
        header = f"  {'Code':<8} {'Name':<30} {'I/O':<8} {'Value':<15} {'UOM':<10}"
        lines.append(header)
        lines.append("  " + "-" * 71)
        for p in exp.parameters:
            # parameter_name is a v2 alias; fall back to name for compatibility
            pname = _fmt(getattr(p, "parameter_name", None) or getattr(p, "name", None))
            lines.append(
                f"  {_fmt(p.code):<8} {pname:<30}"
                f" {_fmt(p.input_output):<8} {_fmt(p.parameter_value):<15} {_fmt(p.uom):<10}"
            )

    # ── Equipment ─────────────────────────────────────────────────────────────
    if include_equipment and exp.equipment:
        _section("EQUIPMENT USED")
        for eq in exp.equipment:
            lines.append(
                f"  {_fmt(eq.instrument_code)}  {_fmt(eq.instrument_name)}"
                f"  Calib: {_fmt(eq.calibration_status)}"
                f"  Maint: {_fmt(eq.maintenance_status)}"
            )

    # ── TLC ───────────────────────────────────────────────────────────────────
    if include_tlc and exp.tlc_records:
        _section("TLC DATA")
        for tlc in exp.tlc_records:
            rf_sm  = _fmt(getattr(tlc, "rf_starting_material", None))
            rf_prd = _fmt(getattr(tlc, "rf_product", None))
            solv   = _fmt(getattr(tlc, "solvent_system", None))
            notes  = _fmt(getattr(tlc, "notes", None))
            lines.append(
                f"  Rf(SM)={rf_sm}  Rf(Prod)={rf_prd}"
                f"  Solvent={solv}  Notes={notes}"
            )

    # ── Conclusion ────────────────────────────────────────────────────────────
    conc = _strip_html(getattr(exp, "conclusion", None))
    if conc:
        _section("CONCLUSION / RESULTS")
        for ln in textwrap.wrap(conc, 70):
            lines.append(f"  {ln}")

    # ── Yield ─────────────────────────────────────────────────────────────────
    if any(getattr(exp, f, None) is not None for f in ("theoretical_yield", "actual_yield", "yield_pct")):
        _section("YIELD")
        _kv("Theoretical yield", exp.theoretical_yield)
        _kv("Actual yield",      exp.actual_yield)
        _kv("Yield %",           exp.yield_pct)

    # ── Comments ──────────────────────────────────────────────────────────────
    if include_comments and comments:
        _section("COMMENTS")
        for c in comments:
            if c.is_deleted:
                continue
            author = _fmt(c.creator.display_name if c.creator else None)
            lines.append(f"  [{_fmt(c.created_at)}] {author}: {_strip_html(c.comment)}")

    # ── Signatures ────────────────────────────────────────────────────────────
    _section("SIGNATURES")
    if exp.creator:
        _kv("Prepared by",  exp.creator.display_name)
    if exp.submitted_at:
        _kv("Submitted at", exp.submitted_at)
        if exp.submitter:
            _kv("Submitted to", exp.submitter.display_name)
    if exp.verified_at:
        _kv("Verified at",  exp.verified_at)
    if exp.approved_at:
        _kv("Approved at",  exp.approved_at)

    lines.append("")
    lines.append("=" * 72)
    lines.append("  END OF REPORT")
    lines.append("=" * 72)
    lines.append("")

    return "\n".join(lines)


@router.get(
    "/{exp_id}/export-pdf",
    summary="Export experiment as a downloadable report (FIX-36)",
    response_class=Response,
)
def export_experiment_pdf(
    exp_id:             str,
    include_steps:      bool    = Query(True),
    include_inputs:     bool    = Query(True),
    include_parameters: bool    = Query(True),
    include_equipment:  bool    = Query(True),
    include_tlc:        bool    = Query(True),
    include_comments:   bool    = Query(False),
    db:                 Session = Depends(get_db),
    actor:              User    = Depends(get_current_user),
):
    exp = (
        db.query(Experiment)
        .options(
            selectinload(Experiment.notebook),
            selectinload(Experiment.project),
            selectinload(Experiment.route),
            selectinload(Experiment.stage),
            selectinload(Experiment.creator),
            selectinload(Experiment.submitter),
            selectinload(Experiment.reviewer),
            selectinload(Experiment.inputs),
            selectinload(Experiment.parameters),
            selectinload(Experiment.steps),
            selectinload(Experiment.equipment),
            selectinload(Experiment.tlc_records),
        )
        .filter(Experiment.id == exp_id)
        .first()
    )
    if not exp:
        raise HTTPException(404, "Experiment not found")

    # Load comments separately to eager-load creator without N+1
    comments: List[ExperimentComment] = []
    if include_comments:
        comments = (
            db.query(ExperimentComment)
            .options(selectinload(ExperimentComment.creator))
            .filter(
                ExperimentComment.experiment_id == exp_id,
                ExperimentComment.is_deleted.is_(False),
            )
            .order_by(ExperimentComment.created_at)
            .all()
        )

    text_body = _render_text(
        exp,
        comments,
        include_steps      = include_steps,
        include_inputs     = include_inputs,
        include_parameters = include_parameters,
        include_equipment  = include_equipment,
        include_tlc        = include_tlc,
        include_comments   = include_comments,
    )

    # Try WeasyPrint for a real PDF; fall back to plain text
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
