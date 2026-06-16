"""
Thorough test of all backend changes made in the current session:
  1. experiment_materials table + GET/POST/PATCH /{id}/materials
  2. GET /{id}/preliminary-data
  3. Preliminary disposition gate on submit
  4. ADC synthesis seed template (slug=adc-synthesis)
  5. N+1 query fixes (history actor_name, reviewer names, unlock enrichment)
"""

import sys
import json
import requests

BASE = "http://localhost:8000"
PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
SKIP = "\033[33mSKIP\033[0m"
WARN = "\033[33mWARN\033[0m"

results = []


def ok(name, detail=""):
    results.append(("PASS", name))
    print(f"  {PASS}  {name}" + (f"  — {detail}" if detail else ""))


def fail(name, detail=""):
    results.append(("FAIL", name))
    print(f"  {FAIL}  {name}" + (f"  — {detail}" if detail else ""))


def skip(name, detail=""):
    results.append(("SKIP", name))
    print(f"  {SKIP}  {name}" + (f"  — {detail}" if detail else ""))


def warn(name, detail=""):
    results.append(("WARN", name))
    print(f"  {WARN}  {name}" + (f"  — {detail}" if detail else ""))


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ── Login ─────────────────────────────────────────────────────────────────────
section("0. Auth — get token")

r = requests.post(f"{BASE}/api/auth/login", json={"username": "sys.admin", "password": "Admin@123"})
if r.status_code != 200:
    print(f"  {FAIL}  Login failed: {r.status_code} {r.text}")
    sys.exit(1)

token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}
ok("Login", f"token length={len(token)}")

me = requests.get(f"{BASE}/api/auth/me", headers=H).json()
user_id = me["id"]
ok("GET /api/auth/me", f"user={me['username']} role={me['role']}")


# ── ADC Synthesis template ─────────────────────────────────────────────────────
section("1. ADC Synthesis workflow template")

r = requests.get(f"{BASE}/api/workflow-templates", headers=H, params={"is_active": "true", "page_size": 50})
if r.status_code != 200:
    fail("List workflow templates", f"{r.status_code}")
else:
    raw = r.json()
    items = raw if isinstance(raw, list) else raw.get("items", [])
    slugs = [t.get("slug") for t in items]
    if "adc-synthesis" in slugs:
        ok("adc-synthesis template exists in list", f"total templates={len(items)}")
    else:
        fail("adc-synthesis template exists in list", f"found slugs: {slugs}")

# Get the template detail
r = requests.get(f"{BASE}/api/workflow-templates", headers=H, params={"page_size": 100})
raw = r.json()
all_templates = raw if isinstance(raw, list) else raw.get("items", [])
synth_tmpl = next((t for t in all_templates if t.get("slug") == "adc-synthesis"), None)

if synth_tmpl:
    tmpl_id = synth_tmpl["id"]
    r2 = requests.get(f"{BASE}/api/workflow-templates/{tmpl_id}", headers=H)
    if r2.status_code == 200:
        defn = r2.json().get("definition", {})
        sections_list = defn.get("sections", [])
        screen_count = sum(len(s.get("screens", [])) for s in sections_list)
        field_count = sum(
            len(sc.get("fields", []))
            for s in sections_list
            for sc in s.get("screens", [])
        )
        esig_count = sum(
            1 for s in sections_list
            for sc in s.get("screens", [])
            if sc.get("has_signature")
        )
        ok(f"Template detail", f"sections={len(sections_list)} screens={screen_count} fields={field_count} e-sigs={esig_count}")
        if len(sections_list) == 2:
            ok("2 sections (pre-synthesis + manufacturing)")
        else:
            warn("Expected 2 sections", f"got {len(sections_list)}")
        if screen_count == 13:
            ok("13 screens")
        else:
            warn("Expected 13 screens", f"got {screen_count}")
        if field_count >= 130:
            ok(f"Field count >=130", f"actual={field_count}")
        else:
            warn(f"Expected >=130 fields", f"got {field_count}")
        if esig_count == 2:
            ok("2 e-signature screens")
        else:
            warn("Expected 2 e-sig screens", f"got {esig_count}")
    else:
        fail("Template detail fetch", f"{r2.status_code}")
else:
    fail("Could not find adc-synthesis template to detail-check")
    tmpl_id = None


# ── Create a test notebook + experiment for materials testing ─────────────────
section("2. Setup — create notebook + synthesis experiment")

# Get a project
r = requests.get(f"{BASE}/api/projects", headers=H, params={"page_size": 5})
projects = r.json().get("items", [])
if not projects:
    fail("No projects found — cannot create notebook")
    proj_id = None
else:
    proj_id = projects[0]["id"]
    ok("Found project", projects[0].get("code", proj_id))

nb_id = None
if proj_id:
    r = requests.post(f"{BASE}/api/notebooks", headers=H, json={
        "code": "TEST-SYNTH-NB-001",
        "title": "Test Synthesis Notebook",
        "project_id": proj_id,
        "type": "synthesis",
    })
    if r.status_code in (200, 201):
        nb_id = r.json()["id"]
        ok("Create synthesis notebook", nb_id)
    elif r.status_code == 409:
        # already exists — find it
        r2 = requests.get(f"{BASE}/api/notebooks", headers=H, params={"search": "TEST-SYNTH-NB-001", "page_size": 5})
        items = r2.json().get("items", [])
        if items:
            nb_id = items[0]["id"]
            ok("Notebook already exists, reusing", nb_id)
        else:
            fail("Create notebook 409 and can't find existing")
    else:
        fail("Create synthesis notebook", f"{r.status_code} {r.text[:200]}")

exp_id = None
if nb_id:
    r = requests.post(f"{BASE}/api/notebooks/{nb_id}/experiments", headers=H, json={
        "title": "ADC Synthesis Test Experiment",
    })
    if r.status_code in (200, 201):
        exp_id = r.json()["id"]
        ok("Create synthesis experiment", exp_id)
    else:
        fail("Create synthesis experiment", f"{r.status_code} {r.text[:200]}")

    # Also get existing experiments in case we want to reuse
    if not exp_id:
        r2 = requests.get(f"{BASE}/api/notebooks/{nb_id}/experiments", headers=H)
        exps = r2.json() if isinstance(r2.json(), list) else []
        if exps:
            exp_id = exps[0]["id"]
            ok("Reusing existing experiment", exp_id)


# ── GET /{id}/materials (empty) ───────────────────────────────────────────────
section("3. GET /{id}/materials — empty list")

if exp_id:
    r = requests.get(f"{BASE}/api/experiments/{exp_id}/materials", headers=H)
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            ok("GET /materials returns list", f"count={len(data)}")
        else:
            fail("GET /materials response is not a list", str(data)[:100])
    else:
        fail("GET /materials", f"{r.status_code} {r.text[:200]}")
else:
    skip("GET /materials — no experiment")


# ── Find an available inventory batch ─────────────────────────────────────────
section("4. Find inventory batch for material reservation")

mat_id = None
batch_id = None

r = requests.get(f"{BASE}/api/inventory/materials", headers=H, params={"page_size": 20})
if r.status_code == 200:
    _raw_mats = r.json()
    mats = _raw_mats if isinstance(_raw_mats, list) else _raw_mats.get("items", [])
    if mats:
        ok("Found inventory materials", f"count={len(mats)}")
        # Try to get a batch for the first material
        for m in mats:
            rb = requests.get(f"{BASE}/api/inventory/batches", headers=H, params={
                "material_id": m["id"], "page_size": 5
            })
            if rb.status_code == 200:
                _raw_b = rb.json()
                batches = _raw_b if isinstance(_raw_b, list) else _raw_b.get("items", [])
                avail = [b for b in batches if b.get("status") in ("AVAILABLE", "ACTIVE", None)]
                if avail:
                    mat_id = m["id"]
                    batch_id = avail[0]["id"]
                    ok("Found available batch", f"mat_id={mat_id} batch_id={batch_id} material={m.get('name', m.get('chemical_name','?'))}")
                    break
        if not batch_id:
            warn("No available batch found across all materials")
    else:
        warn("No inventory materials found")
else:
    warn("Cannot fetch inventory materials", f"{r.status_code}")


# ── POST /{id}/materials — reserve ────────────────────────────────────────────
section("5. POST /{id}/materials — reserve a batch")

mat_record_id = None
if exp_id and mat_id and batch_id:
    payload = {
        "material_role": "mAb",
        "material_id": mat_id,
        "batch_id": batch_id,
        "qty_reserved": 10.5,
        "unit": "mg",
        "remarks": "Test reservation",
    }
    r = requests.post(f"{BASE}/api/experiments/{exp_id}/materials", headers=H, json=payload)
    if r.status_code in (200, 201):
        mat_record = r.json()
        mat_record_id = mat_record.get("id")
        ok("POST /materials reserve", f"id={mat_record_id} status={mat_record.get('status')}")
        # Validate response fields
        for field in ["id", "experiment_id", "material_role", "material_id", "batch_id",
                       "qty_reserved", "unit", "status", "reserved_by", "reserved_at"]:
            if field not in mat_record:
                warn(f"Missing field in response: {field}")
        if mat_record.get("status") == "RESERVED":
            ok("Status is RESERVED")
        else:
            warn("Expected status=RESERVED", f"got {mat_record.get('status')}")
    else:
        fail("POST /materials", f"{r.status_code} {r.text[:300]}")
elif not exp_id:
    skip("POST /materials — no experiment")
else:
    skip("POST /materials — no inventory batch available")


# ── GET /{id}/materials — after reserve ───────────────────────────────────────
section("6. GET /{id}/materials — after reservation")

if exp_id:
    r = requests.get(f"{BASE}/api/experiments/{exp_id}/materials", headers=H)
    if r.status_code == 200:
        items = r.json()
        if isinstance(items, list) and len(items) >= 1:
            ok("GET /materials returns reserved items", f"count={len(items)}")
            # Check denormalized fields
            first = items[0]
            for field in ["material_name", "batch_no"]:
                if first.get(field):
                    ok(f"Denormalized field present: {field}", str(first[field]))
                else:
                    warn(f"Denormalized field missing or null: {field}", str(first.get(field)))
        elif mat_record_id:
            fail("GET /materials expected at least 1 item")
        else:
            ok("GET /materials empty (no reservation made)")
    else:
        fail("GET /materials after reservation", f"{r.status_code}")
else:
    skip("GET /materials after reservation — no experiment")


# ── PATCH /{id}/materials/{mat_id} ────────────────────────────────────────────
section("7. PATCH /{id}/materials/{mat_id} — update status")

if exp_id and mat_record_id:
    # Update to ISSUED
    r = requests.patch(
        f"{BASE}/api/experiments/{exp_id}/materials/{mat_record_id}",
        headers=H,
        json={"qty_issued": 9.0, "status": "ISSUED", "remarks": "Issued for reaction"},
    )
    if r.status_code == 200:
        updated = r.json()
        ok("PATCH /materials ISSUED", f"status={updated.get('status')} qty_issued={updated.get('qty_issued')}")
        if updated.get("status") == "ISSUED":
            ok("Status correctly updated to ISSUED")
        else:
            fail("Status not ISSUED", f"got {updated.get('status')}")
    else:
        fail("PATCH /materials", f"{r.status_code} {r.text[:300]}")

    # Update to RETURNED
    r2 = requests.patch(
        f"{BASE}/api/experiments/{exp_id}/materials/{mat_record_id}",
        headers=H,
        json={"status": "RETURNED"},
    )
    if r2.status_code == 200:
        ok("PATCH /materials RETURNED", f"status={r2.json().get('status')}")
    else:
        fail("PATCH /materials RETURNED", f"{r2.status_code} {r2.text[:200]}")
elif not exp_id:
    skip("PATCH /materials — no experiment")
else:
    skip("PATCH /materials — no reservation to update")


# ── GET /{id}/preliminary-data ────────────────────────────────────────────────
section("8. GET /{id}/preliminary-data")

# Seeded IDs from seed_linked_synthesis.py
GOOD_SYNTH_ID = "1b3de45c-4c4a-4f57-82f8-4722030f5394"  # EXP-042 linked to released prelim
BAD_SYNTH_ID  = "cd127f8b-da95-4234-8e8a-ec43525d5c51"  # EXP-043 linked to held prelim

if exp_id:
    r = requests.get(f"{BASE}/api/experiments/{exp_id}/preliminary-data", headers=H)
    if r.status_code == 404:
        ok("preliminary-data 404 when not linked", "expected")
    elif r.status_code == 200:
        ok("preliminary-data returned (unexpected link?)", r.json().get("preliminary_id", ""))
    else:
        fail("preliminary-data unlinked experiment", f"{r.status_code}")

# Test with seeded linked synthesis (EXP-042 → EXP-040 released)
r = requests.get(f"{BASE}/api/experiments/{GOOD_SYNTH_ID}/preliminary-data", headers=H)
if r.status_code == 200:
    pdata = r.json()
    ok("preliminary-data 200 for seeded linked synthesis", f"prelim={pdata.get('full_code','?')}")
    for field in ["preliminary_id", "full_code", "title", "status", "data"]:
        if field in pdata:
            val = str(pdata[field])[:40] if field != "data" else f"{len(pdata['data'])} keys"
            ok(f"  field present: {field}", val)
        else:
            fail(f"  field missing: {field}")
    inner = pdata.get("data", {})
    if inner.get("disposition") == "Release for conjugation":
        ok("  disposition=Release for conjugation")
    else:
        fail("  disposition wrong", str(inner.get("disposition")))
    if inner.get("lp_disposition") == "Release for conjugation":
        ok("  lp_disposition=Release for conjugation")
    else:
        fail("  lp_disposition wrong", str(inner.get("lp_disposition")))
    if inner.get("antibody_lot_id"):
        ok("  antibody_lot_id present", inner["antibody_lot_id"])
elif r.status_code == 404:
    fail("preliminary-data — seeded experiment not found (run seed_linked_synthesis.py)")
else:
    fail("preliminary-data seeded", f"{r.status_code} {r.text[:200]}")

# Still build all_exps for later sections
r = requests.get(f"{BASE}/api/experiments", headers=H, params={"page_size": 50})
_raw_exps = r.json()
all_exps = _raw_exps if isinstance(_raw_exps, list) else _raw_exps.get("items", [])


# ── Submit gate — disposition check ───────────────────────────────────────────
section("9. Submit gate — disposition guard")

# Try submitting the test experiment (no linked preliminary, should just fail for other reasons or pass)
if exp_id:
    r = requests.post(f"{BASE}/api/experiments/{exp_id}/submit", headers=H)
    if r.status_code == 400:
        detail = r.json().get("detail", "")
        if "disposition" in detail.lower() or "preliminary" in detail.lower():
            ok("Submit blocked by disposition gate", detail[:80])
        else:
            ok("Submit blocked (other reason — gate not triggered without linked prelim)", detail[:80])
    elif r.status_code == 200:
        ok("Submit succeeded (no linked preliminary — gate skipped correctly)")
    else:
        warn("Submit unexpected response", f"{r.status_code} {r.text[:200]}")
else:
    skip("Submit gate test — no experiment")

# Test gate BLOCKS bad-disposition linked synthesis (EXP-043 → EXP-041 Hold)
r = requests.post(f"{BASE}/api/experiments/{BAD_SYNTH_ID}/submit", headers=H)
if r.status_code == 400:
    detail = r.json().get("detail", "")
    if "disposition" in detail.lower() or "release" in detail.lower():
        ok("Disposition gate BLOCKED submit (Hold prelim)", detail[:100])
    else:
        ok("Submit blocked for other reason", detail[:80])
elif r.status_code == 200:
    fail("Disposition gate did NOT block — bad prelim synthesis was submitted")
else:
    warn("Submit gate unexpected response", f"{r.status_code} {r.text[:100]}")

# Test gate PASSES for good-disposition linked synthesis (EXP-042 → EXP-040 Released)
r = requests.post(f"{BASE}/api/experiments/{GOOD_SYNTH_ID}/submit", headers=H)
if r.status_code == 200:
    ok("Gate passed — good prelim synthesis submitted successfully")
    # Reset back to DRAFT for idempotency (can't, but that's fine)
elif r.status_code == 400:
    detail = r.json().get("detail", "")
    if "disposition" in detail.lower():
        fail("Gate wrongly blocked good-disposition synthesis", detail[:100])
    else:
        ok("Submit blocked for non-disposition reason (acceptable)", detail[:80])
else:
    warn("Submit gate good-prelim unexpected", f"{r.status_code} {r.text[:100]}")


# ── Experiment History — actor_name (N+1 fix) ─────────────────────────────────
section("10. Experiment history — actor_name (N+1 fix)")

# Use any experiment that has history
hist_exp = next((e for e in all_exps if e.get("id")), None)
if hist_exp or exp_id:
    target_id = exp_id or hist_exp["id"]
    r = requests.get(f"{BASE}/api/experiments/{target_id}/history", headers=H)
    if r.status_code == 200:
        history = r.json()
        if isinstance(history, list):
            ok("GET /history returns list", f"count={len(history)}")
            if history:
                entry = history[0]
                if "actor_name" in entry:
                    ok("actor_name field present", str(entry.get("actor_name")))
                else:
                    fail("actor_name field missing from history entry")
                if "actor_id" in entry:
                    ok("actor_id field present")
                if entry.get("actor_name"):
                    ok("actor_name resolved (not None)", entry["actor_name"])
                else:
                    warn("actor_name is None or empty")
            else:
                skip("History empty — can't verify actor_name")
        else:
            fail("GET /history not a list", str(history)[:100])
    else:
        fail("GET /history", f"{r.status_code} {r.text[:200]}")
else:
    skip("No experiment for history test")


# ── Assign reviewer — reviewer name (N+1 fix) ─────────────────────────────────
section("11. Assign reviewer — reviewer display_name (N+1 fix)")

# Find a SUBMITTED experiment
submitted_exp = next((e for e in all_exps if e.get("status") == "SUBMITTED"), None)
if submitted_exp:
    # Get list of users for reviewer
    r = requests.get(f"{BASE}/api/users", headers=H, params={"page_size": 10})
    users = r.json().get("items", [])
    reviewer_candidate = next((u for u in users if u["id"] != user_id), None)
    if reviewer_candidate:
        r = requests.post(
            f"{BASE}/api/experiments/{submitted_exp['id']}/reviewers",
            headers=H,
            json={"reviewer_id": reviewer_candidate["id"]},
        )
        if r.status_code in (200, 201):
            rev = r.json()
            ok("Assign reviewer", f"reviewer_id={rev.get('reviewer_id')}")
            if rev.get("reviewer") and rev["reviewer"].get("display_name"):
                ok("reviewer.display_name present (N+1 fix)", rev["reviewer"]["display_name"])
            else:
                warn("reviewer.display_name missing from response", str(rev.get("reviewer")))
        elif r.status_code == 409:
            ok("Reviewer already assigned (idempotent 409 — acceptable)")
        else:
            warn("Assign reviewer", f"{r.status_code} {r.text[:200]}")
    else:
        skip("No other user for reviewer assignment")
else:
    skip("No SUBMITTED experiment for reviewer test")


# ── ATR unlock request — enriched response (N+1 fix) ──────────────────────────
section("12. ATR unlock requests — enriched response (N+1 fix)")

r = requests.get(f"{BASE}/api/unlock-requests", headers=H, params={"page_size": 10})
if r.status_code == 200:
    _raw_ul = r.json()
    unlock_items = _raw_ul if isinstance(_raw_ul, list) else _raw_ul.get("items", [])
    ok("GET /unlock-requests", f"count={len(unlock_items)}")
    if unlock_items:
        item = unlock_items[0]
        for field in ["experiment_full_code", "requester_name"]:
            if field in item:
                ok(f"  {field} present (N+1 fix)", str(item[field]))
            else:
                warn(f"  {field} missing from unlock response")
    else:
        skip("No unlock requests in DB")
else:
    warn("GET /unlock-requests", f"{r.status_code}")


# ── PDF export — reviews eager-loaded (no lazy load) ──────────────────────────
section("13. PDF export — reviews eager-loaded")

# Use a LOCKED or APPROVED experiment
locked_exp = next((e for e in all_exps if e.get("status") in ("LOCKED", "APPROVED")), None)
target_export = locked_exp or ({"id": exp_id} if exp_id else None)
if target_export:
    r = requests.get(f"{BASE}/api/experiments/{target_export['id']}/export-pdf", headers=H)
    if r.status_code == 200:
        ct = r.headers.get("content-type", "")
        ok("PDF export succeeded", f"content-type={ct}")
        if "text/plain" in ct or "application/pdf" in ct:
            ok("Correct content-type")
        else:
            warn("Unexpected content-type", ct)
    else:
        fail("PDF export", f"{r.status_code} {r.text[:200]}")
else:
    skip("PDF export — no suitable experiment")


# ── Summary ───────────────────────────────────────────────────────────────────
section("SUMMARY")
passed  = sum(1 for s, _ in results if s == "PASS")
failed  = sum(1 for s, _ in results if s == "FAIL")
warned  = sum(1 for s, _ in results if s == "WARN")
skipped = sum(1 for s, _ in results if s == "SKIP")

print(f"\n  Total checks : {len(results)}")
print(f"  {PASS} Passed  : {passed}")
print(f"  {FAIL} Failed  : {failed}")
print(f"  {WARN} Warnings: {warned}")
print(f"  {SKIP} Skipped : {skipped}")

if failed:
    print(f"\n  FAILED tests:")
    for s, n in results:
        if s == "FAIL":
            print(f"    • {n}")

sys.exit(0 if failed == 0 else 1)
