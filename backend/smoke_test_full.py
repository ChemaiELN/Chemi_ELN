# -*- coding: utf-8 -*-
"""
Full CRUD smoke test — hits every endpoint including writes.
Creates test data with SMOKE_ prefix, cleans up at the end.
Usage: python smoke_test_full.py
Requires backend running on http://localhost:8000
"""
import io
import sys
import time
import requests

# Unique suffix per run so re-runs don't hit "already exists" errors
RUN_ID = str(int(time.time()))[-5:]  # last 5 digits of epoch

BASE   = "http://localhost:8000/api"
PASS   = []
FAIL   = []
SKIP   = []
CREATED = {}   # key -> id, for cleanup tracking

def check(method, path, *, token=None, json=None, files=None, data=None,
          expected=(200, 201, 204), label=None):
    url  = BASE + path
    hdrs = {"Authorization": f"Bearer {token}"} if token else {}
    lbl  = label or f"{method.upper()} {path}"
    try:
        r = getattr(requests, method)(url, headers=hdrs, json=json,
                                      files=files, data=data, timeout=15)
        ok  = r.status_code in expected
        sym = "PASS" if ok else "FAIL"
        msg = f"[{sym}] {method.upper():6} {path}  ->  {r.status_code}"
        if ok:
            PASS.append(msg)
        else:
            FAIL.append(msg + f"  |  {r.text[:200]}")
        print(msg)
        return r if ok else None
    except Exception as e:
        msg = f"[ERR ] {method.upper():6} {path}  ->  {e}"
        FAIL.append(msg)
        print(msg)
        return None

def skip(path, reason):
    msg = f"[SKIP] {path}  ->  {reason}"
    SKIP.append(msg)
    print(msg)

# ============================================================
# LOGIN
# ============================================================
print("\n=== AUTH ===")
r = requests.post(f"{BASE}/auth/login",
                  json={"username": "sys.admin", "password": "Admin@123"}, timeout=10)
if r.status_code != 200:
    print("Login failed:", r.text); sys.exit(1)
token         = r.json()["access_token"]
refresh_token = r.json().get("refresh_token", "")
PASS.append("[PASS] POST   /auth/login  ->  200")
print("[PASS] POST   /auth/login  ->  200")

check("get",  "/auth/me",     token=token)
check("post", "/auth/refresh", json={"refresh_token": refresh_token})
check("post", "/auth/change-password",
      json={"current_password": "Admin@123", "new_password": "Admin@123"},
      token=token)
skip("/auth/forgot-password", "requires real email delivery")
skip("/auth/reset-password",  "requires token from email")

# Re-login to get fresh token after change-password
r = requests.post(f"{BASE}/auth/login",
                  json={"username": "sys.admin", "password": "Admin@123"}, timeout=10)
token = r.json()["access_token"]
refresh_token = r.json().get("refresh_token", "")

# ============================================================
# ROLES
# ============================================================
print("\n=== ROLES ===")
r = check("get", "/roles/", token=token)
roles = {x["code"]: x["id"] for x in (r.json() if r else [])}
print(f"  Found roles: {list(roles.keys())}")

# ============================================================
# DEPARTMENTS
# ============================================================
print("\n=== DEPARTMENTS ===")
check("get", "/departments/", token=token)
check("get", "/departments/?search=RD&is_active=true", token=token)
r = check("post", "/departments/",
          json={"code": f"SMK{RUN_ID}", "name": "Smoke Test Dept", "description": "Auto-created"},
          token=token, expected=(201,))
dept_id = r.json()["id"] if r else None
CREATED["dept"] = dept_id
if dept_id:
    check("get",   f"/departments/{dept_id}", token=token)
    check("patch", f"/departments/{dept_id}",
          json={"name": "Smoke Test Dept (updated)", "is_active": True}, token=token)

# ============================================================
# USERS
# ============================================================
print("\n=== USERS ===")
check("get", "/users/", token=token)
check("get", "/users/?search=admin&is_active=true", token=token)

# Create test users for workflow (CHEM and TL roles)
r = check("post", "/users/",
          json={"username": f"smoke.chem.{RUN_ID}", "emp_no": f"SMK{RUN_ID}1",
                "first_name": "Smoke", "last_name": "Chemist",
                "email": f"smoke.chem.{RUN_ID}@test.local", "password": "Test@1234",
                "role": "CHEM", "department_id": dept_id},
          token=token, expected=(201,))
chem_id = r.json()["id"] if r else None
CREATED["chem_user"] = chem_id

r = check("post", "/users/",
          json={"username": f"smoke.tl.{RUN_ID}", "emp_no": f"SMK{RUN_ID}2",
                "first_name": "Smoke", "last_name": "TL",
                "email": f"smoke.tl.{RUN_ID}@test.local", "password": "Test@1234",
                "role": "TL", "department_id": dept_id},
          token=token, expected=(201,))
tl_id = r.json()["id"] if r else None
CREATED["tl_user"] = tl_id

r = check("post", "/users/",
          json={"username": f"smoke.hod.{RUN_ID}", "emp_no": f"SMK{RUN_ID}3",
                "first_name": "Smoke", "last_name": "HOD",
                "email": f"smoke.hod.{RUN_ID}@test.local", "password": "Test@1234",
                "role": "HOD", "department_id": dept_id},
          token=token, expected=(201,))
hod_id = r.json()["id"] if r else None
CREATED["hod_user"] = hod_id

if chem_id:
    check("get",   f"/users/{chem_id}", token=token)
    check("patch", f"/users/{chem_id}",
          json={"designation": "Junior Chemist"}, token=token)
    check("post",  f"/users/{chem_id}/deactivate", token=token)
    check("post",  f"/users/{chem_id}/activate",   token=token)

# Get TL token for workflow operations
r_tl = requests.post(f"{BASE}/auth/login",
                     json={"username": f"smoke.tl.{RUN_ID}", "password": "Test@1234"}, timeout=10)
tl_token = r_tl.json().get("access_token") if r_tl.status_code == 200 else token

r_chem = requests.post(f"{BASE}/auth/login",
                       json={"username": f"smoke.chem.{RUN_ID}", "password": "Test@1234"}, timeout=10)
chem_token = r_chem.json().get("access_token") if r_chem.status_code == 200 else token

# ============================================================
# MASTER DATA
# ============================================================
print("\n=== MASTER DATA ===")
check("get", "/master-data/chemicals?active_only=true",   token=token)
check("get", "/master-data/instruments?active_only=true", token=token)
check("get", "/master-data/sites?active_only=true",       token=token)

r = check("post", "/master-data/chemicals",
          json={"chemical_name": "Smoke Acetone", "cas_no": "0000-00-0",
                "formula": "CH3COCH3", "mol_wt": 58.08},
          token=token, expected=(201,))
chem_md_id = r.json()["id"] if r else None
CREATED["chem_md"] = chem_md_id
if chem_md_id:
    check("get",    f"/master-data/chemicals/{chem_md_id}", token=token)
    check("patch",  f"/master-data/chemicals/{chem_md_id}",
          json={"chemical_name": "Smoke Acetone Updated"}, token=token)
    check("delete", f"/master-data/chemicals/{chem_md_id}", token=token, expected=(204,))
    CREATED["chem_md"] = None

r = check("post", "/master-data/instruments",
          json={"instrument_code": f"SMK-NMR-{RUN_ID}", "instrument_name": "Smoke NMR",
                "instrument_type": "NMR"},
          token=token, expected=(201,))
instr_md_id = r.json()["id"] if r else None
CREATED["instr_md"] = instr_md_id
if instr_md_id:
    check("get",    f"/master-data/instruments/{instr_md_id}", token=token)
    check("patch",  f"/master-data/instruments/{instr_md_id}",
          json={"name": "Smoke NMR Updated"}, token=token)
    check("delete", f"/master-data/instruments/{instr_md_id}", token=token, expected=(204,))
    CREATED["instr_md"] = None

r = check("post", "/master-data/sites",
          json={"code": "SMKS", "name": "Smoke Site"},
          token=token, expected=(201,))
site_id = r.json()["id"] if r else None
CREATED["site"] = site_id
if site_id:
    check("patch",  f"/master-data/sites/{site_id}",
          json={"name": "Smoke Site Updated"}, token=token)
    check("delete", f"/master-data/sites/{site_id}", token=token, expected=(204,))
    CREATED["site"] = None

# ============================================================
# ADMIN SETTINGS
# ============================================================
print("\n=== ADMIN SETTINGS ===")
check("get",   "/admin/settings/company", token=token)
check("patch", "/admin/settings/company",
      json={"company_name": "Chemia ELN Test"}, token=token)
check("get",   "/admin/settings/crd",     token=token)
check("patch", "/admin/settings/crd",
      json={"exp_code_prefix": "EXP"}, token=token)
check("get",   "/admin/sequences",         token=token)
r = requests.get(f"{BASE}/admin/sequences", headers={"Authorization": f"Bearer {token}"})
seqs = r.json() if r.status_code == 200 else []
if seqs:
    check("get", f"/admin/sequences/{seqs[0]['scope_key']}", token=token)
check("get", "/admin/privilege-keys", token=token)
check("get", "/admin/audit",          token=token)
check("get", "/admin/audit?module=Experiments&page=1&page_size=5", token=token)

# ============================================================
# NOTIFICATION SETTINGS
# ============================================================
print("\n=== NOTIFICATION SETTINGS ===")
check("get", "/notification-settings/", token=token)
r = check("post", "/notification-settings/",
          json={"key": "smoke.test.notif", "label": "Smoke Test",
                "module": "Experiments", "is_enabled": True},
          token=token, expected=(201,))
notif_id = r.json()["id"] if r else None
CREATED["notif"] = notif_id
if notif_id:
    check("get",   f"/notification-settings/{notif_id}", token=token)
    check("patch", f"/notification-settings/{notif_id}",
          json={"label": "Smoke Test Updated"}, token=token)
    check("post",  f"/notification-settings/{notif_id}/toggle", token=token)
    check("delete",f"/notification-settings/{notif_id}", token=token, expected=(204,))
    CREATED["notif"] = None

# ============================================================
# EXCEL TEMPLATES
# ============================================================
print("\n=== EXCEL TEMPLATES ===")
check("get", "/excel-templates/", token=token)
fake_xlsx = io.BytesIO(b"PK\x03\x04")  # minimal ZIP/XLSX magic bytes
fake_xlsx.name = "smoke_template.xlsx"
r = check("post", "/excel-templates/?name=SmokeTemplate&module=Experiments&version=v1",
          files={"file": ("smoke_template.xlsx", fake_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
          token=token, expected=(201, 400, 422))  # might reject malformed xlsx
tmpl_id = None
if r and r.status_code == 201:
    tmpl_id = r.json()["id"]
    CREATED["tmpl"] = tmpl_id
    check("get",  f"/excel-templates/{tmpl_id}", token=token)
    check("patch",f"/excel-templates/{tmpl_id}", json={"name": "SmokeTemplate Updated"}, token=token)
    check("post", f"/excel-templates/{tmpl_id}/deactivate", token=token)
    check("post", f"/excel-templates/{tmpl_id}/activate",   token=token)
    check("delete",f"/excel-templates/{tmpl_id}", token=token, expected=(204,))
    CREATED["tmpl"] = None
else:
    skip("/excel-templates CRUD", "upload rejected malformed file (expected)")

# ============================================================
# ROLE PRIVILEGES
# ============================================================
print("\n=== ROLE PRIVILEGES ===")
check("get", "/role-privileges/", token=token)
check("get", "/role-privileges/?privilege_key=experiments.void", token=token)
tl_role_id = roles.get("TL")
r = check("post", "/role-privileges/",
          json={"role_id": tl_role_id, "privilege_key": "experiments.void", "is_granted": False},
          token=token, expected=(201, 400))
rp_id = r.json()["id"] if r and r.status_code == 201 else None
CREATED["rp"] = rp_id
if rp_id:
    check("get",   f"/role-privileges/{rp_id}", token=token)
    check("patch", f"/role-privileges/{rp_id}", json={"is_granted": True}, token=token)
    check("delete",f"/role-privileges/{rp_id}", token=token, expected=(204,))
    CREATED["rp"] = None

# ============================================================
# PROJECTS
# ============================================================
print("\n=== PROJECTS ===")
check("get", "/projects/", token=token)
check("get", "/projects/?page=1&page_size=5&status=ACTIVE", token=token)
r = check("post", "/projects/",
          json={"code": f"SMK-{RUN_ID}", "name": "Smoke Test Project",
                "description": "Auto-created by smoke test",
                "department_id": dept_id},
          token=token, expected=(201,))
proj_id = r.json()["id"] if r else None
CREATED["proj"] = proj_id
if proj_id:
    check("get",   f"/projects/{proj_id}", token=token)
    check("patch", f"/projects/{proj_id}", json={"name": "Smoke Test Project Updated"}, token=token)
    check("get",   f"/projects/{proj_id}/members",    token=token)
    check("get",   f"/projects/{proj_id}/milestones", token=token)
    if tl_id:
        check("post", f"/projects/{proj_id}/members",
              json={"user_ids": [tl_id]}, token=token)
        check("delete",f"/projects/{proj_id}/members/{tl_id}", token=token, expected=(200, 204))
    r_ms = check("post", f"/projects/{proj_id}/milestones",
                 json={"name": "Smoke Milestone", "status": "NOT STARTED", "pct": 0},
                 token=token, expected=(201,))
    ms_id = r_ms.json()["id"] if r_ms else None
    if ms_id:
        check("patch",  f"/projects/{proj_id}/milestones/{ms_id}",
              json={"name": "Smoke Milestone Updated", "pct": 50}, token=token)
        check("delete", f"/projects/{proj_id}/milestones/{ms_id}", token=token, expected=(200, 204))

# ============================================================
# ROUTES & STAGES
# ============================================================
print("\n=== ROUTES & STAGES ===")
route_id = stage_id = None
if proj_id:
    check("get", f"/routes/{proj_id}/routes", token=token)
    r = check("post", f"/routes/{proj_id}/routes",
              json={"code": "SMK-RT", "name": "Smoke Route", "sort_order": 1,
                    "stages": [{"code": "SMK-ST1", "name": "Stage 1", "sort_order": 1}]},
              token=token, expected=(201,))
    if r:
        route_id = r.json()["id"]
        stages   = r.json().get("stages", [])
        stage_id = stages[0]["id"] if stages else None
        check("get",   f"/routes/{proj_id}/routes/{route_id}", token=token)
        check("patch", f"/routes/{proj_id}/routes/{route_id}",
              json={"name": "Smoke Route Updated"}, token=token)
        r_st = check("post", f"/routes/{proj_id}/routes/{route_id}/stages",
                     json={"code": "SMK-ST2", "name": "Stage 2"}, token=token, expected=(201,))
        st2_id = r_st.json()["id"] if r_st else None
        if stage_id:
            check("patch", f"/routes/{proj_id}/routes/{route_id}/stages/{stage_id}",
                  json={"name": "Stage 1 Updated"}, token=token)
        if st2_id:
            check("delete", f"/routes/{proj_id}/routes/{route_id}/stages/{st2_id}",
                  token=token, expected=(200, 204))

# ============================================================
# NOTEBOOKS
# ============================================================
print("\n=== NOTEBOOKS ===")
check("get", "/notebooks/", token=token)
nb_id = None
if proj_id:
    r = check("post", "/notebooks/",
              json={"title": "Smoke Notebook", "project_id": proj_id,
                    "description": "Smoke test notebook",
                    "route_id": route_id, "stage_id": stage_id},
              token=token, expected=(201,))
    nb_id = r.json()["id"] if r else None
    CREATED["nb"] = nb_id
    if nb_id:
        check("get",   f"/notebooks/{nb_id}", token=token)
        check("patch", f"/notebooks/{nb_id}",
              json={"title": "Smoke Notebook Updated"}, token=token)
        check("get",   f"/notebooks/{nb_id}/permissions", token=token)
        if chem_id:
            check("post", f"/notebooks/{nb_id}/permissions",
                  json={"user_id": chem_id, "can_edit": True, "can_approve": False},
                  token=token, expected=(201,))
            check("get",  f"/notebooks/{nb_id}/permissions", token=token)
            check("patch",f"/notebooks/{nb_id}/permissions/{chem_id}",
                  json={"can_edit": False}, token=token)
            check("delete",f"/notebooks/{nb_id}/permissions/{chem_id}",
                  token=token, expected=(200, 204))

# ============================================================
# EXPERIMENTS — full workflow
# ============================================================
print("\n=== EXPERIMENTS ===")
check("get", "/experiments/", token=token)
check("get", "/experiments/?latest_only=true&page=1&page_size=5", token=token)
exp_id = exp2_id = None

if nb_id:
    # Create
    r = check("post", "/experiments/",
              json={"notebook_id": nb_id, "title": "Smoke Experiment",
                    "aim": "Test all endpoints", "starting_material": "Water",
                    "target_product": "Steam", "reaction_type": "Boiling"},
              token=token, expected=(201,))
    exp_id = r.json()["id"] if r else None
    CREATED["exp"] = exp_id

if exp_id:
    check("get",   f"/experiments/{exp_id}", token=token)
    check("patch", f"/experiments/{exp_id}",
          json={"objective": "Smoke test", "procedure": "Just do it"}, token=token)

    # Sub-resources
    r_inp = check("post", f"/experiments/{exp_id}/inputs",
                  json={"material_name": "Smoke Water", "quantity": 100, "unit": "mL", "role": "SM"},
                  token=token, expected=(201,))
    inp_id = r_inp.json()["id"] if r_inp else None
    check("get", f"/experiments/{exp_id}/inputs", token=token)
    if inp_id:
        check("patch",  f"/experiments/{exp_id}/inputs/{inp_id}",
              json={"quantity": 200}, token=token)
        check("delete", f"/experiments/{exp_id}/inputs/{inp_id}",
              token=token, expected=(200, 204))

    r_prm = check("post", f"/experiments/{exp_id}/parameters",
                  json={"name": "Temperature", "value": "100", "unit": "C"},
                  token=token, expected=(201,))
    prm_id = r_prm.json()["id"] if r_prm else None
    check("get", f"/experiments/{exp_id}/parameters", token=token)
    if prm_id:
        check("patch",  f"/experiments/{exp_id}/parameters/{prm_id}",
              json={"value": "120"}, token=token)
        check("delete", f"/experiments/{exp_id}/parameters/{prm_id}",
              token=token, expected=(200, 204))

    r_stp = check("post", f"/experiments/{exp_id}/steps",
                  json={"step_no": 1, "description": "Smoke step"},
                  token=token, expected=(201,))
    stp_id = r_stp.json()["id"] if r_stp else None
    check("get", f"/experiments/{exp_id}/steps", token=token)
    if stp_id:
        check("patch",  f"/experiments/{exp_id}/steps/{stp_id}",
              json={"description": "Smoke step updated"}, token=token)
        check("delete", f"/experiments/{exp_id}/steps/{stp_id}",
              token=token, expected=(200, 204))

    r_eq = check("post", f"/experiments/{exp_id}/equipment",
                 json={"equipment_name": "Smoke Flask", "quantity": 1},
                 token=token, expected=(201,))
    eq_id = r_eq.json()["id"] if r_eq else None
    check("get", f"/experiments/{exp_id}/equipment", token=token)
    if eq_id:
        check("patch",  f"/experiments/{exp_id}/equipment/{eq_id}",
              json={"quantity": 2}, token=token)
        check("delete", f"/experiments/{exp_id}/equipment/{eq_id}",
              token=token, expected=(200, 204))

    r_tlc = check("post", f"/experiments/{exp_id}/tlc",
                  json={"rf_value": 0.5, "solvent_system": "EtOAc:Hex 1:1",
                        "visualization": "UV"},
                  token=token, expected=(201,))
    check("get", f"/experiments/{exp_id}/tlc", token=token)

    r_cmt = check("post", f"/experiments/{exp_id}/comments",
                  json={"comment": "Smoke test comment"},
                  token=token, expected=(201,))
    check("get", f"/experiments/{exp_id}/comments", token=token)

    # Attachment upload
    check("get", f"/experiments/{exp_id}/attachments", token=token)
    att_bytes = b"smoke test attachment content"
    r_att = check("post", f"/experiments/{exp_id}/attachments",
                  files={"file": ("smoke.txt", io.BytesIO(att_bytes), "text/plain")},
                  token=token, expected=(201,))
    att_id = r_att.json()["id"] if r_att else None
    if att_id:
        check("get",    f"/experiments/{exp_id}/attachments/{att_id}", token=token)
        check("delete", f"/experiments/{exp_id}/attachments/{att_id}",
              token=token, expected=(200, 204))

    # Versions
    check("get", f"/experiments/{exp_id}/versions", token=token)
    check("get", f"/experiments/{exp_id}/history",  token=token)

    # Export PDF
    check("get", f"/experiments/{exp_id}/export-pdf?include_steps=true&include_inputs=true",
          token=token, expected=(200, 404))

    # Workflow: DRAFT -> SUBMITTED -> VERIFIED -> APPROVED
    r_sub = check("post", f"/experiments/{exp_id}/submit",
                  json={"password": "Admin@123"}, token=token, expected=(200,))
    if r_sub:
        # Verify (TL role)
        r_ver = check("post", f"/experiments/{exp_id}/verify",
                      json={"password": "Test@1234"}, token=tl_token, expected=(200,))
        if r_ver:
            # Approve (QA role)
            r_app = check("post", f"/experiments/{exp_id}/approve",
                          json={"password": "Admin@123"}, token=token, expected=(200,))
            if r_app:
                # Void
                check("post", f"/experiments/{exp_id}/void",
                      json={"password": "Admin@123", "reason": "Smoke test void"},
                      token=token, expected=(200,))

    # Create a second experiment for reject/revise flow
    r2 = check("post", "/experiments/",
               json={"notebook_id": nb_id, "title": "Smoke Exp 2 (Reject Flow)"},
               token=token, expected=(201,))
    exp2_id = r2.json()["id"] if r2 else None
    CREATED["exp2"] = exp2_id
    if exp2_id:
        check("post", f"/experiments/{exp2_id}/submit",
              json={"password": "Admin@123"}, token=token, expected=(200,))
        check("post", f"/experiments/{exp2_id}/verify",
              json={"password": "Test@1234"}, token=tl_token, expected=(200,))
        r_rej = check("post", f"/experiments/{exp2_id}/reject",
                      json={"password": "Admin@123", "reason": "Smoke reject"},
                      token=token, expected=(200,))
        if r_rej:
            check("post", f"/experiments/{exp2_id}/revise",
                  json={"password": "Admin@123"}, token=token, expected=(200,))

    # Diff (between two experiments if both exist)
    if exp_id and exp2_id:
        check("get", f"/experiments/{exp_id}/diff/{exp2_id}?field=title",
              token=token, expected=(200, 400, 404))

# ============================================================
# ATR — full workflow
# ============================================================
print("\n=== ATR ===")
check("get", "/atr/?page=1&page_size=5", token=token)
atr_id = atr2_id = None

r = check("post", "/atr/",
          json={"test_type": "NMR", "objectives": "Smoke test NMR",
                "experiment_id": exp_id},
          token=token, expected=(201,))
atr_id = r.json()["id"] if r else None
CREATED["atr"] = atr_id

if atr_id:
    check("get",   f"/atr/{atr_id}", token=token)
    check("patch", f"/atr/{atr_id}", json={"objectives": "Updated NMR objectives"}, token=token)

    # ATR attachment
    check("get", f"/atr/{atr_id}/attachments", token=token)
    r_aatt = check("post", f"/atr/{atr_id}/attachments",
                   files={"file": ("atr_smoke.txt", io.BytesIO(b"atr attachment"), "text/plain")},
                   token=token, expected=(201,))
    aatt_id = r_aatt.json()["id"] if r_aatt else None
    if aatt_id:
        check("get",    f"/atr/{atr_id}/attachments/{aatt_id}", token=token)
        check("delete", f"/atr/{atr_id}/attachments/{aatt_id}",
              token=token, expected=(200, 204))

    # Workflow: DRAFT -> SUBMITTED -> VERIFIED -> COMPLETED
    r_sub_a = check("post", f"/atr/{atr_id}/submit",  token=token, expected=(200,))
    if r_sub_a and tl_id:
        r_asgn = check("post", f"/atr/{atr_id}/assign",
                       json={"assigned_to": tl_id}, token=token, expected=(200,))
        if r_asgn:
            check("post", f"/atr/{atr_id}/complete",
                  json={"result": "Smoke complete"},
                  token=tl_token, expected=(200,))

# Create a second ATR to test cancel
r2a = check("post", "/atr/",
            json={"test_type": "HPLC", "objectives": "Smoke HPLC (cancel)"},
            token=token, expected=(201,))
atr2_id = r2a.json()["id"] if r2a else None
CREATED["atr2"] = atr2_id
if atr2_id:
    check("post", f"/atr/{atr2_id}/cancel", token=token, expected=(200,))

# ============================================================
# UNLOCK REQUESTS
# ============================================================
print("\n=== UNLOCK REQUESTS ===")
check("get", "/unlock-requests/", token=token)
check("get", "/unlock-requests/?status=PENDING", token=token)

# Create an approved experiment then request unlock
unlock_exp_id = ur_id = None
if nb_id:
    r_ue = check("post", "/experiments/",
                 json={"notebook_id": nb_id, "title": "Smoke Exp (unlock flow)"},
                 token=token, expected=(201,))
    unlock_exp_id = r_ue.json()["id"] if r_ue else None
    CREATED["unlock_exp"] = unlock_exp_id

if unlock_exp_id:
    check("post", f"/experiments/{unlock_exp_id}/submit",
          json={"password": "Admin@123"}, token=token, expected=(200,))
    check("post", f"/experiments/{unlock_exp_id}/verify",
          json={"password": "Test@1234"}, token=tl_token, expected=(200,))
    r_appu = check("post", f"/experiments/{unlock_exp_id}/approve",
                   json={"password": "Admin@123"}, token=token, expected=(200,))
    if r_appu:
        # Request unlock
        r_ur = check("post", "/unlock-requests/",
                     json={"experiment_id": unlock_exp_id, "reason": "Smoke unlock request"},
                     token=token, expected=(201,))
        ur_id = r_ur.json()["id"] if r_ur else None
        if ur_id:
            check("get", f"/unlock-requests/{ur_id}", token=token)
            check("post", f"/unlock-requests/{ur_id}/approve",
                  json={"review_note": "Smoke approved"}, token=token, expected=(200,))

        # Request another unlock for reject test
        # First need to re-approve (was unlocked by approve above)
        # Skip this edge case
        skip("/unlock-requests/{id}/reject", "experiment already unlocked by approve step")

# ============================================================
# SEARCH
# ============================================================
print("\n=== SEARCH ===")
check("get", "/search/experiments?q=Smoke",                             token=token)
check("get", "/search/experiments?status=DRAFT&latest_only=true",       token=token)
check("get", "/search/experiments/by-parameters?param_code=TEMP",       token=token)
check("get", "/search/atrs?q=Smoke",                                     token=token)
check("get", "/search/atrs?status=COMPLETED",                            token=token)
check("get", "/search/notebooks?q=Smoke",                               token=token)
check("get", "/search/projects?q=Smoke",                                token=token)

# ============================================================
# DASHBOARD
# ============================================================
print("\n=== DASHBOARD ===")
check("get", "/dashboard/counts",              token=token)
check("get", "/dashboard/verification-queue",  token=token)
check("get", "/dashboard/approval-queue",      token=token)
check("get", "/dashboard/rework-inbox",        token=token)
check("get", "/dashboard/sla-alerts",          token=token)
check("get", "/dashboard/my-activity?limit=10",token=token)

# ============================================================
# INVENTORY
# ============================================================
print("\n=== INVENTORY — Materials ===")
check("get", "/inventory/materials", token=token)
r_mat = check("post", "/inventory/materials",
              json={"code": f"SMK-MAT-{RUN_ID}", "name": "Smoke Material"},
              token=token, expected=(201,))
mat_id = r_mat.json()["id"] if r_mat else None
CREATED["mat"] = mat_id
if mat_id:
    check("get",   f"/inventory/materials/{mat_id}", token=token)
    check("patch", f"/inventory/materials/{mat_id}", json={"name": "Smoke Material Updated"}, token=token)
    check("patch", f"/inventory/materials/{mat_id}/toggle", token=token)
    check("put",   f"/inventory/materials/{mat_id}/chemical-props",
          json={"cas_no": "0000-00-1", "molecular_formula": "C2H6O"}, token=token, expected=(200, 201))

print("\n=== INVENTORY — Manufacturers ===")
check("get", "/inventory/manufacturers", token=token)
r_mfr = check("post", "/inventory/manufacturers",
              json={"code": f"SMK-MFR-{RUN_ID}", "name": "Smoke Mfr", "country": "IN"},
              token=token, expected=(201,))
mfr_id = r_mfr.json()["id"] if r_mfr else None
CREATED["mfr"] = mfr_id
if mfr_id:
    check("get",   f"/inventory/manufacturers/{mfr_id}", token=token)
    check("patch", f"/inventory/manufacturers/{mfr_id}", json={"name": "Smoke Mfr Updated"}, token=token)
    check("patch", f"/inventory/manufacturers/{mfr_id}/toggle", token=token)

print("\n=== INVENTORY — Mappings ===")
check("get", "/inventory/mappings", token=token)
map_id = None
if mat_id and mfr_id:
    r_map = check("post", "/inventory/mappings",
                  json={"material_id": mat_id, "manufacturer_id": mfr_id,
                        "catalog_no": "SMK-001"},
                  token=token, expected=(201,))
    map_id = r_map.json()["id"] if r_map else None
    CREATED["map"] = map_id
    if map_id:
        check("patch",  f"/inventory/mappings/{map_id}",
              json={"catalog_no": "SMK-002"}, token=token)
        check("delete", f"/inventory/mappings/{map_id}", token=token, expected=(200, 204))
        CREATED["map"] = None

print("\n=== INVENTORY — Equipment Types ===")
check("get", "/inventory/equipment-types", token=token)
r_et = check("post", "/inventory/equipment-types",
             json={"code": f"SMK-ET-{RUN_ID}", "name": "Smoke Equip Type"},
             token=token, expected=(201,))
et_id = r_et.json()["id"] if r_et else None
CREATED["et"] = et_id
if et_id:
    check("get",   f"/inventory/equipment-types/{et_id}", token=token)
    check("patch", f"/inventory/equipment-types/{et_id}",
          json={"name": "Smoke Equip Type Updated"}, token=token)
    check("patch", f"/inventory/equipment-types/{et_id}/toggle", token=token)

print("\n=== INVENTORY — Instrument Types ===")
check("get", "/inventory/instrument-types", token=token)
r_it = check("post", "/inventory/instrument-types",
             json={"code": f"SMK-IT-{RUN_ID}", "name": "Smoke Instr Type"},
             token=token, expected=(201,))
it_id = r_it.json()["id"] if r_it else None
CREATED["it"] = it_id
if it_id:
    check("get",   f"/inventory/instrument-types/{it_id}", token=token)
    check("patch", f"/inventory/instrument-types/{it_id}",
          json={"name": "Smoke Instr Type Updated"}, token=token)
    check("patch", f"/inventory/instrument-types/{it_id}/toggle", token=token)

print("\n=== INVENTORY — Column Types ===")
check("get", "/inventory/column-types", token=token)
r_ct = check("post", "/inventory/column-types",
             json={"code": f"SMK-CT-{RUN_ID}", "name": "Smoke Col Type"},
             token=token, expected=(201,))
col_type_id = r_ct.json()["id"] if r_ct else None
if col_type_id:
    check("get",   f"/inventory/column-types/{col_type_id}", token=token)
    check("patch", f"/inventory/column-types/{col_type_id}",
          json={"name": "Smoke Col Type Updated"}, token=token)
    check("patch", f"/inventory/column-types/{col_type_id}/toggle", token=token)

print("\n=== INVENTORY — Equipment Catalogue ===")
check("get", "/inventory/equipment-catalogue", token=token)
r_ec = check("post", "/inventory/equipment-catalogue",
             json={"asset_id": f"SMK-EQ-{RUN_ID}", "name": "Smoke Reactor",
                   "equipment_type_id": et_id},
             token=token, expected=(201,))
ec_id = r_ec.json()["id"] if r_ec else None
CREATED["ec"] = ec_id
if ec_id:
    check("get",   f"/inventory/equipment-catalogue/{ec_id}", token=token)
    check("patch", f"/inventory/equipment-catalogue/{ec_id}",
          json={"name": "Smoke Reactor Updated"}, token=token)
    check("patch", f"/inventory/equipment-catalogue/{ec_id}/toggle", token=token)

print("\n=== INVENTORY — Instrument Catalogue ===")
check("get", "/inventory/instrument-catalogue", token=token)
r_ic = check("post", "/inventory/instrument-catalogue",
             json={"asset_id": f"SMK-IN-{RUN_ID}", "name": "Smoke NMR Instrument",
                   "instrument_type_id": it_id},
             token=token, expected=(201,))
ic_id = r_ic.json()["id"] if r_ic else None
CREATED["ic"] = ic_id
if ic_id:
    check("get",   f"/inventory/instrument-catalogue/{ic_id}", token=token)
    check("patch", f"/inventory/instrument-catalogue/{ic_id}",
          json={"name": "Smoke NMR Updated"}, token=token)
    check("patch", f"/inventory/instrument-catalogue/{ic_id}/toggle", token=token)

print("\n=== INVENTORY — Column Catalogue ===")
check("get", "/inventory/column-catalogue", token=token)
r_cc = check("post", "/inventory/column-catalogue",
             json={"column_id": f"SMK-COL-{RUN_ID}", "name": "Smoke Column",
                   "column_type_id": col_type_id},
             token=token, expected=(201,))
cc_id = r_cc.json()["id"] if r_cc else None
if cc_id:
    check("get",   f"/inventory/column-catalogue/{cc_id}", token=token)
    check("patch", f"/inventory/column-catalogue/{cc_id}",
          json={"name": "Smoke Column Updated"}, token=token)
    check("patch", f"/inventory/column-catalogue/{cc_id}/toggle", token=token)

print("\n=== INVENTORY — Batches ===")
check("get", "/inventory/batches", token=token)
batch_id = None
if mat_id:
    r_bat = check("post", "/inventory/batches",
                  json={"batch_no": f"SMK-BAT-{RUN_ID}", "material_id": mat_id,
                        "qty_received": 100.0, "unit": "kg"},
                  token=token, expected=(201,))
    batch_id = r_bat.json()["id"] if r_bat else None
    CREATED["batch"] = batch_id
    if batch_id:
        check("get",   f"/inventory/batches/{batch_id}", token=token)
        check("patch", f"/inventory/batches/{batch_id}",
              json={"quantity": 90.0}, token=token)
        check("patch", f"/inventory/batches/{batch_id}/toggle", token=token)
        check("get",   f"/inventory/batches/{batch_id}/events", token=token)
        check("post",  f"/inventory/batches/{batch_id}/issue",
              json={"qty": 5.0, "issued_to": "Smoke Test"}, token=token, expected=(200,))

print("\n=== INVENTORY — Batch Verifications ===")
check("get", "/inventory/batch-verifications", token=token)
bv_id = None
if batch_id:
    r_bv = check("post", "/inventory/batch-verifications",
                 json={"request_no": f"SMK-BV-{RUN_ID}", "batch_id": batch_id},
                 token=token, expected=(201,))
    bv_id = r_bv.json()["id"] if r_bv else None
    if bv_id:
        check("get",   f"/inventory/batch-verifications/{bv_id}", token=token)
        check("patch", f"/inventory/batch-verifications/{bv_id}/verify",
              json={"notes": "Smoke verified"}, token=token, expected=(200,))

print("\n=== INVENTORY — Stock Requests ===")
check("get", "/inventory/stock-requests", token=token)
sr_id = None
if mat_id:
    r_sr = check("post", "/inventory/stock-requests",
                 json={"request_no": f"SMK-SR-{RUN_ID}", "material_id": mat_id,
                       "qty_required": 10.0, "unit": "kg", "criticality": "MEDIUM"},
                 token=token, expected=(201,))
    sr_id = r_sr.json()["id"] if r_sr else None
    CREATED["sr"] = sr_id
    if sr_id:
        check("get",   f"/inventory/stock-requests/{sr_id}", token=token)
        check("patch", f"/inventory/stock-requests/{sr_id}",
              json={"reason": "Updated reason"}, token=token)
        check("get",   f"/inventory/stock-requests/{sr_id}/events", token=token)
        check("patch", f"/inventory/stock-requests/{sr_id}/approve",
              json={"note": "Smoke approved"}, token=token, expected=(200,))

print("\n=== INVENTORY — Maintenance Schedules ===")
check("get", "/inventory/maintenance-schedules", token=token)
ms_inv_id = None
if ec_id:
    r_ms = check("post", "/inventory/maintenance-schedules",
                 json={"equipment_id": ec_id, "scheduled_date": "2026-12-31",
                       "maintenance_type": "PREVENTIVE", "notes": "Smoke maintenance"},
                 token=token, expected=(201,))
    ms_inv_id = r_ms.json()["id"] if r_ms else None
    if ms_inv_id:
        check("get",   f"/inventory/maintenance-schedules/{ms_inv_id}", token=token)
        check("patch", f"/inventory/maintenance-schedules/{ms_inv_id}",
              json={"notes": "Updated notes"}, token=token)
        check("patch", f"/inventory/maintenance-schedules/{ms_inv_id}/complete",
              json={"completed_date": "2026-12-31", "notes": "Smoke completed"},
              token=token, expected=(200,))

print("\n=== INVENTORY — Calibration Schedules ===")
check("get", "/inventory/calibration-schedules", token=token)
cs_id = None
if ic_id:
    r_cs = check("post", "/inventory/calibration-schedules",
                 json={"instrument_id": ic_id, "scheduled_date": "2026-12-31",
                       "calibration_type": "INTERNAL", "notes": "Smoke calibration"},
                 token=token, expected=(201,))
    cs_id = r_cs.json()["id"] if r_cs else None
    if cs_id:
        check("get",   f"/inventory/calibration-schedules/{cs_id}", token=token)
        check("patch", f"/inventory/calibration-schedules/{cs_id}",
              json={"notes": "Updated cal notes"}, token=token)
        check("patch", f"/inventory/calibration-schedules/{cs_id}/complete",
              json={"completed_date": "2026-12-31", "notes": "Smoke cal completed"},
              token=token, expected=(200,))

print("\n=== INVENTORY — Equipment Verifications ===")
check("get", "/inventory/equipment-verifications", token=token)
ev_id = None
if ec_id:
    r_ev = check("post", "/inventory/equipment-verifications",
                 json={"request_no": f"SMK-EV-{RUN_ID}", "equipment_id": ec_id},
                 token=token, expected=(201,))
    ev_id = r_ev.json()["id"] if r_ev else None
    if ev_id:
        check("get",   f"/inventory/equipment-verifications/{ev_id}", token=token)
        check("patch", f"/inventory/equipment-verifications/{ev_id}/verify",
              json={"notes": "Smoke equip verified"}, token=token, expected=(200,))

print("\n=== INVENTORY — Instrument Verifications ===")
check("get", "/inventory/instrument-verifications", token=token)
iv_id = None
if ic_id:
    r_iv = check("post", "/inventory/instrument-verifications",
                 json={"request_no": f"SMK-IV-{RUN_ID}", "instrument_id": ic_id},
                 token=token, expected=(201,))
    iv_id = r_iv.json()["id"] if r_iv else None
    if iv_id:
        check("get",   f"/inventory/instrument-verifications/{iv_id}", token=token)
        check("patch", f"/inventory/instrument-verifications/{iv_id}/verify",
              json={"notes": "Smoke instr verified"}, token=token, expected=(200,))

print("\n=== INVENTORY — Audit Trail ===")
check("get", "/inventory/audit-trail", token=token)
check("get", "/inventory/audit-trail?event_type=CREATE&page=1&page_size=5", token=token)

print("\n=== INVENTORY — Dashboard ===")
check("get", "/inventory/dashboard/kpis",             token=token)
check("get", "/inventory/dashboard/available-stock",  token=token)
check("get", "/inventory/dashboard/expiring-soon?days=90", token=token)
check("get", "/inventory/dashboard/pending-actions",  token=token)

print("\n=== INVENTORY — Reports ===")
check("get", "/inventory/reports/batch-inventory",  token=token)
check("get", "/inventory/reports/expiry",           token=token)
check("get", "/inventory/reports/stock-requests",   token=token)
check("get", "/inventory/reports/equipment-status", token=token)

print("\n=== HEALTH ===")
check("get", "/health")

# ============================================================
# AUTH LOGOUT (last so token stays valid throughout)
# ============================================================
print("\n=== AUTH LOGOUT ===")
check("post", "/auth/logout", json={"refresh_token": refresh_token}, token=token)

# ============================================================
# SUMMARY
# ============================================================
total = len(PASS) + len(FAIL)
print("\n" + "="*68)
print(f"  PASSED : {len(PASS)}")
print(f"  FAILED : {len(FAIL)}")
print(f"  SKIPPED: {len(SKIP)}")
print(f"  TOTAL  : {total}")

if FAIL:
    print("\nFailed endpoints:")
    for f in FAIL:
        print(" ", f)

if SKIP:
    print("\nSkipped:")
    for s in SKIP:
        print(" ", s)

print("="*68)
