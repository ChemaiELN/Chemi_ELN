"""
ATR file-upload integration tests.

save_upload() is mocked to avoid real disk I/O.
validate_upload() runs normally so extension/MIME checks are exercised.

Covers:
  M2  — Valid file accepted (201 + attachment record created)
  M2  — Invalid extension rejected before save (400)
  M2  — Wrong MIME type rejected before save (400)
  M2  — Cancelled ATR rejects attachments (400)
  M2  — Non-raiser / non-QA-TL cannot attach (403)
  M2  — List attachments returns uploaded file
  M2  — QA can attach to any ATR
"""
from __future__ import annotations

import io
from unittest.mock import AsyncMock, patch

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

_PASS    = "AtrUpload@1"
_FAKE_PATH = "/tmp/fake_atr_upload.pdf"
_FAKE_SIZE = 1024


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
    return make_user(db, chemist_role.id, username="aup_chemist", password=_PASS)


@pytest.fixture
def tl_user(db, tl_role):
    return make_user(db, tl_role.id, username="aup_tl", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="aup_qa", password=_PASS)


@pytest.fixture
def other_chemist(db, chemist_role):
    return make_user(db, chemist_role.id, username="aup_other", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="AUPP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="AUP-NB001")


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


@pytest.fixture
def _perm(db, notebook, chemist, tl_user, qa_user):
    make_permission(db, notebook.id, chemist.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False)


@pytest.fixture
def experiment(db, notebook, project, chemist, _perm, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="DRAFT", code="AUP/E001")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _create_atr(client, headers: dict, experiment_id: str) -> dict:
    resp = client.post("/api/atr/", json={
        "test_type":     "HPLC",
        "objectives":    "Determine purity of sample",
        "experiment_id": experiment_id,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _upload(client, headers: dict, atr_id: str,
            filename: str = "report.pdf",
            content_type: str = "application/pdf",
            content: bytes = b"%PDF-1.4 fake content"):
    return client.post(
        f"/api/atr/{atr_id}/attachments",
        files={"file": (filename, io.BytesIO(content), content_type)},
        headers=headers,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Happy path
# ─────────────────────────────────────────────────────────────────────────────

def test_raiser_can_upload_pdf(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(client, h, atr["id"])

    assert resp.status_code == 201
    body = resp.json()
    assert body["filename"] == "report.pdf"
    assert body["atr_id"] == atr["id"]
    assert body["file_size"] == _FAKE_SIZE


def test_qa_can_upload_to_any_atr(client, experiment, chemist, qa_user, _perm, crd):
    c_h  = _login(client, "aup_chemist")
    qa_h = _login(client, "aup_qa")
    atr = _create_atr(client, c_h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(client, qa_h, atr["id"])

    assert resp.status_code == 201


def test_tl_can_upload_to_any_atr(client, experiment, chemist, tl_user, _perm, crd):
    c_h = _login(client, "aup_chemist")
    t_h = _login(client, "aup_tl")
    atr = _create_atr(client, c_h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(client, t_h, atr["id"])

    assert resp.status_code == 201


def test_upload_xlsx_accepted(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(
            client, h, atr["id"],
            filename="data.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            content=b"PK fake xlsx",
        )

    assert resp.status_code == 201
    assert resp.json()["filename"] == "data.xlsx"


def test_upload_creates_audit_log(client, db, experiment, chemist, _perm, crd):
    from app.models.audit import AuditLog
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        _upload(client, h, atr["id"])

    rows = db.query(AuditLog).filter(
        AuditLog.action == "ATTACHMENT_UPLOADED",
        AuditLog.target_id == atr["id"],
    ).all()
    assert len(rows) >= 1
    assert rows[0].detail is not None
    assert "report.pdf" in rows[0].detail


# ─────────────────────────────────────────────────────────────────────────────
# Extension / MIME validation (save_upload never called)
# ─────────────────────────────────────────────────────────────────────────────

def test_exe_extension_rejected(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))) as mock_save:
        resp = _upload(client, h, atr["id"],
                       filename="malware.exe",
                       content_type="application/octet-stream")

    assert resp.status_code == 400
    mock_save.assert_not_called()  # save must not be called for invalid files


def test_disallowed_mime_rejected(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))) as mock_save:
        resp = _upload(client, h, atr["id"],
                       filename="file.pdf",
                       content_type="application/x-malicious")

    assert resp.status_code == 400
    mock_save.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# Access control
# ─────────────────────────────────────────────────────────────────────────────

def test_other_chemist_cannot_upload_to_others_atr(
    client, experiment, chemist, other_chemist, _perm, crd
):
    """A different CHEMIST who is not the raiser must get 403."""
    c_h = _login(client, "aup_chemist")
    o_h = _login(client, "aup_other")
    atr = _create_atr(client, c_h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(client, o_h, atr["id"])

    assert resp.status_code == 403


def test_cannot_upload_to_cancelled_atr(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)
    client.post(f"/api/atr/{atr['id']}/cancel", headers=h)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(client, h, atr["id"])

    assert resp.status_code == 400


def test_upload_requires_auth(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    resp = client.post(
        f"/api/atr/{atr['id']}/attachments",
        files={"file": ("report.pdf", io.BytesIO(b"pdf"), "application/pdf")},
    )
    assert resp.status_code in (401, 403)


def test_upload_to_nonexistent_atr_returns_404(client, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        resp = _upload(client, h, "00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# List attachments
# ─────────────────────────────────────────────────────────────────────────────

def test_list_atr_attachments_empty(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)
    resp = client.get(f"/api/atr/{atr['id']}/attachments", headers=h)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_atr_attachments_after_upload(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        _upload(client, h, atr["id"], filename="results.pdf")

    resp = client.get(f"/api/atr/{atr['id']}/attachments", headers=h)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["filename"] == "results.pdf"


def test_multiple_uploads_all_listed(client, experiment, chemist, _perm, crd):
    h = _login(client, "aup_chemist")
    atr = _create_atr(client, h, experiment.id)

    with patch("app.modules.atr.router.save_upload",
               new=AsyncMock(return_value=(_FAKE_PATH, _FAKE_SIZE))):
        _upload(client, h, atr["id"], filename="report1.pdf")
        _upload(client, h, atr["id"], filename="data.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    resp = client.get(f"/api/atr/{atr['id']}/attachments", headers=h)
    assert resp.status_code == 200
    filenames = {item["filename"] for item in resp.json()}
    assert filenames == {"report1.pdf", "data.xlsx"}
