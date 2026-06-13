"""
Integration tests for Notebook CRUD and the Permission Matrix.

Permission matrix flags: can_view | can_edit | can_submit | can_verify | can_approve

Business rules:
  - Only HOD / TL / QA can create or update notebooks.
  - QA and TL always have implicit full access; explicit grants are not required.
  - Chemists require explicit NotebookPermission grants for every operation.
  - Granting, updating, and revoking permissions is HOD/TL/QA only.
  - A Chemist without any permission cannot view or act on a notebook's experiments.
"""
from __future__ import annotations

import pytest

from tests.conftest import (
    make_crd_settings,
    make_department,
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
)

_PASS = "Notebook@1"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def hod_role(db):
    return make_role(db, "HOD")


@pytest.fixture
def tl_role(db):
    return make_role(db, "TL")


@pytest.fixture
def qa_role(db):
    return make_role(db, "QA")


@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def hod_user(db, hod_role):
    return make_user(db, hod_role.id, username="nb_hod", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="nb_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="nb_qa", password=_PASS)


@pytest.fixture
def chemist(db, chemist_role):
    return make_user(db, chemist_role.id, username="nb_chemist", password=_PASS)


@pytest.fixture
def other_chemist(db, chemist_role):
    return make_user(db, chemist_role.id, username="nb_other", password=_PASS)


@pytest.fixture
def project(db, hod_user):
    return make_project(db, hod_user.id, code="NBP")


@pytest.fixture
def notebook(db, project, hod_user):
    """Notebook created directly in DB (bypasses HTTP auth layer for speed)."""
    return make_notebook(db, project.id, hod_user.id, code="NB-PERM001")


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ─────────────────────────────────────────────────────────────────────────────
# Notebook CRUD — create
# ─────────────────────────────────────────────────────────────────────────────

def test_hod_can_create_notebook(client, project, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.post(
        "/api/notebooks/",
        json={
            "title": "Purity Studies Q1",
            "project_id": project.id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Purity Studies Q1"
    assert body["project_id"] == project.id


def test_tl_can_create_notebook(client, project, tl_user):
    headers = _login(client, "nb_tl")
    resp = client.post(
        "/api/notebooks/",
        json={"title": "Stability Study NB", "project_id": project.id},
        headers=headers,
    )
    assert resp.status_code == 201


def test_chemist_cannot_create_notebook(client, project, chemist):
    headers = _login(client, "nb_chemist")
    resp = client.post(
        "/api/notebooks/",
        json={"title": "Chemist Notebook", "project_id": project.id},
        headers=headers,
    )
    assert resp.status_code in (403, 422)


def test_create_notebook_invalid_project(client, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.post(
        "/api/notebooks/",
        json={"title": "Test", "project_id": "00000000-0000-0000-0000-000000000000"},
        headers=headers,
    )
    assert resp.status_code in (400, 404, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Notebook CRUD — read
# ─────────────────────────────────────────────────────────────────────────────

def test_hod_can_list_notebooks(client, notebook, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.get("/api/notebooks/", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_hod_can_get_notebook(client, notebook, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.get(f"/api/notebooks/{notebook.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == notebook.id


def test_get_nonexistent_notebook(client, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.get("/api/notebooks/00000000-0000-0000-0000-000000000000", headers=headers)
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Notebook CRUD — update
# ─────────────────────────────────────────────────────────────────────────────

def test_hod_can_update_notebook(client, notebook, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.patch(
        f"/api/notebooks/{notebook.id}",
        json={"title": "Updated Title"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_chemist_cannot_update_notebook(client, notebook, chemist, hod_user):
    # Grant chemist view-only (not HOD/TL/QA role)
    hod_h = _login(client, "nb_hod")
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": False,
              "can_submit": False, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )
    c_h = _login(client, "nb_chemist")
    resp = client.patch(
        f"/api/notebooks/{notebook.id}",
        json={"title": "Chemist Hack"},
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Permission Matrix — grant
# ─────────────────────────────────────────────────────────────────────────────

def test_hod_can_grant_permission(client, notebook, hod_user, chemist):
    headers = _login(client, "nb_hod")
    resp = client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={
            "user_id": chemist.id,
            "can_view": True,
            "can_edit": True,
            "can_submit": True,
            "can_verify": False,
            "can_approve": False,
        },
        headers=headers,
    )
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body["user_id"] == chemist.id
    assert body["can_edit"] is True
    assert body["can_submit"] is True
    assert body["can_verify"] is False


def test_chemist_cannot_grant_permission(client, notebook, chemist, other_chemist):
    c_h = _login(client, "nb_chemist")
    resp = client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": other_chemist.id, "can_view": True},
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


def test_grant_permission_to_nonexistent_user(client, notebook, hod_user):
    headers = _login(client, "nb_hod")
    resp = client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": "00000000-0000-0000-0000-000000000000", "can_view": True},
        headers=headers,
    )
    assert resp.status_code in (400, 404, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Permission Matrix — list & read
# ─────────────────────────────────────────────────────────────────────────────

def test_list_permissions(client, notebook, hod_user, chemist):
    hod_h = _login(client, "nb_hod")
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": True,
              "can_submit": True, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )
    resp = client.get(f"/api/notebooks/{notebook.id}/permissions", headers=hod_h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# Permission Matrix — update
# ─────────────────────────────────────────────────────────────────────────────

def test_hod_can_update_permission_flags(client, notebook, hod_user, chemist):
    hod_h = _login(client, "nb_hod")
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": True,
              "can_submit": False, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )
    resp = client.patch(
        f"/api/notebooks/{notebook.id}/permissions/{chemist.id}",
        json={"can_submit": True, "can_verify": True},
        headers=hod_h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["can_submit"] is True
    assert body["can_verify"] is True


# ─────────────────────────────────────────────────────────────────────────────
# Permission Matrix — revoke
# ─────────────────────────────────────────────────────────────────────────────

def test_hod_can_revoke_permission(client, notebook, hod_user, chemist):
    hod_h = _login(client, "nb_hod")
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": True,
              "can_submit": True, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )
    resp = client.delete(
        f"/api/notebooks/{notebook.id}/permissions/{chemist.id}",
        headers=hod_h,
    )
    assert resp.status_code in (200, 204)


def test_revoke_then_chemist_loses_access(client, notebook, project, hod_user, chemist, crd):
    """After permission revocation, chemist can no longer create experiments."""
    hod_h = _login(client, "nb_hod")
    c_h   = _login(client, "nb_chemist")

    # Grant
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": True,
              "can_submit": True, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )

    # Revoke
    client.delete(f"/api/notebooks/{notebook.id}/permissions/{chemist.id}", headers=hod_h)

    # Create experiment — should now be denied
    resp = client.post(
        "/api/experiments/",
        json={
            "title": "Post-revoke experiment",
            "notebook_id": notebook.id,
            "project_id": project.id,
        },
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Access control — role-based implicit access
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_has_implicit_access_without_explicit_grant(
    client, notebook, project, qa_user, chemist_role, crd
):
    """QA does not need an explicit permission row — role grants full access."""
    qa_h = _login(client, "nb_qa")

    # QA creates an experiment in a notebook they were never explicitly granted
    resp = client.post(
        "/api/experiments/",
        json={
            "title": "QA implicit access experiment",
            "notebook_id": notebook.id,
            "project_id": project.id,
        },
        headers=qa_h,
    )
    # Should succeed (QA bypasses permission check)
    assert resp.status_code in (201, 200)


def test_tl_has_implicit_access_without_explicit_grant(
    client, notebook, project, tl_user, crd
):
    """TL does not need an explicit permission row."""
    tl_h = _login(client, "nb_tl")
    resp = client.post(
        "/api/experiments/",
        json={
            "title": "TL implicit access experiment",
            "notebook_id": notebook.id,
            "project_id": project.id,
        },
        headers=tl_h,
    )
    assert resp.status_code in (201, 200)


def test_chemist_without_permission_cannot_create_experiment(
    client, notebook, project, chemist, crd
):
    """Chemist with NO permission row at all must be blocked."""
    c_h = _login(client, "nb_chemist")
    resp = client.post(
        "/api/experiments/",
        json={
            "title": "Unauthorized experiment",
            "notebook_id": notebook.id,
            "project_id": project.id,
        },
        headers=c_h,
    )
    assert resp.status_code in (403, 422)


def test_chemist_view_only_cannot_submit(client, notebook, project, hod_user, chemist, crd):
    """can_submit=False means chemist cannot submit, even if they can view/edit."""
    hod_h = _login(client, "nb_hod")
    c_h   = _login(client, "nb_chemist")

    # Grant edit but NOT submit
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": True,
              "can_submit": False, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )

    # Create experiment (allowed by can_edit)
    create_resp = client.post(
        "/api/experiments/",
        json={"title": "Edge case exp", "notebook_id": notebook.id, "project_id": project.id},
        headers=c_h,
    )
    # If creation itself is gated on can_submit the assertion below may differ,
    # but a submit call must always be denied.
    if create_resp.status_code in (200, 201):
        exp_id = create_resp.json()["id"]
        resp = client.post(
            f"/api/experiments/{exp_id}/submit",
            json={},
            headers=c_h,
        )
        assert resp.status_code in (403, 422)


def test_chemist_cannot_verify_without_can_verify(
    client, notebook, project, hod_user, chemist, crd
):
    """can_verify=False means chemist cannot verify, even if they have can_edit."""
    hod_h = _login(client, "nb_hod")
    c_h   = _login(client, "nb_chemist")

    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": chemist.id, "can_view": True, "can_edit": True,
              "can_submit": True, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )

    # Create and submit an experiment
    create_resp = client.post(
        "/api/experiments/",
        json={"title": "Verify gate exp", "notebook_id": notebook.id, "project_id": project.id},
        headers=c_h,
    )
    if create_resp.status_code in (200, 201):
        exp_id = create_resp.json()["id"]
        client.post(f"/api/experiments/{exp_id}/submit", json={}, headers=c_h)
        resp = client.post(
            f"/api/experiments/{exp_id}/verify",
            json={},
            headers=c_h,
        )
        assert resp.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Permission Matrix — full matrix scenario
# ─────────────────────────────────────────────────────────────────────────────

def test_full_permission_matrix_scenario(
    client, db, project, notebook, hod_user, chemist_role, tl_role, qa_role, crd
):
    """
    Verifies the complete 4-role permission matrix:
      Chemist: can_edit=T, can_submit=T, can_verify=F, can_approve=F
      TL     : implicit via role (no row needed)
      QA     : implicit via role (no row needed)
    """
    # Create users
    submitter = make_user(db, chemist_role.id, username="matrix_chemist", password=_PASS)
    verifier  = make_user(db, tl_role.id,      username="matrix_tl",      password=_PASS)
    approver  = make_user(db, qa_role.id,       username="matrix_qa",      password=_PASS)

    hod_h = _login(client, "nb_hod")
    s_h   = _login(client, "matrix_chemist")
    v_h   = _login(client, "matrix_tl")
    a_h   = _login(client, "matrix_qa")

    # Grant chemist permission
    client.post(
        f"/api/notebooks/{notebook.id}/permissions",
        json={"user_id": submitter.id, "can_view": True, "can_edit": True,
              "can_submit": True, "can_verify": False, "can_approve": False},
        headers=hod_h,
    )

    # 1. Chemist creates
    r = client.post(
        "/api/experiments/",
        json={"title": "Matrix Test Exp", "notebook_id": notebook.id, "project_id": project.id},
        headers=s_h,
    )
    assert r.status_code in (200, 201), r.text
    exp_id = r.json()["id"]

    # 2. Chemist submits
    r = client.post(f"/api/experiments/{exp_id}/submit", json={}, headers=s_h)
    assert r.status_code == 200
    assert r.json()["status"] == "SUBMITTED"

    # 3. Chemist cannot verify (403)
    r = client.post(f"/api/experiments/{exp_id}/verify", json={}, headers=s_h)
    assert r.status_code in (403, 422)

    # 4. TL verifies
    r = client.post(f"/api/experiments/{exp_id}/verify", json={}, headers=v_h)
    assert r.status_code == 200
    assert r.json()["status"] == "VERIFIED"

    # 5. QA approves
    r = client.post(f"/api/experiments/{exp_id}/approve", json={}, headers=a_h)
    assert r.status_code == 200
    assert r.json()["status"] == "APPROVED"

    # 6. QA can void; chemist cannot
    r = client.post(
        f"/api/experiments/{exp_id}/void",
        json={"reason": "Equipment malfunction discovered"},
        headers=s_h,
    )
    assert r.status_code in (403, 422)

    r = client.post(
        f"/api/experiments/{exp_id}/void",
        json={"reason": "Equipment malfunction discovered"},
        headers=a_h,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "VOID"
