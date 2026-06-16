"""
Tests for performance bottleneck fixes:
  1. Inventory KPIs  — 10 queries -> 7 (conditional aggregation)
  2. available-stock — N+1 loop   -> single GROUP BY query
  3. expiring-soon   — lazy load  -> selectinload
  4. pending-actions — 6x lazy loads -> selectinload on each query
  5. dashboard/counts   — Python list materialisation -> subquery
  6. dashboard/sla-alerts — same fix
"""
import sys
import time
import requests

BASE = "http://localhost:8000"
PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
WARN = "\033[33mWARN\033[0m"

results = []

def ok(name, detail=""):
    results.append(("PASS", name))
    print(f"  {PASS}  {name}" + (f"  -- {detail}" if detail else ""))

def fail(name, detail=""):
    results.append(("FAIL", name))
    print(f"  {FAIL}  {name}" + (f"  -- {detail}" if detail else ""))

def warn(name, detail=""):
    results.append(("WARN", name))
    print(f"  {WARN}  {name}" + (f"  -- {detail}" if detail else ""))

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def get(path, params=None):
    return requests.get(f"{BASE}{path}", headers=H, params=params)

def timed_get(path, params=None):
    t0 = time.monotonic()
    r = get(path, params)
    ms = (time.monotonic() - t0) * 1000
    return r, ms

# ── Auth ──────────────────────────────────────────────────────────────────────
r = requests.post(f"{BASE}/api/auth/login", json={"username": "sys.admin", "password": "Admin@123"})
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# ── 1. Inventory KPIs ─────────────────────────────────────────────────────────
section("1. Inventory KPIs -- conditional aggregation (10 queries -> 7)")

r, ms = timed_get("/api/inventory/dashboard/kpis")
if r.status_code == 200:
    data = r.json()
    ok(f"GET /kpis returned 200", f"{ms:.0f}ms")
    expected_keys = [
        "materials", "batches_available", "batches_low_stock",
        "batches_expiring_30d", "batches_expired",
        "stock_requests_pending", "stock_requests_critical",
        "maintenance_due", "calibration_due", "verifications_pending",
    ]
    for k in expected_keys:
        if k in data:
            val = data[k].get("value", "?")
            ok(f"  KPI present: {k}", f"value={val}")
        else:
            fail(f"  KPI missing: {k}")
    # Spot-check verifications_pending detail
    vp = data.get("verifications_pending", {})
    if vp.get("detail") and "Batch:" in vp["detail"]:
        ok("  verifications_pending detail breakdown present", vp["detail"])
    else:
        warn("  verifications_pending detail format unexpected", str(vp.get("detail")))
else:
    fail(f"GET /kpis", f"{r.status_code} {r.text[:200]}")

# ── 2. Available Stock ────────────────────────────────────────────────────────
section("2. Available Stock -- single GROUP BY (was N+1 loop per material)")

r, ms = timed_get("/api/inventory/dashboard/available-stock")
if r.status_code == 200:
    rows = r.json()
    ok(f"GET /available-stock returned 200", f"{ms:.0f}ms  rows={len(rows)}")
    if rows:
        row = rows[0]
        for field in ["material_id", "material_code", "material_name",
                       "material_type", "total_available", "unit",
                       "batch_count", "has_expiring"]:
            if field in row:
                ok(f"  field present: {field}", str(row[field]))
            else:
                fail(f"  field missing: {field}")
        # has_expiring must be a bool
        if isinstance(row["has_expiring"], bool):
            ok("  has_expiring is bool (not int)")
        else:
            warn("  has_expiring type", type(row["has_expiring"]).__name__)
    else:
        warn("  No rows returned (no active materials in DB)")

    # Material type filter
    r2, _ = timed_get("/api/inventory/dashboard/available-stock", {"material_type": "chemical"})
    if r2.status_code == 200:
        ok("  material_type filter works", f"rows={len(r2.json())}")
    else:
        fail("  material_type filter", f"{r2.status_code}")
else:
    fail(f"GET /available-stock", f"{r.status_code} {r.text[:200]}")

# ── 3. Expiring Soon ──────────────────────────────────────────────────────────
section("3. Expiring Soon -- selectinload(InvBatch.material) (was lazy load)")

r, ms = timed_get("/api/inventory/dashboard/expiring-soon")
if r.status_code == 200:
    rows = r.json()
    ok(f"GET /expiring-soon returned 200", f"{ms:.0f}ms  rows={len(rows)}")
    if rows:
        row = rows[0]
        for field in ["batch_id", "batch_no", "material_name", "material_code",
                       "qty_available", "unit", "expiry_date", "days_to_expiry"]:
            if field in row:
                ok(f"  field present: {field}", str(row[field]))
            else:
                fail(f"  field missing: {field}")
    else:
        warn("  No expiring batches in DB (acceptable)")

    # Custom window
    r2, _ = timed_get("/api/inventory/dashboard/expiring-soon", {"days": 365})
    if r2.status_code == 200:
        ok("  days=365 filter works", f"rows={len(r2.json())}")
    else:
        fail("  days filter", f"{r2.status_code}")
else:
    fail(f"GET /expiring-soon", f"{r.status_code} {r.text[:200]}")

# ── 4. Pending Actions ────────────────────────────────────────────────────────
section("4. Pending Actions -- selectinload on all 6 queries (was N+1 lazy loads)")

r, ms = timed_get("/api/inventory/dashboard/pending-actions")
if r.status_code == 200:
    rows = r.json()
    ok(f"GET /pending-actions returned 200", f"{ms:.0f}ms  rows={len(rows)}")
    categories_seen = {row["category"] for row in rows}
    if rows:
        row = rows[0]
        for field in ["category", "ref_no", "description", "priority"]:
            if field in row:
                ok(f"  field present: {field}", str(row[field]))
            else:
                fail(f"  field missing: {field}")
        ok(f"  categories in response: {categories_seen}")
        # Priority must be HIGH/MEDIUM/LOW
        for row in rows:
            if row["priority"] not in ("HIGH", "MEDIUM", "LOW", "CRITICAL"):
                fail(f"  invalid priority: {row['priority']}")
                break
        else:
            ok("  all priorities are valid")
    else:
        warn("  No pending actions in DB (acceptable)")
else:
    fail(f"GET /pending-actions", f"{r.status_code} {r.text[:200]}")

# ── 5. Dashboard Counts ───────────────────────────────────────────────────────
section("5. Dashboard Counts -- subquery (was Python list materialisation)")

r, ms = timed_get("/api/dashboard/counts")
if r.status_code == 200:
    data = r.json()
    ok(f"GET /dashboard/counts returned 200", f"{ms:.0f}ms")
    if "experiments" in data and "atr" in data:
        ok("  top-level keys: experiments + atr")
        exp = data["experiments"]
        for k in ["total", "by_status"]:
            if k in exp:
                ok(f"  experiments.{k} present", str(exp[k])[:40])
            else:
                fail(f"  experiments.{k} missing")
    else:
        fail("  unexpected response shape", str(list(data.keys())))
else:
    fail(f"GET /dashboard/counts", f"{r.status_code} {r.text[:200]}")

# ── 6. SLA Alerts ─────────────────────────────────────────────────────────────
section("6. SLA Alerts -- subquery (was Python list materialisation)")

r, ms = timed_get("/api/dashboard/sla-alerts")
if r.status_code == 200:
    data = r.json()
    ok(f"GET /dashboard/sla-alerts returned 200", f"{ms:.0f}ms")
    for k in ["sla_days_for_submission", "overdue_draft_experiments",
               "delayed_review_requests", "long_running_locked"]:
        if k in data:
            ok(f"  field present: {k}", str(data[k]))
        else:
            fail(f"  field missing: {k}")
else:
    fail(f"GET /dashboard/sla-alerts", f"{r.status_code} {r.text[:200]}")

# ── 7. Verification Queue + Approval Queue (no change, verify still working) ──
section("7. Dashboard queues -- still working after refactor")

for path in ["/api/dashboard/verification-queue", "/api/dashboard/approval-queue", "/api/dashboard/rework-inbox", "/api/dashboard/my-activity"]:
    r, ms = timed_get(path)
    if r.status_code == 200:
        ok(f"GET {path}", f"{ms:.0f}ms")
    else:
        fail(f"GET {path}", f"{r.status_code} {r.text[:100]}")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("  SUMMARY")
print(f"{'='*60}")
passed  = sum(1 for s, _ in results if s == "PASS")
failed  = sum(1 for s, _ in results if s == "FAIL")
warned  = sum(1 for s, _ in results if s == "WARN")

print(f"\n  Total : {len(results)}")
print(f"  {PASS} : {passed}")
print(f"  {FAIL} : {failed}")
print(f"  {WARN} : {warned}")

if failed:
    print(f"\n  Failed:")
    for s, n in results:
        if s == "FAIL":
            print(f"    * {n}")

sys.exit(0 if failed == 0 else 1)
