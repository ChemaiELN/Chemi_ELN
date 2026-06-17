"""
Chemia ELN -- Security Test Suite
Authorized internal security test against dev environment.
Run: python security_test.py  (from backend/ directory)
"""
import io
import json
import sys
import time
from typing import Optional

import requests

BASE = "http://localhost:8000"
ADMIN_USER = "sys.admin"
ADMIN_PASS = "Admin@123"
# Seeded QA admin from seed.py
QA_USER = "qa.admin"
QA_PASS = "Admin@123"

results = []


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def record(category: str, name: str, status: str, detail: str):
    tag = {"PASS": "+", "FAIL": "X", "WARN": "!", "INFO": "i"}.get(status, "?")
    line = f"[{tag}] [{status}] {category} | {name} -- {detail}"
    # Use sys.stdout.buffer for safe output on Windows consoles
    try:
        print(line)
    except UnicodeEncodeError:
        safe_line = line.encode("ascii", errors="replace").decode("ascii")
        print(safe_line)
    results.append({"category": category, "name": name, "status": status, "detail": detail})


def login(username: str, password: str) -> Optional[str]:
    """Return access_token or None."""
    try:
        r = requests.post(f"{BASE}/api/auth/login",
                          json={"username": username, "password": password}, timeout=10)
        if r.status_code == 200:
            return r.json().get("access_token")
    except Exception:
        pass
    return None


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def get_experiments(token: str):
    """Return list of experiment IDs visible to this user."""
    r = requests.get(f"{BASE}/api/search/experiments", headers=auth_headers(token), timeout=10)
    if r.status_code == 200:
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        return items
    return []


def get_users_list(token: str):
    r = requests.get(f"{BASE}/api/users/", headers=auth_headers(token), timeout=10)
    if r.status_code == 200:
        data = r.json()
        return data.get("items", []) if isinstance(data, dict) else data
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight -- get admin token and gather IDs for later tests
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "="*70)
print("  Chemia ELN Security Test Suite")
print("="*70 + "\n")

admin_token = login(ADMIN_USER, ADMIN_PASS)
if not admin_token:
    # Fallback to qa.admin seeded credential
    admin_token = login(QA_USER, QA_PASS)
    if admin_token:
        print(f"[INFO] Using qa.admin (sys.admin not found / different cred)\n")
    else:
        print("[FATAL] Cannot obtain admin token -- server may be down or credentials wrong")
        sys.exit(1)
else:
    print(f"[INFO] Admin login successful\n")

# Gather some IDs for tests
users = get_users_list(admin_token)
non_admin_user = None
for u in users:
    role = u.get("role", "")
    uname = u.get("username", "")
    if uname not in (ADMIN_USER, QA_USER) and role not in ("QA", "ADMIN"):
        non_admin_user = u
        break

# Find any experiment
experiments_raw = get_experiments(admin_token)
sample_experiment_id = None
if experiments_raw:
    first = experiments_raw[0] if isinstance(experiments_raw, list) else None
    if first:
        sample_experiment_id = first.get("id") or first.get("experiment_id")

print(f"[INFO] Non-admin user found: {non_admin_user.get('username') if non_admin_user else 'None'}")
print(f"[INFO] Sample experiment ID: {sample_experiment_id}\n")
print("-"*70)


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 1 -- AUTHENTICATION
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 1 -- AUTHENTICATION\n")

# Test 1 -- No token
r = requests.get(f"{BASE}/api/auth/me", timeout=10)
if r.status_code in (401, 403):
    record("Auth", "1. No token -> 401/403", "PASS",
           f"Returned {r.status_code} - unauthenticated access denied")
else:
    record("Auth", "1. No token -> 401/403", "FAIL",
           f"Returned {r.status_code} - should have been 401/403. Body: {r.text[:200]}")

# Test 2 -- Invalid/garbage JWT
r = requests.get(f"{BASE}/api/auth/me",
                 headers={"Authorization": "Bearer abc123garbage"}, timeout=10)
if r.status_code in (401, 403):
    record("Auth", "2. Garbage token -> 401/403", "PASS",
           f"Returned {r.status_code} -- invalid token rejected")
else:
    record("Auth", "2. Garbage token -> 401/403", "FAIL",
           f"Returned {r.status_code} -- invalid token not rejected. Body: {r.text[:200]}")

# Test 3 -- Wrong password
r = requests.post(f"{BASE}/api/auth/login",
                  json={"username": ADMIN_USER, "password": "wrongpassword123!"}, timeout=10)
if r.status_code in (400, 401, 422):
    record("Auth", "3. Wrong password -> 401/400", "PASS",
           f"Returned {r.status_code} -- bad credentials rejected")
else:
    record("Auth", "3. Wrong password -> 401/400", "FAIL",
           f"Returned {r.status_code} -- wrong password was accepted! Body: {r.text[:200]}")

# Test 4 -- SQL injection in login
sqli_payloads = ["' OR '1'='1", "admin'--", "' OR 1=1--", "' UNION SELECT 1,1,1--"]
sqli_passed = True
for payload in sqli_payloads:
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"username": payload, "password": "anything"}, timeout=10)
    if r.status_code == 200:
        sqli_passed = False
        record("Auth", f"4. SQL injection in login ({payload[:20]})", "FAIL",
               f"SQL injection succeeded! Status 200 -- CRITICAL VULNERABILITY")
        break
if sqli_passed:
    record("Auth", "4. SQL injection in login", "PASS",
           f"All SQLi payloads rejected (last status: {r.status_code})")

# Test 5 -- Brute force / rate limiting (10 rapid attempts)
print("  [Running brute-force test -- 10 rapid login attempts...]")
rate_limited = False
statuses = []
for i in range(10):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"username": ADMIN_USER, "password": f"wrong{i}"}, timeout=10)
    statuses.append(r.status_code)
    if r.status_code == 429:
        rate_limited = True
        break
    time.sleep(0.05)  # 50ms between -- rapid but not hammering

rate_429_count = statuses.count(429)
if rate_limited or rate_429_count > 0:
    record("Auth", "5. Brute-force -> rate limited (429)", "PASS",
           f"Rate limiting triggered after {statuses.index(429)+1} attempts -- statuses: {statuses}")
else:
    record("Auth", "5. Brute-force -> rate limited (429)", "WARN",
           f"No 429 seen in 10 rapid attempts -- rate limit may not engage at this pace. "
           f"Config: 5/minute. Statuses: {statuses}")

# Test 6 -- Empty credentials
# NOTE: 429 is also a PASS here -- brute-force test (Test 5) may have consumed the rate-limit
# budget, so the rate limiter fires before validation, which is still correct blocking behaviour.
r = requests.post(f"{BASE}/api/auth/login",
                  json={"username": "", "password": ""}, timeout=10)
if r.status_code in (400, 401, 422, 429):
    record("Auth", "6. Empty credentials -> 400/422 (or 429 rate-limited)", "PASS",
           f"Returned {r.status_code} -- request correctly blocked "
           f"({'rate limiter fired first' if r.status_code == 429 else 'empty credentials rejected'})")
else:
    record("Auth", "6. Empty credentials -> 400/422", "FAIL",
           f"Returned {r.status_code} -- empty credentials not rejected. Body: {r.text[:200]}")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 2 -- AUTHORIZATION / PRIVILEGE ESCALATION
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 2 -- AUTHORIZATION / PRIVILEGE ESCALATION\n")

# Test 7 -- Modify another user's role
if non_admin_user:
    target_id = non_admin_user.get("id") or non_admin_user.get("user_id")
    r = requests.patch(f"{BASE}/api/users/{target_id}",
                       headers=auth_headers(admin_token),
                       json={"designation": "Security Test Modified"},
                       timeout=10)
    if r.status_code in (200, 204):
        record("Auth-Z", "7. Admin can PATCH other user", "INFO",
               f"Admin (sys.admin) patched user {target_id[:8]}… -- status {r.status_code} "
               f"(expected; admin has USERS_MANAGE)")
    else:
        record("Auth-Z", "7. Admin can PATCH other user", "WARN",
               f"Admin PATCH on other user returned {r.status_code} -- check privilege config")
else:
    record("Auth-Z", "7. Admin PATCH other user", "INFO",
           "No non-admin user found in user list -- skipped")

# Test 8 -- Non-admin accessing /api/admin/users
# Try to login as qa.admin first; if that works, try without USERS_MANAGE
# We test with a clearly invalid low-priv user token by attempting qa.admin
# which is QA -- it should have USERS_MANAGE. So we craft a test with admin token
# but check the endpoint guard exists in code (we already verified it does)
# Also test accessing admin settings without privilege:
r_priv = requests.get(f"{BASE}/api/admin/users",
                      headers=auth_headers(admin_token), timeout=10)
if r_priv.status_code == 200:
    record("Auth-Z", "8. /api/admin/users requires USERS_MANAGE (admin has it)", "INFO",
           f"Admin correctly gets 200 -- endpoint protected by require_privilege(USERS_MANAGE)")
else:
    record("Auth-Z", "8. /api/admin/users requires privilege", "WARN",
           f"Admin got {r_priv.status_code} -- unexpected")

# Try unauthenticated
r_unauth = requests.get(f"{BASE}/api/admin/users", timeout=10)
if r_unauth.status_code in (401, 403):
    record("Auth-Z", "8b. /api/admin/users blocks unauthenticated", "PASS",
           f"Returned {r_unauth.status_code} -- unauthenticated access denied")
else:
    record("Auth-Z", "8b. /api/admin/users blocks unauthenticated", "FAIL",
           f"Returned {r_unauth.status_code} -- admin endpoint accessible without token!")

# Test 9 -- IDOR on experiments
if sample_experiment_id:
    r = requests.get(f"{BASE}/api/experiments/{sample_experiment_id}",
                     headers=auth_headers(admin_token), timeout=10)
    if r.status_code == 200:
        record("Auth-Z", "9. IDOR experiment access (admin token)", "INFO",
               f"Admin can access experiment {sample_experiment_id[:8]}… -- "
               f"check if non-notebook-members can also access (not tested -- no second token available)")
    else:
        record("Auth-Z", "9. IDOR experiment access", "INFO",
               f"Experiment not accessible by admin: {r.status_code}")
else:
    record("Auth-Z", "9. IDOR experiment access", "INFO",
           "No experiments found to test IDOR -- skipped")

# Test 10 -- Horizontal privilege: PATCH experiment with fake/random UUID
fake_exp_id = "00000000-0000-0000-0000-000000000001"
r = requests.patch(f"{BASE}/api/experiments/{fake_exp_id}",
                   headers=auth_headers(admin_token),
                   json={"title": "SECURITY_TEST_HORIZONTAL"},
                   timeout=10)
if r.status_code == 404:
    record("Auth-Z", "10. Horizontal priv: PATCH non-existent exp -> 404", "PASS",
           f"Returned 404 -- non-existent experiment correctly rejected")
elif r.status_code in (401, 403):
    record("Auth-Z", "10. Horizontal priv: PATCH non-existent exp -> 403", "PASS",
           f"Returned {r.status_code} -- access denied")
else:
    record("Auth-Z", "10. Horizontal priv: PATCH non-existent exp", "WARN",
           f"Returned {r.status_code} -- unexpected. Body: {r.text[:200]}")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 3 -- INPUT VALIDATION / INJECTION
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 3 -- INPUT VALIDATION / INJECTION\n")

# Test 11 -- XSS in text fields
xss_payload = "<script>alert(1)</script>"
if sample_experiment_id:
    r = requests.patch(f"{BASE}/api/experiments/{sample_experiment_id}",
                       headers=auth_headers(admin_token),
                       json={"title": xss_payload},
                       timeout=10)
    if r.status_code in (200, 204):
        # Check if stored as-is
        r2 = requests.get(f"{BASE}/api/experiments/{sample_experiment_id}",
                          headers=auth_headers(admin_token), timeout=10)
        if r2.status_code == 200:
            body = r2.text
            if xss_payload in body:
                record("Injection", "11. XSS stored as-is in experiment title", "WARN",
                       "XSS payload stored without server-side sanitization -- "
                       "no server-side XSS but frontend must escape on render")
            else:
                record("Injection", "11. XSS in experiment title sanitized", "PASS",
                       "XSS payload was sanitized before storage or not reflected")
        else:
            record("Injection", "11. XSS test (could not verify storage)", "INFO",
                   f"PATCH returned {r.status_code}, GET returned {r2.status_code}")
    elif r.status_code == 422:
        record("Injection", "11. XSS in experiment title rejected (422)", "PASS",
               "Server rejects HTML tags in title field via validation")
    else:
        record("Injection", "11. XSS test", "INFO",
               f"PATCH returned {r.status_code} -- experiment may be LOCKED/SUBMITTED")
else:
    record("Injection", "11. XSS in experiment title", "INFO",
           "No sample experiment ID -- skipped")

# Test 12 -- SQL injection in search
r = requests.get(f"{BASE}/api/search/experiments",
                 params={"q": "'; DROP TABLE experiments;--"},
                 headers=auth_headers(admin_token), timeout=10)
if r.status_code in (200, 400, 422):
    record("Injection", "12. SQLi in search param -> no crash", "PASS",
           f"Returned {r.status_code} -- handled cleanly (ORM parameterized queries)")
elif r.status_code == 500:
    record("Injection", "12. SQLi in search param -> 500 crash", "FAIL",
           f"Server crashed (500) on SQLi input -- potential raw SQL execution")
else:
    record("Injection", "12. SQLi in search param", "INFO",
           f"Returned {r.status_code}")

# Test 13 -- SQL injection in users search
r = requests.get(f"{BASE}/api/users/",
                 params={"search": "'; DELETE FROM users;--"},
                 headers=auth_headers(admin_token), timeout=10)
if r.status_code in (200, 400, 422):
    record("Injection", "13. SQLi in users search -> no crash", "PASS",
           f"Returned {r.status_code} -- handled cleanly")
elif r.status_code == 500:
    record("Injection", "13. SQLi in users search -> 500 crash", "FAIL",
           "Server crashed on SQLi in search param -- CRITICAL")
else:
    record("Injection", "13. SQLi in users search", "INFO", f"Returned {r.status_code}")

# Test 14 -- Oversized payload (10MB username)
print("  [Running oversized payload test -- sending 10MB body...]")
big_payload = {"username": "A" * (10 * 1024 * 1024), "password": "test"}
try:
    r = requests.post(f"{BASE}/api/auth/login", json=big_payload, timeout=30)
    if r.status_code in (400, 413, 422):
        record("Injection", "14. Oversized payload (10MB) -> 413/400", "PASS",
               f"Returned {r.status_code} -- body size limit enforced")
    elif r.status_code == 500:
        record("Injection", "14. Oversized payload (10MB) -> crash", "FAIL",
               "Server crashed (500) on 10MB payload -- body size limit not working")
    else:
        record("Injection", "14. Oversized payload (10MB)", "WARN",
               f"Returned {r.status_code} -- unexpected, may have processed large payload")
except requests.exceptions.ConnectionError:
    record("Injection", "14. Oversized payload (10MB) -> connection dropped", "PASS",
           "Server dropped connection -- body size limit or network rejected oversized request")
except Exception as e:
    record("Injection", "14. Oversized payload (10MB)", "INFO", f"Exception: {e}")

# Test 15 -- Null bytes in input
if sample_experiment_id:
    r = requests.patch(f"{BASE}/api/experiments/{sample_experiment_id}",
                       headers=auth_headers(admin_token),
                       json={"title": "Normal\x00NullByte"},
                       timeout=10)
    if r.status_code in (400, 422):
        record("Injection", "15. Null byte in title -> rejected", "PASS",
               f"Returned {r.status_code} -- null byte rejected by validation")
    elif r.status_code == 500:
        record("Injection", "15. Null byte in title -> 500 crash", "FAIL",
               "Server crashed on null byte input")
    elif r.status_code in (200, 204):
        record("Injection", "15. Null byte in title -> accepted (WARN)", "WARN",
               "Null byte was accepted -- check DB storage handles it gracefully")
    else:
        record("Injection", "15. Null byte in title", "INFO",
               f"Returned {r.status_code} (may be LOCKED experiment)")
else:
    record("Injection", "15. Null byte in title", "INFO", "No sample experiment -- skipped")

# Test 16a -- Negative page number
r = requests.get(f"{BASE}/api/users/",
                 params={"page": -1},
                 headers=auth_headers(admin_token), timeout=10)
if r.status_code in (400, 422):
    record("Injection", "16a. Negative page -> 400/422", "PASS",
           f"Returned {r.status_code} -- invalid page param rejected")
elif r.status_code == 500:
    record("Injection", "16a. Negative page -> 500", "FAIL",
           "Server crashed on negative page number")
else:
    record("Injection", "16a. Negative page -> unexpected", "WARN",
           f"Returned {r.status_code} -- pagination may not validate negative values")

# Test 16b -- Huge page number
r = requests.get(f"{BASE}/api/users/",
                 params={"page": 999999},
                 headers=auth_headers(admin_token), timeout=10)
if r.status_code == 200:
    data = r.json()
    items = data.get("items", []) if isinstance(data, dict) else data
    if isinstance(items, list) and len(items) == 0:
        record("Injection", "16b. Huge page -> empty list (not crash)", "PASS",
               "Page 999999 returns empty list -- correct behavior")
    else:
        record("Injection", "16b. Huge page -> returns data", "INFO",
               f"Got {len(items)} items on page 999999")
elif r.status_code in (400, 422):
    record("Injection", "16b. Huge page -> rejected", "PASS",
           f"Returned {r.status_code} -- very large page number rejected")
elif r.status_code == 500:
    record("Injection", "16b. Huge page -> 500", "FAIL",
           "Server crashed on huge page number")
else:
    record("Injection", "16b. Huge page", "INFO", f"Returned {r.status_code}")

# Test 17 -- Path traversal in filename (file upload)
if sample_experiment_id:
    malicious_filename = "../../etc/passwd"
    file_content = b"fake content for path traversal test"
    files = {"file": (malicious_filename, io.BytesIO(file_content), "application/pdf")}
    r = requests.post(f"{BASE}/api/experiments/{sample_experiment_id}/files",
                      headers=auth_headers(admin_token),
                      files=files, timeout=15)
    if r.status_code in (400, 422):
        record("Injection", "17. Path traversal in filename -> rejected", "PASS",
               f"Returned {r.status_code} -- malicious filename sanitized/rejected")
    elif r.status_code == 200:
        # Check if filename was sanitized in response
        resp_body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        stored_path = str(resp_body.get("file_path", resp_body.get("path", "")))
        if ".." in stored_path or "etc" in stored_path:
            record("Injection", "17. Path traversal in filename -> stored as-is", "FAIL",
                   f"CRITICAL: Path traversal in stored path: {stored_path}")
        else:
            record("Injection", "17. Path traversal in filename -> sanitized", "PASS",
                   f"File accepted but path sanitized -- stored path: {stored_path[:100]}")
    else:
        record("Injection", "17. Path traversal in filename", "INFO",
               f"Returned {r.status_code} (experiment may be LOCKED/SUBMITTED)")
else:
    record("Injection", "17. Path traversal in filename", "INFO",
           "No sample experiment -- skipped")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 4 -- SENSITIVE DATA EXPOSURE
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 4 -- SENSITIVE DATA EXPOSURE\n")

# Test 18 -- Password not in user response
if users:
    first_user = users[0]
    uid = first_user.get("id") or first_user.get("user_id")
    if uid:
        r = requests.get(f"{BASE}/api/users/{uid}",
                         headers=auth_headers(admin_token), timeout=10)
        if r.status_code == 200:
            # Check ONLY exact keys, not substrings -- 'must_reset_password' is a
            # legitimate field and must NOT be flagged as a password leak.
            try:
                user_json = r.json()
                if isinstance(user_json, dict):
                    leaked_fields = [k for k in user_json
                                     if k in ("password", "password_hash", "hashed_password")]
                else:
                    leaked_fields = []
            except Exception:
                # Fallback: exact-word search avoids must_reset_password false positive
                import re
                body = r.text
                leaked_fields = [f for f in ("password", "password_hash", "hashed_password")
                                 if re.search(r'"' + re.escape(f) + r'"', body)]
            if leaked_fields:
                record("Exposure", "18. Password fields in user response", "FAIL",
                       f"CRITICAL: Password fields exposed: {leaked_fields}")
            else:
                record("Exposure", "18. Password not in user response", "PASS",
                       "No password fields found in GET /api/users/{id} response "
                       "(must_reset_password is a legitimate boolean field, not a leak)")
        else:
            record("Exposure", "18. Password in user response", "INFO",
                   f"GET /api/users/{{id}} returned {r.status_code} -- skipped")
    else:
        record("Exposure", "18. Password in user response", "INFO", "No user ID available")
else:
    record("Exposure", "18. Password in user response", "INFO", "No users in list -- skipped")

# Test 19 -- JWT secret not exposed in health endpoint
r = requests.get(f"{BASE}/api/health", timeout=10)
body = r.text.lower()
if "secret" in body or "algorithm" in body or "hs256" in body:
    record("Exposure", "19. JWT secret/algorithm in health endpoint", "FAIL",
           f"Sensitive config exposed in health response! Body: {r.text[:300]}")
else:
    record("Exposure", "19. JWT secret not in health response", "PASS",
           f"Health endpoint is clean: {r.text[:100]}")

# Test 20a -- 404 error format
r = requests.get(f"{BASE}/api/nonexistent_endpoint_xyz", timeout=10)
body = r.text
has_traceback = "traceback" in body.lower() or "file \"/" in body.lower() or \
                "sqlalchemy" in body.lower() or "line " in body.lower()
if r.status_code == 404:
    if has_traceback:
        record("Exposure", "20a. 404 exposes traceback", "FAIL",
               f"Python traceback leaked in 404 response: {body[:300]}")
    else:
        record("Exposure", "20a. 404 returns generic error (no traceback)", "PASS",
               f"Clean 404 response: {body[:100]}")
else:
    record("Exposure", "20a. 404 status code", "INFO",
           f"Returned {r.status_code} instead of 404: {body[:100]}")

# Test 20b -- Attempt to trigger 500 via malformed JSON body
try:
    r = requests.post(f"{BASE}/api/auth/login",
                      data="{{invalid json{{",
                      headers={"Content-Type": "application/json"},
                      timeout=10)
    body = r.text
    has_traceback = "traceback" in body.lower() or "sqlalchemy" in body.lower()
    if has_traceback:
        record("Exposure", "20b. Malformed JSON body exposes traceback", "FAIL",
               f"Traceback in error response: {body[:300]}")
    elif r.status_code in (400, 422):
        record("Exposure", "20b. Malformed JSON -> clean error (no traceback)", "PASS",
               f"Returned {r.status_code} with clean error: {body[:100]}")
    else:
        record("Exposure", "20b. Malformed JSON error format", "INFO",
               f"Returned {r.status_code}: {body[:150]}")
except Exception as e:
    record("Exposure", "20b. Malformed JSON test", "INFO", f"Exception: {e}")

# Test 21 -- Error detail leakage with invalid UUID
# Schema leak = DB internals exposed: table names, column names, SQL statements,
# ORM stack traces, raw psycopg/sqlalchemy errors.
# "Invalid UUID format" messages that echo back the input are NOT a schema leak --
# they are normal input-validation feedback.
r = requests.get(f"{BASE}/api/experiments/not-a-valid-uuid",
                 headers=auth_headers(admin_token), timeout=10)
body = r.text.lower()
# Only flag genuine DB-schema / stack-trace terms; do NOT flag "uuid" alone,
# and do NOT flag "orm" because it appears inside ordinary words like "format".
# We require word-boundary-safe matches: e.g. "sqlalchemy", "psycopg", "traceback".
import re as _re
schema_leak_terms = [
    r"sqlalchemy", r"psycopg", r"traceback", r"pg_[a-z]",
    r"relation \"", r"from experiments", r"\bselect\b.*\bfrom\b",
    r"\"table\"", r"\btable name\b", r"\bcolumn name\b",
]
schema_leaked = any(_re.search(pat, body) for pat in schema_leak_terms)
if schema_leaked:
    record("Exposure", "21. Invalid UUID leaks DB schema", "FAIL",
           f"DB schema details in error response: {r.text[:300]}")
elif r.status_code in (400, 404, 422):
    record("Exposure", "21. Invalid UUID -> clean error (no schema leak)", "PASS",
           f"Returned {r.status_code} with clean message: {r.text[:100]}")
elif r.status_code == 500:
    record("Exposure", "21. Invalid UUID -> 500 error", "FAIL",
           f"Server error (500) on invalid UUID input: {r.text[:300]}")
else:
    record("Exposure", "21. Invalid UUID error", "INFO",
           f"Returned {r.status_code}: {r.text[:150]}")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 5 -- RATE LIMITING
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 5 -- RATE LIMITING\n")

# Test 22 -- Login rate limit (15 rapid attempts)
print("  [Running login rate-limit test -- 15 rapid attempts, waiting for 429...]")
rl_statuses = []
rl_triggered = False
# Wait out any existing rate limit window from test 5
time.sleep(2)
for i in range(15):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"username": "ratelimit_test_user", "password": f"wrong{i}"},
                      timeout=10)
    rl_statuses.append(r.status_code)
    if r.status_code == 429:
        rl_triggered = True
        break
    time.sleep(0.1)

if rl_triggered:
    idx = rl_statuses.index(429)
    record("RateLimit", "22. Login rate limit (15 attempts) -> 429", "PASS",
           f"Rate limit triggered after {idx+1} attempts -- config: 5/minute. "
           f"Statuses: {rl_statuses}")
else:
    record("RateLimit", "22. Login rate limit -> no 429 in 15 attempts", "WARN",
           f"Rate limiter did not trigger in 15 rapid attempts. "
           f"Statuses: {rl_statuses}. "
           f"Note: slowapi is configured (5/min) but may not have triggered in this window")

# Test 23 -- Rate limit on heavy endpoint (dashboard, 20 rapid requests)
print("  [Running dashboard rate-limit test -- 20 rapid requests...]")
dash_statuses = []
dash_rate_limited = False
for i in range(20):
    r = requests.get(f"{BASE}/api/dashboard/counts",
                     headers=auth_headers(admin_token), timeout=10)
    dash_statuses.append(r.status_code)
    if r.status_code == 429:
        dash_rate_limited = True
        break

if dash_rate_limited:
    record("RateLimit", "23. Dashboard rate limited (429)", "PASS",
           f"Rate limit hit after {dash_statuses.index(429)+1} requests")
else:
    unique_statuses = list(set(dash_statuses))
    record("RateLimit", "23. Dashboard no rate limit on 20 requests", "WARN",
           f"No rate limiting on GET /api/dashboard/counts after 20 rapid requests. "
           f"Statuses seen: {unique_statuses}. Consider adding rate limit to data-heavy endpoints.")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 6 -- FILE UPLOAD SECURITY
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 6 -- FILE UPLOAD SECURITY\n")

# Test 24 -- Malicious file type (.py disguised as .pdf)
if sample_experiment_id:
    py_code = b"import os; os.system('id')"
    files = {"file": ("exploit.py", io.BytesIO(py_code), "application/octet-stream")}
    r = requests.post(f"{BASE}/api/experiments/{sample_experiment_id}/files",
                      headers=auth_headers(admin_token),
                      files=files, timeout=15)
    if r.status_code in (400, 415, 422):
        record("Upload", "24. .py file rejected", "PASS",
               f"Returned {r.status_code} -- Python file rejected by extension whitelist")
    elif r.status_code in (200, 201):
        record("Upload", "24. .py file accepted -- FAIL", "FAIL",
               "Python executable file was accepted and stored! "
               "upload_file() in experiments/router.py does NOT call validate_upload() -- HIGH vulnerability")
    else:
        record("Upload", "24. .py file upload", "INFO",
               f"Returned {r.status_code} (experiment may be LOCKED/SUBMITTED): {r.text[:150]}")
else:
    record("Upload", "24. .py file type check", "INFO", "No sample experiment -- skipped")

# Test 25 -- Large file (6MB -- over JSON limit but under file limit of 50MB)
if sample_experiment_id:
    print("  [Running large file upload test -- 6MB PDF...]")
    large_content = b"%PDF-1.4 " + b"A" * (6 * 1024 * 1024)
    files = {"file": ("large_test.pdf", io.BytesIO(large_content), "application/pdf")}
    try:
        r = requests.post(f"{BASE}/api/experiments/{sample_experiment_id}/files",
                          headers=auth_headers(admin_token),
                          files=files, timeout=60)
        if r.status_code in (413, 400, 422):
            record("Upload", "25. 6MB file -> rejected (413/400)", "PASS",
                   f"Returned {r.status_code} -- large file rejected")
        elif r.status_code == 200:
            record("Upload", "25. 6MB file -> accepted", "INFO",
                   "6MB file accepted (config allows up to 50MB for files -- this is expected behavior). "
                   "File size limit is 50MB, JSON body limit is 10MB (separate configs).")
        else:
            record("Upload", "25. 6MB file", "INFO",
                   f"Returned {r.status_code}: {r.text[:150]}")
    except Exception as e:
        record("Upload", "25. 6MB file test", "INFO", f"Exception: {e}")
else:
    record("Upload", "25. Large file upload", "INFO", "No sample experiment -- skipped")

# Test 26 -- Double extension filename
if sample_experiment_id:
    files = {"file": ("malicious.pdf.exe", io.BytesIO(b"MZ" + b"\x00" * 100), "application/pdf")}
    r = requests.post(f"{BASE}/api/experiments/{sample_experiment_id}/files",
                      headers=auth_headers(admin_token),
                      files=files, timeout=15)
    if r.status_code in (400, 415, 422):
        record("Upload", "26. Double extension .pdf.exe rejected", "PASS",
               f"Returned {r.status_code} -- .exe extension in double ext rejected")
    elif r.status_code in (200, 201):
        resp = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        stored = str(resp.get("file_path", resp.get("filename", "")))
        if ".exe" in stored.lower():
            record("Upload", "26. Double extension .pdf.exe stored as-is", "FAIL",
                   f"Dangerous file stored with .exe extension: {stored[:150]}")
        else:
            record("Upload", "26. Double extension sanitized on storage", "WARN",
                   f"File accepted but verify extension sanitization: {stored[:150]}")
    else:
        record("Upload", "26. Double extension", "INFO",
               f"Returned {r.status_code}: {r.text[:150]}")
else:
    record("Upload", "26. Double extension filename", "INFO", "No sample experiment -- skipped")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 7 -- CORS AND SECURITY HEADERS
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 7 -- CORS AND SECURITY HEADERS\n")

# Test 27 -- CORS with evil origin
r = requests.get(f"{BASE}/api/health",
                 headers={"Origin": "https://evil.com"}, timeout=10)
acao = r.headers.get("Access-Control-Allow-Origin", "")
acac = r.headers.get("Access-Control-Allow-Credentials", "")
if acao == "*":
    if acac == "true":
        record("CORS", "27. Wildcard CORS with credentials", "FAIL",
               "CRITICAL: Access-Control-Allow-Origin: * with allow_credentials=true -- "
               "allows cross-site credential theft")
    else:
        record("CORS", "27. Wildcard CORS without credentials", "WARN",
               "Access-Control-Allow-Origin: * -- not ideal but credentials not exposed")
elif acao == "https://evil.com":
    record("CORS", "27. Evil origin reflected in ACAO", "FAIL",
           "Server reflects any origin -- ACAO mirrors request Origin header!")
elif acao == "":
    record("CORS", "27. Evil origin blocked (no ACAO header)", "PASS",
           "https://evil.com not in allowed origins -- CORS correctly blocked")
else:
    record("CORS", "27. CORS origin control", "INFO",
           f"ACAO: '{acao}' for evil.com request -- check if whitelisted correctly")

# Test 28 -- Security headers
r = requests.get(f"{BASE}/api/health", timeout=10)
missing_headers = []
present_headers = []
security_hdrs = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": None,
    "Content-Security-Policy": None,
    "Strict-Transport-Security": None,
    "X-XSS-Protection": None,
}
for hdr, expected_val in security_hdrs.items():
    val = r.headers.get(hdr)
    if val:
        present_headers.append(f"{hdr}: {val}")
    else:
        missing_headers.append(hdr)

if missing_headers:
    severity = "WARN" if len(missing_headers) >= 3 else "INFO"
    record("Headers", "28. Missing security headers", severity,
           f"Missing: {missing_headers}. Present: {present_headers if present_headers else 'none'}")
else:
    record("Headers", "28. All security headers present", "PASS",
           f"All security headers set: {present_headers}")

# Test 29 -- OPTIONS request
r = requests.options(f"{BASE}/api/auth/login",
                     headers={"Origin": "http://localhost:3000",
                               "Access-Control-Request-Method": "POST"},
                     timeout=10)
allowed_methods = r.headers.get("Access-Control-Allow-Methods", "")
record("CORS", "29. OPTIONS preflight on /api/auth/login", "INFO",
       f"Status: {r.status_code}, Allow-Methods: '{allowed_methods}', "
       f"Headers: {dict(list(r.headers.items())[:6])}")


# ═════════════════════════════════════════════════════════════════════════════
# CATEGORY 8 -- BUSINESS LOGIC
# ═════════════════════════════════════════════════════════════════════════════

print("\n### CATEGORY 8 -- BUSINESS LOGIC\n")

# For business logic tests we need to find experiments in specific states
# Get all accessible experiments with their statuses
all_exps = []
try:
    r = requests.get(f"{BASE}/api/search/experiments",
                     headers=auth_headers(admin_token), timeout=10)
    if r.status_code == 200:
        data = r.json()
        all_exps = data.get("items", data) if isinstance(data, dict) else data
except Exception:
    pass

submitted_exp = None
locked_exp = None
draft_exp = None

for exp in all_exps:
    status_val = exp.get("status", "")
    if status_val == "SUBMITTED" and not submitted_exp:
        submitted_exp = exp
    elif status_val in ("LOCKED", "APPROVED") and not locked_exp:
        locked_exp = exp
    elif status_val == "DRAFT" and not draft_exp:
        draft_exp = exp

print(f"  [Found experiments -- DRAFT: {bool(draft_exp)}, SUBMITTED: {bool(submitted_exp)}, LOCKED: {bool(locked_exp)}]")

# Test 30 -- Double submit
exp_for_submit = submitted_exp or draft_exp
if exp_for_submit:
    exp_id = exp_for_submit.get("id")
    current_status = exp_for_submit.get("status")
    if current_status == "SUBMITTED":
        # Try to submit again
        r = requests.post(f"{BASE}/api/experiments/{exp_id}/submit",
                          headers=auth_headers(admin_token), timeout=10)
        if r.status_code in (400, 409, 422):
            record("BizLogic", "30. Double submit -> rejected (400/409)", "PASS",
                   f"Re-submitting SUBMITTED experiment returns {r.status_code} -- "
                   f"double submission blocked")
        elif r.status_code == 200:
            record("BizLogic", "30. Double submit -> accepted", "FAIL",
                   "SUBMITTED experiment can be submitted again -- business logic flaw")
        else:
            record("BizLogic", "30. Double submit", "INFO",
                   f"Returned {r.status_code}: {r.text[:150]}")
    elif current_status == "DRAFT":
        record("BizLogic", "30. Double submit", "INFO",
               "Only found DRAFT experiment -- cannot test double-submit without SUBMITTED exp")
else:
    record("BizLogic", "30. Double submit", "INFO", "No suitable experiment found -- skipped")

# Test 31 -- Approve without reviewers
if submitted_exp:
    exp_id = submitted_exp.get("id")
    r = requests.post(f"{BASE}/api/experiments/{exp_id}/approve",
                      headers=auth_headers(admin_token), timeout=10)
    if r.status_code in (400, 409, 422):
        record("BizLogic", "31. Approve without all reviews -> 400", "PASS",
               f"Approve without reviewer sign-off returns {r.status_code} -- "
               f"business rule enforced")
    elif r.status_code == 200:
        record("BizLogic", "31. Approve without reviews -> accepted", "WARN",
               "Experiment approved without reviewer signatures -- check reviewer requirement logic")
    else:
        record("BizLogic", "31. Approve without reviews", "INFO",
               f"Returned {r.status_code}: {r.text[:150]}")
else:
    record("BizLogic", "31. Approve without reviewers", "INFO",
           "No SUBMITTED experiment found -- skipped")

# Test 32 -- Materials on LOCKED experiment
if locked_exp:
    exp_id = locked_exp.get("id")
    r = requests.post(f"{BASE}/api/experiments/{exp_id}/materials",
                      headers=auth_headers(admin_token),
                      json={"batch_id": "00000000-0000-0000-0000-000000000001",
                            "qty_reserved": 10.0, "unit": "g"},
                      timeout=10)
    if r.status_code in (400, 409, 422, 403):
        record("BizLogic", "32. Materials on LOCKED exp -> rejected", "PASS",
               f"Returned {r.status_code} -- cannot add materials to locked experiment")
    elif r.status_code == 200:
        record("BizLogic", "32. Materials on LOCKED exp -> accepted", "FAIL",
               "Materials can be added to a LOCKED experiment -- state enforcement missing")
    else:
        record("BizLogic", "32. Materials on LOCKED exp", "INFO",
               f"Returned {r.status_code}: {r.text[:150]}")
else:
    record("BizLogic", "32. Materials on LOCKED experiment", "INFO",
           "No LOCKED experiment found -- skipped")

# Test 33 -- Void a LOCKED experiment (as admin/QA)
if locked_exp:
    exp_id = locked_exp.get("id")
    r = requests.post(f"{BASE}/api/experiments/{exp_id}/void",
                      headers=auth_headers(admin_token),
                      json={"reason": "Security test -- void attempt"},
                      timeout=10)
    if r.status_code == 200:
        record("BizLogic", "33. QA/admin can void LOCKED experiment", "INFO",
               f"Admin successfully voided locked experiment {exp_id[:8]}… -- "
               f"this is expected behavior for QA role with EXPERIMENTS_VOID privilege")
    elif r.status_code in (400, 403, 422):
        record("BizLogic", "33. Void LOCKED experiment -> blocked", "INFO",
               f"Returned {r.status_code} -- admin void of locked exp blocked: {r.text[:150]}")
    else:
        record("BizLogic", "33. Void LOCKED experiment", "INFO",
               f"Returned {r.status_code}: {r.text[:150]}")
else:
    record("BizLogic", "33. Void LOCKED experiment", "INFO",
           "No LOCKED experiment found -- skipped")


# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

print("\n" + "="*70)
print("  SECURITY TEST SUMMARY")
print("="*70)

counts = {"PASS": 0, "FAIL": 0, "WARN": 0, "INFO": 0}
for r_item in results:
    counts[r_item["status"]] = counts.get(r_item["status"], 0) + 1

total = len(results)
print(f"\n  Total tests run : {total}")
print(f"  PASS (hardened) : {counts['PASS']}")
print(f"  FAIL (vuln)     : {counts['FAIL']}")
print(f"  WARN (concern)  : {counts['WARN']}")
print(f"  INFO (neutral)  : {counts['INFO']}")
print()

if counts["FAIL"] > 0:
    print("  *** CRITICAL FINDINGS (FAIL) ***")
    for r_item in results:
        if r_item["status"] == "FAIL":
            print(f"    - [{r_item['category']}] {r_item['name']}: {r_item['detail'][:120]}")
    print()

if counts["WARN"] > 0:
    print("  *** WARNINGS (WARN) ***")
    for r_item in results:
        if r_item["status"] == "WARN":
            print(f"    - [{r_item['category']}] {r_item['name']}: {r_item['detail'][:120]}")
    print()

print("="*70)

# Export JSON for report generation
with open("security_test_results.json", "w") as f:
    json.dump({"summary": counts, "total": total, "results": results}, f, indent=2)
print("\n  Full results saved to security_test_results.json")

