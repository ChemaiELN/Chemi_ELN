"""
Integration tests for the Unlock Request workflow.

Business rules:
  - Only APPROVED experiments can have unlock requests raised.
  - Only one PENDING unlock request can exist per experiment at a time.
  - QA approves or rejects an unlock request.
  - When QA approves: experiment status → UNLOCKED.
  - When QA rejects: experiment status stays APPROVED.
  - Non-QA users cannot approve or reject unlock requests.
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

_PASS = "Unlock@1"


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
    return make_user(db, chemist_role.id, username="unl_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="unl_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="unl_qa", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="UNLP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="UNL-NB001")


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


@pytest.fixture
def approved_experiment(db, notebook, project, chemist, _perm, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="APPROVED", code="UNL/E001")


@pytest.fixture
def draft_experiment(db, notebook, project, chemist, _perm, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="DRAFT", code="UNL/E002")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _raise_unlock(client, headers: dict, experiment_id: str,
                  reason: str = "Protocol revision required") -> dict:
    resp = client.post(
        "/api/unlock-requests/",
        json={"experiment_id": experiment_id, "reason": reason},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# CREATE unlock request
# ─────────────────────────────────────────────────────────────────────────────

def test_chemist_can_raise_unlock_for_approved_experiment(
    client, approved_experiment, chemist
):
    headers = _login(client, "unl_chemist")
    resp = client.post(
        "/api/unlock-requests/",
        json={
            "experiment_id": approved_experiment.id,
            "reason": "Correction to yield calculation required",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "PENDING"
    assert body["experiment_id"] == approved_experiment.id


def test_cannot_raise_unlock_for_draft_experiment(client, draft_experiment, chemist):
    headers = _login(client, "unl_chemist")
    resp = client.post(
        "/api/unlock-requests/",
        json={"experiment_id": draft_experiment.id, "reason": "Wrong status"},
        headers=headers,
    )
    assert resp.status_code in (400, 422)


def test_cannot_raise_duplicate_pending_unlock(client, approved_experiment, chemist):
    """Two PENDING unlock requests for the same experiment must be blocked."""
    headers = _login(client, "unl_chemist")
    # First request
    client.post(
        "/api/unlock-requests/",
        json={"experiment_id": approved_experiment.id, "reason": "First request"},
        headers=headers,
    )
    # Second request — must fail
    resp = client.post(
        "/api/unlock-requests/",
        json={"experiment_id": approved_experiment.id, "reason": "Duplicate"},
        headers=headers,
    )
    assert resp.status_code in (400, 409, 422)


def test_cannot_raise_unlock_for_nonexistent_experiment(client, chemist):
    headers = _login(client, "unl_chemist")
    resp = client.post(
        "/api/unlock-requests/",
        json={
            "experiment_id": "00000000-0000-0000-0000-000000000000",
            "reason": "No such experiment",
        },
        headers=headers,
    )
    assert resp.status_code == 404


def test_raise_unlock_requires_auth(client, approved_experiment):
    resp = client.post(
        "/api/unlock-requests/",
        json={"experiment_id": approved_experiment.id, "reason": "Unauthorized"},
    )
    assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# READ / LIST unlock requests
# ─────────────────────────────────────────────────────────────────────────────

def test_chemist_can_list_own_unlock_requests(client, approved_experiment, chemist):
    headers = _login(client, "unl_chemist")
    _raise_unlock(client, headers, approved_experiment.id)
    resp = client.get("/api/unlock-requests/", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_qa_can_list_all_unlock_requests(client, approved_experiment, chemist, qa_user):
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")
    _raise_unlock(client, c_h, approved_experiment.id)
    resp = client.get("/api/unlock-requests/", headers=qa_h)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_get_unlock_request_by_id(client, approved_experiment, chemist):
    headers = _login(client, "unl_chemist")
    created = _raise_unlock(client, headers, approved_experiment.id)
    resp = client.get(f"/api/unlock-requests/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_nonexistent_unlock_request(client, chemist):
    headers = _login(client, "unl_chemist")
    resp = client.get("/api/unlock-requests/00000000-0000-0000-0000-000000000000",
                      headers=headers)
    assert resp.status_code == 404


def test_list_unlock_requests_filter_by_status(client, approved_experiment, chemist):
    headers = _login(client, "unl_chemist")
    _raise_unlock(client, headers, approved_experiment.id)
    resp = client.get("/api/unlock-requests/?status=PENDING", headers=headers)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "PENDING"


# ─────────────────────────────────────────────────────────────────────────────
# APPROVE unlock request
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_approve_unlock_request(client, approved_experiment, chemist, qa_user, db):
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")

    req = _raise_unlock(client, c_h, approved_experiment.id)

    resp = client.post(
        f"/api/unlock-requests/{req['id']}/approve",
        json={"review_note": "Approved — revision is justified"},
        headers=qa_h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "APPROVED"


def test_qa_approve_unlocks_experiment(client, approved_experiment, chemist, qa_user, db):
    """After approval, the experiment's status must change to UNLOCKED."""
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")

    req = _raise_unlock(client, c_h, approved_experiment.id)
    client.post(
        f"/api/unlock-requests/{req['id']}/approve",
        json={"review_note": "Unlock approved"},
        headers=qa_h,
    )

    # Check experiment status via API
    exp_resp = client.get(f"/api/experiments/{approved_experiment.id}", headers=qa_h)
    assert exp_resp.status_code == 200
    assert exp_resp.json()["status"] == "UNLOCKED"


def test_non_qa_cannot_approve_unlock(client, approved_experiment, chemist, tl_user):
    c_h = _login(client, "unl_chemist")
    t_h = _login(client, "unl_tl")
    req = _raise_unlock(client, c_h, approved_experiment.id)

    resp = client.post(
        f"/api/unlock-requests/{req['id']}/approve",
        json={"review_note": "TL attempt"},
        headers=t_h,
    )
    assert resp.status_code in (403, 422)


def test_chemist_cannot_approve_own_unlock(client, approved_experiment, chemist):
    headers = _login(client, "unl_chemist")
    req = _raise_unlock(client, headers, approved_experiment.id)

    resp = client.post(
        f"/api/unlock-requests/{req['id']}/approve",
        json={"review_note": "Self-approval attempt"},
        headers=headers,
    )
    assert resp.status_code in (403, 422)


def test_cannot_approve_already_reviewed_request(
    client, approved_experiment, chemist, qa_user
):
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")
    req = _raise_unlock(client, c_h, approved_experiment.id)

    # First approval
    client.post(f"/api/unlock-requests/{req['id']}/approve",
                json={"review_note": "First"}, headers=qa_h)

    # Second approval attempt — must fail
    resp = client.post(
        f"/api/unlock-requests/{req['id']}/approve",
        json={"review_note": "Duplicate"},
        headers=qa_h,
    )
    assert resp.status_code in (400, 409, 422)


# ─────────────────────────────────────────────────────────────────────────────
# REJECT unlock request
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_reject_unlock_request(client, approved_experiment, chemist, qa_user):
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")
    req  = _raise_unlock(client, c_h, approved_experiment.id)

    resp = client.post(
        f"/api/unlock-requests/{req['id']}/reject",
        json={"review_note": "Insufficient justification provided"},
        headers=qa_h,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "REJECTED"


def test_reject_does_not_change_experiment_status(
    client, approved_experiment, chemist, qa_user
):
    """After QA rejects, experiment must remain in APPROVED status."""
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")
    req  = _raise_unlock(client, c_h, approved_experiment.id)

    client.post(
        f"/api/unlock-requests/{req['id']}/reject",
        json={"review_note": "Not justified"},
        headers=qa_h,
    )

    exp_resp = client.get(f"/api/experiments/{approved_experiment.id}", headers=qa_h)
    assert exp_resp.status_code == 200
    assert exp_resp.json()["status"] == "APPROVED"


def test_non_qa_cannot_reject_unlock(client, approved_experiment, chemist):
    c_h = _login(client, "unl_chemist")
    req = _raise_unlock(client, c_h, approved_experiment.id)

    resp = client.post(
        f"/api/unlock-requests/{req['id']}/reject",
        json={"review_note": "Chemist reject attempt"},
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


def test_cannot_reject_already_reviewed_request(
    client, approved_experiment, chemist, qa_user
):
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")
    req  = _raise_unlock(client, c_h, approved_experiment.id)

    client.post(f"/api/unlock-requests/{req['id']}/reject",
                json={"review_note": "Rejected"}, headers=qa_h)

    resp = client.post(
        f"/api/unlock-requests/{req['id']}/reject",
        json={"review_note": "Double reject"},
        headers=qa_h,
    )
    assert resp.status_code in (400, 409, 422)


# ─────────────────────────────────────────────────────────────────────────────
# FULL LIFECYCLE
# ─────────────────────────────────────────────────────────────────────────────

def test_full_unlock_lifecycle(client, approved_experiment, chemist, qa_user):
    """
    Complete unlock cycle:
    1. Chemist raises unlock request (PENDING)
    2. QA approves (APPROVED) → experiment becomes UNLOCKED
    3. Raising another request on the now-UNLOCKED experiment should fail
       (it's no longer in APPROVED status)
    """
    c_h  = _login(client, "unl_chemist")
    qa_h = _login(client, "unl_qa")

    # 1. Raise
    req = _raise_unlock(client, c_h, approved_experiment.id)
    assert req["status"] == "PENDING"

    # 2. Approve
    approve_resp = client.post(
        f"/api/unlock-requests/{req['id']}/approve",
        json={"review_note": "Approved after review"},
        headers=qa_h,
    )
    assert approve_resp.json()["status"] == "APPROVED"

    # 3. Verify experiment is now UNLOCKED
    exp = client.get(f"/api/experiments/{approved_experiment.id}", headers=qa_h).json()
    assert exp["status"] == "UNLOCKED"

    # 4. Trying to raise another unlock for a non-APPROVED experiment must fail
    resp = client.post(
        "/api/unlock-requests/",
        json={
            "experiment_id": approved_experiment.id,
            "reason": "Second attempt on unlocked exp",
        },
        headers=c_h,
    )
    assert resp.status_code in (400, 422)
