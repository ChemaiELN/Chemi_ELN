"""
Tests for role listing and role-privilege CRUD endpoints.

Routes under test
-----------------
GET    /api/roles/                  – list all roles (any authenticated user)
POST   /api/role-privileges/        – create privilege (QA only)
GET    /api/role-privileges/        – list privileges  (any authenticated user)
GET    /api/role-privileges/{id}    – get single       (any authenticated user)
PATCH  /api/role-privileges/{id}    – update           (QA only)
DELETE /api/role-privileges/{id}    – delete           (QA only)
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import get_auth_headers, make_crd_settings, make_role, make_user

PASSWORD = "RolePriv@1"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def qa_role(db: Session):
    return make_role(db, "QA")


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_user(db: Session, qa_role):
    return make_user(db, qa_role.id, username="rp_qa", password=PASSWORD)


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="rp_chemist", password=PASSWORD)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _qa_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "rp_qa", PASSWORD)


def _chemist_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "rp_chemist", PASSWORD)


def _create_privilege(client: TestClient, chemist_role_id: str, headers: dict) -> dict:
    resp = client.post(
        "/api/role-privileges/",
        json={"role_id": chemist_role_id, "privilege_key": "can_export", "is_granted": True},
        headers=headers,
    )
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# Role listing tests
# ─────────────────────────────────────────────────────────────────────────────

class TestListRoles:
    def test_list_roles_returns_all_roles(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        resp = client.get("/api/roles/", headers=headers)
        assert resp.status_code == 200
        codes = [r["code"] for r in resp.json()]
        assert "QA" in codes
        assert "CHEMIST" in codes

    def test_list_roles_requires_auth(self, client: TestClient, crd, qa_role):
        resp = client.get("/api/roles/")
        assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# Create privilege tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCreatePrivilege:
    def test_qa_can_create_privilege(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        resp = _create_privilege(client, chemist_role.id, headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["role_id"] == chemist_role.id
        assert body["privilege_key"] == "can_export"
        assert body["is_granted"] is True

    def test_chemist_cannot_create_privilege(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user, chemist
    ):
        headers = _chemist_headers(client)
        resp = _create_privilege(client, chemist_role.id, headers)
        assert resp.status_code == 403

    def test_create_privilege_requires_auth(
        self, client: TestClient, crd, qa_role, chemist_role
    ):
        resp = client.post(
            "/api/role-privileges/",
            json={"role_id": chemist_role.id, "privilege_key": "can_export", "is_granted": True},
        )
        assert resp.status_code in (401, 403)

    def test_duplicate_privilege_rejected(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        first = _create_privilege(client, chemist_role.id, headers)
        assert first.status_code == 201
        second = _create_privilege(client, chemist_role.id, headers)
        assert second.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# List / get privileges tests
# ─────────────────────────────────────────────────────────────────────────────

class TestListAndGetPrivileges:
    def test_list_privileges(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        _create_privilege(client, chemist_role.id, headers)
        resp = client.get("/api/role-privileges/", headers=headers)
        assert resp.status_code == 200
        keys = [p["privilege_key"] for p in resp.json()]
        assert "can_export" in keys

    def test_list_privileges_filter_by_role(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        _create_privilege(client, chemist_role.id, headers)
        resp = client.get(
            f"/api/role-privileges/?role_id={chemist_role.id}", headers=headers
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 1
        for item in items:
            assert item["role_id"] == chemist_role.id

    def test_get_privilege_by_id(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        created = _create_privilege(client, chemist_role.id, headers)
        assert created.status_code == 201
        priv_id = created.json()["id"]

        resp = client.get(f"/api/role-privileges/{priv_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == priv_id

    def test_get_nonexistent_privilege(
        self, client: TestClient, crd, qa_role, qa_user
    ):
        headers = _qa_headers(client)
        resp = client.get("/api/role-privileges/nonexistent-id-000", headers=headers)
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Update privilege tests
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdatePrivilege:
    def test_qa_can_update_privilege(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        created = _create_privilege(client, chemist_role.id, headers)
        assert created.status_code == 201
        priv_id = created.json()["id"]

        resp = client.patch(
            f"/api/role-privileges/{priv_id}",
            json={"is_granted": False},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_granted"] is False

    def test_chemist_cannot_update_privilege(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user, chemist
    ):
        qa_headers = _qa_headers(client)
        created = _create_privilege(client, chemist_role.id, qa_headers)
        assert created.status_code == 201
        priv_id = created.json()["id"]

        chemist_headers = _chemist_headers(client)
        resp = client.patch(
            f"/api/role-privileges/{priv_id}",
            json={"is_granted": False},
            headers=chemist_headers,
        )
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Delete privilege tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDeletePrivilege:
    def test_qa_can_delete_privilege(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user
    ):
        headers = _qa_headers(client)
        created = _create_privilege(client, chemist_role.id, headers)
        assert created.status_code == 201
        priv_id = created.json()["id"]

        resp = client.delete(f"/api/role-privileges/{priv_id}", headers=headers)
        assert resp.status_code == 204

    def test_chemist_cannot_delete_privilege(
        self, client: TestClient, crd, qa_role, chemist_role, qa_user, chemist
    ):
        qa_headers = _qa_headers(client)
        created = _create_privilege(client, chemist_role.id, qa_headers)
        assert created.status_code == 201
        priv_id = created.json()["id"]

        chemist_headers = _chemist_headers(client)
        resp = client.delete(f"/api/role-privileges/{priv_id}", headers=chemist_headers)
        assert resp.status_code == 403
