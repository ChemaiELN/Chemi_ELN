"""
Tests for file-upload validation and attachment download Content-Type.

Covers:
  M2  — ATR attachment: file-type/size validation (unit-level via validate_upload)
  M3  — Experiment attachment download returns correct Content-Type header
"""
from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import UploadFile

from tests.conftest import (
    make_crd_settings,
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
)

_PASS = "Attach@123"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_role(db):
    return make_role(db, "QA")


@pytest.fixture
def chemist(db, chemist_role):
    return make_user(db, chemist_role.id, username="att_chemist", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="att_qa", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="ATTP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="ATT-NB001")


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


@pytest.fixture
def _perm(db, notebook, chemist, qa_user):
    make_permission(db, notebook.id, chemist.id,
                    can_edit=True, can_submit=True, can_verify=False, can_approve=False,
                    can_comment=True)
    make_permission(db, notebook.id, qa_user.id,
                    can_edit=False, can_submit=False, can_verify=False, can_approve=True)


@pytest.fixture
def experiment(db, notebook, project, chemist, _perm, crd):
    return make_experiment(db, notebook.id, project.id, chemist.id,
                           status="DRAFT", code="ATT/E001")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ─────────────────────────────────────────────────────────────────────────────
# M2 — validate_upload unit tests (no HTTP needed)
# ─────────────────────────────────────────────────────────────────────────────

def _make_upload(filename: str, content_type: str = "application/octet-stream") -> UploadFile:
    return UploadFile(filename=filename,
                      file=io.BytesIO(b"dummy content"),
                      headers={"content-type": content_type})


def test_validate_upload_accepts_pdf():
    from app.utils.files import validate_upload
    f = _make_upload("report.pdf", "application/pdf")
    ext = validate_upload(f)
    assert ext == ".pdf"


def test_validate_upload_accepts_xlsx():
    from app.utils.files import validate_upload
    f = _make_upload("data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ext = validate_upload(f)
    assert ext == ".xlsx"


def test_validate_upload_accepts_png():
    from app.utils.files import validate_upload
    f = _make_upload("image.png", "image/png")
    ext = validate_upload(f)
    assert ext == ".png"


def test_validate_upload_accepts_csv():
    from app.utils.files import validate_upload
    f = _make_upload("data.csv", "text/csv")
    ext = validate_upload(f)
    assert ext == ".csv"


def test_validate_upload_rejects_exe():
    from fastapi import HTTPException
    from app.utils.files import validate_upload
    f = _make_upload("virus.exe", "application/octet-stream")
    with pytest.raises(HTTPException) as exc_info:
        validate_upload(f)
    assert exc_info.value.status_code == 400
    assert ".exe" in exc_info.value.detail


def test_validate_upload_rejects_sh():
    from fastapi import HTTPException
    from app.utils.files import validate_upload
    f = _make_upload("script.sh", "text/x-shellscript")
    with pytest.raises(HTTPException) as exc_info:
        validate_upload(f)
    assert exc_info.value.status_code == 400


def test_validate_upload_rejects_no_extension():
    from fastapi import HTTPException
    from app.utils.files import validate_upload
    f = _make_upload("noextension", "application/octet-stream")
    with pytest.raises(HTTPException) as exc_info:
        validate_upload(f)
    assert exc_info.value.status_code == 400


def test_validate_upload_rejects_disallowed_mime():
    from fastapi import HTTPException
    from app.utils.files import validate_upload
    f = _make_upload("file.pdf", "application/x-malicious")
    with pytest.raises(HTTPException) as exc_info:
        validate_upload(f)
    assert exc_info.value.status_code == 400


def test_sanitize_filename_strips_path_components():
    from app.utils.files import sanitize_filename
    assert "/" not in sanitize_filename("../../etc/passwd")
    assert "\\" not in sanitize_filename("..\\windows\\system32\\cmd.exe")


def test_sanitize_filename_handles_special_chars():
    from app.utils.files import sanitize_filename
    result = sanitize_filename("my file (v2) [final].pdf")
    assert result  # not empty
    # Must not contain shell-special characters
    for ch in (";", "&", "|", "`", "$", "<", ">"):
        assert ch not in result


# ─────────────────────────────────────────────────────────────────────────────
# M3 — Experiment attachment download Content-Type (via API)
# ─────────────────────────────────────────────────────────────────────────────

def test_attachment_download_pdf_content_type(client, db, experiment, chemist, _perm, crd):
    """A PDF attachment must be served with Content-Type: application/pdf."""
    from app.models.experiment import ExperimentAttachment
    from app.models.base import new_uuid

    h = _login(client, "att_chemist")

    # Create a real temp file so FileResponse can serve it
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(b"%PDF-1.4 fake pdf content")
        tmp_path = tmp.name

    try:
        att = ExperimentAttachment(
            id=new_uuid(),
            experiment_id=experiment.id,
            filename="report.pdf",
            file_path=tmp_path,
            file_size=24,
            file_type="pdf",
            uploaded_by=chemist.id,
        )
        db.add(att)
        db.flush()

        resp = client.get(
            f"/api/experiments/{experiment.id}/attachments/{att.id}",
            headers=h,
        )
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")
    finally:
        os.unlink(tmp_path)


def test_attachment_download_png_content_type(client, db, experiment, chemist, _perm, crd):
    """A PNG attachment must be served with Content-Type: image/png."""
    from app.models.experiment import ExperimentAttachment
    from app.models.base import new_uuid

    h = _login(client, "att_chemist")

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20)
        tmp_path = tmp.name

    try:
        att = ExperimentAttachment(
            id=new_uuid(),
            experiment_id=experiment.id,
            filename="image.png",
            file_path=tmp_path,
            file_size=28,
            file_type="png",
            uploaded_by=chemist.id,
        )
        db.add(att)
        db.flush()

        resp = client.get(
            f"/api/experiments/{experiment.id}/attachments/{att.id}",
            headers=h,
        )
        assert resp.status_code == 200
        assert "image/png" in resp.headers.get("content-type", "")
    finally:
        os.unlink(tmp_path)


def test_attachment_download_unknown_ext_falls_back_to_octet_stream(
    client, db, experiment, chemist, _perm, crd
):
    """Unknown file extension must fall back to application/octet-stream."""
    from app.models.experiment import ExperimentAttachment
    from app.models.base import new_uuid

    h = _login(client, "att_chemist")

    with tempfile.NamedTemporaryFile(suffix=".zzz", delete=False) as tmp:
        tmp.write(b"binary data")
        tmp_path = tmp.name

    try:
        att = ExperimentAttachment(
            id=new_uuid(),
            experiment_id=experiment.id,
            filename="mystery.zzz",
            file_path=tmp_path,
            file_size=11,
            file_type="zzz",
            uploaded_by=chemist.id,
        )
        db.add(att)
        db.flush()

        resp = client.get(
            f"/api/experiments/{experiment.id}/attachments/{att.id}",
            headers=h,
        )
        assert resp.status_code == 200
        assert "octet-stream" in resp.headers.get("content-type", "")
    finally:
        os.unlink(tmp_path)


def test_missing_file_on_disk_returns_404(client, db, experiment, chemist, _perm, crd):
    """If the file was deleted from disk, endpoint must return 404."""
    from app.models.experiment import ExperimentAttachment
    from app.models.base import new_uuid

    h = _login(client, "att_chemist")

    att = ExperimentAttachment(
        id=new_uuid(),
        experiment_id=experiment.id,
        filename="ghost.pdf",
        file_path="/nonexistent/path/ghost.pdf",
        file_size=0,
        file_type="pdf",
        uploaded_by=chemist.id,
    )
    db.add(att)
    db.flush()

    resp = client.get(
        f"/api/experiments/{experiment.id}/attachments/{att.id}",
        headers=h,
    )
    assert resp.status_code == 404


def test_download_nonexistent_attachment_id(client, experiment, chemist, _perm, crd):
    h = _login(client, "att_chemist")
    resp = client.get(
        f"/api/experiments/{experiment.id}/attachments/00000000-0000-0000-0000-000000000000",
        headers=h,
    )
    assert resp.status_code == 404


def test_list_attachments_returns_empty_list(client, experiment, chemist, _perm, crd):
    h = _login(client, "att_chemist")
    resp = client.get(f"/api/experiments/{experiment.id}/attachments", headers=h)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) == 0


def test_list_attachments_after_adding_record(client, db, experiment, chemist, _perm, crd):
    from app.models.experiment import ExperimentAttachment
    from app.models.base import new_uuid

    att = ExperimentAttachment(
        id=new_uuid(),
        experiment_id=experiment.id,
        filename="data.xlsx",
        file_path="/tmp/fake.xlsx",
        file_size=512,
        file_type="xlsx",
        uploaded_by=chemist.id,
    )
    db.add(att)
    db.flush()

    h = _login(client, "att_chemist")
    resp = client.get(f"/api/experiments/{experiment.id}/attachments", headers=h)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["filename"] == "data.xlsx"
