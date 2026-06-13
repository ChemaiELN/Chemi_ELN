"""
Tests for /api/master-data endpoints (chemicals, instruments, sites).
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

PASSWORD = "Master@1234"
BASE = "/api/master-data"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def qa_role(db: Session):
    return make_role(db, "QA")


@pytest.fixture
def hod_role(db: Session):
    return make_role(db, "HOD")


@pytest.fixture
def chemist_role(db: Session):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_user(db: Session, qa_role):
    return make_user(db, qa_role.id, username="md_qa", password=PASSWORD)


@pytest.fixture
def hod_user(db: Session, hod_role):
    return make_user(db, hod_role.id, username="md_hod", password=PASSWORD)


@pytest.fixture
def chemist(db: Session, chemist_role):
    return make_user(db, chemist_role.id, username="md_chemist", password=PASSWORD)


@pytest.fixture
def crd(db: Session):
    return make_crd_settings(db)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _qa_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "md_qa", PASSWORD)


def _hod_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "md_hod", PASSWORD)


def _chemist_headers(client: TestClient) -> dict:
    return get_auth_headers(client, "md_chemist", PASSWORD)


# ─────────────────────────────────────────────────────────────────────────────
# CHEMICALS
# ─────────────────────────────────────────────────────────────────────────────

class TestChemicals:

    def test_qa_can_create_chemical(self, client: TestClient, qa_user, crd):
        resp = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Acetone", "cas_no": "67-64-1"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["chemical_name"] == "Acetone"
        assert data["cas_no"] == "67-64-1"
        assert "id" in data

    def test_hod_can_create_chemical(self, client: TestClient, hod_user, crd):
        resp = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Ethanol", "cas_no": "64-17-5"},
            headers=_hod_headers(client),
        )
        assert resp.status_code == 201
        assert resp.json()["chemical_name"] == "Ethanol"

    def test_chemist_cannot_create_chemical(self, client: TestClient, chemist, crd):
        resp = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Methanol"},
            headers=_chemist_headers(client),
        )
        assert resp.status_code == 403

    def test_create_chemical_requires_auth(self, client: TestClient, crd):
        resp = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "NoAuth"},
        )
        assert resp.status_code in (401, 403)

    def test_list_chemicals_returns_results(self, client: TestClient, qa_user, crd):
        client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Toluene", "cas_no": "108-88-3"},
            headers=_qa_headers(client),
        )
        resp = client.get(
            f"{BASE}/chemicals",
            params={"active_only": "false"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_get_chemical_by_id(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Water", "cas_no": "7732-18-5"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        chem_id = create.json()["id"]

        resp = client.get(
            f"{BASE}/chemicals/{chem_id}",
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == chem_id

    def test_get_nonexistent_chemical(self, client: TestClient, qa_user, crd):
        resp = client.get(
            f"{BASE}/chemicals/nonexistent-id-00000",
            headers=_qa_headers(client),
        )
        assert resp.status_code == 404

    def test_qa_can_update_chemical(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Hexane"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        chem_id = create.json()["id"]

        resp = client.patch(
            f"{BASE}/chemicals/{chem_id}",
            json={"chemical_name": "Updated"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert resp.json()["chemical_name"] == "Updated"

    def test_chemist_cannot_update_chemical(self, client: TestClient, qa_user, chemist, crd):
        create = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Ether"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        chem_id = create.json()["id"]

        resp = client.patch(
            f"{BASE}/chemicals/{chem_id}",
            json={"chemical_name": "HackedName"},
            headers=_chemist_headers(client),
        )
        assert resp.status_code == 403

    def test_qa_can_delete_chemical(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "ToDelete"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        chem_id = create.json()["id"]

        resp = client.delete(
            f"{BASE}/chemicals/{chem_id}",
            headers=_qa_headers(client),
        )
        assert resp.status_code == 204

        get_resp = client.get(
            f"{BASE}/chemicals/{chem_id}",
            headers=_qa_headers(client),
        )
        assert get_resp.status_code == 404

    def test_list_chemicals_search(self, client: TestClient, qa_user, crd):
        client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "Benzene", "cas_no": "71-43-2"},
            headers=_qa_headers(client),
        )
        resp = client.get(
            f"{BASE}/chemicals",
            params={"q": "benz", "active_only": "false"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        names = [c["chemical_name"] for c in resp.json()]
        assert any("Benzene" in n for n in names)

    def test_list_chemicals_active_filter(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/chemicals",
            json={"chemical_name": "InactiveChemical", "is_active": True},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        chem_id = create.json()["id"]

        client.patch(
            f"{BASE}/chemicals/{chem_id}",
            json={"is_active": False},
            headers=_qa_headers(client),
        )

        resp_active = client.get(
            f"{BASE}/chemicals",
            params={"active_only": "true"},
            headers=_qa_headers(client),
        )
        assert resp_active.status_code == 200
        ids_active = [c["id"] for c in resp_active.json()]
        assert chem_id not in ids_active

        resp_all = client.get(
            f"{BASE}/chemicals",
            params={"active_only": "false"},
            headers=_qa_headers(client),
        )
        assert resp_all.status_code == 200
        ids_all = [c["id"] for c in resp_all.json()]
        assert chem_id in ids_all


# ─────────────────────────────────────────────────────────────────────────────
# INSTRUMENTS
# ─────────────────────────────────────────────────────────────────────────────

class TestInstruments:

    def test_qa_can_create_instrument(self, client: TestClient, qa_user, crd):
        resp = client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "HPLC-01", "instrument_name": "HPLC System"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["instrument_code"] == "HPLC-01"
        assert data["instrument_name"] == "HPLC System"
        assert "id" in data

    def test_duplicate_instrument_code_rejected(self, client: TestClient, qa_user, crd):
        client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "GC-01", "instrument_name": "Gas Chromatograph"},
            headers=_qa_headers(client),
        )
        resp = client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "GC-01", "instrument_name": "Another GC"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 400

    def test_list_instruments(self, client: TestClient, qa_user, crd):
        client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "UV-01", "instrument_name": "UV Spectrophotometer"},
            headers=_qa_headers(client),
        )
        resp = client.get(
            f"{BASE}/instruments",
            params={"active_only": "false"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_get_instrument_by_id(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "IR-01", "instrument_name": "IR Spectrometer"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        inst_id = create.json()["id"]

        resp = client.get(
            f"{BASE}/instruments/{inst_id}",
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == inst_id

    def test_update_instrument(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "MS-01", "instrument_name": "Mass Spec"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        inst_id = create.json()["id"]

        resp = client.patch(
            f"{BASE}/instruments/{inst_id}",
            json={"instrument_name": "Mass Spectrometer Updated"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert resp.json()["instrument_name"] == "Mass Spectrometer Updated"

    def test_delete_instrument(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "DEL-01", "instrument_name": "ToDelete Instrument"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        inst_id = create.json()["id"]

        resp = client.delete(
            f"{BASE}/instruments/{inst_id}",
            headers=_qa_headers(client),
        )
        assert resp.status_code == 204

        get_resp = client.get(
            f"{BASE}/instruments/{inst_id}",
            headers=_qa_headers(client),
        )
        assert get_resp.status_code == 404

    def test_chemist_cannot_create_instrument(self, client: TestClient, chemist, crd):
        resp = client.post(
            f"{BASE}/instruments",
            json={"instrument_code": "CHEM-01", "instrument_name": "Forbidden Instrument"},
            headers=_chemist_headers(client),
        )
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# SITES
# ─────────────────────────────────────────────────────────────────────────────

class TestSites:

    def test_qa_can_create_site(self, client: TestClient, qa_user, crd):
        resp = client.post(
            f"{BASE}/sites",
            json={"code": "HQ", "name": "Headquarters"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "HQ"
        assert data["name"] == "Headquarters"
        assert "id" in data

    def test_duplicate_site_code_rejected(self, client: TestClient, qa_user, crd):
        client.post(
            f"{BASE}/sites",
            json={"code": "NYC", "name": "New York"},
            headers=_qa_headers(client),
        )
        resp = client.post(
            f"{BASE}/sites",
            json={"code": "NYC", "name": "New York Duplicate"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 400

    def test_list_sites(self, client: TestClient, qa_user, crd):
        client.post(
            f"{BASE}/sites",
            json={"code": "LON", "name": "London"},
            headers=_qa_headers(client),
        )
        resp = client.get(
            f"{BASE}/sites",
            params={"active_only": "false"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_update_site(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/sites",
            json={"code": "MUM", "name": "Mumbai"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        site_id = create.json()["id"]

        resp = client.patch(
            f"{BASE}/sites/{site_id}",
            json={"name": "Mumbai Updated"},
            headers=_qa_headers(client),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Mumbai Updated"

    def test_delete_site(self, client: TestClient, qa_user, crd):
        create = client.post(
            f"{BASE}/sites",
            json={"code": "DEL", "name": "ToDelete Site"},
            headers=_qa_headers(client),
        )
        assert create.status_code == 201
        site_id = create.json()["id"]

        resp = client.delete(
            f"{BASE}/sites/{site_id}",
            headers=_qa_headers(client),
        )
        assert resp.status_code == 204

        get_resp = client.get(
            f"{BASE}/sites",
            params={"active_only": "false"},
            headers=_qa_headers(client),
        )
        assert get_resp.status_code == 200
        ids = [s["id"] for s in get_resp.json()]
        assert site_id not in ids
