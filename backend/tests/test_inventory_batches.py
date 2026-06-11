"""
Tests for inventory batch-related endpoints:
  /api/inventory/batches
  /api/inventory/batch-verifications
  /api/inventory/mappings
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

PASSWORD = "Batches@1234"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="bat_chemist", password=PASSWORD)


@pytest.fixture
def auth(client: TestClient, chemist, crd):
    return get_auth_headers(client, "bat_chemist", PASSWORD)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_material(client, auth, code="BMAT001") -> int:
    resp = client.post(
        "/api/inventory/materials",
        json={"code": code, "name": f"Material {code}", "material_type": "CHEMICAL"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_manufacturer(client, auth, code="BMFR001") -> int:
    resp = client.post(
        "/api/inventory/manufacturers",
        json={"code": code, "name": f"Mfr {code}", "country": "Germany"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_batch(client, auth, mat_id: int, batch_no: str = "BATCH001", qty: float = 10.0) -> dict:
    resp = client.post(
        "/api/inventory/batches",
        json={
            "batch_no": batch_no,
            "material_id": mat_id,
            "qty_received": qty,
            "unit": "kg",
            "location": "Shelf A",
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════════
# BATCHES
# ═══════════════════════════════════════════════════════════════════════════════

class TestBatches:

    def test_create_batch(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_CR01")
        resp = client.post(
            "/api/inventory/batches",
            json={"batch_no": "BAT_CR001", "material_id": mat_id, "qty_received": 5.0, "unit": "kg"},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["batch_no"] == "BAT_CR001"
        assert float(data["qty_received"]) == pytest.approx(5.0)
        assert isinstance(data["id"], int)

    def test_create_batch_requires_auth(self, client: TestClient, crd):
        resp = client.post(
            "/api/inventory/batches",
            json={"batch_no": "BAT_NOAUTH", "material_id": 1, "qty_received": 1.0, "unit": "kg"},
        )
        assert resp.status_code in (401, 403)

    def test_duplicate_batch_no_rejected(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_DUP01")
        _create_batch(client, auth, mat_id, batch_no="BAT_DUP001")
        resp = client.post(
            "/api/inventory/batches",
            json={"batch_no": "BAT_DUP001", "material_id": mat_id, "qty_received": 1.0, "unit": "kg"},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_batches(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_LST01")
        _create_batch(client, auth, mat_id, batch_no="BAT_LST001")
        resp = client.get("/api/inventory/batches", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_batches_filter_by_material(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_FLT01")
        _create_batch(client, auth, mat_id, batch_no="BAT_FLT001")
        resp = client.get(f"/api/inventory/batches?material_id={mat_id}", headers=auth)
        assert resp.status_code == 200
        for b in resp.json():
            assert b["material_id"] == mat_id

    def test_list_batches_filter_by_status(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_STS01")
        _create_batch(client, auth, mat_id, batch_no="BAT_STS001")
        resp = client.get("/api/inventory/batches?status=AVAILABLE", headers=auth)
        assert resp.status_code == 200

    def test_get_batch_by_id(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_GET01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_GET001")
        resp = client.get(f"/api/inventory/batches/{batch['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == batch["id"]

    def test_get_nonexistent_batch_returns_404(self, client: TestClient, auth):
        resp = client.get("/api/inventory/batches/999999", headers=auth)
        assert resp.status_code == 404

    def test_update_batch(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_UPD01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_UPD001")
        resp = client.patch(
            f"/api/inventory/batches/{batch['id']}",
            json={"location": "Shelf B"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["location"] == "Shelf B"

    def test_toggle_batch(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_TOG01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_TOG001")
        original = batch.get("is_active", True)
        resp = client.patch(f"/api/inventory/batches/{batch['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original

    def test_issue_from_batch(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_ISS01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_ISS001", qty=10.0)
        resp = client.post(
            f"/api/inventory/batches/{batch['id']}/issue",
            json={"qty": 3.0, "purpose": "Testing"},
            headers=auth,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert float(data["qty_available"]) == pytest.approx(7.0)

    def test_issue_exceeding_available_rejected(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_ISS02")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_ISS002", qty=5.0)
        resp = client.post(
            f"/api/inventory/batches/{batch['id']}/issue",
            json={"qty": 99.0},
            headers=auth,
        )
        assert resp.status_code in (400, 422)

    def test_allocate_from_batch(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_ALL01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_ALL001", qty=20.0)
        resp = client.post(
            f"/api/inventory/batches/{batch['id']}/allocate",
            json={"qty": 5.0, "project_code": "PRJ001", "purpose": "Allocation test"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert float(resp.json()["qty_available"]) == pytest.approx(15.0)

    def test_get_batch_events(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_EVT01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_EVT001")
        resp = client.get(f"/api/inventory/batches/{batch['id']}/events", headers=auth)
        assert resp.status_code == 200
        events = resp.json()
        assert isinstance(events, list)
        assert len(events) >= 1
        assert any(e["event_type"] == "RECEIVED" for e in events)

    def test_get_batch_events_filter_by_type(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_EVT02")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_EVT002", qty=10.0)
        client.post(
            f"/api/inventory/batches/{batch['id']}/issue",
            json={"qty": 2.0},
            headers=auth,
        )
        resp = client.get(
            f"/api/inventory/batches/{batch['id']}/events?event_type=ISSUED",
            headers=auth,
        )
        assert resp.status_code == 200
        for e in resp.json():
            assert e["event_type"] == "ISSUED"

    def test_batch_fully_consumed_updates_status(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_CONS01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_CONS001", qty=5.0)
        resp = client.post(
            f"/api/inventory/batches/{batch['id']}/issue",
            json={"qty": 5.0},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "CONSUMED"


# ═══════════════════════════════════════════════════════════════════════════════
# BATCH VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class TestBatchVerifications:

    def test_create_verification(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV01")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV001")
        resp = client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV001", "batch_id": batch["id"]},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "PENDING"
        assert data["request_no"] == "BV001"

    def test_create_verification_requires_auth(self, client: TestClient, crd):
        resp = client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV_NOAUTH", "batch_id": 1},
        )
        assert resp.status_code in (401, 403)

    def test_duplicate_request_no_rejected(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV02")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV002")
        client.post("/api/inventory/batch-verifications", json={"request_no": "BV_DUP001", "batch_id": batch["id"]}, headers=auth)
        resp = client.post("/api/inventory/batch-verifications", json={"request_no": "BV_DUP001", "batch_id": batch["id"]}, headers=auth)
        assert resp.status_code == 400

    def test_list_verifications(self, client: TestClient, auth):
        resp = client.get("/api/inventory/batch-verifications", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_verification_by_id(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV03")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV003")
        bv = client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV003", "batch_id": batch["id"]},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/batch-verifications/{bv['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == bv["id"]

    def test_verify_pending_verification(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV04")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV004")
        bv = client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV004", "batch_id": batch["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/batch-verifications/{bv['id']}/verify",
            json={"remarks": "Looks good"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "VERIFIED"

    def test_reject_pending_verification(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV05")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV005")
        bv = client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV005", "batch_id": batch["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/batch-verifications/{bv['id']}/reject",
            json={"remarks": "Failed QC"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REJECTED"

    def test_cannot_verify_already_verified(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV06")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV006")
        bv = client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV006", "batch_id": batch["id"]},
            headers=auth,
        ).json()
        client.patch(f"/api/inventory/batch-verifications/{bv['id']}/verify", json={}, headers=auth)
        resp = client.patch(f"/api/inventory/batch-verifications/{bv['id']}/verify", json={}, headers=auth)
        assert resp.status_code == 400

    def test_list_verifications_filter_by_batch(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_BV07")
        batch = _create_batch(client, auth, mat_id, batch_no="BAT_BV007")
        client.post(
            "/api/inventory/batch-verifications",
            json={"request_no": "BV007", "batch_id": batch["id"]},
            headers=auth,
        )
        resp = client.get(
            f"/api/inventory/batch-verifications?batch_id={batch['id']}",
            headers=auth,
        )
        assert resp.status_code == 200
        for v in resp.json():
            assert v["batch_id"] == batch["id"]


# ═══════════════════════════════════════════════════════════════════════════════
# MANUFACTURER MAPPINGS
# ═══════════════════════════════════════════════════════════════════════════════

class TestMappings:

    def test_create_mapping(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_MAP01")
        mfr_id = _create_manufacturer(client, auth, "BMFR_MAP01")
        resp = client.post(
            "/api/inventory/mappings",
            json={"material_id": mat_id, "manufacturer_id": mfr_id},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["material_id"] == mat_id
        assert data["manufacturer_id"] == mfr_id

    def test_duplicate_mapping_rejected(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_MAP02")
        mfr_id = _create_manufacturer(client, auth, "BMFR_MAP02")
        client.post("/api/inventory/mappings", json={"material_id": mat_id, "manufacturer_id": mfr_id}, headers=auth)
        resp = client.post("/api/inventory/mappings", json={"material_id": mat_id, "manufacturer_id": mfr_id}, headers=auth)
        assert resp.status_code == 400

    def test_list_mappings(self, client: TestClient, auth):
        resp = client.get("/api/inventory/mappings", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_mappings_filter_by_material(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_MAP03")
        mfr_id = _create_manufacturer(client, auth, "BMFR_MAP03")
        client.post("/api/inventory/mappings", json={"material_id": mat_id, "manufacturer_id": mfr_id}, headers=auth)
        resp = client.get(f"/api/inventory/mappings?material_id={mat_id}", headers=auth)
        assert resp.status_code == 200
        for m in resp.json():
            assert m["material_id"] == mat_id

    def test_update_mapping(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_MAP04")
        mfr_id = _create_manufacturer(client, auth, "BMFR_MAP04")
        mapping = client.post(
            "/api/inventory/mappings",
            json={"material_id": mat_id, "manufacturer_id": mfr_id},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/mappings/{mapping['id']}",
            json={"catalogue_no": "CAT-001"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["catalogue_no"] == "CAT-001"

    def test_delete_mapping(self, client: TestClient, auth):
        mat_id = _create_material(client, auth, "BMAT_MAP05")
        mfr_id = _create_manufacturer(client, auth, "BMFR_MAP05")
        mapping = client.post(
            "/api/inventory/mappings",
            json={"material_id": mat_id, "manufacturer_id": mfr_id},
            headers=auth,
        ).json()
        resp = client.delete(f"/api/inventory/mappings/{mapping['id']}", headers=auth)
        assert resp.status_code == 204

    def test_delete_nonexistent_mapping_returns_404(self, client: TestClient, auth):
        resp = client.delete("/api/inventory/mappings/999999", headers=auth)
        assert resp.status_code == 404
