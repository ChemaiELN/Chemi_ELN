"""
Search router — FIX-35.

Global experiment search with:
  - Full-text across code / title / aim / conclusion
  - Criteria-based search (parameter min/max, yield range, status)
  - ATR search
  - Notebook and project search
"""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.atr import ATR
from app.models.experiment import Experiment, ExperimentParameter
from app.models.notebook import Notebook, NotebookPermission
from app.models.project import Project
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.global_settings import experiment_search_limit

router = APIRouter()


def _visible_nb_ids(db: Session, actor: User) -> Optional[list]:
    """Return None (no filter) for QA/HOD, or list of visible notebook IDs."""
    if actor.role.code in ("QA", "HOD"):
        return None
    return [
        p.notebook_id
        for p in db.query(NotebookPermission)
        .filter(
            NotebookPermission.user_id == actor.id,
            NotebookPermission.can_view.is_(True),
        )
        .all()
    ]


@router.get("/experiments")
def search_experiments(
    q:                  Optional[str]   = Query(None, description="Full-text across code, title, aim, conclusion"),
    status:             Optional[str]   = Query(None),
    notebook_id:        Optional[str]   = Query(None),
    project_id:         Optional[str]   = Query(None),
    created_by:         Optional[str]   = Query(None),
    starting_material:  Optional[str]   = Query(None),
    target_product:     Optional[str]   = Query(None),
    reaction_type:      Optional[str]   = Query(None),
    yield_min:          Optional[float] = Query(None),
    yield_max:          Optional[float] = Query(None),
    latest_only:        bool            = Query(True),
    page:               int             = Query(1, ge=1),
    page_size:          int             = Query(20, ge=1, le=100),
    db:                 Session         = Depends(get_db),
    actor:              User            = Depends(get_current_user),
):
    """FIX-35: Comprehensive experiment search."""
    nb_ids = _visible_nb_ids(db, actor)

    query = db.query(Experiment)
    if nb_ids is not None:
        query = query.filter(Experiment.notebook_id.in_(nb_ids))

    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            Experiment.title.ilike(like),
            Experiment.code.ilike(like),
            Experiment.full_code.ilike(like),
            Experiment.aim.ilike(like),
            Experiment.conclusion.ilike(like),
            Experiment.starting_material.ilike(like),
            Experiment.target_product.ilike(like),
        ))

    if status:
        query = query.filter(Experiment.status == status.upper())
    if notebook_id:
        query = query.filter(Experiment.notebook_id == notebook_id)
    if project_id:
        query = query.filter(Experiment.project_id == project_id)
    if created_by:
        query = query.filter(Experiment.created_by == created_by)
    if starting_material:
        query = query.filter(Experiment.starting_material.ilike(f"%{starting_material}%"))
    if target_product:
        query = query.filter(Experiment.target_product.ilike(f"%{target_product}%"))
    if reaction_type:
        query = query.filter(Experiment.reaction_type.ilike(f"%{reaction_type}%"))
    if yield_min is not None:
        query = query.filter(Experiment.yield_pct >= yield_min)
    if yield_max is not None:
        query = query.filter(Experiment.yield_pct <= yield_max)
    if latest_only:
        query = query.filter(Experiment.is_latest_version.is_(True))

    total = query.count()
    limit = min(page_size, experiment_search_limit(db))
    items = (
        query.order_by(Experiment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(limit)
        .all()
    )
    return {"total": total, "page": page, "page_size": limit, "items": items}


@router.get("/experiments/by-parameters")
def search_by_parameters(
    param_code: str             = Query(..., description="Parameter code to filter on, e.g. P1"),
    value_min:  Optional[Decimal] = Query(None),
    value_max:  Optional[Decimal] = Query(None),
    uom:        Optional[str]   = Query(None),
    page:       int             = Query(1, ge=1),
    page_size:  int             = Query(20, ge=1, le=100),
    db:         Session         = Depends(get_db),
    actor:      User            = Depends(get_current_user),
):
    """FIX-35: Search experiments by parameter code and value range."""
    nb_ids = _visible_nb_ids(db, actor)

    param_q = db.query(ExperimentParameter.experiment_id).filter(
        ExperimentParameter.code == param_code
    )
    if value_min is not None:
        param_q = param_q.filter(ExperimentParameter.parameter_value >= value_min)
    if value_max is not None:
        param_q = param_q.filter(ExperimentParameter.parameter_value <= value_max)
    if uom:
        param_q = param_q.filter(ExperimentParameter.uom == uom)

    matching_exp_ids = [row[0] for row in param_q.all()]

    query = db.query(Experiment).filter(
        Experiment.id.in_(matching_exp_ids),
        Experiment.is_latest_version.is_(True),
    )
    if nb_ids is not None:
        query = query.filter(Experiment.notebook_id.in_(nb_ids))

    total = query.count()
    items = (
        query.order_by(Experiment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}


@router.get("/atrs")
def search_atrs(
    q:              Optional[str] = Query(None, description="Search by ATR number or test type"),
    status:         Optional[str] = Query(None),
    test_type:      Optional[str] = Query(None),
    experiment_id:  Optional[str] = Query(None),
    raised_by_me:   bool          = Query(False),
    assigned_to_me: bool          = Query(False),
    page:           int           = Query(1, ge=1),
    page_size:      int           = Query(20, ge=1, le=100),
    db:             Session       = Depends(get_db),
    actor:          User          = Depends(get_current_user),
):
    """FIX-35: ATR search."""
    query = db.query(ATR).filter(ATR.is_latest_version.is_(True))

    if q:
        like = f"%{q}%"
        query = query.filter(or_(ATR.atr_no.ilike(like), ATR.test_type.ilike(like)))
    if status:
        query = query.filter(ATR.status == status.upper())
    if test_type:
        query = query.filter(ATR.test_type.ilike(f"%{test_type}%"))
    if experiment_id:
        query = query.filter(ATR.experiment_id == experiment_id)
    if raised_by_me:
        query = query.filter(ATR.raised_by == actor.id)
    if assigned_to_me:
        query = query.filter(ATR.assigned_to == actor.id)

    total = query.count()
    items = (
        query.order_by(ATR.raised_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}


@router.get("/notebooks")
def search_notebooks(
    q:          Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    status:     Optional[str] = Query(None),
    page:       int           = Query(1, ge=1),
    page_size:  int           = Query(20, ge=1, le=100),
    db:         Session       = Depends(get_db),
    actor:      User          = Depends(get_current_user),
):
    """Search notebooks visible to the current user."""
    query = db.query(Notebook)

    if actor.role.code not in ("QA", "HOD"):
        query = query.join(
            NotebookPermission,
            (NotebookPermission.notebook_id == Notebook.id) &
            (NotebookPermission.user_id == actor.id) &
            (NotebookPermission.can_view.is_(True)),
        )

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Notebook.title.ilike(like), Notebook.code.ilike(like)))
    if project_id:
        query = query.filter(Notebook.project_id == project_id)
    if status:
        query = query.filter(Notebook.status == status.upper())

    total = query.count()
    items = (
        query.order_by(Notebook.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}


@router.get("/projects")
def search_projects(
    q:             Optional[str] = Query(None),
    status:        Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    page:          int           = Query(1, ge=1),
    page_size:     int           = Query(20, ge=1, le=100),
    db:            Session       = Depends(get_db),
    _:             User          = Depends(get_current_user),
):
    """Search projects."""
    query = db.query(Project)

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Project.name.ilike(like), Project.code.ilike(like)))
    if status:
        query = query.filter(Project.status == status.upper())
    if department_id:
        query = query.filter(Project.department_id == department_id)

    total = query.count()
    items = (
        query.order_by(Project.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}
