"""
Dashboard router — FIX-12.

Provides aggregated counts and queue views for the main ELN dashboard:
  - Experiment counts by status
  - Verification queue (submitted to current user)
  - Approval queue (verified, user can approve)
  - Rework inbox (REWORK, owned by current user)
  - SLA alerts (overdue submissions)
  - My activity (recent ExperimentHistory actions)
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.atr import ATR
from app.models.experiment import Experiment, ExperimentReview
from app.models.notebook import NotebookPermission
from app.models.user import User
from app.services.esignature import get_crd_settings
from app.utils.deps import get_current_user

router = APIRouter()


@router.get("/counts")
def experiment_counts(
    db:    Session = Depends(get_db),
    actor: User    = Depends(get_current_user),
):
    """FIX-12: Experiment counts by status for the logged-in user."""
    roles = {actor.role.code}

    if "QA" in roles or "HOD" in roles:
        q = db.query(Experiment).filter(Experiment.is_latest_version.is_(True))
    else:
        nb_ids_sq = (
            db.query(NotebookPermission.notebook_id)
            .filter(
                NotebookPermission.user_id == actor.id,
                NotebookPermission.can_view.is_(True),
            )
            .subquery()
        )
        q = db.query(Experiment).filter(
            Experiment.notebook_id.in_(nb_ids_sq),
            Experiment.is_latest_version.is_(True),
        )

    status_counts = (
        q.with_entities(Experiment.status, func.count(Experiment.id))
        .group_by(Experiment.status)
        .all()
    )

    counts = {row[0]: row[1] for row in status_counts}
    total = sum(counts.values())

    atr_pending = db.query(ATR).filter(
        ATR.submitted_to == actor.id,
        ATR.status == "SUBMITTED",
        ATR.is_latest_version.is_(True),
    ).count()

    atr_assigned = db.query(ATR).filter(
        ATR.assigned_to == actor.id,
        ATR.status.in_(["ASSIGNED", "IN_PROGRESS"]),
        ATR.is_latest_version.is_(True),
    ).count()

    return {
        "experiments": {
            "total": total,
            "by_status": counts,
            "in_progress": counts.get("INPROGRESS", 0),
            "verification_requested": counts.get("VERIFICATION REQUESTED", 0),
            "submitted": counts.get("SUBMITTED", 0),
            "verified": counts.get("VERIFIED", 0),
            "approved": counts.get("APPROVED", 0),
            "rework": counts.get("REWORK", 0),
            "unlocked": counts.get("UNLOCKED", 0),
            "void": counts.get("VOID", 0),
        },
        "atr": {
            "pending_assignment": atr_pending,
            "assigned_to_me": atr_assigned,
        },
    }


@router.get("/verification-queue")
def verification_queue(
    page:      int     = Query(1, ge=1),
    page_size: int     = Query(20, ge=1, le=100),
    db:        Session = Depends(get_db),
    actor:     User    = Depends(get_current_user),
):
    """SUBMITTED experiments where actor is an assigned reviewer who hasn't signed yet."""
    # Experiments where actor has an unsigned review assignment
    pending_review_exp_ids = (
        db.query(ExperimentReview.experiment_id)
        .filter(
            ExperimentReview.reviewer_id == actor.id,
            ExperimentReview.signed_at.is_(None),
        )
        .subquery()
    )
    q = db.query(Experiment).filter(
        Experiment.id.in_(pending_review_exp_ids),
        Experiment.status == "SUBMITTED",
        Experiment.is_latest_version.is_(True),
    )
    total = q.count()
    items = (
        q.order_by(Experiment.submitted_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": [
        {"id": e.id, "full_code": e.full_code, "title": e.title,
         "status": e.status, "submitted_at": e.submitted_at}
        for e in items
    ]}


@router.get("/approval-queue")
def approval_queue(
    page:      int     = Query(1, ge=1),
    page_size: int     = Query(20, ge=1, le=100),
    db:        Session = Depends(get_db),
    actor:     User    = Depends(get_current_user),
):
    """SUBMITTED experiments where all reviewers have signed APPROVED — ready for HOD/QA to approve."""
    from sqlalchemy import exists, and_, not_
    from app.models.experiment import ExperimentReview

    roles = {actor.role.code}

    # Only HOD/QA can approve (matches EXPERIMENTS_APPROVE default privilege)
    if "QA" not in roles and "HOD" not in roles:
        return {"total": 0, "page": page, "items": []}

    # Experiments that have at least one reviewer AND all reviewers have signed APPROVED
    has_pending = (
        db.query(ExperimentReview.experiment_id)
        .filter(ExperimentReview.signed_at.is_(None))
        .subquery()
    )
    has_rejected = (
        db.query(ExperimentReview.experiment_id)
        .filter(ExperimentReview.decision == "REJECTED")
        .subquery()
    )
    has_any_reviewer = (
        db.query(ExperimentReview.experiment_id)
        .subquery()
    )

    q = db.query(Experiment).filter(
        Experiment.status == "SUBMITTED",
        Experiment.is_latest_version.is_(True),
        Experiment.id.in_(has_any_reviewer),
        Experiment.id.notin_(has_pending),
        Experiment.id.notin_(has_rejected),
    )

    total = q.count()
    items = (
        q.order_by(Experiment.submitted_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": [
        {"id": e.id, "full_code": e.full_code, "title": e.title,
         "status": e.status, "submitted_at": e.submitted_at,
         "submitted_by": e.submitted_by}
        for e in items
    ]}


@router.get("/rework-inbox")
def rework_inbox(
    page:      int     = Query(1, ge=1),
    page_size: int     = Query(20, ge=1, le=100),
    db:        Session = Depends(get_db),
    actor:     User    = Depends(get_current_user),
):
    """FIX-12: Experiments returned to current user for rework."""
    q = db.query(Experiment).filter(
        Experiment.created_by == actor.id,
        Experiment.status == "REWORK",
        Experiment.is_latest_version.is_(True),
    )
    total = q.count()
    items = (
        q.order_by(Experiment.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}


@router.get("/sla-alerts")
def sla_alerts(
    db:    Session = Depends(get_db),
    actor: User    = Depends(get_current_user),
):
    """FIX-12: Experiments past SLA deadlines (thresholds from crd_settings)."""
    crd = get_crd_settings(db)
    now = datetime.now(timezone.utc)

    roles = {actor.role.code}
    if "QA" in roles or "HOD" in roles:
        base_q = db.query(Experiment).filter(Experiment.is_latest_version.is_(True))
    else:
        nb_ids_sq = (
            db.query(NotebookPermission.notebook_id)
            .filter(
                NotebookPermission.user_id == actor.id,
                NotebookPermission.can_view.is_(True),
            )
            .subquery()
        )
        base_q = db.query(Experiment).filter(
            Experiment.notebook_id.in_(nb_ids_sq),
            Experiment.is_latest_version.is_(True),
        )

    # Experiments sitting in DRAFT too long (not yet submitted)
    sla_days = crd.sla_experiments_days or 30
    overdue_draft = base_q.filter(
        Experiment.status == "DRAFT",
        Experiment.created_at < now - timedelta(days=sla_days),
    ).count()

    # Experiments submitted but not yet approved (sitting in review too long)
    delay_sub_days = crd.sla_delayed_submission_days or 7
    delayed_review = base_q.filter(
        Experiment.status == "SUBMITTED",
        Experiment.submitted_at < now - timedelta(days=delay_sub_days),
    ).count()

    # Experiments approved but project still open (optional informational metric)
    delay_app_days = crd.sla_delayed_approval_days or 14
    long_locked = base_q.filter(
        Experiment.status == "LOCKED",
        Experiment.approved_at < now - timedelta(days=delay_app_days),
    ).count()

    return {
        "sla_days_for_submission": sla_days,
        "overdue_draft_experiments": overdue_draft,
        "delayed_review_requests": delayed_review,
        "long_running_locked": long_locked,
    }


@router.get("/my-activity")
def my_activity(
    limit: int     = Query(20, ge=1, le=100),
    db:    Session = Depends(get_db),
    actor: User    = Depends(get_current_user),
):
    """Recent experiment history actions performed by the current user."""
    from app.models.experiment import ExperimentHistory
    rows = (
        db.query(ExperimentHistory)
        .filter(ExperimentHistory.actor_id == actor.id)
        .order_by(ExperimentHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"items": [
        {
            "id":            r.id,
            "experiment_id": r.experiment_id,
            "action":        r.action,
            "action_by":     r.actor_id,
            "action_at":     r.created_at,
        }
        for r in rows
    ]}
