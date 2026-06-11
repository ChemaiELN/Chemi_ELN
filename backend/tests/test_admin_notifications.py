"""
Tests for the notification settings admin API.

Endpoint prefix: /api/notification-settings
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    get_auth_headers,
    make_crd_settings,
    make_role,
    make_user,
)

PASSWORD = "Notify@1234"
PREFIX = "/api/notification-settings"

BASE_PAYLOAD = {
    "key": "exp_submitted",
    "label": "Exp Submitted",
    "module": "Experiments",
    "is_enabled": True,
}


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def qa_role(db: Session):
    return make_role(db, "QA")


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_user(db: Session, qa_role):
    return make_user(db, qa_role.id, username="ns_qa", password=PASSWORD)


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="ns_chemist", password=PASSWORD)


@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _qa_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "ns_qa", PASSWORD)


def _chemist_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "ns_chemist", PASSWORD)


def _create_setting(client: TestClient, headers: dict, payload: dict | None = None) -> dict:
    resp = client.post(PREFIX + "/", json=payload or BASE_PAYLOAD, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_create_notification_setting(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    resp = client.post(PREFIX + "/", json=BASE_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["key"] == BASE_PAYLOAD["key"]
    assert data["label"] == BASE_PAYLOAD["label"]
    assert data["module"] == BASE_PAYLOAD["module"]
    assert data["is_enabled"] is True


def test_chemist_cannot_create(client: TestClient, qa_user, chemist, crd):
    headers = _chemist_headers(client)
    resp = client.post(PREFIX + "/", json=BASE_PAYLOAD, headers=headers)
    assert resp.status_code == 403


def test_create_requires_auth(client: TestClient, crd):
    resp = client.post(PREFIX + "/", json=BASE_PAYLOAD)
    assert resp.status_code in (401, 403)


def test_duplicate_key_rejected(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    _create_setting(client, headers)
    resp = client.post(PREFIX + "/", json=BASE_PAYLOAD, headers=headers)
    assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

def test_list_settings(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    _create_setting(client, headers)
    resp = client.get(PREFIX + "/", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_list_filter_by_module(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    _create_setting(client, headers, BASE_PAYLOAD)
    other_payload = {
        "key": "sample_created",
        "label": "Sample Created",
        "module": "Samples",
        "is_enabled": True,
    }
    _create_setting(client, headers, other_payload)

    resp = client.get(PREFIX + "/", params={"module": "Experiments"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(item["module"] == "Experiments" for item in data)


def test_list_filter_by_enabled(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    _create_setting(client, headers, BASE_PAYLOAD)
    disabled_payload = {
        "key": "exp_approved",
        "label": "Exp Approved",
        "module": "Experiments",
        "is_enabled": False,
    }
    _create_setting(client, headers, disabled_payload)

    resp = client.get(PREFIX + "/", params={"is_enabled": "true"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(item["is_enabled"] is True for item in data)


def test_list_requires_auth(client: TestClient, crd):
    resp = client.get(PREFIX + "/")
    assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# Get by ID
# ─────────────────────────────────────────────────────────────────────────────

def test_get_setting_by_id(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    created = _create_setting(client, headers)
    setting_id = created["id"]

    resp = client.get(f"{PREFIX}/{setting_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == setting_id


def test_get_nonexistent(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    resp = client.get(f"{PREFIX}/nonexistent-id-that-does-not-exist", headers=headers)
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_update_setting(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    created = _create_setting(client, headers)
    setting_id = created["id"]

    resp = client.patch(
        f"{PREFIX}/{setting_id}",
        json={"label": "Updated Label"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["label"] == "Updated Label"


def test_chemist_cannot_update(client: TestClient, qa_user, chemist, crd):
    qa_headers = _qa_headers(client)
    created = _create_setting(client, qa_headers)
    setting_id = created["id"]

    chemist_headers = _chemist_headers(client)
    resp = client.patch(
        f"{PREFIX}/{setting_id}",
        json={"label": "Should Fail"},
        headers=chemist_headers,
    )
    assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Toggle
# ─────────────────────────────────────────────────────────────────────────────

def test_toggle_enables_disabled(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    disabled_payload = {
        "key": "exp_disabled_toggle",
        "label": "Exp Disabled Toggle",
        "module": "Experiments",
        "is_enabled": False,
    }
    created = _create_setting(client, headers, disabled_payload)
    setting_id = created["id"]
    assert created["is_enabled"] is False

    resp = client.post(f"{PREFIX}/{setting_id}/toggle", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_enabled"] is True


def test_toggle_disables_enabled(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    enabled_payload = {
        "key": "exp_enabled_toggle",
        "label": "Exp Enabled Toggle",
        "module": "Experiments",
        "is_enabled": True,
    }
    created = _create_setting(client, headers, enabled_payload)
    setting_id = created["id"]
    assert created["is_enabled"] is True

    resp = client.post(f"{PREFIX}/{setting_id}/toggle", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_enabled"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────────────────

def test_qa_can_delete(client: TestClient, qa_user, crd):
    headers = _qa_headers(client)
    created = _create_setting(client, headers)
    setting_id = created["id"]

    resp = client.delete(f"{PREFIX}/{setting_id}", headers=headers)
    assert resp.status_code == 204

    get_resp = client.get(f"{PREFIX}/{setting_id}", headers=headers)
    assert get_resp.status_code == 404


def test_chemist_cannot_delete(client: TestClient, qa_user, chemist, crd):
    qa_headers = _qa_headers(client)
    created = _create_setting(client, qa_headers)
    setting_id = created["id"]

    chemist_headers = _chemist_headers(client)
    resp = client.delete(f"{PREFIX}/{setting_id}", headers=chemist_headers)
    assert resp.status_code == 403
