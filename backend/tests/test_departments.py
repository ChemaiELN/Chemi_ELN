"""
Tests for the Departments CRUD API.

Covers:
  CREATE  — QA can create; CHEMIST cannot; unauthenticated gets 401/403;
            duplicate code is rejected with 400
  LIST    — authenticated users can list; unauthenticated cannot;
            search filter; is_active filter; pagination param validation
  GET     — fetch by id; 404 for unknown id
  UPDATE  — QA can update name and is_active; CHEMIST cannot
"""
from __future__ import annotations

import pytest

from tests.conftest import (
    make_crd_settings,
    make_department,
    make_role,
    make_user,
)

_PASS = "Dept@1234"
_BASE_URL = "/api/departments/"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def qa_role(db):
    return make_role(db, "QA")


@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="dept_qa", password=_PASS)


@pytest.fixture
def chemist(db, chemist_role):
    return make_user(db, chemist_role.id, username="dept_chem", password=_PASS)


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


# ─────────────────────────────────────────────────────────────────────────────
# Login helper
# ─────────────────────────────────────────────────────────────────────────────

def _login(client, username: str, password: str = _PASS) -> dict:
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_create_department(client, qa_user, crd):
    h = _login(client, "dept_qa")
    resp = client.post(
        _BASE_URL,
        json={"code": "RD", "name": "Research"},
        headers=h,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["code"] == "RD"
    assert body["name"] == "Research"
    assert body["is_active"] is True


def test_chemist_cannot_create_department(client, chemist, crd):
    h = _login(client, "dept_chem")
    resp = client.post(
        _BASE_URL,
        json={"code": "RD", "name": "Research"},
        headers=h,
    )
    assert resp.status_code == 403


def test_create_department_requires_auth(client, crd):
    resp = client.post(
        _BASE_URL,
        json={"code": "RD", "name": "Research"},
    )
    assert resp.status_code in (401, 403)


def test_duplicate_code_rejected(client, qa_user, crd):
    h = _login(client, "dept_qa")
    # First creation succeeds
    resp1 = client.post(
        _BASE_URL,
        json={"code": "DUP", "name": "Duplicate First"},
        headers=h,
    )
    assert resp1.status_code == 201

    # Second creation with same code must fail
    resp2 = client.post(
        _BASE_URL,
        json={"code": "DUP", "name": "Duplicate Second"},
        headers=h,
    )
    assert resp2.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

def test_list_departments_returns_created(client, qa_user, crd):
    h = _login(client, "dept_qa")
    # Create a department first
    create_resp = client.post(
        _BASE_URL,
        json={"code": "LST", "name": "List Dept"},
        headers=h,
    )
    assert create_resp.status_code == 201

    # Then list and confirm it appears
    list_resp = client.get(_BASE_URL, headers=h)
    assert list_resp.status_code == 200
    body = list_resp.json()
    codes = [item["code"] for item in body["items"]]
    assert "LST" in codes


def test_list_departments_requires_auth(client, crd):
    resp = client.get(_BASE_URL)
    assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# GET by ID
# ─────────────────────────────────────────────────────────────────────────────

def test_get_department_by_id(client, db, qa_user, crd):
    dept = make_department(db, code="GBY")
    h = _login(client, "dept_qa")
    resp = client.get(f"{_BASE_URL}{dept.id}", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == dept.id
    assert body["code"] == "GBY"


def test_get_nonexistent_department_returns_404(client, qa_user, crd):
    h = _login(client, "dept_qa")
    resp = client.get(f"{_BASE_URL}00000000-0000-0000-0000-000000000000", headers=h)
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_update_department(client, db, qa_user, crd):
    dept = make_department(db, code="UPD")
    h = _login(client, "dept_qa")
    resp = client.patch(
        f"{_BASE_URL}{dept.id}",
        json={"name": "Updated"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


def test_chemist_cannot_update_department(client, db, chemist, crd):
    dept = make_department(db, code="UPC")
    h = _login(client, "dept_chem")
    resp = client.patch(
        f"{_BASE_URL}{dept.id}",
        json={"name": "Hijacked"},
        headers=h,
    )
    assert resp.status_code == 403


def test_update_department_deactivate(client, db, qa_user, crd):
    dept = make_department(db, code="DAC")
    h = _login(client, "dept_qa")
    resp = client.patch(
        f"{_BASE_URL}{dept.id}",
        json={"is_active": False},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# ─────────────────────────────────────────────────────────────────────────────
# LIST — filters
# ─────────────────────────────────────────────────────────────────────────────

def test_list_departments_search_filter(client, qa_user, crd):
    h = _login(client, "dept_qa")
    # Create a department whose name contains "chemistry"
    client.post(
        _BASE_URL,
        json={"code": "CHMY", "name": "CHEMISTRY"},
        headers=h,
    )
    resp = client.get(_BASE_URL, params={"search": "chem"}, headers=h)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any("CHEM" in item["code"] or "chem" in item["name"].lower() for item in items)


def test_list_departments_filter_active(client, db, qa_user, crd):
    # Create one inactive department directly in DB
    make_department(db, code="ACT")
    inactive = make_department(db, code="INA")
    from app.models.department import Department  # local import to avoid top-level pollution
    db_dept = db.get(Department, inactive.id)
    db_dept.is_active = False
    db.flush()

    h = _login(client, "dept_qa")
    resp = client.get(_BASE_URL, params={"is_active": "true"}, headers=h)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(item["is_active"] is True for item in items)
    # "INA" must NOT appear in the filtered results
    inactive_codes = [item["code"] for item in items if item["code"] == "INA"]
    assert inactive_codes == []


def test_list_departments_pagination(client, qa_user, crd):
    h = _login(client, "dept_qa")
    # page_size=0 is below the minimum (ge=1) — expect 422
    resp = client.get(_BASE_URL, params={"page_size": 0}, headers=h)
    assert resp.status_code == 422

    # page_size=201 exceeds the maximum (le=200) — expect 422
    resp = client.get(_BASE_URL, params={"page_size": 201}, headers=h)
    assert resp.status_code == 422

    # Valid page_size=1 — expect 200
    resp = client.get(_BASE_URL, params={"page_size": 1}, headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert len(body["items"]) <= 1
