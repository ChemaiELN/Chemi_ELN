"""
Tests for inventory maintenance/calibration schedule and verification endpoints:
  /api/inventory/maintenance-schedules
  /api/inventory/calibration-schedules
  /api/inventory/equipment-verifications
  /api/inventory/instrument-verifications
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

PASSWORD = "Schedules@1234"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="sch_chemist", password=PASSWORD)


@pytest.fixture
def auth(client: TestClient, chemist, crd):
    return get_auth_headers(client, "sch_chemist", PASSWORD)


# ── Setup helpers ─────────────────────────────────────────────────────────────

def _create_equip_type(client, auth, code="SCH_ET01") -> dict:
    resp = client.post(
        "/api/inventory/equipment-types",
        json={"code": code, "name": f"Type {code}"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_instr_type(client, auth, code="SCH_IT01") -> dict:
    resp = client.post(
        "/api/inventory/instrument-types",
        json={"code": code, "name": f"Type {code}"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_equipment(client, auth, asset_id="SCH_EQ01", type_id: int = None) -> dict:
    if type_id is None:
        type_id = _create_equip_type(client, auth, f"SCH_ET_{asset_id}")["id"]
    resp = client.post(
        "/api/inventory/equipment-catalogue",
        json={"asset_id": asset_id, "name": f"Equipment {asset_id}", "equipment_type_id": type_id},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_instrument(client, auth, asset_id="SCH_INSTR01", type_id: int = None) -> dict:
    if type_id is None:
        type_id = _create_instr_type(client, auth, f"SCH_IT_{asset_id}")["id"]
    resp = client.post(
        "/api/inventory/instrument-catalogue",
        json={"asset_id": asset_id, "name": f"Instrument {asset_id}", "instrument_type_id": type_id},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════════
# MAINTENANCE SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════

class TestMaintenanceSchedules:

    def test_create_maintenance_schedule(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ01")
        resp = client.post(
            "/api/inventory/maintenance-schedules",
            json={
                "equipment_id": eq["id"],
                "maintenance_type": "PREVENTIVE",
                "scheduled_date": "2025-06-15",
            },
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "DUE"
        assert data["maintenance_type"] == "PREVENTIVE"

    def test_create_schedule_requires_auth(self, client: TestClient, crd):
        resp = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": 1, "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-15"},
        )
        assert resp.status_code in (401, 403)

    def test_create_schedule_invalid_equipment_returns_404(self, client: TestClient, auth):
        resp = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": 999999, "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-15"},
            headers=auth,
        )
        assert resp.status_code == 404

    def test_list_maintenance_schedules(self, client: TestClient, auth):
        resp = client.get("/api/inventory/maintenance-schedules", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_maintenance_schedule_by_id(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ02")
        ms = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": eq["id"], "maintenance_type": "CORRECTIVE", "scheduled_date": "2025-07-01"},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/maintenance-schedules/{ms['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == ms["id"]

    def test_get_nonexistent_schedule_returns_404(self, client: TestClient, auth):
        resp = client.get("/api/inventory/maintenance-schedules/999999", headers=auth)
        assert resp.status_code == 404

    def test_update_maintenance_schedule(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ03")
        ms = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": eq["id"], "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-01"},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/maintenance-schedules/{ms['id']}",
            json={"technician": "John Doe"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["technician"] == "John Doe"

    def test_complete_maintenance_schedule(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ04")
        ms = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": eq["id"], "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-01"},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/maintenance-schedules/{ms['id']}/complete",
            json={"completed_date": "2025-06-10", "notes": "Completed successfully"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"

    def test_cancel_maintenance_schedule(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ05")
        ms = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": eq["id"], "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-01"},
            headers=auth,
        ).json()
        resp = client.patch(f"/api/inventory/maintenance-schedules/{ms['id']}/cancel", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["status"] == "CANCELLED"

    def test_cannot_cancel_completed_schedule(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ06")
        ms = client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": eq["id"], "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-01"},
            headers=auth,
        ).json()
        client.patch(
            f"/api/inventory/maintenance-schedules/{ms['id']}/complete",
            json={"completed_date": "2025-06-10"},
            headers=auth,
        )
        resp = client.patch(f"/api/inventory/maintenance-schedules/{ms['id']}/cancel", headers=auth)
        assert resp.status_code == 400

    def test_list_schedules_filter_by_equipment(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "MAINT_EQ07")
        client.post(
            "/api/inventory/maintenance-schedules",
            json={"equipment_id": eq["id"], "maintenance_type": "PREVENTIVE", "scheduled_date": "2025-06-01"},
            headers=auth,
        )
        resp = client.get(f"/api/inventory/maintenance-schedules?equipment_id={eq['id']}", headers=auth)
        assert resp.status_code == 200
        for s in resp.json():
            assert s["equipment_id"] == eq["id"]


# ═══════════════════════════════════════════════════════════════════════════════
# CALIBRATION SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════

class TestCalibrationSchedules:

    def test_create_calibration_schedule(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "CALIB_INSTR01")
        resp = client.post(
            "/api/inventory/calibration-schedules",
            json={
                "instrument_id": instr["id"],
                "calibration_type": "ANNUAL",
                "scheduled_date": "2025-09-01",
            },
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "DUE"
        assert data["calibration_type"] == "ANNUAL"

    def test_create_schedule_invalid_instrument_returns_404(self, client: TestClient, auth):
        resp = client.post(
            "/api/inventory/calibration-schedules",
            json={"instrument_id": 999999, "calibration_type": "ANNUAL", "scheduled_date": "2025-09-01"},
            headers=auth,
        )
        assert resp.status_code == 404

    def test_list_calibration_schedules(self, client: TestClient, auth):
        resp = client.get("/api/inventory/calibration-schedules", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_calibration_schedule_by_id(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "CALIB_INSTR02")
        cs = client.post(
            "/api/inventory/calibration-schedules",
            json={"instrument_id": instr["id"], "calibration_type": "ANNUAL", "scheduled_date": "2025-09-01"},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/calibration-schedules/{cs['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == cs["id"]

    def test_complete_calibration_schedule(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "CALIB_INSTR03")
        cs = client.post(
            "/api/inventory/calibration-schedules",
            json={"instrument_id": instr["id"], "calibration_type": "ANNUAL", "scheduled_date": "2025-09-01"},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/calibration-schedules/{cs['id']}/complete",
            json={"completed_date": "2025-09-05", "certificate_no": "CERT-2025-001"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"
        assert resp.json()["certificate_no"] == "CERT-2025-001"

    def test_cancel_calibration_schedule(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "CALIB_INSTR04")
        cs = client.post(
            "/api/inventory/calibration-schedules",
            json={"instrument_id": instr["id"], "calibration_type": "ROUTINE", "scheduled_date": "2025-09-01"},
            headers=auth,
        ).json()
        resp = client.patch(f"/api/inventory/calibration-schedules/{cs['id']}/cancel", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["status"] == "CANCELLED"

    def test_update_calibration_schedule(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "CALIB_INSTR05")
        cs = client.post(
            "/api/inventory/calibration-schedules",
            json={"instrument_id": instr["id"], "calibration_type": "ANNUAL", "scheduled_date": "2025-09-01"},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/calibration-schedules/{cs['id']}",
            json={"technician": "Jane Smith"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["technician"] == "Jane Smith"

    def test_list_schedules_filter_by_instrument(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "CALIB_INSTR06")
        client.post(
            "/api/inventory/calibration-schedules",
            json={"instrument_id": instr["id"], "calibration_type": "ANNUAL", "scheduled_date": "2025-09-01"},
            headers=auth,
        )
        resp = client.get(f"/api/inventory/calibration-schedules?instrument_id={instr['id']}", headers=auth)
        assert resp.status_code == 200
        for s in resp.json():
            assert s["instrument_id"] == instr["id"]


# ═══════════════════════════════════════════════════════════════════════════════
# EQUIPMENT VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class TestEquipmentVerifications:

    def test_create_equipment_verification(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ01")
        resp = client.post(
            "/api/inventory/equipment-verifications",
            json={"request_no": "EV001", "equipment_id": eq["id"]},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "PENDING"
        assert data["request_no"] == "EV001"

    def test_duplicate_request_no_rejected(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ02")
        client.post("/api/inventory/equipment-verifications", json={"request_no": "EV_DUP001", "equipment_id": eq["id"]}, headers=auth)
        resp = client.post("/api/inventory/equipment-verifications", json={"request_no": "EV_DUP001", "equipment_id": eq["id"]}, headers=auth)
        assert resp.status_code == 400

    def test_list_equipment_verifications(self, client: TestClient, auth):
        resp = client.get("/api/inventory/equipment-verifications", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_verification_by_id(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ03")
        ev = client.post(
            "/api/inventory/equipment-verifications",
            json={"request_no": "EV003", "equipment_id": eq["id"]},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/equipment-verifications/{ev['id']}", headers=auth)
        assert resp.status_code == 200

    def test_verify_equipment(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ04")
        ev = client.post(
            "/api/inventory/equipment-verifications",
            json={"request_no": "EV004", "equipment_id": eq["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/equipment-verifications/{ev['id']}/verify",
            json={"remarks": "Passed"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "VERIFIED"

    def test_reject_equipment_verification(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ05")
        ev = client.post(
            "/api/inventory/equipment-verifications",
            json={"request_no": "EV005", "equipment_id": eq["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/equipment-verifications/{ev['id']}/reject",
            json={"remarks": "Failed inspection"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REJECTED"

    def test_cannot_verify_already_verified(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ06")
        ev = client.post(
            "/api/inventory/equipment-verifications",
            json={"request_no": "EV006", "equipment_id": eq["id"]},
            headers=auth,
        ).json()
        client.patch(f"/api/inventory/equipment-verifications/{ev['id']}/verify", json={}, headers=auth)
        resp = client.patch(f"/api/inventory/equipment-verifications/{ev['id']}/verify", json={}, headers=auth)
        assert resp.status_code == 400

    def test_list_verifications_filter_by_equipment(self, client: TestClient, auth):
        eq = _create_equipment(client, auth, "EV_EQ07")
        client.post(
            "/api/inventory/equipment-verifications",
            json={"request_no": "EV007", "equipment_id": eq["id"]},
            headers=auth,
        )
        resp = client.get(f"/api/inventory/equipment-verifications?equipment_id={eq['id']}", headers=auth)
        assert resp.status_code == 200
        for v in resp.json():
            assert v["equipment_id"] == eq["id"]


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class TestInstrumentVerifications:

    def test_create_instrument_verification(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "IV_INSTR01")
        resp = client.post(
            "/api/inventory/instrument-verifications",
            json={"request_no": "IV001", "instrument_id": instr["id"]},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "PENDING"

    def test_verify_instrument(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "IV_INSTR02")
        iv = client.post(
            "/api/inventory/instrument-verifications",
            json={"request_no": "IV002", "instrument_id": instr["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/instrument-verifications/{iv['id']}/verify",
            json={"remarks": "All good"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "VERIFIED"

    def test_reject_instrument_verification(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "IV_INSTR03")
        iv = client.post(
            "/api/inventory/instrument-verifications",
            json={"request_no": "IV003", "instrument_id": instr["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/instrument-verifications/{iv['id']}/reject",
            json={"remarks": "Calibration out of range"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REJECTED"

    def test_list_instrument_verifications(self, client: TestClient, auth):
        resp = client.get("/api/inventory/instrument-verifications", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_verifications_filter_by_instrument(self, client: TestClient, auth):
        instr = _create_instrument(client, auth, "IV_INSTR04")
        client.post(
            "/api/inventory/instrument-verifications",
            json={"request_no": "IV004", "instrument_id": instr["id"]},
            headers=auth,
        )
        resp = client.get(f"/api/inventory/instrument-verifications?instrument_id={instr['id']}", headers=auth)
        assert resp.status_code == 200
        for v in resp.json():
            assert v["instrument_id"] == instr["id"]
