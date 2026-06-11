from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import new_uuid
from app.models.experiment import (
    Experiment,
    ExperimentAttachment,
    ExperimentComment,
    ExperimentHistory,
    ExperimentInput,
    ExperimentParameter,
    ExperimentTLC,
)
from app.models.notebook import Notebook, NotebookPermission
from app.models.project import Project
from app.models.route import Route, Stage
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.experiment import (
    CommentCreate,
    CommentResponse,
    ExperimentAttachmentResponse,
    ExperimentCreate,
    ExperimentInputCreate,
    ExperimentInputResponse,
    ExperimentInputUpdate,
    ExperimentParameterCreate,
    ExperimentParameterResponse,
    ExperimentParameterUpdate,
    ExperimentResponse,
    ExperimentSummary,
    ExperimentTLCCreate,
    ExperimentTLCResponse,
    ExperimentTLCUpdate,
    ExperimentUpdate,
    HistoryResponse,
    NewVersionRequest,
    RejectRequest,
)
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.files import delete_file, save_upload, upload_dir, validate_upload
from app.utils.richtext import fields_changed, RICH_TEXT_FIELDS, diff_html_unified
from app.utils.sequences import next_value

router = APIRouter()


# ── Internal helpers ─────────────────────────────────────────────────────────

def _roles(user: User) -> set:
    return {user.role.code}


def _has_nb_perm(db: Session, notebook_id: str, user: User, flag: str) -> bool:
    """QA and TL always have access; everyone else needs the specific flag on the notebook."""
    roles = _roles(user)
    if "QA" in roles or "TL" in roles:
        return True
    perm = (
        db.query(NotebookPermission)
        .filter(
            NotebookPermission.notebook_id == notebook_id,
            NotebookPermission.user_id == user.id,
        )
        .first()
    )
    return perm is not None and getattr(perm, flag, False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _snapshot(exp: Experiment) -> dict:
    return {
        "title": exp.title,
        "aim": exp.aim,
        "objective": exp.objective,
        "procedure": exp.procedure,
        "observations": exp.observations,
        "conclusion": exp.conclusion,
        "starting_material": exp.starting_material,
        "target_product": exp.target_product,
        "reaction_type": exp.reaction_type,
        "theoretical_yield": str(exp.theoretical_yield) if exp.theoretical_yield else None,
        "actual_yield": str(exp.actual_yield) if exp.actual_yield else None,
        "yield_pct": str(exp.yield_pct) if exp.yield_pct else None,
        "inputs": [
            {
                "material_name": i.material_name,
                "cas_no": i.cas_no,
                "quantity": str(i.quantity) if i.quantity else None,
                "unit": i.unit,
                "role": i.role,
            }
            for i in exp.inputs
        ],
        "parameters": [
            {"name": p.name, "value": p.value, "unit": p.unit}
            for p in exp.parameters
        ],
    }


def _write_history(
    db: Session,
    exp: Experiment,
    action: str,
    user_id: str,
    rejection_reason: Optional[str] = None,
    revision_note: Optional[str] = None,
) -> None:
    root_id = exp.root_experiment_id or exp.id
    db.add(ExperimentHistory(
        id=new_uuid(),
        experiment_id=root_id,
        version_experiment_id=exp.id,
        action=action,
        action_by=user_id,
        action_at=_now(),
        rejection_reason=rejection_reason,
        revision_note=revision_note,
        snapshot=_snapshot(exp),
    ))


def _build_code(db: Session, nb: Notebook) -> tuple[str, str]:
    """Return (code, full_code_v1). code = OQ/R1/S1/E00001"""
    proj = db.get(Project, nb.project_id)
    parts = [proj.code if proj else "UNK"]
    if nb.route_id:
        r = db.get(Route, nb.route_id)
        if r:
            parts.append(r.code)
    if nb.stage_id:
        s = db.get(Stage, nb.stage_id)
        if s:
            parts.append(s.code)
    seq = next_value(db, "EXP")
    code = "/".join(parts) + f"/E{seq:05d}"
    return code, code + "/001"


def _get_exp_or_404(db: Session, exp_id: str) -> Experiment:
    exp = db.get(Experiment, exp_id)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    return exp


# ── Create & list ─────────────────────────────────────────────────────────────

@router.post("/", status_code=201, response_model=ExperimentResponse)
def create_experiment(
    body: ExperimentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    nb = db.get(Notebook, body.notebook_id)
    if not nb:
        raise HTTPException(404, "Notebook not found")
    if not _has_nb_perm(db, body.notebook_id, current_user, "can_edit"):
        raise HTTPException(403, "Requires can_edit permission on this notebook")

    code, full_code = _build_code(db, nb)

    exp = Experiment(
        id=new_uuid(),
        code=code,
        full_code=full_code,
        version=1,
        title=body.title,
        notebook_id=body.notebook_id,
        project_id=nb.project_id,
        route_id=nb.route_id,
        stage_id=nb.stage_id,
        aim=body.aim,
        objective=body.objective,
        procedure=body.procedure,
        observations=body.observations,
        conclusion=body.conclusion,
        starting_material=body.starting_material,
        target_product=body.target_product,
        reaction_type=body.reaction_type,
        theoretical_yield=body.theoretical_yield,
        actual_yield=body.actual_yield,
        yield_pct=body.yield_pct,
        status="DRAFT",
        is_latest_version=True,
        created_by=current_user.id,
    )
    db.add(exp)
    db.flush()

    if body.inputs:
        for inp in body.inputs:
            db.add(ExperimentInput(id=new_uuid(), experiment_id=exp.id, **inp.model_dump()))
    if body.parameters:
        for p in body.parameters:
            db.add(ExperimentParameter(id=new_uuid(), experiment_id=exp.id, **p.model_dump()))

    db.flush()
    _write_history(db, exp, "CREATED", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="CREATED",
        target_type="experiment", target_id=exp.id, target_label=full_code,
        detail=f"Created experiment '{body.title}'",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.get("/", response_model=PaginatedResponse[ExperimentSummary])
def list_experiments(
    notebook_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    latest_only: bool = Query(True),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = _roles(current_user)
    q = db.query(Experiment)

    if "QA" not in roles and "TL" not in roles:
        nb_ids = [
            p.notebook_id
            for p in db.query(NotebookPermission)
            .filter(
                NotebookPermission.user_id == current_user.id,
                NotebookPermission.can_view.is_(True),
            )
            .all()
        ]
        q = q.filter(Experiment.notebook_id.in_(nb_ids))

    if notebook_id:
        q = q.filter(Experiment.notebook_id == notebook_id)
    if status:
        q = q.filter(Experiment.status == status.upper())
    if latest_only:
        q = q.filter(Experiment.is_latest_version.is_(True))
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Experiment.title.ilike(like), Experiment.code.ilike(like)))

    total = q.count()
    pg = paginate(total, page, page_size)
    items = (
        q.order_by(Experiment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Resolve creator display names in one query
    creator_ids = list({e.created_by for e in items})
    users_map: dict[str, str] = {}
    if creator_ids:
        rows = db.query(User.id, User.display_name).filter(User.id.in_(creator_ids)).all()
        users_map = {r.id: r.display_name for r in rows}

    summaries = []
    for exp in items:
        s = ExperimentSummary.model_validate(exp)
        s.creator_name = users_map.get(exp.created_by)
        summaries.append(s)

    return PaginatedResponse(items=summaries, **pg)


@router.get("/{exp_id}", response_model=ExperimentResponse)
def get_experiment(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access to this notebook")
    # Resolve display names for user UUID fields
    user_ids = {uid for uid in [
        exp.created_by, exp.verified_by, exp.approved_by, exp.rejected_by
    ] if uid}
    users_map: dict = {}
    if user_ids:
        users_map = {
            str(r.id): r.display_name
            for r in db.query(User.id, User.display_name).filter(User.id.in_(user_ids)).all()
        }
    result = ExperimentResponse.model_validate(exp)
    result.creator_name = users_map.get(str(exp.created_by))
    result.verified_by_name = users_map.get(str(exp.verified_by)) if exp.verified_by else None
    result.approved_by_name = users_map.get(str(exp.approved_by)) if exp.approved_by else None
    result.rejected_by_name = users_map.get(str(exp.rejected_by)) if exp.rejected_by else None
    return result


@router.patch("/{exp_id}", response_model=ExperimentResponse)
def update_experiment(
    exp_id: str,
    body: ExperimentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if exp.status not in ("DRAFT", "REJECTED", "UNLOCKED"):
        raise HTTPException(400, f"Cannot edit experiment in '{exp.status}' status")
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_edit"):
        raise HTTPException(403, "Requires can_edit on this notebook")

    # ── Snapshot current rich-text values before applying changes ─────────────
    before: dict = {f: getattr(exp, f, None) for f in RICH_TEXT_FIELDS}

    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(exp, field, val)

    # ── Detect which rich-text fields changed (with similarity ratios) ─────────
    after: dict = {f: getattr(exp, f, None) for f in RICH_TEXT_FIELDS}
    changed = fields_changed(before, after)

    # Build a human-readable audit detail
    plain_fields = [k for k in updates if k not in RICH_TEXT_FIELDS]
    detail_parts: list[str] = []
    if plain_fields:
        detail_parts.append(f"Updated: {', '.join(plain_fields)}")
    if changed:
        rt_summary = "; ".join(
            f"{field} ({int(ratio * 100)}% similar)" if ratio > 0
            else f"{field} (fully replaced)"
            for field, ratio in changed.items()
        )
        detail_parts.append(f"Rich-text edits → {rt_summary}")

    detail = " | ".join(detail_parts) if detail_parts else "Saved (no changes detected)"

    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="UPDATE",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail=detail,
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


# ── Status workflow ──────────────────────────────────────────────────────────

@router.post("/{exp_id}/submit", response_model=ExperimentResponse)
def submit_experiment(
    exp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if exp.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(400, f"Cannot submit from '{exp.status}' status")
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_submit"):
        raise HTTPException(403, "Requires can_submit on this notebook")

    exp.status = "SUBMITTED"
    exp.submitted_by = current_user.id
    exp.submitted_at = _now()
    db.flush()
    _write_history(db, exp, "SUBMITTED", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="SUBMITTED",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail=f"Submitted experiment for review",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/verify", response_model=ExperimentResponse)
def verify_experiment(
    exp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if exp.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot verify from '{exp.status}' status")
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_verify"):
        raise HTTPException(403, "Requires can_verify on this notebook")

    exp.status = "VERIFIED"
    exp.verified_by = current_user.id
    exp.verified_at = _now()
    db.flush()
    _write_history(db, exp, "VERIFIED", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="VERIFIED",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail=f"Experiment verified",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/approve", response_model=ExperimentResponse)
def approve_experiment(
    exp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if exp.status != "VERIFIED":
        raise HTTPException(400, f"Cannot approve from '{exp.status}' status")
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_approve"):
        raise HTTPException(403, "Requires can_approve on this notebook")

    exp.status = "APPROVED"
    exp.approved_by = current_user.id
    exp.approved_at = _now()
    db.flush()
    _write_history(db, exp, "APPROVED", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="APPROVED",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail=f"Experiment approved",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/reject", response_model=ExperimentResponse)
def reject_experiment(
    exp_id: str,
    body: RejectRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if exp.status not in ("SUBMITTED", "VERIFIED"):
        raise HTTPException(400, f"Cannot reject from '{exp.status}' status")

    required_flag = "can_verify" if exp.status == "SUBMITTED" else "can_approve"
    if not _has_nb_perm(db, exp.notebook_id, current_user, required_flag):
        raise HTTPException(403, f"Requires {required_flag} on this notebook to reject")

    exp.status = "REJECTED"
    exp.rejected_by = current_user.id
    exp.rejected_at = _now()
    exp.rejection_reason = body.reason
    db.flush()
    _write_history(db, exp, "REJECTED", current_user.id, rejection_reason=body.reason)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="REJECTED",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail=f"Rejected: {body.reason}",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/revise", response_model=ExperimentResponse)
def revise_experiment(
    exp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move REJECTED experiment back to DRAFT so it can be fixed and resubmitted."""
    exp = _get_exp_or_404(db, exp_id)
    if exp.status != "REJECTED":
        raise HTTPException(400, "Only REJECTED experiments can be revised")
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_edit"):
        raise HTTPException(403, "Requires can_edit on this notebook")

    exp.status = "DRAFT"
    db.flush()
    _write_history(db, exp, "REVISED", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="REVISED",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail="Experiment returned to DRAFT for revision",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/void", response_model=ExperimentResponse)
def void_experiment(
    exp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    exp = _get_exp_or_404(db, exp_id)
    if exp.status == "VOID":
        raise HTTPException(400, "Experiment is already voided")

    exp.status = "VOID"
    db.flush()
    _write_history(db, exp, "VOID", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="VOID",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail="Experiment voided by QA",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/unlock", response_model=ExperimentResponse)
def unlock_experiment(
    exp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("QA")),
):
    """QA unlocks an APPROVED experiment so a new version can be created."""
    exp = _get_exp_or_404(db, exp_id)
    if exp.status != "APPROVED":
        raise HTTPException(400, "Only APPROVED experiments can be unlocked")

    exp.status = "UNLOCKED"
    exp.unlocked_by = current_user.id
    exp.unlocked_at = _now()
    db.flush()
    _write_history(db, exp, "UNLOCKED", current_user.id)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="UNLOCKED",
        target_type="experiment", target_id=exp.id, target_label=exp.full_code,
        detail="Experiment unlocked by QA for new version",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/{exp_id}/new-version", status_code=201, response_model=ExperimentResponse)
def new_version(
    exp_id: str,
    body: NewVersionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new version from an UNLOCKED experiment. Copies all content."""
    parent = _get_exp_or_404(db, exp_id)
    if parent.status != "UNLOCKED":
        raise HTTPException(400, "Source experiment must be in UNLOCKED status")
    if not _has_nb_perm(db, parent.notebook_id, current_user, "can_edit"):
        raise HTTPException(403, "Requires can_edit on this notebook")

    new_ver = parent.version + 1
    root_id = parent.root_experiment_id or parent.id
    full_code = parent.code + f"/{new_ver:03d}"

    child = Experiment(
        id=new_uuid(),
        code=parent.code,
        full_code=full_code,
        version=new_ver,
        title=parent.title,
        notebook_id=parent.notebook_id,
        project_id=parent.project_id,
        route_id=parent.route_id,
        stage_id=parent.stage_id,
        aim=parent.aim,
        objective=parent.objective,
        procedure=parent.procedure,
        observations=parent.observations,
        conclusion=parent.conclusion,
        starting_material=parent.starting_material,
        target_product=parent.target_product,
        reaction_type=parent.reaction_type,
        theoretical_yield=parent.theoretical_yield,
        actual_yield=parent.actual_yield,
        yield_pct=parent.yield_pct,
        status="DRAFT",
        is_latest_version=True,
        created_by=current_user.id,
        root_experiment_id=root_id,
        parent_experiment_id=parent.id,
        revision_note=body.revision_note,
    )
    parent.is_latest_version = False
    db.add(child)
    db.flush()

    for inp in parent.inputs:
        db.add(ExperimentInput(
            id=new_uuid(), experiment_id=child.id,
            sort_order=inp.sort_order, material_name=inp.material_name,
            cas_no=inp.cas_no, mol_weight=inp.mol_weight, quantity=inp.quantity,
            unit=inp.unit, moles=inp.moles, mole_ratio=inp.mole_ratio,
            purity_pct=inp.purity_pct, role=inp.role,
        ))
    for p in parent.parameters:
        db.add(ExperimentParameter(
            id=new_uuid(), experiment_id=child.id,
            sort_order=p.sort_order, name=p.name, value=p.value, unit=p.unit,
        ))

    db.flush()
    _write_history(db, child, "REVISED", current_user.id, revision_note=body.revision_note)
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="NEW_VERSION",
        target_type="experiment", target_id=child.id, target_label=full_code,
        detail=f"Created v{new_ver} from {parent.full_code}. Note: {body.revision_note or '—'}",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(child)
    return child


@router.get("/{exp_id}/versions", response_model=List[ExperimentSummary])
def list_versions(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access to this notebook")

    root_id = exp.root_experiment_id or exp.id
    return (
        db.query(Experiment)
        .filter(or_(Experiment.id == root_id, Experiment.root_experiment_id == root_id))
        .order_by(Experiment.version)
        .all()
    )


# ── Inputs ───────────────────────────────────────────────────────────────────

def _editable_exp(db: Session, exp_id: str, user: User) -> Experiment:
    exp = _get_exp_or_404(db, exp_id)
    if exp.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(400, f"Experiment is not editable in '{exp.status}' status")
    if not _has_nb_perm(db, exp.notebook_id, user, "can_edit"):
        raise HTTPException(403, "Requires can_edit on this notebook")
    return exp


@router.post("/{exp_id}/inputs", status_code=201, response_model=ExperimentInputResponse)
def add_input(
    exp_id: str,
    body: ExperimentInputCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _editable_exp(db, exp_id, current_user)
    inp = ExperimentInput(id=new_uuid(), experiment_id=exp.id, **body.model_dump())
    db.add(inp)
    db.commit()
    db.refresh(inp)
    return inp


@router.get("/{exp_id}/inputs", response_model=List[ExperimentInputResponse])
def list_inputs(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access")
    return (
        db.query(ExperimentInput)
        .filter(ExperimentInput.experiment_id == exp_id)
        .order_by(ExperimentInput.sort_order)
        .all()
    )


@router.patch("/{exp_id}/inputs/{input_id}", response_model=ExperimentInputResponse)
def update_input(
    exp_id: str,
    input_id: str,
    body: ExperimentInputUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _editable_exp(db, exp_id, current_user)
    inp = db.get(ExperimentInput, input_id)
    if not inp or inp.experiment_id != exp_id:
        raise HTTPException(404, "Input not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(inp, field, val)
    db.commit()
    db.refresh(inp)
    return inp


@router.delete("/{exp_id}/inputs/{input_id}", status_code=204)
def delete_input(
    exp_id: str,
    input_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _editable_exp(db, exp_id, current_user)
    inp = db.get(ExperimentInput, input_id)
    if not inp or inp.experiment_id != exp_id:
        raise HTTPException(404, "Input not found")
    db.delete(inp)
    db.commit()


# ── Parameters ───────────────────────────────────────────────────────────────

@router.post("/{exp_id}/parameters", status_code=201, response_model=ExperimentParameterResponse)
def add_parameter(
    exp_id: str,
    body: ExperimentParameterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _editable_exp(db, exp_id, current_user)
    param = ExperimentParameter(id=new_uuid(), experiment_id=exp.id, **body.model_dump())
    db.add(param)
    db.commit()
    db.refresh(param)
    return param


@router.get("/{exp_id}/parameters", response_model=List[ExperimentParameterResponse])
def list_parameters(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access")
    return (
        db.query(ExperimentParameter)
        .filter(ExperimentParameter.experiment_id == exp_id)
        .order_by(ExperimentParameter.sort_order)
        .all()
    )


@router.patch("/{exp_id}/parameters/{param_id}", response_model=ExperimentParameterResponse)
def update_parameter(
    exp_id: str,
    param_id: str,
    body: ExperimentParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _editable_exp(db, exp_id, current_user)
    param = db.get(ExperimentParameter, param_id)
    if not param or param.experiment_id != exp_id:
        raise HTTPException(404, "Parameter not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(param, field, val)
    db.commit()
    db.refresh(param)
    return param


@router.delete("/{exp_id}/parameters/{param_id}", status_code=204)
def delete_parameter(
    exp_id: str,
    param_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _editable_exp(db, exp_id, current_user)
    param = db.get(ExperimentParameter, param_id)
    if not param or param.experiment_id != exp_id:
        raise HTTPException(404, "Parameter not found")
    db.delete(param)
    db.commit()


# ── TLC ──────────────────────────────────────────────────────────────────────

@router.post("/{exp_id}/tlc", status_code=201, response_model=ExperimentTLCResponse)
def add_tlc(
    exp_id: str,
    body: ExperimentTLCCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _editable_exp(db, exp_id, current_user)
    tlc = ExperimentTLC(id=new_uuid(), experiment_id=exp.id, **body.model_dump())
    db.add(tlc)
    db.commit()
    db.refresh(tlc)
    return tlc


@router.get("/{exp_id}/tlc", response_model=List[ExperimentTLCResponse])
def list_tlc(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access")
    return db.query(ExperimentTLC).filter(ExperimentTLC.experiment_id == exp_id).all()


# ── History ──────────────────────────────────────────────────────────────────

@router.get("/{exp_id}/history", response_model=List[HistoryResponse])
def get_history(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access")
    root_id = exp.root_experiment_id or exp.id
    return (
        db.query(ExperimentHistory)
        .filter(ExperimentHistory.experiment_id == root_id)
        .order_by(ExperimentHistory.action_at)
        .all()
    )


# ── Rich-text diff ───────────────────────────────────────────────────────────

@router.get("/{exp_id}/diff/{other_id}")
def diff_experiments(
    exp_id: str,
    other_id: str,
    field: str = Query(..., description="Rich-text field to diff (aim, objective, procedure, observations, conclusion)"),
    format: str = Query("html", description="Output format: 'html' (inline ins/del) or 'unified' (patch text)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compare a single rich-text field between two experiment versions.

    Returns:
      - format=html     → HTML fragment with <ins> / <del> highlights
      - format=unified  → unified-diff plain text (copy/paste ready)

    Also returns:
      - similarity      → 0.0–1.0 ratio
      - plain_before    → stripped plain text of the base version
      - plain_after     → stripped plain text of the other version
    """
    from app.utils.richtext import diff_html_html, diff_html_unified, strip_html, similarity_ratio

    if field not in RICH_TEXT_FIELDS:
        raise HTTPException(400, f"'field' must be one of: {', '.join(RICH_TEXT_FIELDS)}")

    exp   = _get_exp_or_404(db, exp_id)
    other = _get_exp_or_404(db, other_id)

    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access to base experiment")

    old_html = getattr(exp,   field, None)
    new_html = getattr(other, field, None)

    ratio = similarity_ratio(old_html, new_html)

    if format == "unified":
        diff_output = diff_html_unified(old_html, new_html, field_name=field)
    else:
        diff_output = diff_html_html(old_html, new_html)

    return {
        "field":         field,
        "format":        format,
        "similarity":    round(ratio, 4),
        "diff":          diff_output,
        "plain_before":  strip_html(old_html),
        "plain_after":   strip_html(new_html),
        "exp_id":        exp_id,
        "other_id":      other_id,
    }


# ── Comments ─────────────────────────────────────────────────────────────────

@router.post("/{exp_id}/comments", status_code=201, response_model=CommentResponse)
def add_comment(
    exp_id: str,
    body: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_comment"):
        raise HTTPException(403, "Requires can_comment on this notebook")
    c = ExperimentComment(
        id=new_uuid(),
        experiment_id=exp_id,
        comment=body.comment,
        comment_type=body.comment_type,
        parent_id=body.parent_id,
        created_by=current_user.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{exp_id}/comments", response_model=List[CommentResponse])
def list_comments(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access")
    return (
        db.query(ExperimentComment)
        .filter(
            ExperimentComment.experiment_id == exp_id,
            ExperimentComment.is_deleted.is_(False),
        )
        .order_by(ExperimentComment.created_at)
        .all()
    )


# ── Attachments ───────────────────────────────────────────────────────────────

@router.post(
    "/{exp_id}/attachments",
    status_code=201,
    response_model=ExperimentAttachmentResponse,
)
async def upload_experiment_attachment(
    exp_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a file attachment to an experiment.
    Requires can_attach notebook permission (QA always passes).
    Any experiment status except VOID is allowed — analysts often attach
    supporting data to already-approved experiments.
    """
    exp = _get_exp_or_404(db, exp_id)
    if exp.status == "VOID":
        raise HTTPException(400, "Cannot attach files to a voided experiment")
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_attach"):
        raise HTTPException(403, "Requires can_attach permission on this notebook")

    ext = validate_upload(file)
    subdir = upload_dir() / "experiments" / exp_id
    file_path, file_size = await save_upload(file, subdir)

    att = ExperimentAttachment(
        id=new_uuid(),
        experiment_id=exp_id,
        filename=file.filename or "upload",
        file_path=file_path,
        file_size=file_size,
        file_type=ext.lstrip("."),
        uploaded_by=current_user.id,
    )
    db.add(att)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="ATTACHMENT_UPLOADED",
        target_type="experiment", target_id=exp_id, target_label=exp.full_code,
        detail=f"Uploaded '{file.filename}' ({file_size} bytes)",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(att)
    return att


@router.get(
    "/{exp_id}/attachments",
    response_model=List[ExperimentAttachmentResponse],
)
def list_experiment_attachments(
    exp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access to this notebook")
    return (
        db.query(ExperimentAttachment)
        .filter(ExperimentAttachment.experiment_id == exp_id)
        .order_by(ExperimentAttachment.uploaded_at)
        .all()
    )


@router.get(
    "/{exp_id}/attachments/{att_id}",
    response_class=FileResponse,
)
def download_experiment_attachment(
    exp_id: str,
    att_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the attachment file to the client."""
    exp = _get_exp_or_404(db, exp_id)
    if not _has_nb_perm(db, exp.notebook_id, current_user, "can_view"):
        raise HTTPException(403, "No view access to this notebook")

    att = db.get(ExperimentAttachment, att_id)
    if not att or att.experiment_id != exp_id:
        raise HTTPException(404, "Attachment not found")

    import os
    if not os.path.exists(att.file_path):
        raise HTTPException(404, "File not found on server")

    return FileResponse(
        path=att.file_path,
        filename=att.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{exp_id}/attachments/{att_id}", status_code=204)
def delete_experiment_attachment(
    exp_id: str,
    att_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an attachment. Uploader or QA only."""
    exp = _get_exp_or_404(db, exp_id)
    att = db.get(ExperimentAttachment, att_id)
    if not att or att.experiment_id != exp_id:
        raise HTTPException(404, "Attachment not found")

    roles = _roles(current_user)
    if att.uploaded_by != current_user.id and "QA" not in roles:
        raise HTTPException(403, "Only the uploader or QA can delete attachments")

    file_path = att.file_path
    db.delete(att)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="Experiments", action="ATTACHMENT_DELETED",
        target_type="experiment", target_id=exp_id, target_label=exp.full_code,
        detail=f"Deleted attachment '{att.filename}'",
        ip_address=get_ip(request),
    )
    db.commit()
    delete_file(file_path)
