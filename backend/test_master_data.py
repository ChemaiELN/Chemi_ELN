"""
Manual/smoke test script for the Admin -> Master Data page
(frontend route /admin/master-data, InventoryMasterDataPage.tsx).

Covers all 11 tabs shown in that page, against the real backend REST API:
  /api/auth/login
  /api/inventory/consumable-types      (GET, POST, PATCH, PATCH .../toggle, DELETE)
  /api/inventory/equipment-types       (GET, POST, PATCH, PATCH .../toggle)
  /api/inventory/instrument-types      (GET, POST, PATCH, PATCH .../toggle)
  /api/inventory/column-types          (GET, POST, PATCH, PATCH .../toggle)
  /api/inventory/measurement-master    (GET, POST, PATCH, PATCH .../toggle)
  /api/inventory/spare-parts           (GET, POST, PATCH, PATCH .../toggle)
  /api/inventory/uom-master            (GET, POST, PATCH, PATCH .../toggle, + sub-resource /units)
  /api/inventory/lookup                (GET, POST, PATCH, PATCH .../toggle)
  /api/inventory/test-master           (GET, POST, PATCH, + sub-resources /names, /methods with DELETE)
  /api/inventory/storage-conditions    (GET, POST, PATCH, PATCH .../toggle, DELETE)
  /api/master-data/sites               (GET, POST, PATCH, DELETE)

Run with the backend server already running (see backend/start.bat), then:

    python test_master_data.py

Optional env vars:
    BASE_URL       default: http://localhost:8000
    LOGIN_USERNAME default: qa.hod
    LOGIN_PASSWORD default: password@123

Note: use LOGIN_USERNAME / LOGIN_PASSWORD, not USERNAME -- Windows already
defines a USERNAME environment variable for the logged-in OS account, which
would silently shadow this script's default.

Each section creates a throwaway record, lists, updates, toggles
is_active (where supported), then deletes it again where a real DELETE
endpoint exists -- so it's safe to re-run. Tabs with no DELETE endpoint
(only PATCH .../toggle) are left deactivated (is_active=False) rather than
removed; that's a small, harmless bit of test data (name prefixed "Test ").
"""

import os
import sys
import uuid

import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
USERNAME = os.environ.get("LOGIN_USERNAME", "qa.hod")
PASSWORD = os.environ.get("LOGIN_PASSWORD", "password@123")

API = f"{BASE_URL}/api"

PASS = []
FAIL = []


def check(label, condition, detail=""):
    if condition:
        PASS.append(label)
        print(f"  [PASS] {label}")
    else:
        FAIL.append(label)
        print(f"  [FAIL] {label} {detail}")


def login():
    print(f"\n== Logging in as {USERNAME} against {BASE_URL} ==")
    r = requests.post(f"{API}/auth/login", json={"username": USERNAME, "password": PASSWORD})
    check("login returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")
    if r.status_code != 200:
        print("\nCannot continue without a valid login. Check BASE_URL/LOGIN_USERNAME/LOGIN_PASSWORD.")
        sys.exit(1)
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def suffix(n=6):
    return uuid.uuid4().hex[:n]


# ── 1. Consumable Types (real DELETE) ─────────────────────────────

def test_consumable_types(headers):
    print("\n== Consumable Types (/api/inventory/consumable-types) ==")
    base = f"{API}/inventory/consumable-types"
    payload = {"name": f"Test Consumable {suffix()}", "description": "smoke test", "sort_order": 99}

    r = requests.get(base, headers=headers)
    check("list consumable-types returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create consumable-type returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"sort_order": 5})
    check("update consumable-type returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{row_id}/toggle", headers=headers, json={"is_active": False})
    check("toggle consumable-type returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/{row_id}", headers=headers)
    check("delete consumable-type returns 204", r.status_code == 204, f"-> {r.status_code} {r.text}")


# ── 2/3. Equipment Types / Instrument Types (toggle only) ─────────

def _test_type_table(headers, label, path):
    print(f"\n== {label} (/api/inventory/{path}) ==")
    base = f"{API}/inventory/{path}"
    payload = {"code": f"TST{suffix(4).upper()}", "name": f"Test {label} {suffix()}", "description": "smoke test"}

    r = requests.get(base, headers=headers)
    check(f"list {path} returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check(f"create {path} returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"description": "updated by smoke test"})
    check(f"update {path} returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/{row_id}/deactivate", headers=headers)
    check(f"deactivate {path} returns 200", r.status_code == 200 and r.json().get("is_active") is False, f"-> {r.status_code} {r.text}")


# ── 4. Column Types (toggle only, extra numeric fields) ───────────

def test_column_types(headers):
    print("\n== Column Types (/api/inventory/column-types) ==")
    base = f"{API}/inventory/column-types"
    payload = {
        "code": f"TSTCOL{suffix(4).upper()}",
        "name": f"Test Column {suffix()}",
        "description": "smoke test",
        "length_mm": 150,
        "particle_size_um": 5,
        "pore_size_angstrom": 100,
    }

    r = requests.get(base, headers=headers)
    check("list column-types returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create column-type returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"length_mm": 250})
    check("update column-type returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/{row_id}/deactivate", headers=headers)
    check("deactivate column-type returns 200", r.status_code == 200 and r.json().get("is_active") is False, f"-> {r.status_code} {r.text}")


# ── 5. Measurement Master (toggle only) ───────────────────────────

def test_measurement_master(headers):
    print("\n== Measurement Master (/api/inventory/measurement-master) ==")
    base = f"{API}/inventory/measurement-master"
    payload = {"name": f"Test Measurement {suffix()}", "data_type": "DECIMAL", "uom": "mg"}

    r = requests.get(base, headers=headers)
    check("list measurement-master returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create measurement-master returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"uom": "g"})
    check("update measurement-master returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{row_id}/toggle", headers=headers, json={"is_active": False})
    check("toggle measurement-master inactive", r.status_code == 200 and r.json().get("is_active") is False, f"-> {r.status_code} {r.text}")


# ── 6. Spare Parts (toggle only) ──────────────────────────────────

def test_spare_parts(headers):
    print("\n== Spare Parts (/api/inventory/spare-parts) ==")
    base = f"{API}/inventory/spare-parts"
    payload = {"part_code": f"TSTPART{suffix(4).upper()}", "name": f"Test Spare Part {suffix()}", "description": "smoke test"}

    r = requests.get(base, headers=headers)
    check("list spare-parts returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create spare-part returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"description": "updated by smoke test"})
    check("update spare-part returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{row_id}/toggle", headers=headers, json={"is_active": False})
    check("toggle spare-part inactive", r.status_code == 200 and r.json().get("is_active") is False, f"-> {r.status_code} {r.text}")


# ── 7. UOM Master (dimension + nested unit, toggle only) ──────────

def test_uom_master(headers):
    print("\n== UOM Master (/api/inventory/uom-master) ==")
    base = f"{API}/inventory/uom-master"
    dim_payload = {
        "dimension_key": f"test_dim_{suffix(5)}",
        "display_name": f"Test Dimension {suffix()}",
        "base_unit": "unit",
        "sort_order": 99,
    }

    r = requests.get(base, headers=headers)
    check("list uom-master dimensions returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=dim_payload)
    check("create uom-master dimension returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    dim_id = r.json().get("id")

    r = requests.patch(f"{base}/{dim_id}", headers=headers, json={"sort_order": 10})
    check("update uom-master dimension returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    unit_payload = {"symbol": f"tu{suffix(3)}", "name": f"Test Unit {suffix()}", "sort_order": 1}
    r = requests.post(f"{base}/{dim_id}/units", headers=headers, json=unit_payload)
    check("create uom-master unit returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    unit_id = r.json().get("id")

    r = requests.patch(f"{base}/units/{unit_id}", headers=headers, json={"sort_order": 2})
    check("update uom-master unit returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/units/{unit_id}/toggle", headers=headers, json={"is_active": False})
    check("toggle uom-master unit inactive", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{dim_id}/toggle", headers=headers, json={"is_active": False})
    check("toggle uom-master dimension inactive", r.status_code == 200, f"-> {r.status_code} {r.text}")


# ── 8. Lookup Master (toggle only) ────────────────────────────────

def test_lookup_master(headers):
    print("\n== Lookup Master (/api/inventory/lookup) ==")
    base = f"{API}/inventory/lookup"
    # lookup_type must be one of the fixed set the backend allows (see GET /types) -- "CUSTOM" is safe for a test row.
    payload = {
        "lookup_type": "CUSTOM",
        "lookup_value": f"Test Value {suffix()}",
        "lookup_code": f"TSTCODE{suffix(4).upper()}",
    }

    r = requests.get(base, headers=headers)
    check("list lookup returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create lookup returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"lookup_value": "Updated by smoke test"})
    check("update lookup returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    # toggle_lookup takes no request body -- it flips is_active unconditionally.
    was_active = r.json().get("is_active") if r.status_code == 200 else True
    r = requests.patch(f"{base}/{row_id}/toggle", headers=headers)
    check("toggle lookup flips is_active", r.status_code == 200 and r.json().get("is_active") != was_active, f"-> {r.status_code} {r.text}")


# ── 9. Test Master (type + nested name + method, names/methods have real DELETE) ──

def test_test_master(headers):
    print("\n== Test Master (/api/inventory/test-master) ==")
    base = f"{API}/inventory/test-master"
    type_key = f"test_type_{suffix(5)}"
    type_payload = {"type_key": type_key, "name": f"Test Type {suffix()}"}

    r = requests.get(base, headers=headers)
    check("list test-master types returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=type_payload)
    check("create test-master type returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{type_key}", headers=headers, json={"name": "Updated by smoke test"})
    check("update test-master type returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    name_payload = {"name": f"Test Name {suffix()}"}
    r = requests.post(f"{base}/{type_key}/names", headers=headers, json=name_payload)
    check("create test-master name returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    name_id = r.json().get("id")

    r = requests.patch(f"{base}/names/{name_id}", headers=headers, json={"name": "Updated Test Name"})
    check("update test-master name returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    method_payload = {"method_name": f"Test Method {suffix()}"}
    r = requests.post(f"{base}/names/{name_id}/methods", headers=headers, json=method_payload)
    check("create test-master method returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    method_id = r.json().get("id")

    r = requests.patch(f"{base}/methods/{method_id}", headers=headers, json={"method_name": "Updated Test Method"})
    check("update test-master method returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/methods/{method_id}", headers=headers)
    check("delete test-master method returns 204", r.status_code == 204, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/names/{name_id}", headers=headers)
    check("delete test-master name returns 204", r.status_code == 204, f"-> {r.status_code} {r.text}")
    # Note: test-master TYPE itself has no delete endpoint -- left in place (harmless, prefixed "Test ").


# ── 10. Storage Master / Storage Conditions (real DELETE) ────────

def test_storage_master(headers):
    print("\n== Storage Master (/api/inventory/storage-conditions) ==")
    base = f"{API}/inventory/storage-conditions"
    payload = {
        "label": f"Test Storage {suffix()}",
        "temperature_min": 2,
        "temperature_max": 8,
        "temperature_unit": "°C",
        "description": "smoke test",
        "sort_order": 99,
    }

    r = requests.get(base, headers=headers)
    check("list storage-conditions returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create storage-condition returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    row_id = r.json().get("id")

    r = requests.patch(f"{base}/{row_id}", headers=headers, json={"temperature_max": 25})
    check("update storage-condition returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{row_id}/toggle", headers=headers, json={"is_active": False})
    check("toggle storage-condition returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/{row_id}", headers=headers)
    check("delete storage-condition returns 204", r.status_code == 204, f"-> {r.status_code} {r.text}")


# ── 11. Sites (real DELETE, separate admin master-data module) ───

def test_sites(headers):
    print("\n== Sites (/api/master-data/sites) ==")
    base = f"{API}/master-data/sites"
    payload = {"code": f"TST{suffix(4).upper()}", "name": f"Test Site {suffix()}"}

    r = requests.get(base, headers=headers)
    check("list sites returns 200", r.status_code == 200, f"-> {r.status_code}")

    r = requests.post(base, headers=headers, json=payload)
    check("create site returns 201", r.status_code == 201, f"-> {r.status_code} {r.text}")
    site_id = r.json().get("id")

    r = requests.patch(f"{base}/{site_id}", headers=headers, json={"name": "Test Site Renamed"})
    check("update site returns 200", r.status_code == 200, f"-> {r.status_code} {r.text}")

    r = requests.patch(f"{base}/{site_id}", headers=headers, json={"is_active": False})
    check("toggle site inactive", r.status_code == 200 and r.json().get("is_active") is False, f"-> {r.status_code} {r.text}")

    r = requests.delete(f"{base}/{site_id}", headers=headers)
    check("delete site returns 204", r.status_code == 204, f"-> {r.status_code} {r.text}")


def main():
    headers = login()

    test_consumable_types(headers)
    _test_type_table(headers, "Equipment Types", "equipment-types")
    _test_type_table(headers, "Instrument Types", "instrument-types")
    test_column_types(headers)
    test_measurement_master(headers)
    test_spare_parts(headers)
    test_uom_master(headers)
    test_lookup_master(headers)
    test_test_master(headers)
    test_storage_master(headers)
    test_sites(headers)

    print("\n== Summary ==")
    print(f"Passed: {len(PASS)}   Failed: {len(FAIL)}")
    if FAIL:
        print("Failed checks:")
        for f in FAIL:
            print(f"  - {f}")
        sys.exit(1)
    print("All Master Data checks passed.")


if __name__ == "__main__":
    main()
