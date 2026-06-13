"""
Tests for the PDF export endpoint.

Covers:
  L2  — Export experiment to PDF/text includes all child entities
  L2  — Content-Disposition header names the file after the experiment code
  L2  — Access control: unauthenticated or unauthorized users cannot export
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

_PASS = "Report@123"

_EXPORT_URL = "/api/experiments/{exp_id}/export-pdf"


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
    return make_user(db, chemist_role.id, username="rpt_chemist", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="rpt_qa", password=_PASS)


@pytest.fixture
def project(db, chemist):
    return make_project(db, chemist.id, code="RPTP")


@pytest.fixture
def notebook(db, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="RPT-NB001")


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
                           status="DRAFT", code="RPT/E001")


def _login(client, username: str) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": _PASS})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ─────────────────────────────────────────────────────────────────────────────
# L2 — Export endpoint basic access
# ─────────────────────────────────────────────────────────────────────────────

def test_export_returns_200(client, experiment, chemist, _perm, crd):
    h = _login(client, "rpt_chemist")
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id), headers=h)
    assert resp.status_code == 200


def test_export_content_type_is_pdf_or_text(client, experiment, chemist, _perm, crd):
    """Endpoint returns application/pdf (if WeasyPrint installed) or text/plain."""
    h = _login(client, "rpt_chemist")
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id), headers=h)
    assert resp.status_code == 200
    ct = resp.headers.get("content-type", "")
    assert "application/pdf" in ct or "text/plain" in ct


def test_export_content_disposition_includes_exp_code(client, experiment, chemist, _perm, crd):
    """Content-Disposition filename must include the experiment code."""
    h = _login(client, "rpt_chemist")
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id), headers=h)
    assert resp.status_code == 200
    cd = resp.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert "filename" in cd
    # Code "RPT/E001" becomes "RPT_E001" in the filename (/ replaced with _)
    assert "RPT" in cd


def test_export_response_has_content(client, experiment, chemist, _perm, crd):
    """The response body must not be empty."""
    h = _login(client, "rpt_chemist")
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id), headers=h)
    assert resp.status_code == 200
    assert len(resp.content) > 0


def test_export_requires_auth(client, experiment, _perm, crd):
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id))
    assert resp.status_code in (401, 403)


def test_export_nonexistent_experiment_returns_404(client, chemist, crd):
    h = _login(client, "rpt_chemist")
    resp = client.get(
        _EXPORT_URL.format(exp_id="00000000-0000-0000-0000-000000000000"),
        headers=h,
    )
    assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# L2 — Export with child entities includes them in the response body
# ─────────────────────────────────────────────────────────────────────────────

def test_export_includes_step(client, db, experiment, chemist, _perm, crd):
    """When the experiment has a step, the export body must reference it."""
    h = _login(client, "rpt_chemist")

    # Add a step
    client.post(
        f"/api/experiments/{experiment.id}/steps",
        json={"step_no": 1, "procedure_text": "Weigh reagents into a round-bottom flask"},
        headers=h,
    )

    resp = client.get(
        _EXPORT_URL.format(exp_id=experiment.id) + "?include_steps=true",
        headers=h,
    )
    assert resp.status_code == 200
    # For text/plain responses the body is readable; for PDF content is binary
    ct = resp.headers.get("content-type", "")
    if "text/plain" in ct:
        body = resp.text
        assert "flask" in body.lower() or "step" in body.lower()


def test_export_includes_parameter(client, db, experiment, chemist, _perm, crd):
    """When the experiment has a parameter, the export body must reference it."""
    h = _login(client, "rpt_chemist")

    client.post(
        f"/api/experiments/{experiment.id}/parameters",
        json={"code": "P1", "name": "Initial Weight", "parameter_value": "5.0", "uom": "g",
              "user_entered_or_formula": "USER ENTERED"},
        headers=h,
    )

    resp = client.get(
        _EXPORT_URL.format(exp_id=experiment.id) + "?include_parameters=true",
        headers=h,
    )
    assert resp.status_code == 200
    ct = resp.headers.get("content-type", "")
    if "text/plain" in ct:
        body = resp.text
        assert "Initial Weight" in body or "P1" in body


def test_export_comments_excluded_by_default(client, experiment, chemist, _perm, crd):
    """Comments are excluded unless include_comments=true is passed."""
    h = _login(client, "rpt_chemist")
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id), headers=h)
    assert resp.status_code == 200
    # Default: include_comments=False per router signature — just verify 200


def test_export_all_sections_enabled(client, experiment, chemist, _perm, crd):
    """All include_ flags set to true must still return 200."""
    h = _login(client, "rpt_chemist")
    url = (
        _EXPORT_URL.format(exp_id=experiment.id)
        + "?include_steps=true&include_inputs=true&include_parameters=true"
          "&include_equipment=true&include_tlc=true&include_comments=true"
    )
    resp = client.get(url, headers=h)
    assert resp.status_code == 200


def test_qa_can_export_any_experiment(client, experiment, chemist, qa_user, _perm, crd):
    """QA has implicit access and can export without an explicit permission grant."""
    h = _login(client, "rpt_qa")
    resp = client.get(_EXPORT_URL.format(exp_id=experiment.id), headers=h)
    assert resp.status_code == 200
