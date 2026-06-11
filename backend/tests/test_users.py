"""
Tests for User CRUD and cross-user IDOR protection.

Covers:
  User CRUD  — QA can create/list/get/update users; non-QA cannot create
  IDOR       — User A cannot read or modify User B's experiment data
               across notebook boundaries
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

_PASS = "Users@1234"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEM")


@pytest.fixture
def tl_role(db):
    return make_role(db, "TL")


@pytest.fixture
def qa_role(db):
    return make_role(db, "QA")


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="usr_qa", password=_PASS)


@pytest.fixture
def chemist_a(db, chemist_role):
    return make_user(db, chemist_role.id, username="chmist_a", password=_PASS)


@pytest.fixture
def chemist_b(db, chemist_role):
    return make_user(db, chemist_role.id, username="chmist_b", password=_PASS)


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


def _login(client, username: str, password: str = _PASS) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


_USER_BODY = {
    "username":   "new_analyst",
    "emp_no":     "EMP-9901",
    "first_name": "Alice",
    "last_name":  "Smith",
    "email":      "alice.smith@lab.com",
    "password":   "AlicePass@1",
    "role":       "QA",    # QA role is always seeded by the qa_user fixture dep
}


# ─────────────────────────────────────────────────────────────────────────────
# User CREATE
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_create_user(client, qa_user, crd):
    h = _login(client, "usr_qa")
    resp = client.post("/api/users/", json=_USER_BODY, headers=h)
    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "new_analyst"
    assert body["role"] == "QA"
    assert body["is_active"] is True


def test_chemist_cannot_create_user(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.post("/api/users/", json=_USER_BODY, headers=h)
    assert resp.status_code == 403


def test_create_user_requires_auth(client, crd):
    resp = client.post("/api/users/", json=_USER_BODY)
    assert resp.status_code in (401, 403)


def test_duplicate_username_rejected(client, qa_user, crd):
    h = _login(client, "usr_qa")
    client.post("/api/users/", json=_USER_BODY, headers=h)
    resp = client.post("/api/users/", json=_USER_BODY, headers=h)
    assert resp.status_code == 400
    assert "username" in resp.json()["detail"].lower() or "taken" in resp.json()["detail"].lower()


def test_duplicate_emp_no_rejected(client, qa_user, crd):
    h = _login(client, "usr_qa")
    client.post("/api/users/", json=_USER_BODY, headers=h)
    body2 = {**_USER_BODY, "username": "other_user", "email": "other@lab.com"}
    resp = client.post("/api/users/", json=body2, headers=h)
    assert resp.status_code == 400


def test_duplicate_email_rejected(client, qa_user, crd):
    h = _login(client, "usr_qa")
    client.post("/api/users/", json=_USER_BODY, headers=h)
    body2 = {**_USER_BODY, "username": "other_user2", "emp_no": "EMP-9902"}
    resp = client.post("/api/users/", json=body2, headers=h)
    assert resp.status_code == 400


def test_invalid_email_rejected(client, qa_user, crd):
    h = _login(client, "usr_qa")
    body = {**_USER_BODY, "email": "not-an-email"}
    resp = client.post("/api/users/", json=body, headers=h)
    assert resp.status_code == 422


def test_short_password_rejected(client, qa_user, crd):
    h = _login(client, "usr_qa")
    body = {**_USER_BODY, "password": "short"}
    resp = client.post("/api/users/", json=body, headers=h)
    assert resp.status_code == 422


def test_invalid_role_rejected(client, qa_user, crd):
    h = _login(client, "usr_qa")
    body = {**_USER_BODY, "role": "SUPERADMIN"}
    resp = client.post("/api/users/", json=body, headers=h)
    assert resp.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# User LIST / GET
# ─────────────────────────────────────────────────────────────────────────────

def test_any_authenticated_user_can_list_users(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get("/api/users/", headers=h)
    assert resp.status_code == 200
    assert "items" in resp.json()
    assert "total" in resp.json()


def test_list_users_requires_auth(client, crd):
    resp = client.get("/api/users/")
    assert resp.status_code in (401, 403)


def test_list_users_pagination(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get("/api/users/?page=1&page_size=5", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 5


def test_list_users_invalid_page_rejected(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get("/api/users/?page=0", headers=h)
    assert resp.status_code == 422


def test_list_users_page_size_max(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get("/api/users/?page_size=999", headers=h)
    assert resp.status_code == 422


def test_list_users_search_filter(client, qa_user, chemist_a, crd):
    h = _login(client, "usr_qa")
    resp = client.get("/api/users/?search=chmist_a", headers=h)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(u["username"] == "chmist_a" for u in items)


def test_list_users_filter_by_active(client, chemist_a, qa_user, crd):
    h = _login(client, "usr_qa")
    resp = client.get("/api/users/?is_active=true", headers=h)
    assert resp.status_code == 200
    for u in resp.json()["items"]:
        assert u["is_active"] is True


def test_get_user_by_id(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get(f"/api/users/{chemist_a.id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["username"] == "chmist_a"


def test_get_nonexistent_user_returns_404(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get("/api/users/00000000-0000-0000-0000-000000000000", headers=h)
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# User UPDATE
# ─────────────────────────────────────────────────────────────────────────────

def test_user_can_update_own_profile(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.patch(
        f"/api/users/{chemist_a.id}",
        json={"designation": "Senior Chemist"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["designation"] == "Senior Chemist"


def test_chemist_cannot_update_another_user(client, chemist_a, chemist_b, crd):
    h = _login(client, "chmist_a")
    resp = client.patch(
        f"/api/users/{chemist_b.id}",
        json={"designation": "Hacked"},
        headers=h,
    )
    assert resp.status_code == 403


def test_qa_can_update_any_user(client, qa_user, chemist_a, crd):
    h = _login(client, "usr_qa")
    resp = client.patch(
        f"/api/users/{chemist_a.id}",
        json={"designation": "QA-assigned designation"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["designation"] == "QA-assigned designation"


def test_chemist_cannot_change_own_role(client, chemist_a, crd):
    h = _login(client, "chmist_a")
    resp = client.patch(
        f"/api/users/{chemist_a.id}",
        json={"role": "QA"},
        headers=h,
    )
    assert resp.status_code == 403


def test_qa_can_change_user_role(client, qa_user, tl_role, chemist_a, crd):
    h = _login(client, "usr_qa")
    resp = client.patch(
        f"/api/users/{chemist_a.id}",
        json={"role": "TL"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "TL"


def test_update_duplicate_email_rejected(client, qa_user, chemist_a, chemist_b, crd):
    """Changing chemist_a's email to chemist_b's existing email must fail."""
    # First update chemist_b to have a known email
    qa_h = _login(client, "usr_qa")
    client.patch(f"/api/users/{chemist_b.id}",
                 json={"email": "unique_b@lab.com"}, headers=qa_h)

    # Try to give chemist_a the same email
    resp = client.patch(
        f"/api/users/{chemist_a.id}",
        json={"email": "unique_b@lab.com"},
        headers=qa_h,
    )
    assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# IDOR — Cross-user experiment isolation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def project_a(db, chemist_a):
    return make_project(db, chemist_a.id, code="IDORP-A")


@pytest.fixture
def project_b(db, chemist_b):
    return make_project(db, chemist_b.id, code="IDORP-B")


@pytest.fixture
def notebook_a(db, project_a, chemist_a):
    return make_notebook(db, project_a.id, chemist_a.id, code="IDOR-A-NB001")


@pytest.fixture
def notebook_b(db, project_b, chemist_b):
    return make_notebook(db, project_b.id, chemist_b.id, code="IDOR-B-NB001")


@pytest.fixture
def perm_a(db, notebook_a, chemist_a):
    make_permission(db, notebook_a.id, chemist_a.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False)


@pytest.fixture
def perm_b(db, notebook_b, chemist_b):
    make_permission(db, notebook_b.id, chemist_b.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False)


@pytest.fixture
def exp_a(db, notebook_a, project_a, chemist_a, perm_a, crd):
    return make_experiment(db, notebook_a.id, project_a.id, chemist_a.id,
                           status="DRAFT", code="IDOR/A001")


@pytest.fixture
def exp_b(db, notebook_b, project_b, chemist_b, perm_b, crd):
    return make_experiment(db, notebook_b.id, project_b.id, chemist_b.id,
                           status="DRAFT", code="IDOR/B001")


def test_chemist_a_cannot_read_chemist_b_experiment(
    client, chemist_a, exp_b, perm_a, perm_b, crd
):
    """Chemist A has no access to notebook B — GET must return 403/404."""
    h = _login(client, "chmist_a")
    resp = client.get(f"/api/experiments/{exp_b.id}", headers=h)
    assert resp.status_code in (403, 404)


def test_chemist_a_cannot_edit_chemist_b_experiment(
    client, chemist_a, exp_b, perm_a, perm_b, crd
):
    """PATCH on another user's experiment without permission must fail."""
    h = _login(client, "chmist_a")
    resp = client.patch(
        f"/api/experiments/{exp_b.id}",
        json={"title": "Stolen edit"},
        headers=h,
    )
    assert resp.status_code in (403, 404)


def test_chemist_a_cannot_submit_chemist_b_experiment(
    client, chemist_a, exp_b, perm_a, perm_b, crd
):
    h = _login(client, "chmist_a")
    resp = client.post(f"/api/experiments/{exp_b.id}/submit", json={}, headers=h)
    assert resp.status_code in (403, 404)


def test_chemist_a_cannot_add_step_to_chemist_b_experiment(
    client, chemist_a, exp_b, perm_a, perm_b, crd
):
    h = _login(client, "chmist_a")
    resp = client.post(
        f"/api/experiments/{exp_b.id}/steps",
        json={"step_no": 1, "procedure_text": "Injected step"},
        headers=h,
    )
    assert resp.status_code in (403, 404)


def test_chemist_a_cannot_delete_chemist_b_experiment(
    client, chemist_a, exp_b, perm_a, perm_b, crd
):
    h = _login(client, "chmist_a")
    resp = client.delete(f"/api/experiments/{exp_b.id}", headers=h)
    assert resp.status_code in (403, 404, 405)


def test_chemist_a_can_read_own_experiment(client, chemist_a, exp_a, perm_a, crd):
    h = _login(client, "chmist_a")
    resp = client.get(f"/api/experiments/{exp_a.id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["id"] == exp_a.id


def test_chemist_b_can_read_own_experiment(client, chemist_b, exp_b, perm_b, crd):
    h = _login(client, "chmist_b")
    resp = client.get(f"/api/experiments/{exp_b.id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["id"] == exp_b.id


def test_list_experiments_does_not_leak_other_users_experiments(
    client, chemist_a, chemist_b, exp_a, exp_b, perm_a, perm_b, crd
):
    """Chemist A's list must not include Chemist B's experiments."""
    h = _login(client, "chmist_a")
    resp = client.get("/api/experiments/", headers=h)
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert exp_a.id in ids
    assert exp_b.id not in ids


def test_chemist_a_cannot_create_experiment_in_notebook_b(
    client, chemist_a, notebook_b, project_b, perm_a, perm_b, crd
):
    """Chemist A must not be able to create an experiment in Notebook B."""
    h = _login(client, "chmist_a")
    resp = client.post(
        "/api/experiments/",
        json={"title": "IDOR create attempt",
              "notebook_id": notebook_b.id,
              "project_id": project_b.id},
        headers=h,
    )
    assert resp.status_code in (403, 404)
