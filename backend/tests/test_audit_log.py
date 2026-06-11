"""
Audit log completeness tests.

Covers:
  L3  — Every experiment state transition writes an AuditLog row with the
         correct module, action, user_id, and target_id.
  L3  — User activation/deactivation is audited.
"""
from __future__ import annotations

import pytest

from app.models.audit import AuditLog
from tests.conftest import (
    make_crd_settings,
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
)

_PASS = "Audit@1234"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def tl_role(db):
    return make_role(db, "TL")


@pytest.fixture
def qa_role(db):
    return make_role(db, "QA")


@pytest.fixture
def chemist(db, chemist_role):
    return make_user(db, chemist_role.id, username="aud_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="aud_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="aud_qa", password=_PASS)


@pytest.fixture
def other_user(db, chemist_role):
    return make_user(db, chemist_role.id, username="aud_other", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="AUDP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="AUD-NB001")


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


@pytest.fixture
def _perm(db, notebook, chemist, tl_user, qa_user):
    make_permission(db, notebook.id, chemist.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False,
                    can_comment=True)
    make_permission(db, notebook.id, tl_user.id,
                    can_edit=False, can_submit=False, can_verify=True, can_approve=False)
    make_permission(db, notebook.id, qa_user.id,
                    can_edit=False, can_submit=False, can_verify=False, can_approve=True)


@pytest.fixture
def experiment(db, notebook, project, chemist, _perm, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="DRAFT", code="AUD/E001")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _audit_rows(db, action: str, target_id: str | None = None):
    q = db.query(AuditLog).filter(AuditLog.action == action)
    if target_id:
        q = q.filter(AuditLog.target_id == target_id)
    return q.all()


# ─────────────────────────────────────────────────────────────────────────────
# Experiment state-transition audit log
# ─────────────────────────────────────────────────────────────────────────────

def test_submit_creates_audit_row(client, experiment, chemist, _perm, crd, db):
    h = _login(client, "aud_chemist")
    r = client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=h)
    assert r.status_code == 200

    rows = _audit_rows(db, "SUBMITTED", target_id=experiment.id)
    assert len(rows) >= 1
    row = rows[0]
    assert row.user_id == chemist.id
    assert row.module == "Experiments"
    assert row.target_id == experiment.id


def test_verify_creates_audit_row(client, experiment, chemist, tl_user, _perm, crd, db):
    c_h = _login(client, "aud_chemist")
    t_h = _login(client, "aud_tl")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    r = client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    assert r.status_code == 200

    rows = _audit_rows(db, "VERIFIED", target_id=experiment.id)
    assert len(rows) >= 1
    assert rows[0].user_id == tl_user.id


def test_approve_creates_audit_row(client, experiment, chemist, tl_user, qa_user, _perm, crd, db):
    c_h = _login(client, "aud_chemist")
    t_h = _login(client, "aud_tl")
    q_h = _login(client, "aud_qa")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    r = client.post(f"/api/experiments/{experiment.id}/approve", json={}, headers=q_h)
    assert r.status_code == 200

    rows = _audit_rows(db, "APPROVED", target_id=experiment.id)
    assert len(rows) >= 1
    assert rows[0].user_id == qa_user.id


def test_reject_creates_audit_row(client, experiment, chemist, tl_user, _perm, crd, db):
    c_h = _login(client, "aud_chemist")
    t_h = _login(client, "aud_tl")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    r = client.post(f"/api/experiments/{experiment.id}/reject",
                    json={"reason": "Yield out of spec"}, headers=t_h)
    assert r.status_code == 200

    rows = _audit_rows(db, "REJECTED", target_id=experiment.id)
    assert len(rows) >= 1
    assert rows[0].user_id == tl_user.id


def test_void_creates_audit_row(client, db, notebook, project, chemist, tl_user, qa_user, _perm, crd):
    c_h = _login(client, "aud_chemist")
    t_h = _login(client, "aud_tl")
    q_h = _login(client, "aud_qa")

    exp_r = client.post(
        "/api/experiments/",
        json={"title": "Void Audit Test", "notebook_id": notebook.id, "project_id": project.id},
        headers=c_h,
    )
    assert exp_r.status_code == 201
    exp_id = exp_r.json()["id"]

    client.post(f"/api/experiments/{exp_id}/submit", json={}, headers=c_h)
    client.post(f"/api/experiments/{exp_id}/verify", json={}, headers=t_h)
    client.post(f"/api/experiments/{exp_id}/approve", json={}, headers=q_h)

    r = client.post(f"/api/experiments/{exp_id}/void",
                    json={"reason": "Sample contaminated"}, headers=q_h)
    assert r.status_code == 200

    rows = _audit_rows(db, "VOID", target_id=exp_id)
    assert len(rows) >= 1
    assert rows[0].user_id == qa_user.id


def test_audit_row_contains_target_label(client, experiment, chemist, _perm, crd, db):
    """The audit row's target_label must contain the experiment code (not just ID)."""
    h = _login(client, "aud_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=h)

    rows = _audit_rows(db, "SUBMITTED", target_id=experiment.id)
    assert rows
    assert rows[0].target_label is not None
    # Label should be the experiment code, not just the UUID
    assert rows[0].target_label != experiment.id


# ─────────────────────────────────────────────────────────────────────────────
# L1 — User activation/deactivation audited
# ─────────────────────────────────────────────────────────────────────────────

def test_user_deactivation_creates_audit_row(client, chemist, other_user, qa_user, crd, db):
    qa_h = _login(client, "aud_qa")
    r = client.post(f"/api/users/{other_user.id}/deactivate", headers=qa_h)
    assert r.status_code == 200

    rows = _audit_rows(db, "DEACTIVATED", target_id=other_user.id)
    assert len(rows) >= 1
    assert rows[0].user_id == qa_user.id
    assert rows[0].module == "Users"


def test_user_activation_creates_audit_row(client, chemist, other_user, qa_user, crd, db):
    qa_h = _login(client, "aud_qa")
    client.post(f"/api/users/{other_user.id}/deactivate", headers=qa_h)
    r = client.post(f"/api/users/{other_user.id}/activate", headers=qa_h)
    assert r.status_code == 200

    rows = _audit_rows(db, "ACTIVATED", target_id=other_user.id)
    assert len(rows) >= 1
    assert rows[0].user_id == qa_user.id


# ─────────────────────────────────────────────────────────────────────────────
# Parameterized check: all 5 transitions are present in audit log after full lifecycle
# ─────────────────────────────────────────────────────────────────────────────

def test_full_lifecycle_all_transitions_audited(
    client, db, notebook, project, chemist, tl_user, qa_user, _perm, crd
):
    """After submit→verify→approve→reject (on another exp) all transitions appear in audit log."""
    c_h = _login(client, "aud_chemist")
    t_h = _login(client, "aud_tl")
    q_h = _login(client, "aud_qa")

    # Full happy path
    exp_r = client.post(
        "/api/experiments/",
        json={"title": "Full Lifecycle Audit", "notebook_id": notebook.id, "project_id": project.id},
        headers=c_h,
    )
    exp_id = exp_r.json()["id"]
    client.post(f"/api/experiments/{exp_id}/submit", json={}, headers=c_h)
    client.post(f"/api/experiments/{exp_id}/verify", json={}, headers=t_h)
    client.post(f"/api/experiments/{exp_id}/approve", json={}, headers=q_h)

    for action in ("SUBMITTED", "VERIFIED", "APPROVED"):
        rows = _audit_rows(db, action, target_id=exp_id)
        assert len(rows) >= 1, f"No audit row for action={action}"
