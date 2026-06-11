"""
Tests for inventory endpoints:
  /api/inventory/materials
  /api/inventory/manufacturers
  /api/inventory/stock-requests
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    make_role,
    make_user,
    make_crd_settings,
    get_auth_headers,
)

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="inv_chemist", password="Inventory@1")


@pytest.fixture
def auth(client: TestClient, chemist, crd):
    """Return auth headers for the chemist user."""
    return get_auth_headers(client, "inv_chemist", "Inventory@1")


# ─────────────────────────────────────────────────────────────────────────────
# Helper: create a material via the API and return the response JSON
# ─────────────────────────────────────────────────────────────────────────────

def _create_material(client, auth, code="MAT001", name="Acetone", material_type="CHEMICAL"):
    resp = client.post(
        "/api/inventory/materials",
        json={"code": code, "name": name, "material_type": material_type},
        headers=auth,
    )
    return resp


# ═════════════════════════════════════════════════════════════════════════════
# MATERIALS
# ═════════════════════════════════════════════════════════════════════════════

class TestMaterials:

    def test_create_material(self, client: TestClient, auth):
        resp = _create_material(client, auth)
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "MAT001"
        assert data["name"] == "Acetone"
        assert data["material_type"] == "CHEMICAL"
        assert isinstance(data["id"], int)

    def test_create_material_requires_auth(self, client: TestClient, crd):
        resp = client.post(
            "/api/inventory/materials",
            json={"code": "MAT002", "name": "Ethanol", "material_type": "CHEMICAL"},
        )
        assert resp.status_code in (401, 403)

    def test_duplicate_material_code_rejected(self, client: TestClient, auth):
        _create_material(client, auth, code="MATDUP")
        resp = _create_material(client, auth, code="MATDUP")
        assert resp.status_code == 400

    def test_list_materials(self, client: TestClient, auth):
        _create_material(client, auth, code="MATLIST1", name="Methanol")
        resp = client.get("/api/inventory/materials", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_materials_search(self, client: TestClient, auth):
        unique_code = "MATSRCH99"
        _create_material(client, auth, code=unique_code, name="SearchableChem")
        resp = client.get(f"/api/inventory/materials?search={unique_code}", headers=auth)
        assert resp.status_code == 200
        results = resp.json()
        assert any(m["code"] == unique_code for m in results)

    def test_get_material_by_id(self, client: TestClient, auth):
        create_resp = _create_material(client, auth, code="MATGET1", name="Toluene")
        assert create_resp.status_code == 201
        mat_id = create_resp.json()["id"]
        resp = client.get(f"/api/inventory/materials/{mat_id}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == mat_id

    def test_get_nonexistent_material(self, client: TestClient, auth):
        resp = client.get("/api/inventory/materials/999999", headers=auth)
        assert resp.status_code == 404

    def test_update_material(self, client: TestClient, auth):
        create_resp = _create_material(client, auth, code="MATUPD1", name="Original")
        assert create_resp.status_code == 201
        mat_id = create_resp.json()["id"]
        resp = client.patch(
            f"/api/inventory/materials/{mat_id}",
            json={"name": "Updated"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"

    def test_toggle_material(self, client: TestClient, auth):
        create_resp = _create_material(client, auth, code="MATTOG1", name="Togglable")
        assert create_resp.status_code == 201
        mat_id = create_resp.json()["id"]
        original_active = create_resp.json().get("is_active", True)

        resp = client.patch(f"/api/inventory/materials/{mat_id}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original_active

    def test_upsert_chemical_props(self, client: TestClient, auth):
        create_resp = _create_material(client, auth, code="MATCHEM1", name="ChemPropMat")
        assert create_resp.status_code == 201
        mat_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/inventory/materials/{mat_id}/chemical-props",
            json={"density": 1.5, "purity_pct": 99.5},
            headers=auth,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert float(data["density"]) == pytest.approx(1.5)
        assert float(data["purity_pct"]) == pytest.approx(99.5)

    def test_upsert_formulation_props(self, client: TestClient, auth):
        create_resp = _create_material(client, auth, code="MATFORM1", name="FormPropMat")
        assert create_resp.status_code == 201
        mat_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/inventory/materials/{mat_id}/formulation-props",
            json={"role": "solvent"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "solvent"


# ═════════════════════════════════════════════════════════════════════════════
# MANUFACTURERS
# ═════════════════════════════════════════════════════════════════════════════

def _create_manufacturer(client, auth, code="MFR001", name="Sigma", country="Germany"):
    return client.post(
        "/api/inventory/manufacturers",
        json={"code": code, "name": name, "country": country},
        headers=auth,
    )


class TestManufacturers:

    def test_create_manufacturer(self, client: TestClient, auth):
        resp = _create_manufacturer(client, auth)
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "MFR001"
        assert data["name"] == "Sigma"
        assert data["country"] == "Germany"
        assert isinstance(data["id"], int)

    def test_duplicate_manufacturer_code_rejected(self, client: TestClient, auth):
        _create_manufacturer(client, auth, code="MFRDUP")
        resp = _create_manufacturer(client, auth, code="MFRDUP")
        assert resp.status_code == 400

    def test_list_manufacturers(self, client: TestClient, auth):
        _create_manufacturer(client, auth, code="MFRLIST1", name="Merck")
        resp = client.get("/api/inventory/manufacturers", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_manufacturer_by_id(self, client: TestClient, auth):
        create_resp = _create_manufacturer(client, auth, code="MFRGET1", name="Aldrich")
        assert create_resp.status_code == 201
        mfr_id = create_resp.json()["id"]
        resp = client.get(f"/api/inventory/manufacturers/{mfr_id}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == mfr_id

    def test_update_manufacturer(self, client: TestClient, auth):
        create_resp = _create_manufacturer(client, auth, code="MFRUPD1", name="OriginalMfr")
        assert create_resp.status_code == 201
        mfr_id = create_resp.json()["id"]
        resp = client.patch(
            f"/api/inventory/manufacturers/{mfr_id}",
            json={"name": "Updated"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"

    def test_toggle_manufacturer(self, client: TestClient, auth):
        create_resp = _create_manufacturer(client, auth, code="MFRTOG1", name="ToggleMfr")
        assert create_resp.status_code == 201
        mfr_id = create_resp.json()["id"]
        original_active = create_resp.json().get("is_active", True)

        resp = client.patch(f"/api/inventory/manufacturers/{mfr_id}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original_active


# ═════════════════════════════════════════════════════════════════════════════
# STOCK REQUESTS
# ═════════════════════════════════════════════════════════════════════════════

def _create_sr_material(client, auth, code="SRMAT001"):
    """Create and return a material for stock request tests."""
    resp = client.post(
        "/api/inventory/materials",
        json={"code": code, "name": f"Material {code}", "material_type": "CHEMICAL"},
        headers=auth,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_stock_request(client, auth, mat_id, request_no="SR001"):
    return client.post(
        "/api/inventory/stock-requests",
        json={
            "request_no": request_no,
            "material_id": mat_id,
            "qty_required": 5.0,
            "unit": "kg",
            "criticality": "HIGH",
            "purpose": "Testing",
        },
        headers=auth,
    )


class TestStockRequests:

    def test_create_stock_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_CR1")
        resp = _create_stock_request(client, auth, mat_id, request_no="SR_CR001")
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "PENDING"
        assert data["request_no"] == "SR_CR001"
        assert isinstance(data["id"], int)

    def test_create_stock_request_requires_auth(self, client: TestClient, crd):
        resp = client.post(
            "/api/inventory/stock-requests",
            json={
                "request_no": "SR_NOAUTH",
                "material_id": 1,
                "qty_required": 1.0,
                "unit": "kg",
                "criticality": "LOW",
                "purpose": "Auth test",
            },
        )
        assert resp.status_code in (401, 403)

    def test_duplicate_request_no_rejected(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_DUP1")
        _create_stock_request(client, auth, mat_id, request_no="SR_DUP001")
        resp = _create_stock_request(client, auth, mat_id, request_no="SR_DUP001")
        assert resp.status_code == 400

    def test_list_stock_requests(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_LST1")
        _create_stock_request(client, auth, mat_id, request_no="SR_LST001")
        resp = client.get("/api/inventory/stock-requests", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_stock_request_with_events(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_EVT1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_EVT001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        resp = client.get(f"/api/inventory/stock-requests/{sr_id}", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert isinstance(data["events"], list)

    def test_update_pending_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_UPD1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_UPD001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/inventory/stock-requests/{sr_id}",
            json={"qty_required": 10.0},
            headers=auth,
        )
        assert resp.status_code == 200
        assert float(resp.json()["qty_required"]) == pytest.approx(10.0)

    def test_approve_stock_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_APR1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_APR001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/inventory/stock-requests/{sr_id}/approve",
            json={"remarks": "Approved for testing"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "APPROVED"

    def test_reject_pending_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_REJ1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_REJ001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/inventory/stock-requests/{sr_id}/reject",
            json={"remarks": "Budget exceeded"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REJECTED"

    def test_fulfill_approved_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_FUL1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_FUL001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        # First approve
        apr = client.patch(
            f"/api/inventory/stock-requests/{sr_id}/approve",
            json={"remarks": "OK"},
            headers=auth,
        )
        assert apr.status_code == 200

        # Then fulfill
        resp = client.patch(
            f"/api/inventory/stock-requests/{sr_id}/fulfill",
            json={"remarks": "Delivered"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "FULFILLED"

    def test_cancel_pending_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_CAN1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_CAN001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/inventory/stock-requests/{sr_id}/cancel",
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "CANCELLED"

    def test_cannot_update_approved_request(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_NOUP1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_NOUP001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        # Approve first
        apr = client.patch(
            f"/api/inventory/stock-requests/{sr_id}/approve",
            json={"remarks": "Approved"},
            headers=auth,
        )
        assert apr.status_code == 200

        # Attempt to update — should be rejected
        resp = client.patch(
            f"/api/inventory/stock-requests/{sr_id}",
            json={"qty_required": 99.0},
            headers=auth,
        )
        assert resp.status_code in (400, 409)

    def test_list_events(self, client: TestClient, auth):
        mat_id = _create_sr_material(client, auth, code="SRMAT_EVTL1")
        create_resp = _create_stock_request(client, auth, mat_id, request_no="SR_EVTL001")
        assert create_resp.status_code == 201
        sr_id = create_resp.json()["id"]

        resp = client.get(f"/api/inventory/stock-requests/{sr_id}/events", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        # At minimum the SUBMITTED event should be present
        assert len(resp.json()) >= 1
