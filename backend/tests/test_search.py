"""
Tests for the search module — /api/search endpoints.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    get_auth_headers,
    make_crd_settings,
    make_experiment,
    make_notebook,
    make_permission,
    make_project,
    make_role,
    make_user,
)

PASSWORD = "Search@1234"

# ---------------------------------------------------------------------------
# Module-level fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_role(db: Session):
    return make_role(db, "QA")


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="chemist_search", password=PASSWORD)


@pytest.fixture
def qa_user(db: Session, qa_role):
    return make_user(db, qa_role.id, username="qa_search", password=PASSWORD)


@pytest.fixture
def project(db: Session, chemist):
    return make_project(db, chemist.id, code="SR")


@pytest.fixture
def notebook(db: Session, project, chemist):
    return make_notebook(db, project.id, chemist.id, code="SRNB001")


@pytest.fixture
def _perm(db: Session, notebook, chemist):
    return make_permission(db, notebook.id, chemist.id, can_edit=True)


@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def experiment(db: Session, notebook, project, chemist, _perm, crd):
    return make_experiment(
        db,
        notebook.id,
        project.id,
        chemist.id,
        status="DRAFT",
        code="SR/E001",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _chemist_headers(client: TestClient, chemist) -> dict:
    return get_auth_headers(client, chemist.username, PASSWORD)


def _qa_headers(client: TestClient, qa_user) -> dict:
    return get_auth_headers(client, qa_user.username, PASSWORD)


# ===========================================================================
# Experiment search tests
# ===========================================================================


def test_search_experiments_returns_results(client: TestClient, chemist, experiment, _perm):
    headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/experiments", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_search_experiments_by_title(client: TestClient, chemist, notebook, project, _perm, crd, db: Session):
    # Create an experiment with a unique title via the API so it's persisted
    headers = _chemist_headers(client, chemist)
    unique_title = "UniqueSearchTitle_XYZ987"
    resp = client.post(
        "/api/experiments/",
        json={
            "notebook_id": notebook.id,
            "project_id": project.id,
            "title": unique_title,
            "code": "SR/E099",
        },
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Create failed: {resp.text}"

    search_resp = client.get(
        f"/api/search/experiments?q={unique_title}",
        headers=headers,
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert data["total"] >= 1
    titles = [item["title"] for item in data["items"]]
    assert any(unique_title in t for t in titles)


def test_search_experiments_requires_auth(client: TestClient):
    resp = client.get("/api/search/experiments")
    assert resp.status_code in (401, 403)


def test_search_experiments_filter_by_status(client: TestClient, chemist, experiment, _perm):
    headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/experiments?status=DRAFT", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["status"] == "DRAFT"


def test_search_experiments_by_parameters(
    client: TestClient, chemist, experiment, _perm
):
    headers = _chemist_headers(client, chemist)

    # POST a parameter with code=P1 to the experiment
    param_resp = client.post(
        f"/api/experiments/{experiment.id}/parameters",
        json={
            "name": "Temperature",
            "code": "P1",
            "value": "25",
            "parameter_value": 25.0,
            "input_output": "INPUT",
            "user_entered_or_formula": "USER ENTERED",
            "param_type": "NUMBER",
        },
        headers=headers,
    )
    assert param_resp.status_code in (200, 201), f"Param create failed: {param_resp.text}"

    search_resp = client.get(
        "/api/search/experiments/by-parameters?param_code=P1",
        headers=headers,
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert "total" in data


# ===========================================================================
# ATR search tests
# ===========================================================================


def test_search_atrs_returns_results(client: TestClient, chemist, experiment, _perm, crd):
    headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/atrs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data


def test_search_atrs_requires_auth(client: TestClient):
    resp = client.get("/api/search/atrs")
    assert resp.status_code in (401, 403)


def test_search_atrs_filter_by_status(client: TestClient, chemist, experiment, _perm, crd):
    headers = _chemist_headers(client, chemist)

    # Create an ATR so we have at least one record to filter
    create_resp = client.post(
        "/api/atr/",
        json={
            "test_type": "HPLC",
            "objectives": "Purity check",
            "experiment_id": experiment.id,
        },
        headers=headers,
    )
    assert create_resp.status_code in (200, 201), f"ATR create failed: {create_resp.text}"
    created_status = create_resp.json().get("status", "NEW")

    search_resp = client.get(
        f"/api/search/atrs?status={created_status}",
        headers=headers,
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["status"] == created_status


# ===========================================================================
# Notebook search tests
# ===========================================================================


def test_search_notebooks_returns_results(client: TestClient, chemist, notebook, _perm):
    headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/notebooks", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data


def test_search_notebooks_requires_auth(client: TestClient):
    resp = client.get("/api/search/notebooks")
    assert resp.status_code in (401, 403)


def test_search_notebooks_chemist_sees_only_permitted(
    client: TestClient,
    db: Session,
    chemist,
    qa_user,
    project,
    notebook,
    _perm,
    crd,
):
    # Create a second notebook without permission for chemist
    nb2 = make_notebook(db, project.id, qa_user.id, code="SRNB002")
    # nb2 has no NotebookPermission for chemist

    chemist_headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/notebooks", headers=chemist_headers)
    assert resp.status_code == 200
    data = resp.json()
    returned_ids = {item["id"] for item in data["items"]}

    # chemist should see their permitted notebook
    assert notebook.id in returned_ids
    # chemist should NOT see the notebook they have no permission on
    assert nb2.id not in returned_ids


# ===========================================================================
# Project search tests
# ===========================================================================


def test_search_projects_returns_results(client: TestClient, chemist, project):
    headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/projects", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data


def test_search_projects_requires_auth(client: TestClient):
    resp = client.get("/api/search/projects")
    assert resp.status_code in (401, 403)


def test_search_projects_by_query(client: TestClient, chemist, project, crd):
    """Use the pre-seeded project fixture; chemists cannot create projects (QA/TL only)."""
    headers = _chemist_headers(client, chemist)

    search_resp = client.get(
        f"/api/search/projects?q=Test",
        headers=headers,
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert data["total"] >= 1


# ===========================================================================
# Pagination / validation tests
# ===========================================================================


def test_search_page_size_limit(client: TestClient, chemist, experiment, _perm):
    headers = _chemist_headers(client, chemist)
    resp = client.get("/api/search/experiments?page_size=999", headers=headers)
    assert resp.status_code == 422
