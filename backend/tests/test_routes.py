"""
Tests for Routes & Stages endpoints.

Prefix: /api/routes
Endpoints under test:
    POST   /api/routes/{project_id}/routes
    GET    /api/routes/{project_id}/routes
    GET    /api/routes/{project_id}/routes/{route_id}
    PATCH  /api/routes/{project_id}/routes/{route_id}
    POST   /api/routes/{project_id}/routes/{route_id}/stages
    PATCH  /api/routes/{project_id}/routes/{route_id}/stages/{stage_id}
    DELETE /api/routes/{project_id}/routes/{route_id}/stages/{stage_id}
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    make_role,
    make_user,
    make_project,
    make_crd_settings,
    get_auth_headers,
)

PASSWORD = "Routes@1234"

ROUTE_BODY = {"code": "R01", "name": "Synthesis Route", "sort_order": 1}
STAGE_BODY = {"code": "S01", "name": "Step 1", "sort_order": 1}


# ── Fixtures ──────────────────────────────────────────────────────────────────

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
    return make_user(db, qa_role.id, username="rt_qa", password=PASSWORD)


@pytest.fixture
def tl_user(db: Session, tl_role):
    return make_user(db, tl_role.id, username="rt_tl", password=PASSWORD)


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="rt_chemist", password=PASSWORD)


@pytest.fixture
def project(db: Session, qa_user):
    return make_project(db, created_by_id=qa_user.id)


@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


# ── Helper ────────────────────────────────────────────────────────────────────

def _routes_url(project_id: str) -> str:
    return f"/api/routes/{project_id}/routes"


def _route_url(project_id: str, route_id: str) -> str:
    return f"/api/routes/{project_id}/routes/{route_id}"


def _stages_url(project_id: str, route_id: str) -> str:
    return f"/api/routes/{project_id}/routes/{route_id}/stages"


def _stage_url(project_id: str, route_id: str, stage_id: str) -> str:
    return f"/api/routes/{project_id}/routes/{route_id}/stages/{stage_id}"


def _create_route(client: TestClient, project_id: str, headers: dict, body: dict | None = None) -> dict:
    resp = client.post(_routes_url(project_id), json=body or ROUTE_BODY, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_stage(client: TestClient, project_id: str, route_id: str, headers: dict, body: dict | None = None) -> dict:
    resp = client.post(_stages_url(project_id, route_id), json=body or STAGE_BODY, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Route creation ────────────────────────────────────────────────────────────

def test_qa_can_create_route(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    resp = client.post(_routes_url(project.id), json=ROUTE_BODY, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "R01"
    assert data["name"] == "Synthesis Route"


def test_tl_can_create_route(client: TestClient, tl_user, project, crd):
    headers = get_auth_headers(client, "rt_tl", PASSWORD)
    resp = client.post(_routes_url(project.id), json=ROUTE_BODY, headers=headers)
    assert resp.status_code == 201


def test_chemist_cannot_create_route(client: TestClient, chemist, project, crd):
    headers = get_auth_headers(client, "rt_chemist", PASSWORD)
    resp = client.post(_routes_url(project.id), json=ROUTE_BODY, headers=headers)
    assert resp.status_code == 403


def test_create_route_requires_auth(client: TestClient, project, crd):
    resp = client.post(_routes_url(project.id), json=ROUTE_BODY)
    assert resp.status_code in (401, 403)


def test_create_route_with_stages(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    body = {
        **ROUTE_BODY,
        "code": "R02",
        "stages": [
            {"code": "S01", "name": "Step 1", "sort_order": 1},
            {"code": "S02", "name": "Step 2", "sort_order": 2},
        ],
    }
    resp = client.post(_routes_url(project.id), json=body, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert "stages" in data
    assert len(data["stages"]) == 2


# ── Route listing & retrieval ─────────────────────────────────────────────────

def test_list_routes(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R03"})
    resp = client.get(_routes_url(project.id), headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_get_route_by_id(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R04"})
    resp = client.get(_route_url(project.id, route["id"]), headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == route["id"]


def test_get_nonexistent_route(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    resp = client.get(_route_url(project.id, "nonexistent-route-id-0000"), headers=headers)
    assert resp.status_code == 404


# ── Route updates ─────────────────────────────────────────────────────────────

def test_qa_can_update_route(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R05"})
    resp = client.patch(_route_url(project.id, route["id"]), json={"name": "Updated"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


def test_chemist_cannot_update_route(client: TestClient, qa_user, chemist, project, crd):
    qa_headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, qa_headers, {**ROUTE_BODY, "code": "R06"})
    chemist_headers = get_auth_headers(client, "rt_chemist", PASSWORD)
    resp = client.patch(_route_url(project.id, route["id"]), json={"name": "Hacked"}, headers=chemist_headers)
    assert resp.status_code == 403


def test_update_route_status(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R07"})
    resp = client.patch(_route_url(project.id, route["id"]), json={"status": "ARCHIVED"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ARCHIVED"


def test_invalid_status_rejected(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R08"})
    resp = client.patch(_route_url(project.id, route["id"]), json={"status": "INVALID"}, headers=headers)
    assert resp.status_code in (400, 422)


# ── Stage creation ────────────────────────────────────────────────────────────

def test_qa_can_add_stage(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R09"})
    resp = client.post(_stages_url(project.id, route["id"]), json=STAGE_BODY, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "S01"
    assert data["name"] == "Step 1"


def test_tl_can_add_stage(client: TestClient, qa_user, tl_user, project, crd):
    qa_headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, qa_headers, {**ROUTE_BODY, "code": "R10"})
    tl_headers = get_auth_headers(client, "rt_tl", PASSWORD)
    resp = client.post(_stages_url(project.id, route["id"]), json=STAGE_BODY, headers=tl_headers)
    assert resp.status_code == 201


def test_chemist_cannot_add_stage(client: TestClient, qa_user, chemist, project, crd):
    qa_headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, qa_headers, {**ROUTE_BODY, "code": "R11"})
    chemist_headers = get_auth_headers(client, "rt_chemist", PASSWORD)
    resp = client.post(_stages_url(project.id, route["id"]), json=STAGE_BODY, headers=chemist_headers)
    assert resp.status_code == 403


# ── Stage update ──────────────────────────────────────────────────────────────

def test_qa_can_update_stage(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R12"})
    stage = _create_stage(client, project.id, route["id"], headers)
    resp = client.patch(
        _stage_url(project.id, route["id"], stage["id"]),
        json={"name": "Updated Stage"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Stage"


# ── Stage deletion ────────────────────────────────────────────────────────────

def test_qa_can_delete_stage(client: TestClient, qa_user, project, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, headers, {**ROUTE_BODY, "code": "R13"})
    stage = _create_stage(client, project.id, route["id"], headers)
    resp = client.delete(_stage_url(project.id, route["id"], stage["id"]), headers=headers)
    assert resp.status_code in (200, 204)


def test_chemist_cannot_delete_stage(client: TestClient, qa_user, chemist, project, crd):
    qa_headers = get_auth_headers(client, "rt_qa", PASSWORD)
    route = _create_route(client, project.id, qa_headers, {**ROUTE_BODY, "code": "R14"})
    stage = _create_stage(client, project.id, route["id"], qa_headers)
    chemist_headers = get_auth_headers(client, "rt_chemist", PASSWORD)
    resp = client.delete(_stage_url(project.id, route["id"], stage["id"]), headers=chemist_headers)
    assert resp.status_code == 403


# ── Invalid project ───────────────────────────────────────────────────────────

def test_create_route_invalid_project(client: TestClient, qa_user, crd):
    headers = get_auth_headers(client, "rt_qa", PASSWORD)
    resp = client.post(_routes_url("nonexistent-project-id-000"), json=ROUTE_BODY, headers=headers)
    assert resp.status_code == 404
