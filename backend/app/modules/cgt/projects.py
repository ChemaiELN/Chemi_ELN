"""CGT Projects — basic CRUD, mirrors app/modules/projects/router.py (ADC)
but with department_id removed and a free-text "process" field added."""
from typing import Any, Optional
import uuid
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.project import CgtProject, CgtProjectCodeCounter
from app.models.cgt_notebook import CgtNotebook, CgtNotebookPermission
from app.models.admin import User
from app.shared.privileges import require_creator_role, ASSIGNMENT_RESTRICTED_ROLES

router = APIRouter(prefix="/cgt-projects", tags=["cgt-projects"])

PROJECT_CODE_PREFIX = "CGT"


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


def _seed_max_project_code_seq(db: Session, year: str) -> int:
    """Seed from the highest existing sequence in any CGT/{year}/{seq} project code."""
    pattern = f"{PROJECT_CODE_PREFIX}/{year}/%"
    rows = db.query(CgtProject.code).filter(CgtProject.code.like(pattern)).all()
    max_seq = 30000
    for (code,) in rows:
        if code:
            try:
                s = int(code.split('/')[-1])
                if s > max_seq:
                    max_seq = s
            except (ValueError, IndexError):
                pass
    return max_seq


def _claim_next_project_code_seq(db: Session, year: str) -> int:
    """Atomically increment and return the next project code sequence for the year.
    SELECT FOR UPDATE prevents two concurrent requests getting the same number."""
    counter = (
        db.query(CgtProjectCodeCounter)
        .filter_by(year=year)
        .with_for_update()
        .first()
    )
    if counter is None:
        counter = CgtProjectCodeCounter(year=year, last_seq=_seed_max_project_code_seq(db, year))
        db.add(counter)
        db.flush()
    counter.last_seq += 1
    return counter.last_seq


# ── Serialisers ───────────────────────────────────────────────────────────────

def _project_dict(p: CgtProject, detail: bool = False, creator: User = None) -> dict:
    d: dict = {
        "id":                  str(p.id),
        "code":                p.code,
        "name":                p.name,
        "product_name":        p.product_name,
        "in_house_project_id": p.in_house_project_id,
        "project_type":        p.project_type,
        "market":              p.market,
        "process":             p.process,
        "created_by":          str(p.created_by),
        "created_by_name":     creator.username if creator else None,
        "start_date":          p.start_date.isoformat()  if p.start_date  else None,
        "target_date":         p.target_date.isoformat() if p.target_date else None,
        "status":              p.status,
        "description":         p.description,
        "created_at":          p.created_at.isoformat(),
        "updated_at":          p.updated_at.isoformat(),
    }
    if detail:
        d.update({"objective": p.objective})
    return d


def _get_or_404(db: Session, project_id: str) -> CgtProject:
    p = db.query(CgtProject).filter(CgtProject.id == project_id).first()
    if not p:
        raise HTTPException(404, "CGT project not found")
    return p


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/next-code")
def next_project_code(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    """Preview-only: returns the likely next project code without claiming it."""
    year = datetime.datetime.utcnow().strftime('%y')
    counter = db.query(CgtProjectCodeCounter).filter_by(year=year).first()
    next_seq = (counter.last_seq if counter else _seed_max_project_code_seq(db, year)) + 1
    return {"code": f"{PROJECT_CODE_PREFIX}/{year}/{next_seq}"}


@router.get("")
def list_projects(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip:   int           = Query(0, ge=0),
    limit:  int           = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    q = db.query(CgtProject)
    # Chemists/Analysts only ever see projects containing a notebook explicitly
    # assigned to them — enforced server-side, not just hidden in the nav.
    if current_user.role.code in ASSIGNMENT_RESTRICTED_ROLES:
        assigned_project_ids = (
            db.query(CgtNotebook.cgt_project_id)
            .join(CgtNotebookPermission, CgtNotebookPermission.cgt_notebook_id == CgtNotebook.id)
            .filter(
                CgtNotebookPermission.user_id == current_user.id,
                CgtNotebookPermission.can_view.is_(True),
            )
            .subquery()
        )
        q = q.filter(CgtProject.id.in_(assigned_project_ids))
    if status:
        q = q.filter(CgtProject.status == status)
    if search:
        q = q.filter(CgtProject.name.ilike(f"%{search}%") | CgtProject.code.ilike(f"%{search}%"))
    total = q.count()
    rows  = q.order_by(CgtProject.created_at.desc()).offset(skip).limit(limit).all()

    creator_ids = {p.created_by for p in rows if p.created_by}
    creators = {u.id: u for u in db.query(User).filter(User.id.in_(creator_ids)).all()} if creator_ids else {}

    return {
        "total": total,
        "items": [_project_dict(p, creator=creators.get(p.created_by)) for p in rows],
    }


def _assert_project_access(db: Session, user, project: CgtProject) -> None:
    """Raise 403 if `user` is assignment-restricted and has no assigned
    notebook within `project` — mirrors assert_cgt_notebook_access."""
    if user.role.code not in ASSIGNMENT_RESTRICTED_ROLES:
        return
    assigned = (
        db.query(CgtNotebook)
        .join(CgtNotebookPermission, CgtNotebookPermission.cgt_notebook_id == CgtNotebook.id)
        .filter(
            CgtNotebook.cgt_project_id == project.id,
            CgtNotebookPermission.user_id == user.id,
            CgtNotebookPermission.can_view.is_(True),
        )
        .first()
    )
    if not assigned:
        raise HTTPException(403, "You are not assigned to any notebook in this project.")


@router.get("/{project_id}")
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    p = _get_or_404(db, project_id)
    _assert_project_access(db, current_user, p)
    creator = db.query(User).filter(User.id == p.created_by).first() if p.created_by else None
    return _project_dict(p, detail=True, creator=creator)


@router.post("")
def create_project(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = require_creator_role(),
):
    if not body.get("name"):
        raise HTTPException(422, "name is required")
    if not body.get("process"):
        raise HTTPException(422, "process is required")

    now = _now()
    year = now.strftime('%y')
    seq = _claim_next_project_code_seq(db, year)
    p = CgtProject(
        id=_uuid(),
        code=f"{PROJECT_CODE_PREFIX}/{year}/{seq}",
        name=body["name"],
        product_name=        body.get("product_name"),
        in_house_project_id= body.get("in_house_project_id"),
        project_type=        body.get("project_type"),
        market=               body.get("market"),
        process=              body.get("process"),
        created_by=           current_user.id,
        start_date=           body.get("start_date"),
        target_date=          body.get("target_date"),
        status=               body.get("status", "ACTIVE"),
        description=          body.get("description"),
        objective=            body.get("objective"),
        created_at=now,
        updated_at=now,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _project_dict(p, detail=True, creator=current_user)


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: Any = require_creator_role(),
):
    p = _get_or_404(db, project_id)
    editable = [
        "name", "product_name", "in_house_project_id", "project_type", "market",
        "process", "start_date", "target_date", "status", "description", "objective",
    ]
    for field in editable:
        if field in body:
            setattr(p, field, body[field])
    p.updated_at = _now()
    db.commit()
    db.refresh(p)
    creator = db.query(User).filter(User.id == p.created_by).first() if p.created_by else None
    return _project_dict(p, detail=True, creator=creator)


@router.delete("/{project_id}")
def archive_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = require_creator_role(),
):
    p = _get_or_404(db, project_id)
    p.status = "ARCHIVED"
    p.updated_at = _now()
    db.commit()
    return {"ok": True}
