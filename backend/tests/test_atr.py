"""
Integration tests for the ATR (Analytical Test Request) workflow.

State machine under test:
  NEW → SUBMITTED → VERIFIED (assigned) → COMPLETED
                 └─ CANCELLED (from any non-COMPLETED status)

Role rules:
  - Any authenticated user can create an ATR.
  - Only the raiser OR QA/TL can submit, update, cancel, attach files.
  - Only QA/TL can assign (SUBMITTED → VERIFIED).
  - Only the assigned analyst OR QA/TL can complete (VERIFIED → COMPLETED).
  - Completed ATRs cannot be cancelled.
"""
from __future__ import annotations

import pytest

from tests.conftest import (
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
    make_crd_settings,
)

_PASS = "ATR@Test1"


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
    return make_user(db, chemist_role.id, username="atr_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="atr_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="atr_qa", password=_PASS)


@pytest.fixture
def analyst(db, chemist_role):
    return make_user(db, chemist_role.id, username="atr_analyst", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="ATRP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="ATR-NB001")


@pytest.fixture
def experiment(db, notebook, project, chemist):
    make_crd_settings(db)
    make_permission(db, notebook.id, chemist.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False)
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="APPROVED", code="ATR/E001")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _create_atr(client, headers: dict, experiment_id: str, test_type: str = "Chemical") -> dict:
    resp = client.post(
        "/api/atr/",
        json={
            "experiment_id": experiment_id,
            "test_type": test_type,
            "objectives": "Test purity of sample batch",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

def test_create_atr_success(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    resp = client.post(
        "/api/atr/",
        json={
            "experiment_id": experiment.id,
            "test_type": "HPLC",
            "objectives": "Verify compound purity",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "NEW"
    assert body["test_type"] == "HPLC"
    assert body["atr_no"].startswith("ATR")


def test_create_atr_invalid_experiment(client, chemist):
    headers = _login(client, "atr_chemist")
    resp = client.post(
        "/api/atr/",
        json={"experiment_id": "00000000-0000-0000-0000-000000000000",
              "test_type": "HPLC"},
        headers=headers,
    )
    # 404 if schema validation passes and the DB lookup fails;
    # 422 if Pydantic rejects the body first (acceptable either way)
    assert resp.status_code in (404, 422)


def test_create_atr_requires_auth(client, experiment):
    resp = client.post(
        "/api/atr/",
        json={"experiment_id": experiment.id, "test_type": "HPLC"},
    )
    assert resp.status_code in (401, 403)


def test_create_atr_without_experiment(client, project, notebook, chemist):
    """ATR can also be raised without an experiment (standalone)."""
    headers = _login(client, "atr_chemist")
    resp = client.post(
        "/api/atr/",
        json={
            "test_type": "Microbiological",
            "notebook_id": notebook.id,
            "project_id": project.id,
            "objectives": "Sterility check",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "NEW"


# ─────────────────────────────────────────────────────────────────────────────
# READ / LIST
# ─────────────────────────────────────────────────────────────────────────────

def test_list_atr_returns_own_atrs_for_chemist(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    _create_atr(client, headers, experiment.id)
    resp = client.get("/api/atr/", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1


def test_list_atr_qa_sees_all(client, experiment, chemist, qa_user):
    chemist_h = _login(client, "atr_chemist")
    _create_atr(client, chemist_h, experiment.id)

    qa_h = _login(client, "atr_qa")
    resp = client.get("/api/atr/", headers=qa_h)
    assert resp.status_code == 200
    # QA should see all ATRs (no owner filter)
    assert resp.json()["total"] >= 1


def test_get_atr_by_id(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    resp = client.get(f"/api/atr/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_nonexistent_atr(client, chemist):
    headers = _login(client, "atr_chemist")
    resp = client.get("/api/atr/00000000-0000-0000-0000-000000000000", headers=headers)
    assert resp.status_code == 404


def test_list_atr_filter_by_status(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    _create_atr(client, headers, experiment.id)
    resp = client.get("/api/atr/?status=NEW", headers=headers)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "NEW"


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

def test_update_atr_in_new_status(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    resp = client.patch(
        f"/api/atr/{created['id']}",
        json={"objectives": "Updated objectives for clarification"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["objectives"] == "Updated objectives for clarification"


def test_update_atr_after_submit_rejected(client, experiment, chemist, tl_user):
    c_h = _login(client, "atr_chemist")
    created = _create_atr(client, c_h, experiment.id)
    # Submit it
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)
    # Attempt to update after submission
    resp = client.patch(
        f"/api/atr/{created['id']}",
        json={"objectives": "Should fail"},
        headers=c_h,
    )
    assert resp.status_code in (400, 403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# SUBMIT (NEW → SUBMITTED)
# ─────────────────────────────────────────────────────────────────────────────

def test_raiser_can_submit_own_atr(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    resp = client.post(f"/api/atr/{created['id']}/submit", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUBMITTED"


def test_tl_can_submit_others_atr(client, experiment, chemist, tl_user):
    c_h = _login(client, "atr_chemist")
    tl_h = _login(client, "atr_tl")
    created = _create_atr(client, c_h, experiment.id)
    resp = client.post(f"/api/atr/{created['id']}/submit", headers=tl_h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUBMITTED"


def test_submit_already_submitted_fails(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=headers)
    resp = client.post(f"/api/atr/{created['id']}/submit", headers=headers)
    assert resp.status_code in (400, 409, 422)


# ─────────────────────────────────────────────────────────────────────────────
# ASSIGN / VERIFY (SUBMITTED → VERIFIED)
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_assign_atr(client, experiment, chemist, qa_user, analyst):
    c_h = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)

    resp = client.post(
        f"/api/atr/{created['id']}/assign",
        json={"assigned_to": analyst.id},
        headers=qa_h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "VERIFIED"
    assert body["assigned_to"] == analyst.id


def test_tl_can_assign_atr(client, experiment, chemist, tl_user, analyst):
    c_h = _login(client, "atr_chemist")
    tl_h = _login(client, "atr_tl")
    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)

    resp = client.post(
        f"/api/atr/{created['id']}/assign",
        json={"assigned_to": analyst.id},
        headers=tl_h,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "VERIFIED"


def test_chemist_cannot_assign_atr(client, experiment, chemist, analyst):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=headers)

    resp = client.post(
        f"/api/atr/{created['id']}/assign",
        json={"assigned_to": analyst.id},
        headers=headers,
    )
    assert resp.status_code in (403, 422)


def test_assign_to_nonexistent_user(client, experiment, chemist, qa_user):
    c_h = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)

    resp = client.post(
        f"/api/atr/{created['id']}/assign",
        json={"assigned_to": "00000000-0000-0000-0000-000000000000"},
        headers=qa_h,
    )
    assert resp.status_code == 404


def test_assign_atr_not_submitted_fails(client, experiment, chemist, qa_user, analyst):
    """Can only assign an ATR in SUBMITTED status."""
    c_h = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    created = _create_atr(client, c_h, experiment.id)
    # Not submitted yet
    resp = client.post(
        f"/api/atr/{created['id']}/assign",
        json={"assigned_to": analyst.id},
        headers=qa_h,
    )
    assert resp.status_code in (400, 422)


# ─────────────────────────────────────────────────────────────────────────────
# COMPLETE (VERIFIED → COMPLETED)
# ─────────────────────────────────────────────────────────────────────────────

def test_analyst_can_complete_assigned_atr(client, experiment, chemist, qa_user, analyst):
    c_h  = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    an_h = _login(client, "atr_analyst")

    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)
    client.post(f"/api/atr/{created['id']}/assign",
                json={"assigned_to": analyst.id}, headers=qa_h)

    resp = client.post(
        f"/api/atr/{created['id']}/complete",
        json={"result": "PASS", "result_observations": "All parameters within spec."},
        headers=an_h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "COMPLETED"
    assert body["result"] == "PASS"


def test_non_analyst_cannot_complete_atr(client, experiment, chemist, qa_user, analyst):
    """A different chemist cannot complete an ATR they are not assigned to."""
    c_h  = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")

    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)
    client.post(f"/api/atr/{created['id']}/assign",
                json={"assigned_to": analyst.id}, headers=qa_h)

    resp = client.post(
        f"/api/atr/{created['id']}/complete",
        json={"result": "FAIL"},
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


def test_qa_can_complete_any_atr(client, experiment, chemist, qa_user, analyst):
    """QA can override and complete any ATR."""
    c_h  = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")

    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)
    client.post(f"/api/atr/{created['id']}/assign",
                json={"assigned_to": analyst.id}, headers=qa_h)

    resp = client.post(
        f"/api/atr/{created['id']}/complete",
        json={"result": "PASS", "result_observations": "QA override completion"},
        headers=qa_h,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "COMPLETED"


def test_complete_atr_in_new_status_fails(client, experiment, chemist, qa_user, analyst):
    c_h  = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    created = _create_atr(client, c_h, experiment.id)

    resp = client.post(
        f"/api/atr/{created['id']}/complete",
        json={"result": "PASS"},
        headers=qa_h,
    )
    assert resp.status_code in (400, 422)


# ─────────────────────────────────────────────────────────────────────────────
# CANCEL
# ─────────────────────────────────────────────────────────────────────────────

def test_raiser_can_cancel_new_atr(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    resp = client.post(f"/api/atr/{created['id']}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


def test_cancel_completed_atr_fails(client, experiment, chemist, qa_user, analyst):
    c_h  = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    an_h = _login(client, "atr_analyst")

    created = _create_atr(client, c_h, experiment.id)
    client.post(f"/api/atr/{created['id']}/submit", headers=c_h)
    client.post(f"/api/atr/{created['id']}/assign",
                json={"assigned_to": analyst.id}, headers=qa_h)
    client.post(f"/api/atr/{created['id']}/complete",
                json={"result": "PASS"}, headers=an_h)

    resp = client.post(f"/api/atr/{created['id']}/cancel", headers=qa_h)
    assert resp.status_code in (400, 422)


def test_cancel_already_cancelled_atr_fails(client, experiment, chemist):
    headers = _login(client, "atr_chemist")
    created = _create_atr(client, headers, experiment.id)
    client.post(f"/api/atr/{created['id']}/cancel", headers=headers)
    resp = client.post(f"/api/atr/{created['id']}/cancel", headers=headers)
    assert resp.status_code in (400, 422)


def test_unrelated_chemist_cannot_cancel_others_atr(
    client, db, experiment, chemist, qa_user, chemist_role
):
    """A chemist who didn't raise the ATR cannot cancel it."""
    other = make_user(db, chemist_role.id, username="atr_other", password=_PASS)
    c_h = _login(client, "atr_chemist")
    other_h = _login(client, "atr_other")

    created = _create_atr(client, c_h, experiment.id)
    resp = client.post(f"/api/atr/{created['id']}/cancel", headers=other_h)
    assert resp.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# FULL LIFECYCLE — NEW → SUBMITTED → VERIFIED → COMPLETED
# ─────────────────────────────────────────────────────────────────────────────

def test_full_atr_lifecycle(client, experiment, chemist, qa_user, analyst):
    c_h  = _login(client, "atr_chemist")
    qa_h = _login(client, "atr_qa")
    an_h = _login(client, "atr_analyst")

    # 1. Create
    atr = _create_atr(client, c_h, experiment.id, "HPLC Purity")
    assert atr["status"] == "NEW"

    # 2. Submit
    resp = client.post(f"/api/atr/{atr['id']}/submit", headers=c_h)
    assert resp.json()["status"] == "SUBMITTED"

    # 3. Assign
    resp = client.post(
        f"/api/atr/{atr['id']}/assign",
        json={"assigned_to": analyst.id},
        headers=qa_h,
    )
    assert resp.json()["status"] == "VERIFIED"
    assert resp.json()["assigned_to"] == analyst.id

    # 4. Complete
    resp = client.post(
        f"/api/atr/{atr['id']}/complete",
        json={"result": "PASS", "result_observations": "Sample passes all purity criteria."},
        headers=an_h,
    )
    assert resp.json()["status"] == "COMPLETED"
    assert resp.json()["result"] == "PASS"
    assert resp.json()["completed_by"] == analyst.id
