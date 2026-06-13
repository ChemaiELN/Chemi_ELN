"""
Tests for the Excel Templates admin endpoints.

Prefix: /api/excel-templates
"""
from __future__ import annotations

import io
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    get_auth_headers,
    make_crd_settings,
    make_role,
    make_user,
)

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
_BASE = "/api/excel-templates"
_PASSWORD = "Template@1"
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_FILE_CONTENT = b"PK fake xlsx"
_FAKE_PATH = "/tmp/fake_template.xlsx"
_FAKE_SIZE = 2048


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
    return make_user(db, qa_role.id, username="et_qa", password=_PASSWORD)


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="et_chemist", password=_PASSWORD)


@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _xlsx_file(filename: str = "template.xlsx") -> dict:
    """Return a files dict suitable for httpx multipart upload."""
    return {
        "file": (filename, io.BytesIO(_FILE_CONTENT), _XLSX_MIME),
    }


def _upload_params(
    name: str = "Test Template",
    module: str = "Experiments",
    version: str = "v1",
) -> dict:
    return {"name": name, "module": module, "version": version}


def _do_upload(
    client: TestClient,
    headers: dict,
    *,
    name: str = "Test Template",
    module: str = "Experiments",
    version: str = "v1",
    filename: str = "template.xlsx",
):
    """Upload a template, mocking save_upload so no real I/O happens."""
    with patch(
        "app.modules.admin.excel_templates.save_upload",
        new_callable=AsyncMock,
        return_value=(_FAKE_PATH, _FAKE_SIZE),
    ):
        resp = client.post(
            f"{_BASE}/",
            params=_upload_params(name=name, module=module, version=version),
            files=_xlsx_file(filename),
            headers=headers,
        )
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# Upload tests
# ─────────────────────────────────────────────────────────────────────────────
def test_qa_can_upload_template(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)
    resp = _do_upload(client, headers)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Test Template"
    assert body["module"] == "Experiments"
    assert "is_active" in body


def test_chemist_cannot_upload(client: TestClient, db: Session, chemist, crd):
    headers = get_auth_headers(client, "et_chemist", _PASSWORD)

    with patch(
        "app.modules.admin.excel_templates.save_upload",
        new_callable=AsyncMock,
        return_value=(_FAKE_PATH, _FAKE_SIZE),
    ):
        resp = client.post(
            f"{_BASE}/",
            params=_upload_params(),
            files=_xlsx_file(),
            headers=headers,
        )

    assert resp.status_code == 403, resp.text


def test_upload_requires_auth(client: TestClient, db: Session, crd):
    with patch(
        "app.modules.admin.excel_templates.save_upload",
        new_callable=AsyncMock,
        return_value=(_FAKE_PATH, _FAKE_SIZE),
    ):
        resp = client.post(
            f"{_BASE}/",
            params=_upload_params(),
            files=_xlsx_file(),
        )

    assert resp.status_code in (401, 403), resp.text


def test_invalid_module_rejected(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    with patch(
        "app.modules.admin.excel_templates.save_upload",
        new_callable=AsyncMock,
        return_value=(_FAKE_PATH, _FAKE_SIZE),
    ):
        resp = client.post(
            f"{_BASE}/",
            params=_upload_params(module="InvalidModule"),
            files=_xlsx_file(),
            headers=headers,
        )

    assert resp.status_code in (400, 422), resp.text


def test_invalid_extension_rejected(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    with patch(
        "app.modules.admin.excel_templates.save_upload",
        new_callable=AsyncMock,
        return_value=(_FAKE_PATH, _FAKE_SIZE),
    ):
        resp = client.post(
            f"{_BASE}/",
            params=_upload_params(),
            files={"file": ("report.txt", io.BytesIO(b"plain text"), "text/plain")},
            headers=headers,
        )

    assert resp.status_code == 400, resp.text


# ─────────────────────────────────────────────────────────────────────────────
# List / Get tests
# ─────────────────────────────────────────────────────────────────────────────
def test_list_templates(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    # Seed one template first
    _do_upload(client, headers)

    resp = client.get(f"{_BASE}/", headers=headers)
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)


def test_list_filter_by_module(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    # Upload one Experiments template and one ATR template
    _do_upload(client, headers, name="Exp Template", module="Experiments")
    _do_upload(client, headers, name="ATR Template", module="ATR")

    resp = client.get(f"{_BASE}/", params={"module": "Experiments"}, headers=headers)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert all(item["module"] == "Experiments" for item in items), items


def test_get_template_by_id(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    upload_resp = _do_upload(client, headers)
    assert upload_resp.status_code == 201, upload_resp.text
    template_id = upload_resp.json()["id"]

    resp = client.get(f"{_BASE}/{template_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == template_id


def test_get_nonexistent(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    resp = client.get(f"{_BASE}/nonexistent-id-00000000", headers=headers)
    assert resp.status_code == 404, resp.text


# ─────────────────────────────────────────────────────────────────────────────
# Update tests
# ─────────────────────────────────────────────────────────────────────────────
def test_qa_can_update_template(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    upload_resp = _do_upload(client, headers)
    assert upload_resp.status_code == 201, upload_resp.text
    template_id = upload_resp.json()["id"]

    resp = client.patch(
        f"{_BASE}/{template_id}",
        json={"name": "New Name"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "New Name"


def test_chemist_cannot_update(client: TestClient, db: Session, qa_user, chemist, crd):
    qa_headers = get_auth_headers(client, "et_qa", _PASSWORD)
    chemist_headers = get_auth_headers(client, "et_chemist", _PASSWORD)

    upload_resp = _do_upload(client, qa_headers)
    assert upload_resp.status_code == 201, upload_resp.text
    template_id = upload_resp.json()["id"]

    resp = client.patch(
        f"{_BASE}/{template_id}",
        json={"name": "Hacked Name"},
        headers=chemist_headers,
    )
    assert resp.status_code == 403, resp.text


# ─────────────────────────────────────────────────────────────────────────────
# Activate / Deactivate tests
# ─────────────────────────────────────────────────────────────────────────────
def test_activate_template(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    upload_resp = _do_upload(client, headers)
    assert upload_resp.status_code == 201, upload_resp.text
    template_id = upload_resp.json()["id"]

    # Deactivate first
    deactivate_resp = client.post(
        f"{_BASE}/{template_id}/deactivate", headers=headers
    )
    assert deactivate_resp.status_code == 200, deactivate_resp.text
    assert deactivate_resp.json()["is_active"] is False

    # Now activate
    activate_resp = client.post(
        f"{_BASE}/{template_id}/activate", headers=headers
    )
    assert activate_resp.status_code == 200, activate_resp.text
    assert activate_resp.json()["is_active"] is True


def test_deactivate_template(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    upload_resp = _do_upload(client, headers)
    assert upload_resp.status_code == 201, upload_resp.text
    template_id = upload_resp.json()["id"]

    # Ensure it is active first
    activate_resp = client.post(
        f"{_BASE}/{template_id}/activate", headers=headers
    )
    assert activate_resp.status_code == 200, activate_resp.text
    assert activate_resp.json()["is_active"] is True

    # Now deactivate
    deactivate_resp = client.post(
        f"{_BASE}/{template_id}/deactivate", headers=headers
    )
    assert deactivate_resp.status_code == 200, deactivate_resp.text
    assert deactivate_resp.json()["is_active"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Delete tests
# ─────────────────────────────────────────────────────────────────────────────
def test_qa_can_delete(client: TestClient, db: Session, qa_user, crd):
    headers = get_auth_headers(client, "et_qa", _PASSWORD)

    upload_resp = _do_upload(client, headers)
    assert upload_resp.status_code == 201, upload_resp.text
    template_id = upload_resp.json()["id"]

    with patch("app.modules.admin.excel_templates.delete_file"):
        resp = client.delete(f"{_BASE}/{template_id}", headers=headers)

    assert resp.status_code == 204, resp.text

    # Confirm it is gone
    get_resp = client.get(f"{_BASE}/{template_id}", headers=headers)
    assert get_resp.status_code == 404, get_resp.text
