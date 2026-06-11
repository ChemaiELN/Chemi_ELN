"""
Tests for inventory audit trail, dashboard, and report endpoints:
  GET /api/inventory/audit-trail
  GET /api/inventory/dashboard/kpis
  GET /api/inventory/dashboard/available-stock
  GET /api/inventory/dashboard/expiring-soon
  GET /api/inventory/dashboard/pending-actions
  GET /api/inventory/reports/batch-inventory
  GET /api/inventory/reports/expiry
  GET /api/inventory/reports/stock-requests
  GET /api/inventory/reports/equipment-status
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

PASSWORD = "Reports@1234"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="rpt_chemist", password=PASSWORD)


@pytest.fixture
def auth(client: TestClient, chemist, crd):
    return get_auth_headers(client, "rpt_chemist", PASSWORD)


# ── Seed helpers ──────────────────────────────────────────────────────────────

def _create_material(client, auth, code="RPT_MAT01") -> int:
    resp = client.post(
        "/api/inventory/materials",
        json={"code": code, "name": f"Material {code}", "material_type": "CHEMICAL"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_batch(client, auth, mat_id: int, batch_no: str, expiry_date: str = None) -> dict:
    body = {
        "batch_no": batch_no,
        "material_id": mat_id,
        "qty_received": 10.0,
        "unit": "kg",
    }
    if expiry_date:
        body["expiry_date"] = expiry_date
    resp = client.post("/api/inventory/batches", json=body, headers=auth)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_stock_request(client, auth, mat_id: int, request_no: str) -> dict:
    resp = client.post(
        "/api/inventory/stock-requests",
        json={
            "request_no": request_no,
            "material_id": mat_id,
            "qty_required": 5.0,
            "unit": "kg",
            "criticality": "MEDIUM",
            "purpose": "Testing",
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_equip_type(client, auth, code="RPT_ET01") -> dict:
    resp = client.post(
        "/api/inventory/equipment-types",
        json={"code": code, "name": f"Type {code}"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_equipment(client, auth, asset_id="RPT_EQ01") -> dict:
    et = _create_equip_type(client, auth, f"RPT_ET_{asset_id}")
    resp = client.post(
        "/api/inventory/equipment-catalogue",
        json={"asset_id": asset_id, "name": f"Equipment {asset_id}", "equipment_type_id": et["id"]},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT TRAIL
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuditTrail:

    def test_list_audit_trail_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/audit-trail", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data

    def test_audit_trail_requires_auth(self, client: TestClient, crd):
        resp = client.get("/api/inventory/audit-trail")
        assert resp.status_code in (401, 403)

    def test_audit_trail_pagination(self, client: TestClient, auth):
        resp = client.get("/api/inventory/audit-trail?page=1&page_size=10", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 10

    def test_audit_trail_filter_by_entity_type(self, client: TestClient, auth):
        resp = client.get("/api/inventory/audit-trail?entity_type=BATCH", headers=auth)
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["entity_type"] == "BATCH"

    def test_audit_trail_filter_by_date_range(self, client: TestClient, auth):
        resp = client.get(
            "/api/inventory/audit-trail?date_from=2024-01-01&date_to=2026-12-31",
            headers=auth,
        )
        assert resp.status_code == 200

    def test_audit_trail_records_batch_creation(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "RPT_AUDIT_MAT01")
        _create_batch(client, auth, mat_id, "RPT_AUDIT_BATCH01")
        resp = client.get("/api/inventory/audit-trail", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

class TestDashboard:

    def test_kpis_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/kpis", headers=auth)
        assert resp.status_code == 200

    def test_kpis_requires_auth(self, client: TestClient, crd):
        resp = client.get("/api/inventory/dashboard/kpis")
        assert resp.status_code in (401, 403)

    def test_kpis_has_expected_keys(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/kpis", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "materials" in data
        assert "batches_available" in data
        assert "stock_requests_pending" in data

    def test_available_stock_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/available-stock", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_available_stock_requires_auth(self, client: TestClient, crd):
        resp = client.get("/api/inventory/dashboard/available-stock")
        assert resp.status_code in (401, 403)

    def test_available_stock_filter_by_material_type(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/available-stock?material_type=CHEMICAL", headers=auth)
        assert resp.status_code == 200

    def test_expiring_soon_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/expiring-soon", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_expiring_soon_with_expiry_date(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "RPT_EXPMAT01")
        _create_batch(client, auth, mat_id, "RPT_EXPBATCH01", expiry_date="2026-07-01")
        resp = client.get("/api/inventory/dashboard/expiring-soon?days=90", headers=auth)
        assert resp.status_code == 200

    def test_expiring_soon_custom_days(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/expiring-soon?days=30", headers=auth)
        assert resp.status_code == 200

    def test_pending_actions_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/dashboard/pending-actions", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_pending_actions_includes_stock_requests(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "RPT_SRMAT01")
        _create_stock_request(client, auth, mat_id, "RPT_SR_PA001")
        resp = client.get("/api/inventory/dashboard/pending-actions", headers=auth)
        assert resp.status_code == 200
        categories = [a["category"] for a in resp.json()]
        assert "STOCK_REQUEST" in categories


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestReports:

    def test_batch_inventory_report_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/batch-inventory", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_batch_inventory_report_requires_auth(self, client: TestClient, crd):
        resp = client.get("/api/inventory/reports/batch-inventory")
        assert resp.status_code in (401, 403)

    def test_batch_inventory_report_contains_batch_data(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "RPT_BIR_MAT01")
        _create_batch(client, auth, mat_id, "RPT_BIR_BATCH01")
        resp = client.get("/api/inventory/reports/batch-inventory", headers=auth)
        assert resp.status_code == 200
        rows = resp.json()
        assert any(r["batch_no"] == "RPT_BIR_BATCH01" for r in rows)

    def test_batch_inventory_filter_by_material_id(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "RPT_BIR_MAT02")
        _create_batch(client, auth, mat_id, "RPT_BIR_BATCH02")
        resp = client.get(f"/api/inventory/reports/batch-inventory?material_id={mat_id}", headers=auth)
        assert resp.status_code == 200
        for row in resp.json():
            assert row["material_code"] is not None

    def test_expiry_report_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/expiry", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_expiry_report_with_include_expired(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/expiry?include_expired=true", headers=auth)
        assert resp.status_code == 200

    def test_expiry_report_with_date_range(self, client: TestClient, auth):
        resp = client.get(
            "/api/inventory/reports/expiry?date_from=2025-01-01&date_to=2026-12-31",
            headers=auth,
        )
        assert resp.status_code == 200

    def test_stock_requests_report_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/stock-requests", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_stock_requests_report_requires_auth(self, client: TestClient, crd):
        resp = client.get("/api/inventory/reports/stock-requests")
        assert resp.status_code in (401, 403)

    def test_stock_requests_report_filter_by_status(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "RPT_SRR_MAT01")
        _create_stock_request(client, auth, mat_id, "RPT_SRR_001")
        resp = client.get("/api/inventory/reports/stock-requests?status=PENDING", headers=auth)
        assert resp.status_code == 200
        for row in resp.json():
            assert row["status"] == "PENDING"

    def test_stock_requests_report_filter_by_date(self, client: TestClient, auth):
        resp = client.get(
            "/api/inventory/reports/stock-requests?date_from=2024-01-01",
            headers=auth,
        )
        assert resp.status_code == 200

    def test_equipment_status_report_returns_200(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/equipment-status", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_equipment_status_report_filter_by_asset_type(self, client: TestClient, auth):
        _create_equipment(client, auth, "RPT_ESR_EQ01")
        resp = client.get("/api/inventory/reports/equipment-status?asset_type=EQUIPMENT", headers=auth)
        assert resp.status_code == 200
        for row in resp.json():
            assert row["asset_type"] == "EQUIPMENT"

    def test_equipment_status_report_filter_instrument_type(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/equipment-status?asset_type=INSTRUMENT", headers=auth)
        assert resp.status_code == 200
        for row in resp.json():
            assert row["asset_type"] == "INSTRUMENT"

    def test_equipment_status_report_filter_column_type(self, client: TestClient, auth):
        resp = client.get("/api/inventory/reports/equipment-status?asset_type=COLUMN", headers=auth)
        assert resp.status_code == 200
        for row in resp.json():
            assert row["asset_type"] == "COLUMN"
