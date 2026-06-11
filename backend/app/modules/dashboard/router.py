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
from app.models.experiment import Experiment
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
        nb_ids = [
            p.notebook_id
            for p in db.query(NotebookPermission)
            .filter(
                NotebookPermission.user_id == actor.id,
                NotebookPermission.can_view.is_(True),
            )
            .all()
        ]
        q = db.query(Experiment).filter(
            Experiment.notebook_id.in_(nb_ids),
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
    """FIX-12: Experiments submitted to current user for verification."""
    q = db.query(Experiment).filter(
        Experiment.submitted_to == actor.id,
        Experiment.status == "VERIFICATION REQUESTED",
        Experiment.is_latest_version.is_(True),
    )
    total = q.count()
    items = (
        q.order_by(Experiment.submitted_to_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}


@router.get("/approval-queue")
def approval_queue(
    page:      int     = Query(1, ge=1),
    page_size: int     = Query(20, ge=1, le=100),
    db:        Session = Depends(get_db),
    actor:     User    = Depends(get_current_user),
):
    """FIX-12: Verified experiments where current user has can_approve permission."""
    roles = {actor.role.code}

    if "QA" in roles or "HOD" in roles:
        q = db.query(Experiment).filter(
            Experiment.status == "VERIFIED",
            Experiment.is_latest_version.is_(True),
        )
    else:
        can_approve_nb_ids = [
            p.notebook_id
            for p in db.query(NotebookPermission)
            .filter(
                NotebookPermission.user_id == actor.id,
                NotebookPermission.can_approve.is_(True),
            )
            .all()
        ]
        q = db.query(Experiment).filter(
            Experiment.notebook_id.in_(can_approve_nb_ids),
            Experiment.status == "VERIFIED",
            Experiment.is_latest_version.is_(True),
        )

    total = q.count()
    items = (
        q.order_by(Experiment.verified_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "items": items}


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
        nb_ids = [
            p.notebook_id
            for p in db.query(NotebookPermission)
            .filter(
                NotebookPermission.user_id == actor.id,
                NotebookPermission.can_view.is_(True),
            )
            .all()
        ]
        base_q = db.query(Experiment).filter(
            Experiment.notebook_id.in_(nb_ids),
            Experiment.is_latest_version.is_(True),
        )

    sla_days = crd.sla_experiments_days or 30
    overdue_in_progress = base_q.filter(
        Experiment.status == "INPROGRESS",
        Experiment.created_at < now - timedelta(days=sla_days),
    ).count()

    delay_sub_days = crd.sla_delayed_submission_days or 7
    delayed_verification = base_q.filter(
        Experiment.status == "VERIFICATION REQUESTED",
        Experiment.submitted_to_at < now - timedelta(days=delay_sub_days),
    ).count()

    delay_app_days = crd.sla_delayed_approval_days or 14
    delayed_approval = base_q.filter(
        Experiment.status == "VERIFIED",
        Experiment.verified_at < now - timedelta(days=delay_app_days),
    ).count()

    return {
        "sla_days_for_submission": sla_days,
        "overdue_in_progress": overdue_in_progress,
        "delayed_verification_requests": delayed_verification,
        "delayed_approvals": delayed_approval,
    }


@router.get("/my-activity")
def my_activity(
    limit: int     = Query(20, ge=1, le=100),
    db:    Session = Depends(get_db),
    actor: User    = Depends(get_current_user),
):
    """Recent ExperimentHistory actions by the current user."""
    from app.models.experiment import ExperimentHistory
    recent = (
        db.query(ExperimentHistory)
        .filter(ExperimentHistory.action_by == actor.id)
        .order_by(ExperimentHistory.action_at.desc())
        .limit(limit)
        .all()
    )
    return {"items": recent}
