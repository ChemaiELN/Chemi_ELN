"""
Deletes test-created data so that Playwright tests are fully idempotent.
Run automatically via tests/global-setup.js before each Playwright test run.

Deletes (in FK-safe order):
  notebook_permissions → notebooks → sequence_counters (NB:*)
  stages → routes
  milestones → project_users → projects
  user_roles / refresh_tokens / reset_tokens → test users
  test departments

Leaves intact: qa.admin user, RD department, roles, QA dept (code='QA').
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.atr import ATR, ATRAttachment
from app.models.unlock_request import UnlockRequest
from app.models.settings import NotificationSetting, ExcelTemplate
from app.models.experiment import (
    Experiment, ExperimentAttachment, ExperimentComment, ExperimentHistory,
    ExperimentInput, ExperimentParameter, ExperimentTLC,
)
from app.models.notebook import Notebook, NotebookPermission
from app.models.route import Route, Stage
from app.models.project import Project, ProjectUser, Milestone
from app.models.user import User
from app.models.department import Department
from app.models.sequence import SequenceCounter

TEST_USERNAMES  = ['hod.rd', 'tl.rd', 'chem.01', 'chem.02']
TEST_DEPT_CODES = ['ARD', 'QADEPT']
TEST_PROJ_CODES = ['OQ', 'RZX']

db = SessionLocal()
try:
    # --- resolve IDs --------------------------------------------------------
    test_user_ids = [
        u.id for u in db.query(User).filter(User.username.in_(TEST_USERNAMES)).all()
    ]
    test_proj_ids = [
        p.id for p in db.query(Project).filter(Project.code.in_(TEST_PROJ_CODES)).all()
    ]
    test_nb_ids = [
        n.id for n in db.query(Notebook).filter(
            Notebook.project_id.in_(test_proj_ids)
        ).all()
    ] if test_proj_ids else []

    # --- ATR and unlock requests --------------------------------------------
    if test_nb_ids:
        nb_atr_ids = [a.id for a in db.query(ATR).filter(ATR.notebook_id.in_(test_nb_ids)).all()]
        if nb_atr_ids:
            db.query(ATRAttachment).filter(ATRAttachment.atr_id.in_(nb_atr_ids)).delete(synchronize_session=False)
            db.query(ATR).filter(ATR.id.in_(nb_atr_ids)).delete(synchronize_session=False)

    # also clean unlock requests for any experiments in test notebooks
    if test_nb_ids:
        exp_ids_for_unlock = [
            e.id for e in db.query(Experiment).filter(Experiment.notebook_id.in_(test_nb_ids)).all()
        ]
        if exp_ids_for_unlock:
            db.query(UnlockRequest).filter(
                UnlockRequest.experiment_id.in_(exp_ids_for_unlock)
            ).delete(synchronize_session=False)

    # --- experiment sub-resources & history ---------------------------------
    if test_nb_ids:
        exp_ids = [
            e.id for e in db.query(Experiment).filter(
                Experiment.notebook_id.in_(test_nb_ids)
            ).all()
        ]
        if exp_ids:
            # collect ALL versions in these chains
            root_ids = list({e.root_experiment_id or e.id for e in
                             db.query(Experiment).filter(Experiment.id.in_(exp_ids)).all()})
            all_exp_ids = [
                e.id for e in db.query(Experiment).filter(
                    (Experiment.id.in_(root_ids)) |
                    (Experiment.root_experiment_id.in_(root_ids))
                ).all()
            ]
            db.query(ExperimentAttachment).filter(
                ExperimentAttachment.experiment_id.in_(all_exp_ids)
            ).delete(synchronize_session=False)
            db.query(ExperimentComment).filter(
                ExperimentComment.experiment_id.in_(all_exp_ids)
            ).delete(synchronize_session=False)
            db.query(ExperimentHistory).filter(
                ExperimentHistory.experiment_id.in_(root_ids)
            ).delete(synchronize_session=False)
            db.query(ExperimentInput).filter(
                ExperimentInput.experiment_id.in_(all_exp_ids)
            ).delete(synchronize_session=False)
            db.query(ExperimentParameter).filter(
                ExperimentParameter.experiment_id.in_(all_exp_ids)
            ).delete(synchronize_session=False)
            db.query(ExperimentTLC).filter(
                ExperimentTLC.experiment_id.in_(all_exp_ids)
            ).delete(synchronize_session=False)
            db.query(Experiment).filter(
                Experiment.id.in_(all_exp_ids)
            ).delete(synchronize_session=False)

    # --- notebook permissions -----------------------------------------------
    if test_nb_ids:
        db.query(NotebookPermission).filter(
            NotebookPermission.notebook_id.in_(test_nb_ids)
        ).delete(synchronize_session=False)

    # --- notebooks ----------------------------------------------------------
    if test_nb_ids:
        db.query(Notebook).filter(Notebook.id.in_(test_nb_ids)).delete(
            synchronize_session=False
        )

    # --- sequence counters --------------------------------------------------
    from sqlalchemy import or_ as sa_or
    db.query(SequenceCounter).filter(
        sa_or(
            SequenceCounter.scope_key.in_(['EXP', 'ATR']),
            SequenceCounter.scope_key.like('NB:%'),
        )
    ).delete(synchronize_session=False)

    # --- stages & routes ----------------------------------------------------
    if test_proj_ids:
        route_ids = [
            r.id for r in db.query(Route).filter(
                Route.project_id.in_(test_proj_ids)
            ).all()
        ]
        if route_ids:
            db.query(Stage).filter(Stage.route_id.in_(route_ids)).delete(
                synchronize_session=False
            )
        db.query(Route).filter(Route.project_id.in_(test_proj_ids)).delete(
            synchronize_session=False
        )

    # --- milestones & project_users ----------------------------------------
    if test_proj_ids:
        db.query(Milestone).filter(Milestone.project_id.in_(test_proj_ids)).delete(
            synchronize_session=False
        )
        db.query(ProjectUser).filter(ProjectUser.project_id.in_(test_proj_ids)).delete(
            synchronize_session=False
        )

    # --- projects -----------------------------------------------------------
    if test_proj_ids:
        db.query(Project).filter(Project.id.in_(test_proj_ids)).delete(
            synchronize_session=False
        )

    # --- user deps (tokens) ------------------------------------------------
    if test_user_ids:
        from app.models.user import RefreshToken, PasswordResetToken
        db.query(RefreshToken).filter(RefreshToken.user_id.in_(test_user_ids)).delete(
            synchronize_session=False
        )
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id.in_(test_user_ids)
        ).delete(synchronize_session=False)

    # --- test users ---------------------------------------------------------
    if test_user_ids:
        db.query(User).filter(User.id.in_(test_user_ids)).delete(
            synchronize_session=False
        )

    # --- test departments ---------------------------------------------------
    db.query(Department).filter(Department.code.in_(TEST_DEPT_CODES)).delete(
        synchronize_session=False
    )

    # --- notification settings created by tests (key starts with "test_") ---
    db.query(NotificationSetting).filter(
        NotificationSetting.key.like("test_%")
    ).delete(synchronize_session=False)

    # --- excel templates (all are test-created) ------------------------------
    db.query(ExcelTemplate).delete(synchronize_session=False)

    db.commit()

    # --- uploaded test files ---------------------------------------------------
    # Delete the entire uploads directory so file attachment tests start clean.
    import shutil
    uploads_dir = Path(os.path.dirname(__file__)) / "uploads"
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir)

    print("[reset] Test data cleared.")
except Exception as exc:
    db.rollback()
    print(f"[reset] ERROR: {exc}", file=sys.stderr)
    sys.exit(1)
finally:
    db.close()
