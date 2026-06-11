"""
Tests for the dashboard endpoint.

Covers:
  M4  — Dashboard queue counts reflect actual DB state
  M5  — Verification-queue, approval-queue, rework-inbox pagination
"""
from __future__ import annotations

import pytest

from tests.conftest import (
    make_crd_settings,
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
)

_PASS = "Dash@1234"


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
    return make_user(db, chemist_role.id, username="dash_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="dash_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="dash_qa", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="DASHP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="DASH-NB001")


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


@pytest.fixture
def _perm(db, notebook, chemist, tl_user, qa_user):
    make_permission(db, notebook.id, chemist.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False)
    make_permission(db, notebook.id, tl_user.id,
                    can_edit=False, can_submit=False, can_verify=True, can_approve=False)
    make_permission(db, notebook.id, qa_user.id,
                    can_edit=False, can_submit=False, can_verify=False, can_approve=True)


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_exp(db, notebook, project, chemist, status="DRAFT"):
    import uuid
    code = f"DASH/{uuid.uuid4().hex[:6].upper()}"
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status=status, code=code)


# ─────────────────────────────────────────────────────────────────────────────
# M4 — /api/dashboard/counts
# ─────────────────────────────────────────────────────────────────────────────

def test_counts_returns_200(client, chemist, _perm, crd):
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/counts", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "experiments" in body
    assert "atr" in body


def test_counts_reflect_draft_experiment(client, db, notebook, project, chemist, _perm, crd):
    _make_exp(db, notebook, project, chemist, status="DRAFT")
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/counts", headers=h)
    body = resp.json()
    by_status = body["experiments"]["by_status"]
    assert by_status.get("DRAFT", 0) >= 1


def test_counts_reflect_submitted_experiment(client, db, notebook, project, chemist, _perm, crd):
    _make_exp(db, notebook, project, chemist, status="SUBMITTED")
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/counts", headers=h)
    body = resp.json()
    by_status = body["experiments"]["by_status"]
    assert by_status.get("SUBMITTED", 0) >= 1


def test_counts_reflect_approved_experiment(client, db, notebook, project, chemist, _perm, crd):
    _make_exp(db, notebook, project, chemist, status="APPROVED")
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/counts", headers=h)
    body = resp.json()
    by_status = body["experiments"]["by_status"]
    assert by_status.get("APPROVED", 0) >= 1


def test_counts_require_auth(client, crd):
    resp = client.get("/api/dashboard/counts")
    assert resp.status_code in (401, 403)


def test_qa_counts_include_all_notebooks(client, db, notebook, project, chemist, qa_user, _perm, crd):
    """QA should see experiments across all notebooks, not just own."""
    _make_exp(db, notebook, project, chemist, status="APPROVED")
    h = _login(client, "dash_qa")
    resp = client.get("/api/dashboard/counts", headers=h)
    body = resp.json()
    assert body["experiments"]["total"] >= 1


def test_multiple_statuses_counted_independently(
    client, db, notebook, project, chemist, _perm, crd
):
    _make_exp(db, notebook, project, chemist, status="DRAFT")
    _make_exp(db, notebook, project, chemist, status="DRAFT")
    _make_exp(db, notebook, project, chemist, status="APPROVED")
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/counts", headers=h)
    body = resp.json()["experiments"]["by_status"]
    assert body.get("DRAFT", 0) >= 2
    assert body.get("APPROVED", 0) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# M5 — Queue endpoints (pagination)
# ─────────────────────────────────────────────────────────────────────────────

def test_verification_queue_accessible(client, tl_user, _perm, crd):
    h = _login(client, "dash_tl")
    resp = client.get("/api/dashboard/verification-queue", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "total" in body
    assert "items" in body


def test_approval_queue_accessible(client, qa_user, _perm, crd):
    h = _login(client, "dash_qa")
    resp = client.get("/api/dashboard/approval-queue", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "total" in body
    assert "items" in body


def test_rework_inbox_accessible(client, chemist, _perm, crd):
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/rework-inbox", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "total" in body
    assert "items" in body


def test_approval_queue_page_size_limit(client, qa_user, _perm, crd):
    """page_size > 100 must be rejected."""
    h = _login(client, "dash_qa")
    resp = client.get("/api/dashboard/approval-queue?page_size=999", headers=h)
    assert resp.status_code == 422


def test_verification_queue_invalid_page_rejected(client, tl_user, _perm, crd):
    h = _login(client, "dash_tl")
    resp = client.get("/api/dashboard/verification-queue?page=0", headers=h)
    assert resp.status_code == 422


def test_sla_alerts_accessible(client, qa_user, _perm, crd):
    h = _login(client, "dash_qa")
    resp = client.get("/api/dashboard/sla-alerts", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "overdue_in_progress" in body
    assert "delayed_verification_requests" in body
    assert "delayed_approvals" in body


def test_my_activity_accessible(client, chemist, _perm, crd):
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/my-activity", headers=h)
    assert resp.status_code == 200
    assert "items" in resp.json()


def test_my_activity_limit_param(client, chemist, _perm, crd):
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/my-activity?limit=5", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 5


def test_my_activity_limit_exceeds_max_rejected(client, chemist, _perm, crd):
    h = _login(client, "dash_chemist")
    resp = client.get("/api/dashboard/my-activity?limit=999", headers=h)
    assert resp.status_code == 422
