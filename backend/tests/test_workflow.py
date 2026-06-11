"""
Integration tests for the experiment workflow state machine.

State transitions tested:
  DRAFT → SUBMITTED → VERIFIED → APPROVED
  SUBMITTED → REJECTED → (new DRAFT via revise)
  APPROVED → VOID (QA only)

E-signature is disabled (reauth_* = False) for most tests to keep them
focused on state logic.  A separate block tests that the e-signature gate
blocks submission when reauth_submit is True.

Setup per test:
  - One CHEMIST user (creator / submitter)
  - One TL user     (verifier)
  - One QA user     (approver / void)
  - A project, notebook, and per-user notebook permissions
  - A CRD settings row with all reauth flags OFF by default
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

_PASS = "Workflow@1"


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
    return make_user(db, chemist_role.id, username="wf_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="wf_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="wf_qa", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="WFP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="WF-NB001")


@pytest.fixture
def _permissions(db, notebook, chemist, tl_user, qa_user):
    make_permission(db, notebook.id, chemist.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False)
    make_permission(db, notebook.id, tl_user.id,
                    can_edit=False, can_submit=False, can_verify=True, can_approve=False)
    make_permission(db, notebook.id, qa_user.id,
                    can_edit=False, can_submit=False, can_verify=False, can_approve=True)


@pytest.fixture
def crd(db):
    return make_crd_settings(db, reauth_submit=False, reauth_verification=False,
                              reauth_approval=False, reauth_void=False)


@pytest.fixture
def experiment(db, notebook, project, chemist, _permissions, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id, code="WF/E001")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ─────────────────────────────────────────────────────────────────────────────
# DRAFT → SUBMITTED
# ─────────────────────────────────────────────────────────────────────────────

def test_chemist_can_submit_draft(client, experiment, chemist):
    headers = _login(client, "wf_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/submit",
        json={},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "SUBMITTED"


def test_cannot_submit_already_submitted(client, experiment, chemist):
    """Submitting a non-DRAFT experiment must fail."""
    headers = _login(client, "wf_chemist")
    # First submission
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=headers)
    # Second submission attempt
    resp = client.post(
        f"/api/experiments/{experiment.id}/submit",
        json={},
        headers=headers,
    )
    assert resp.status_code in (400, 409, 422)


# ─────────────────────────────────────────────────────────────────────────────
# SUBMITTED → VERIFIED
# ─────────────────────────────────────────────────────────────────────────────

def test_tl_can_verify_submitted(client, experiment, chemist, tl_user):
    chemist_h = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=chemist_h)

    tl_h = _login(client, "wf_tl")
    resp = client.post(
        f"/api/experiments/{experiment.id}/verify",
        json={},
        headers=tl_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "VERIFIED"


def test_chemist_cannot_verify(client, experiment, chemist):
    headers = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=headers)
    # Chemist has no can_verify permission
    resp = client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=headers)
    assert resp.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# VERIFIED → APPROVED
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_approve_verified(client, experiment, chemist, tl_user, qa_user):
    c_h = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)

    t_h = _login(client, "wf_tl")
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)

    q_h = _login(client, "wf_qa")
    resp = client.post(
        f"/api/experiments/{experiment.id}/approve",
        json={},
        headers=q_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "APPROVED"


# ─────────────────────────────────────────────────────────────────────────────
# Reject cycle
# ─────────────────────────────────────────────────────────────────────────────

def test_tl_can_reject_submitted(client, experiment, chemist, tl_user):
    c_h = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)

    t_h = _login(client, "wf_tl")
    resp = client.post(
        f"/api/experiments/{experiment.id}/reject",
        json={"reason": "Missing observations section"},
        headers=t_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "REJECTED"


def test_qa_can_reject_verified(client, experiment, chemist, tl_user, qa_user):
    c_h = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)

    t_h = _login(client, "wf_tl")
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)

    q_h = _login(client, "wf_qa")
    resp = client.post(
        f"/api/experiments/{experiment.id}/reject",
        json={"reason": "QA comments not addressed"},
        headers=q_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "REJECTED"


# ─────────────────────────────────────────────────────────────────────────────
# Void — QA only
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_void_approved(client, experiment, chemist, tl_user, qa_user, db):
    # Promote to APPROVED
    c_h = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    t_h = _login(client, "wf_tl")
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    q_h = _login(client, "wf_qa")
    client.post(f"/api/experiments/{experiment.id}/approve", json={}, headers=q_h)

    resp = client.post(
        f"/api/experiments/{experiment.id}/void",
        json={"reason": "Retracted due to equipment fault"},
        headers=q_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "VOID"


def test_chemist_cannot_void(client, experiment, chemist, tl_user, qa_user):
    """Only QA may void an experiment."""
    c_h = _login(client, "wf_chemist")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    t_h = _login(client, "wf_tl")
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    q_h = _login(client, "wf_qa")
    client.post(f"/api/experiments/{experiment.id}/approve", json={}, headers=q_h)

    # Chemist attempts void
    resp = client.post(
        f"/api/experiments/{experiment.id}/void",
        json={"reason": "test"},
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# E-signature gate
# ─────────────────────────────────────────────────────────────────────────────

def test_submit_blocked_without_password_when_reauth_on(client, db, experiment, chemist):
    """When reauth_submit=True, submitting without a password must be rejected."""
    make_crd_settings(db, reauth_submit=True)
    headers = _login(client, "wf_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/submit",
        json={},          # no password field
        headers=headers,
    )
    assert resp.status_code in (400, 403, 422)


def test_submit_passes_with_password_when_reauth_on(client, db, experiment, chemist):
    """Correct password satisfies e-signature when reauth_submit=True."""
    make_crd_settings(db, reauth_submit=True)
    headers = _login(client, "wf_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/submit",
        json={"password": _PASS},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "SUBMITTED"
