"""
Tests for Projects, Members, and Milestones endpoints.

Endpoints covered:
  POST   /api/projects/
  GET    /api/projects/
  GET    /api/projects/{project_id}
  PATCH  /api/projects/{project_id}
  POST   /api/projects/{project_id}/members
  DELETE /api/projects/{project_id}/members/{user_id}
  GET    /api/projects/{project_id}/members
  POST   /api/projects/{project_id}/milestones
  GET    /api/projects/{project_id}/milestones
  PATCH  /api/projects/{project_id}/milestones/{ms_id}
  DELETE /api/projects/{project_id}/milestones/{ms_id}
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    get_auth_headers,
    make_crd_settings,
    make_department,
    make_role,
    make_user,
)

PASSWORD = "Projects@1234"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def qa_role(db: Session):
    return make_role(db, "QA")


@pytest.fixture
def tl_role(db: Session):
    return make_role(db, "TL")


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_user(db: Session, qa_role):
    return make_user(db, qa_role.id, username="prj_qa", password=PASSWORD)


@pytest.fixture
def tl_user(db: Session, tl_role):
    return make_user(db, tl_role.id, username="prj_tl", password=PASSWORD)


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="prj_chemist", password=PASSWORD)


@pytest.fixture
def department(db: Session):
    return make_department(db, code="RND")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _project_body(dept_id: str, manager_id: str, code: str = "PRJ001") -> dict:
    return {
        "code": code,
        "name": "Test Project",
        "product_name": "Drug Candidate A",
        "project_type": "DEVELOPMENT",
        "market": "US",
        "department_id": dept_id,
        "manager_id": manager_id,
        "start_date": "2025-01-01",
        "target_date": "2025-12-31",
    }


def _create_project(client, headers, dept_id, manager_id, code="PRJ001") -> dict:
    resp = client.post(
        "/api/projects/",
        json=_project_body(dept_id, manager_id, code),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Project CREATE ────────────────────────────────────────────────────────────

def test_qa_can_create_project(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    resp = client.post("/api/projects/", json=_project_body(department.id, qa_user.id), headers=h)
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "PRJ001"
    assert data["status"] == "ACTIVE"


def test_tl_can_create_project(client: TestClient, tl_user, department, crd):
    h = get_auth_headers(client, "prj_tl", PASSWORD)
    resp = client.post(
        "/api/projects/",
        json=_project_body(department.id, tl_user.id, code="PRJ-TL01"),
        headers=h,
    )
    assert resp.status_code == 201


def test_chemist_cannot_create_project(client: TestClient, chemist, qa_user, department, crd):
    h = get_auth_headers(client, "prj_chemist", PASSWORD)
    resp = client.post(
        "/api/projects/",
        json=_project_body(department.id, qa_user.id, code="PRJ-CHM01"),
        headers=h,
    )
    assert resp.status_code == 403


def test_create_project_requires_auth(client: TestClient, qa_user, department, crd):
    resp = client.post("/api/projects/", json=_project_body(department.id, qa_user.id, code="PRJ-AUTH01"))
    assert resp.status_code in (401, 403)


def test_duplicate_project_code_rejected(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    _create_project(client, h, department.id, qa_user.id, "PRJ-DUP01")
    resp = client.post("/api/projects/", json=_project_body(department.id, qa_user.id, code="PRJ-DUP01"), headers=h)
    assert resp.status_code == 400


# ── Project LIST / GET ────────────────────────────────────────────────────────

def test_list_projects(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    _create_project(client, h, department.id, qa_user.id, "PRJ-LST01")
    resp = client.get("/api/projects/", headers=h)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


def test_chemist_can_list_projects(client: TestClient, chemist, qa_user, department, crd):
    qa_h = get_auth_headers(client, "prj_qa", PASSWORD)
    _create_project(client, qa_h, department.id, qa_user.id, "PRJ-CL01")
    h = get_auth_headers(client, "prj_chemist", PASSWORD)
    resp = client.get("/api/projects/", headers=h)
    assert resp.status_code == 200


def test_get_project_by_id(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-GET01")
    resp = client.get(f"/api/projects/{proj['id']}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["id"] == proj["id"]


def test_get_nonexistent_project_returns_404(client: TestClient, qa_user, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    resp = client.get("/api/projects/00000000-0000-0000-0000-000000000000", headers=h)
    assert resp.status_code == 404


def test_list_projects_search(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    _create_project(client, h, department.id, qa_user.id, "UNIQUE-SRCH01")
    resp = client.get("/api/projects/?search=UNIQUE-SRCH", headers=h)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_list_projects_filter_by_status(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    _create_project(client, h, department.id, qa_user.id, "PRJ-STS01")
    resp = client.get("/api/projects/?status=ACTIVE", headers=h)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "ACTIVE"


def test_list_projects_pagination(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    resp = client.get("/api/projects/?page=1&page_size=5", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 5


# ── Project UPDATE ────────────────────────────────────────────────────────────

def test_qa_can_update_project(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-UPD01")
    resp = client.patch(f"/api/projects/{proj['id']}", json={"name": "Updated Name"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


def test_update_project_status_to_on_hold(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-STS02")
    resp = client.patch(f"/api/projects/{proj['id']}", json={"status": "ON HOLD"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ON HOLD"


def test_update_project_status_to_completed(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-STS03")
    resp = client.patch(f"/api/projects/{proj['id']}", json={"status": "COMPLETED"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "COMPLETED"


def test_invalid_status_rejected(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-BADSTS01")
    resp = client.patch(f"/api/projects/{proj['id']}", json={"status": "INVALID_STATUS"}, headers=h)
    assert resp.status_code in (400, 422)


def test_chemist_cannot_update_project(client: TestClient, chemist, qa_user, department, crd):
    qa_h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, qa_h, department.id, qa_user.id, "PRJ-NOUPD01")
    h = get_auth_headers(client, "prj_chemist", PASSWORD)
    resp = client.patch(f"/api/projects/{proj['id']}", json={"name": "Hacked"}, headers=h)
    assert resp.status_code == 403


# ── Members ───────────────────────────────────────────────────────────────────

def test_add_project_members(client: TestClient, qa_user, chemist, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MBR01")
    resp = client.post(f"/api/projects/{proj['id']}/members", json={"user_ids": [chemist.id]}, headers=h)
    assert resp.status_code == 200


def test_list_project_members(client: TestClient, qa_user, chemist, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MBR02")
    client.post(f"/api/projects/{proj['id']}/members", json={"user_ids": [chemist.id]}, headers=h)
    resp = client.get(f"/api/projects/{proj['id']}/members", headers=h)
    assert resp.status_code == 200
    assert any(m["user_id"] == chemist.id for m in resp.json())


def test_remove_project_member(client: TestClient, qa_user, chemist, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MBR03")
    client.post(f"/api/projects/{proj['id']}/members", json={"user_ids": [chemist.id]}, headers=h)
    resp = client.delete(f"/api/projects/{proj['id']}/members/{chemist.id}", headers=h)
    assert resp.status_code == 200


def test_remove_nonexistent_member_returns_404(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MBR04")
    resp = client.delete(
        f"/api/projects/{proj['id']}/members/00000000-0000-0000-0000-000000000000",
        headers=h,
    )
    assert resp.status_code == 404


def test_chemist_cannot_add_members(client: TestClient, chemist, qa_user, department, crd):
    qa_h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, qa_h, department.id, qa_user.id, "PRJ-MBR05")
    h = get_auth_headers(client, "prj_chemist", PASSWORD)
    resp = client.post(f"/api/projects/{proj['id']}/members", json={"user_ids": [chemist.id]}, headers=h)
    assert resp.status_code == 403


# ── Milestones ────────────────────────────────────────────────────────────────

def _milestone_body(owner_id: str, name: str = "Phase 1") -> dict:
    return {
        "name": name,
        "due_date": "2025-06-30",
        "owner_id": owner_id,
        "status": "PENDING",
        "pct": 0.0,
    }


def test_create_milestone(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MS01")
    resp = client.post(
        f"/api/projects/{proj['id']}/milestones",
        json=_milestone_body(qa_user.id),
        headers=h,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Phase 1"


def test_list_milestones(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MS02")
    client.post(f"/api/projects/{proj['id']}/milestones", json=_milestone_body(qa_user.id, "M1"), headers=h)
    resp = client.get(f"/api/projects/{proj['id']}/milestones", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_update_milestone(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MS03")
    ms = client.post(
        f"/api/projects/{proj['id']}/milestones",
        json=_milestone_body(qa_user.id, "M1"),
        headers=h,
    ).json()
    resp = client.patch(
        f"/api/projects/{proj['id']}/milestones/{ms['id']}",
        json={"pct": 50.0},
        headers=h,
    )
    assert resp.status_code == 200
    assert float(resp.json()["pct"]) == pytest.approx(50.0)


def test_delete_milestone(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MS04")
    ms = client.post(
        f"/api/projects/{proj['id']}/milestones",
        json=_milestone_body(qa_user.id, "M1"),
        headers=h,
    ).json()
    resp = client.delete(f"/api/projects/{proj['id']}/milestones/{ms['id']}", headers=h)
    assert resp.status_code == 200


def test_delete_nonexistent_milestone_returns_404(client: TestClient, qa_user, department, crd):
    h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, h, department.id, qa_user.id, "PRJ-MS05")
    resp = client.delete(
        f"/api/projects/{proj['id']}/milestones/00000000-0000-0000-0000-000000000000",
        headers=h,
    )
    assert resp.status_code == 404


def test_chemist_cannot_create_milestone(client: TestClient, chemist, qa_user, department, crd):
    qa_h = get_auth_headers(client, "prj_qa", PASSWORD)
    proj = _create_project(client, qa_h, department.id, qa_user.id, "PRJ-MS06")
    h = get_auth_headers(client, "prj_chemist", PASSWORD)
    resp = client.post(
        f"/api/projects/{proj['id']}/milestones",
        json=_milestone_body(chemist.id),
        headers=h,
    )
    assert resp.status_code == 403
