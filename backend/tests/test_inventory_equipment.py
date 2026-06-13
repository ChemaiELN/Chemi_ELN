"""
Tests for inventory equipment/instrument/column catalogue and type endpoints:
  /api/inventory/equipment-types
  /api/inventory/instrument-types
  /api/inventory/column-types
  /api/inventory/equipment-catalogue
  /api/inventory/instrument-catalogue
  /api/inventory/column-catalogue
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

PASSWORD = "Equipment@1234"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="eqp_chemist", password=PASSWORD)


@pytest.fixture
def auth(client: TestClient, chemist, crd):
    return get_auth_headers(client, "eqp_chemist", PASSWORD)


# ── Type helpers ──────────────────────────────────────────────────────────────

def _create_equip_type(client, auth, code="ET001") -> dict:
    resp = client.post(
        "/api/inventory/equipment-types",
        json={"code": code, "name": f"Equipment Type {code}"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_instr_type(client, auth, code="IT001") -> dict:
    resp = client.post(
        "/api/inventory/instrument-types",
        json={"code": code, "name": f"Instrument Type {code}"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_col_type(client, auth, code="CT001") -> dict:
    resp = client.post(
        "/api/inventory/column-types",
        json={"code": code, "name": f"Column Type {code}", "length_mm": 150, "particle_size_um": 5},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════════
# EQUIPMENT TYPES
# ═══════════════════════════════════════════════════════════════════════════════

class TestEquipmentTypes:

    def test_create_equipment_type(self, client: TestClient, auth):
        resp = client.post(
            "/api/inventory/equipment-types",
            json={"code": "ET_CR01", "name": "HPLC System"},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "ET_CR01"
        assert isinstance(data["id"], int)

    def test_duplicate_code_rejected(self, client: TestClient, auth):
        _create_equip_type(client, auth, "ET_DUP01")
        resp = client.post(
            "/api/inventory/equipment-types",
            json={"code": "ET_DUP01", "name": "Duplicate"},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_equipment_types(self, client: TestClient, auth):
        _create_equip_type(client, auth, "ET_LST01")
        resp = client.get("/api/inventory/equipment-types", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_equipment_type_by_id(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_GET01")
        resp = client.get(f"/api/inventory/equipment-types/{et['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == et["id"]

    def test_get_nonexistent_returns_404(self, client: TestClient, auth):
        resp = client.get("/api/inventory/equipment-types/999999", headers=auth)
        assert resp.status_code == 404

    def test_update_equipment_type(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_UPD01")
        resp = client.patch(
            f"/api/inventory/equipment-types/{et['id']}",
            json={"name": "Updated Name"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_toggle_equipment_type(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_TOG01")
        original = et.get("is_active", True)
        resp = client.patch(f"/api/inventory/equipment-types/{et['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original

    def test_list_equipment_types_search(self, client: TestClient, auth):
        _create_equip_type(client, auth, "UNIQUE_ET_SRCH01")
        resp = client.get("/api/inventory/equipment-types?search=UNIQUE_ET", headers=auth)
        assert resp.status_code == 200
        results = resp.json()
        assert any(r["code"] == "UNIQUE_ET_SRCH01" for r in results)


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT TYPES
# ═══════════════════════════════════════════════════════════════════════════════

class TestInstrumentTypes:

    def test_create_instrument_type(self, client: TestClient, auth):
        resp = client.post(
            "/api/inventory/instrument-types",
            json={"code": "IT_CR01", "name": "Mass Spectrometer"},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "IT_CR01"

    def test_duplicate_code_rejected(self, client: TestClient, auth):
        _create_instr_type(client, auth, "IT_DUP01")
        resp = client.post(
            "/api/inventory/instrument-types",
            json={"code": "IT_DUP01", "name": "Duplicate"},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_instrument_types(self, client: TestClient, auth):
        _create_instr_type(client, auth, "IT_LST01")
        resp = client.get("/api/inventory/instrument-types", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_instrument_type_by_id(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_GET01")
        resp = client.get(f"/api/inventory/instrument-types/{it['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == it["id"]

    def test_toggle_instrument_type(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_TOG01")
        original = it.get("is_active", True)
        resp = client.patch(f"/api/inventory/instrument-types/{it['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original


# ═══════════════════════════════════════════════════════════════════════════════
# COLUMN TYPES
# ═══════════════════════════════════════════════════════════════════════════════

class TestColumnTypes:

    def test_create_column_type(self, client: TestClient, auth):
        resp = client.post(
            "/api/inventory/column-types",
            json={"code": "CT_CR01", "name": "C18 Column", "length_mm": 250, "particle_size_um": 5},
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "CT_CR01"
        assert int(float(data["length_mm"])) == 250

    def test_duplicate_code_rejected(self, client: TestClient, auth):
        _create_col_type(client, auth, "CT_DUP01")
        resp = client.post(
            "/api/inventory/column-types",
            json={"code": "CT_DUP01", "name": "Duplicate", "length_mm": 100, "particle_size_um": 3},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_column_types(self, client: TestClient, auth):
        _create_col_type(client, auth, "CT_LST01")
        resp = client.get("/api/inventory/column-types", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_column_type_by_id(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_GET01")
        resp = client.get(f"/api/inventory/column-types/{ct['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == ct["id"]

    def test_toggle_column_type(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_TOG01")
        original = ct.get("is_active", True)
        resp = client.patch(f"/api/inventory/column-types/{ct['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original

    def test_update_column_type(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_UPD01")
        resp = client.patch(
            f"/api/inventory/column-types/{ct['id']}",
            json={"length_mm": 300},
            headers=auth,
        )
        assert resp.status_code == 200
        assert int(float(resp.json()["length_mm"])) == 300


# ═══════════════════════════════════════════════════════════════════════════════
# EQUIPMENT CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

class TestEquipmentCatalogue:

    def test_create_equipment(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT01")
        resp = client.post(
            "/api/inventory/equipment-catalogue",
            json={
                "asset_id": "EQ_CAT001",
                "name": "HPLC Machine A",
                "equipment_type_id": et["id"],
                "location": "Lab 1",
            },
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["asset_id"] == "EQ_CAT001"
        assert isinstance(data["id"], int)

    def test_duplicate_asset_id_rejected(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT02")
        client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "EQ_DUP001", "name": "N1", "equipment_type_id": et["id"]},
            headers=auth,
        )
        resp = client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "EQ_DUP001", "name": "N2", "equipment_type_id": et["id"]},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_equipment(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT03")
        client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "EQ_LST001", "name": "Lab Eq", "equipment_type_id": et["id"]},
            headers=auth,
        )
        resp = client.get("/api/inventory/equipment-catalogue", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_equipment_by_id(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT04")
        eq = client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "EQ_GET001", "name": "Lab Eq", "equipment_type_id": et["id"]},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/equipment-catalogue/{eq['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == eq["id"]

    def test_get_nonexistent_equipment_returns_404(self, client: TestClient, auth):
        resp = client.get("/api/inventory/equipment-catalogue/999999", headers=auth)
        assert resp.status_code == 404

    def test_update_equipment(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT05")
        eq = client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "EQ_UPD001", "name": "Original", "equipment_type_id": et["id"]},
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/equipment-catalogue/{eq['id']}",
            json={"location": "Lab 2"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["location"] == "Lab 2"

    def test_toggle_equipment(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT06")
        eq = client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "EQ_TOG001", "name": "Toggle Eq", "equipment_type_id": et["id"]},
            headers=auth,
        ).json()
        original = eq.get("is_active", True)
        resp = client.patch(f"/api/inventory/equipment-catalogue/{eq['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original

    def test_list_equipment_search(self, client: TestClient, auth):
        et = _create_equip_type(client, auth, "ET_CAT07")
        client.post(
            "/api/inventory/equipment-catalogue",
            json={"asset_id": "UNIQUE_EQ_SRCH01", "name": "SearchableEq", "equipment_type_id": et["id"]},
            headers=auth,
        )
        resp = client.get("/api/inventory/equipment-catalogue?search=UNIQUE_EQ", headers=auth)
        assert resp.status_code == 200
        assert any(r["asset_id"] == "UNIQUE_EQ_SRCH01" for r in resp.json())


# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

class TestInstrumentCatalogue:

    def test_create_instrument(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_CAT01")
        resp = client.post(
            "/api/inventory/instrument-catalogue",
            json={
                "asset_id": "INSTR_CAT001",
                "name": "Mass Spec A",
                "instrument_type_id": it["id"],
            },
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["asset_id"] == "INSTR_CAT001"

    def test_duplicate_asset_id_rejected(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_CAT02")
        client.post(
            "/api/inventory/instrument-catalogue",
            json={"asset_id": "INSTR_DUP001", "name": "N1", "instrument_type_id": it["id"]},
            headers=auth,
        )
        resp = client.post(
            "/api/inventory/instrument-catalogue",
            json={"asset_id": "INSTR_DUP001", "name": "N2", "instrument_type_id": it["id"]},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_instruments(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_CAT03")
        client.post(
            "/api/inventory/instrument-catalogue",
            json={"asset_id": "INSTR_LST001", "name": "N1", "instrument_type_id": it["id"]},
            headers=auth,
        )
        resp = client.get("/api/inventory/instrument-catalogue", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_instrument_by_id(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_CAT04")
        instr = client.post(
            "/api/inventory/instrument-catalogue",
            json={"asset_id": "INSTR_GET001", "name": "N1", "instrument_type_id": it["id"]},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/instrument-catalogue/{instr['id']}", headers=auth)
        assert resp.status_code == 200

    def test_toggle_instrument(self, client: TestClient, auth):
        it = _create_instr_type(client, auth, "IT_CAT05")
        instr = client.post(
            "/api/inventory/instrument-catalogue",
            json={"asset_id": "INSTR_TOG001", "name": "N1", "instrument_type_id": it["id"]},
            headers=auth,
        ).json()
        original = instr.get("is_active", True)
        resp = client.patch(f"/api/inventory/instrument-catalogue/{instr['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original


# ═══════════════════════════════════════════════════════════════════════════════
# COLUMN CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════

class TestColumnCatalogue:

    def test_create_column(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT01")
        resp = client.post(
            "/api/inventory/column-catalogue",
            json={
                "column_id": "COL_CAT001",
                "name": "C18 250mm",
                "column_type_id": ct["id"],
                "max_injections": 500,
            },
            headers=auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["column_id"] == "COL_CAT001"
        assert data["max_injections"] == 500

    def test_duplicate_column_id_rejected(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT02")
        client.post(
            "/api/inventory/column-catalogue",
            json={"column_id": "COL_DUP001", "name": "N1", "column_type_id": ct["id"]},
            headers=auth,
        )
        resp = client.post(
            "/api/inventory/column-catalogue",
            json={"column_id": "COL_DUP001", "name": "N2", "column_type_id": ct["id"]},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_list_columns(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT03")
        client.post(
            "/api/inventory/column-catalogue",
            json={"column_id": "COL_LST001", "name": "N1", "column_type_id": ct["id"]},
            headers=auth,
        )
        resp = client.get("/api/inventory/column-catalogue", headers=auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_column_by_id(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT04")
        col = client.post(
            "/api/inventory/column-catalogue",
            json={"column_id": "COL_GET001", "name": "N1", "column_type_id": ct["id"]},
            headers=auth,
        ).json()
        resp = client.get(f"/api/inventory/column-catalogue/{col['id']}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["id"] == col["id"]

    def test_injections_remaining_computed(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT05")
        col = client.post(
            "/api/inventory/column-catalogue",
            json={
                "column_id": "COL_INJ001",
                "name": "N1",
                "column_type_id": ct["id"],
                "max_injections": 100,
                "cumulative_injections": 30,
            },
            headers=auth,
        ).json()
        assert col["injections_remaining"] == 70

    def test_exhausted_status_when_injections_maxed(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT06")
        col = client.post(
            "/api/inventory/column-catalogue",
            json={
                "column_id": "COL_EXHT001",
                "name": "N1",
                "column_type_id": ct["id"],
                "max_injections": 100,
                "cumulative_injections": 0,
            },
            headers=auth,
        ).json()
        resp = client.patch(
            f"/api/inventory/column-catalogue/{col['id']}",
            json={"cumulative_injections": 100},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "EXHAUSTED"

    def test_toggle_column(self, client: TestClient, auth):
        ct = _create_col_type(client, auth, "CT_CAT07")
        col = client.post(
            "/api/inventory/column-catalogue",
            json={"column_id": "COL_TOG001", "name": "N1", "column_type_id": ct["id"]},
            headers=auth,
        ).json()
        original = col.get("is_active", True)
        resp = client.patch(f"/api/inventory/column-catalogue/{col['id']}/toggle", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_active"] != original
