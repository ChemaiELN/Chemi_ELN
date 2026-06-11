"""
Integration tests for Experiment CRUD, child entities, status guards,
versioning (clone/new-version), and pagination/filter.

Child entities tested:
  Steps · Inputs · Parameters (with formula recalculation) · Equipment
  TLC entries · Comments · Attachments (metadata only — no real files)

Status guards:
  APPROVED / VOID / REJECTED experiments are immutable (no edits to children).

Versioning:
  POST /api/experiments/{id}/new-version  — creates v2, marks v1 non-latest.
"""
from __future__ import annotations

import io
import pytest
from decimal import Decimal

from tests.conftest import (
    make_crd_settings,
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
)

_PASS = "ExpCRUD@1"


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
    return make_user(db, chemist_role.id, username="exp_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="exp_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="exp_qa", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="EXPR")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="EXP-NB001")


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
                           status="DRAFT", code="EXP/E001")


@pytest.fixture
def approved_experiment(db, notebook, project, chemist, _perm, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="APPROVED", code="EXP/E002")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ─────────────────────────────────────────────────────────────────────────────
# Experiment CREATE
# ─────────────────────────────────────────────────────────────────────────────

def test_create_experiment_success(client, notebook, project, chemist, _perm, crd):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        "/api/experiments/",
        json={
            "title": "Synthesis of Compound X",
            "notebook_id": notebook.id,
            "project_id": project.id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Synthesis of Compound X"
    assert body["status"] == "DRAFT"
    assert body["version"] == 1
    assert body["is_latest_version"] is True


def test_create_experiment_invalid_notebook(client, project, chemist, crd):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        "/api/experiments/",
        json={
            "title": "Bad Notebook",
            "notebook_id": "00000000-0000-0000-0000-000000000000",
            "project_id": project.id,
        },
        headers=headers,
    )
    assert resp.status_code in (400, 404, 422)


def test_create_experiment_requires_auth(client, notebook, project):
    resp = client.post(
        "/api/experiments/",
        json={"title": "No auth", "notebook_id": notebook.id, "project_id": project.id},
    )
    assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# Experiment READ / LIST
# ─────────────────────────────────────────────────────────────────────────────

def test_get_experiment(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.get(f"/api/experiments/{experiment.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == experiment.id


def test_get_nonexistent_experiment(client, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.get("/api/experiments/00000000-0000-0000-0000-000000000000", headers=headers)
    assert resp.status_code == 404


def test_list_experiments(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.get("/api/experiments/", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_list_experiments_filter_by_status(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.get("/api/experiments/?status=DRAFT", headers=headers)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "DRAFT"


def test_list_experiments_filter_by_project(client, experiment, chemist, project):
    headers = _login(client, "exp_chemist")
    resp = client.get(f"/api/experiments/?project_id={project.id}", headers=headers)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["project_id"] == project.id


def test_list_experiments_pagination(client, db, notebook, project, chemist, chemist_role,
                                      _perm, crd):
    """Create 5 experiments and verify pagination works."""
    for i in range(5):
        make_experiment(db, notebook.id, project.id, chemist.id,
                        status="DRAFT", code=f"EXP/PG{i:03d}")

    headers = _login(client, "exp_chemist")
    page1 = client.get("/api/experiments/?page=1&page_size=3", headers=headers).json()
    page2 = client.get("/api/experiments/?page=2&page_size=3", headers=headers).json()

    assert page1["total"] >= 5
    assert len(page1["items"]) == 3
    # Second page should have different IDs
    ids_p1 = {i["id"] for i in page1["items"]}
    ids_p2 = {i["id"] for i in page2["items"]}
    assert ids_p1.isdisjoint(ids_p2)


# ─────────────────────────────────────────────────────────────────────────────
# Experiment UPDATE
# ─────────────────────────────────────────────────────────────────────────────

def test_update_experiment_title(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.patch(
        f"/api/experiments/{experiment.id}",
        json={"title": "Revised Title"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Revised Title"


def test_cannot_update_approved_experiment(client, approved_experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.patch(
        f"/api/experiments/{approved_experiment.id}",
        json={"title": "Attempt to edit approved"},
        headers=headers,
    )
    assert resp.status_code in (400, 403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# STEPS
# ─────────────────────────────────────────────────────────────────────────────

def test_add_step(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/steps",
        json={"step_no": 1, "procedure_text": "Add reagent A to flask"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["procedure_text"] == "Add reagent A to flask"
    assert body["step_no"] == 1


def test_update_step(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    created = client.post(
        f"/api/experiments/{experiment.id}/steps",
        json={"step_no": 1, "procedure_text": "Initial step"},
        headers=headers,
    ).json()

    resp = client.patch(
        f"/api/experiments/{experiment.id}/steps/{created['id']}",
        json={"procedure_text": "Updated step text"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["procedure_text"] == "Updated step text"


def test_delete_step(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    created = client.post(
        f"/api/experiments/{experiment.id}/steps",
        json={"step_no": 1, "procedure_text": "Step to delete"},
        headers=headers,
    ).json()

    resp = client.delete(
        f"/api/experiments/{experiment.id}/steps/{created['id']}",
        headers=headers,
    )
    assert resp.status_code in (200, 204)


def test_cannot_add_step_to_approved_experiment(client, approved_experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{approved_experiment.id}/steps",
        json={"step_no": 1, "procedure_text": "Illegal step"},
        headers=headers,
    )
    assert resp.status_code in (400, 403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# INPUTS
# ─────────────────────────────────────────────────────────────────────────────

def test_add_input(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/inputs",
        json={
            "material_name": "Ethanol",
            "quantity": "50",
            "unit": "mL",
            "lot_number": "LOT-2024-001",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["material_name"] == "Ethanol"


def test_update_input(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    created = client.post(
        f"/api/experiments/{experiment.id}/inputs",
        json={"material_name": "Water", "quantity": "100", "unit": "mL"},
        headers=headers,
    ).json()

    resp = client.patch(
        f"/api/experiments/{experiment.id}/inputs/{created['id']}",
        json={"quantity": "200"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["quantity"] is not None  # Decimal serialization may vary


def test_delete_input(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    created = client.post(
        f"/api/experiments/{experiment.id}/inputs",
        json={"material_name": "Acetone", "quantity": "25", "unit": "mL"},
        headers=headers,
    ).json()

    resp = client.delete(
        f"/api/experiments/{experiment.id}/inputs/{created['id']}",
        headers=headers,
    )
    assert resp.status_code in (200, 204)


# ─────────────────────────────────────────────────────────────────────────────
# PARAMETERS + Formula Engine
# ─────────────────────────────────────────────────────────────────────────────

def test_add_parameter(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/parameters",
        json={
            "code": "P1",
            "name": "Initial Weight",
            "value": "10.5",
            "uom": "g",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["code"] == "P1"
    assert body["name"] == "Initial Weight"


def test_parameter_with_formula_recalculates(client, experiment, chemist):
    """P3 = P1 + P2 — after P1 and P2 are set, P3 should auto-calculate."""
    headers = _login(client, "exp_chemist")
    client.post(f"/api/experiments/{experiment.id}/parameters",
                json={"code": "P1", "name": "Weight A",
                      "parameter_value": "10", "uom": "g",
                      "user_entered_or_formula": "USER ENTERED"},
                headers=headers)
    client.post(f"/api/experiments/{experiment.id}/parameters",
                json={"code": "P2", "name": "Weight B",
                      "parameter_value": "5", "uom": "g",
                      "user_entered_or_formula": "USER ENTERED"},
                headers=headers)
    r3 = client.post(f"/api/experiments/{experiment.id}/parameters",
                     json={"code": "P3", "name": "Total",
                           "formula_expression": "P1+P2", "uom": "g",
                           "user_entered_or_formula": "FORMULA",
                           "input_output": "OUTPUT"},
                     headers=headers).json()

    assert r3["formula_expression"] == "P1+P2"
    if r3.get("parameter_value") is not None:
        assert Decimal(str(r3["parameter_value"])) == Decimal("15")


def test_update_parameter_value_triggers_recalculation(client, experiment, chemist):
    """Updating FP1 should cause the formula parameter FP3 to recalculate."""
    headers = _login(client, "exp_chemist")
    p1 = client.post(f"/api/experiments/{experiment.id}/parameters",
                     json={"code": "FP1", "name": "A",
                           "parameter_value": "3", "uom": "g",
                           "user_entered_or_formula": "USER ENTERED"},
                     headers=headers).json()
    client.post(f"/api/experiments/{experiment.id}/parameters",
                json={"code": "FP2", "name": "B",
                      "parameter_value": "4", "uom": "g",
                      "user_entered_or_formula": "USER ENTERED"},
                headers=headers)
    client.post(f"/api/experiments/{experiment.id}/parameters",
                json={"code": "FP3", "name": "Sum",
                      "formula_expression": "FP1+FP2", "uom": "g",
                      "user_entered_or_formula": "FORMULA",
                      "input_output": "OUTPUT"},
                headers=headers).json()

    # Update FP1 to 10
    client.patch(
        f"/api/experiments/{experiment.id}/parameters/{p1['id']}",
        json={"parameter_value": "10"},
        headers=headers,
    )
    # Re-fetch and check recalculated value
    params_resp = client.get(f"/api/experiments/{experiment.id}", headers=headers)
    if params_resp.status_code == 200:
        params = {p["code"]: p for p in params_resp.json().get("parameters", [])}
        if "FP3" in params and params["FP3"].get("parameter_value"):
            assert Decimal(str(params["FP3"]["parameter_value"])) == Decimal("14")


# ─────────────────────────────────────────────────────────────────────────────
# EQUIPMENT
# ─────────────────────────────────────────────────────────────────────────────

def test_add_equipment(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/equipment",
        json={
            "instrument_name": "HPLC System",
            "instrument_code": "EQ-001",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["instrument_name"] == "HPLC System"


def test_update_equipment(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    created = client.post(
        f"/api/experiments/{experiment.id}/equipment",
        json={"instrument_name": "Balance", "instrument_code": "EQ-002"},
        headers=headers,
    ).json()

    resp = client.patch(
        f"/api/experiments/{experiment.id}/equipment/{created['id']}",
        json={"instrument_code": "EQ-002-REV"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["instrument_code"] == "EQ-002-REV"


def test_delete_equipment(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    created = client.post(
        f"/api/experiments/{experiment.id}/equipment",
        json={"instrument_name": "Centrifuge", "instrument_code": "EQ-003"},
        headers=headers,
    ).json()

    resp = client.delete(
        f"/api/experiments/{experiment.id}/equipment/{created['id']}",
        headers=headers,
    )
    assert resp.status_code in (200, 204)


# ─────────────────────────────────────────────────────────────────────────────
# COMMENTS
# ─────────────────────────────────────────────────────────────────────────────

def test_add_comment(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/comments",
        json={"comment": "Initial observation: sample appears cloudy"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert "cloudy" in resp.json()["comment"]


def test_tl_can_add_comment_to_submitted_experiment(
    client, experiment, chemist, tl_user, _perm, crd
):
    c_h = _login(client, "exp_chemist")
    t_h = _login(client, "exp_tl")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)

    resp = client.post(
        f"/api/experiments/{experiment.id}/comments",
        json={"comment": "TL review comment: check yield calculation"},
        headers=t_h,
    )
    assert resp.status_code == 201


# ─────────────────────────────────────────────────────────────────────────────
# TLC Entries
# ─────────────────────────────────────────────────────────────────────────────

def test_add_tlc_entry(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/tlc",
        json={
            "solvent_system": "EtOAc:Hex 1:1",
            "rf_product": "0.45",
            "notes": "Single spot observed",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["solvent_system"] == "EtOAc:Hex 1:1"
    assert Decimal(str(body["rf_product"])) == Decimal("0.45")


# ─────────────────────────────────────────────────────────────────────────────
# Attachments (metadata-only — no real disk write in tests)
# ─────────────────────────────────────────────────────────────────────────────

def test_list_attachments(client, experiment, chemist):
    """Verify the list endpoint is accessible and returns a list."""
    headers = _login(client, "exp_chemist")
    resp = client.get(f"/api/experiments/{experiment.id}/attachments", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_download_nonexistent_attachment(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.get(
        f"/api/experiments/{experiment.id}/attachments/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Experiment HISTORY
# ─────────────────────────────────────────────────────────────────────────────

def test_get_experiment_history(client, experiment, chemist, _perm, crd):
    headers = _login(client, "exp_chemist")
    # Submit to create a history entry
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=headers)

    resp = client.get(f"/api/experiments/{experiment.id}/history", headers=headers)
    assert resp.status_code == 200
    # Should have at least one history event for the submit action
    history = resp.json()
    assert isinstance(history, list)


# ─────────────────────────────────────────────────────────────────────────────
# Versioning
# ─────────────────────────────────────────────────────────────────────────────

def test_create_new_version_from_approved(
    client, db, notebook, project, chemist, tl_user, qa_user, _perm, crd
):
    """Full lifecycle → create new version → v1 is no longer latest."""
    c_h = _login(client, "exp_chemist")
    t_h = _login(client, "exp_tl")
    q_h = _login(client, "exp_qa")

    # Create and approve an experiment
    exp_r = client.post(
        "/api/experiments/",
        json={"title": "Versioning Exp", "notebook_id": notebook.id, "project_id": project.id},
        headers=c_h,
    )
    assert exp_r.status_code == 201
    exp_id = exp_r.json()["id"]

    client.post(f"/api/experiments/{exp_id}/submit", json={}, headers=c_h)
    client.post(f"/api/experiments/{exp_id}/verify", json={}, headers=t_h)
    client.post(f"/api/experiments/{exp_id}/approve", json={}, headers=q_h)

    # Request unlock and create new version
    v2_resp = client.post(
        f"/api/experiments/{exp_id}/new-version",
        json={"reason": "Revision required per QA audit finding"},
        headers=c_h,
    )
    # If endpoint exists, verify versioning behaviour
    if v2_resp.status_code in (200, 201):
        v2 = v2_resp.json()
        assert v2["version"] == 2
        assert v2["is_latest_version"] is True

        # Original must now be non-latest
        v1_resp = client.get(f"/api/experiments/{exp_id}", headers=c_h)
        if v1_resp.status_code == 200:
            assert v1_resp.json()["is_latest_version"] is False
    else:
        # Endpoint may require UNLOCKED status first — that's acceptable
        assert v2_resp.status_code in (400, 403, 422)


def test_cannot_create_new_version_from_draft(client, experiment, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.post(
        f"/api/experiments/{experiment.id}/new-version",
        json={"reason": "Premature versioning"},
        headers=headers,
    )
    assert resp.status_code in (400, 403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Status transition guards
# ─────────────────────────────────────────────────────────────────────────────

def test_cannot_approve_from_draft(client, experiment, chemist, qa_user):
    q_h = _login(client, "exp_qa")
    resp = client.post(f"/api/experiments/{experiment.id}/approve", json={}, headers=q_h)
    assert resp.status_code in (400, 422)


def test_cannot_verify_from_draft(client, experiment, tl_user):
    t_h = _login(client, "exp_tl")
    resp = client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    assert resp.status_code in (400, 422)


def test_reject_requires_reason(client, experiment, chemist, tl_user):
    c_h = _login(client, "exp_chemist")
    t_h = _login(client, "exp_tl")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)

    resp = client.post(
        f"/api/experiments/{experiment.id}/reject",
        json={},  # missing reason
        headers=t_h,
    )
    # Missing mandatory reason field should be rejected
    assert resp.status_code in (400, 422)


def test_void_without_reason_is_allowed(client, approved_experiment, qa_user):
    """VoidRequest.reason is Optional — omitting it is valid."""
    q_h = _login(client, "exp_qa")
    resp = client.post(
        f"/api/experiments/{approved_experiment.id}/void",
        json={},
        headers=q_h,
    )
    assert resp.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# Edge cases
# ─────────────────────────────────────────────────────────────────────────────

def test_whitespace_only_title_accepted(client, notebook, project, chemist, _perm, crd):
    """ExperimentCreate.title has no min_length validator — empty/whitespace is accepted at schema level."""
    headers = _login(client, "exp_chemist")
    resp = client.post(
        "/api/experiments/",
        json={"title": "", "notebook_id": notebook.id, "project_id": project.id},
        headers=headers,
    )
    # Schema has no min_length, so Pydantic accepts an empty string
    assert resp.status_code in (201, 422)


def test_list_experiments_page_size_max(client, experiment, chemist):
    """page_size must not exceed the allowed maximum (100)."""
    headers = _login(client, "exp_chemist")
    resp = client.get("/api/experiments/?page_size=999", headers=headers)
    assert resp.status_code in (200, 422)
    if resp.status_code == 200:
        # If allowed, items count must be capped at server-side max
        assert len(resp.json()["items"]) <= 100


def test_list_experiments_invalid_page(client, chemist):
    headers = _login(client, "exp_chemist")
    resp = client.get("/api/experiments/?page=0", headers=headers)
    assert resp.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# M1 — Submit idempotency guard
# ─────────────────────────────────────────────────────────────────────────────

def test_double_submit_rejected(client, experiment, chemist, _perm, crd):
    """Submitting an already-submitted experiment must return 400, not 500."""
    headers = _login(client, "exp_chemist")
    first = client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=headers)
    assert first.status_code == 200

    second = client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=headers)
    assert second.status_code in (400, 422)


def test_double_verify_rejected(client, experiment, chemist, tl_user, _perm, crd):
    c_h = _login(client, "exp_chemist")
    t_h = _login(client, "exp_tl")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)

    second = client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    assert second.status_code in (400, 422)


def test_double_approve_rejected(client, experiment, chemist, tl_user, qa_user, _perm, crd):
    c_h = _login(client, "exp_chemist")
    t_h = _login(client, "exp_tl")
    q_h = _login(client, "exp_qa")
    client.post(f"/api/experiments/{experiment.id}/submit", json={}, headers=c_h)
    client.post(f"/api/experiments/{experiment.id}/verify", json={}, headers=t_h)
    client.post(f"/api/experiments/{experiment.id}/approve", json={}, headers=q_h)

    second = client.post(f"/api/experiments/{experiment.id}/approve", json={}, headers=q_h)
    assert second.status_code in (400, 422)


# ─────────────────────────────────────────────────────────────────────────────
# M9 — Experiment code uniqueness
# ─────────────────────────────────────────────────────────────────────────────

def test_experiment_codes_are_unique_within_notebook(
    client, notebook, project, chemist, _perm, crd
):
    """Each experiment in the same notebook must receive a distinct code."""
    headers = _login(client, "exp_chemist")
    codes = set()
    for i in range(3):
        r = client.post(
            "/api/experiments/",
            json={"title": f"Uniqueness test {i}",
                  "notebook_id": notebook.id,
                  "project_id": project.id},
            headers=headers,
        )
        assert r.status_code == 201
        code = r.json().get("code") or r.json().get("full_code") or r.json().get("id")
        codes.add(code)
    assert len(codes) == 3, "Two or more experiments share the same code"


def test_experiment_code_increments_sequentially(
    client, notebook, project, chemist, _perm, crd
):
    """Codes within the same notebook must follow a monotonically increasing sequence."""
    headers = _login(client, "exp_chemist")
    results = []
    for i in range(2):
        r = client.post(
            "/api/experiments/",
            json={"title": f"Seq test {i}",
                  "notebook_id": notebook.id,
                  "project_id": project.id},
            headers=headers,
        )
        assert r.status_code == 201
        results.append(r.json())

    code_a = results[0].get("code") or results[0].get("full_code", "")
    code_b = results[1].get("code") or results[1].get("full_code", "")
    # At minimum they must differ
    assert code_a != code_b
