"""Quick endpoint smoke test."""
import sys
sys.path.insert(0, '.')
import urllib.request, urllib.error, json

BASE = 'http://127.0.0.1:8001'
passed = 0
failed = 0
failures = []


def req(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=10)
        return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as ex:
        return 0, str(ex).encode()


def check(label, method, path, body=None, token=None, expect=(200, 201)):
    global passed, failed
    code, raw = req(method, path, body, token)
    ok = code in expect
    icon = 'OK  ' if ok else 'FAIL'
    print(f'  [{code}] {icon}  {label}')
    if not ok:
        print(f'         {raw[:200].decode(errors="replace")}')
        failures.append(f'[{code}] {label}')
    if ok:
        passed += 1
    else:
        failed += 1
    return code, raw


# ── Login ──────────────────────────────────────────────────────────────────
code, raw = req('POST', '/api/auth/login', {'username': 'sys.admin', 'password': 'Admin@123'})
if code != 200:
    print(f'Login FAILED [{code}]: {raw[:300].decode(errors="replace")}')
    sys.exit(1)
j = json.loads(raw)
T = j['access_token']
RT = j['refresh_token']
print('Logged in as sys.admin (QA)\n')

# ── AUTH ───────────────────────────────────────────────────────────────────
print('=== AUTH ===')
check('GET /api/health', 'GET', '/api/health')
check('GET /api/auth/me', 'GET', '/api/auth/me', token=T)
check('POST /api/auth/refresh', 'POST', '/api/auth/refresh', {'refresh_token': RT})

# ── USERS ──────────────────────────────────────────────────────────────────
print('\n=== USERS ===')
code, raw = check('GET /api/users', 'GET', '/api/users', token=T)
users_list = json.loads(raw).get('items', []) if code == 200 else []
uid = users_list[0]['id'] if users_list else ''
if uid:
    check('GET /api/users/{id}', 'GET', f'/api/users/{uid}', token=T)

# ── ROLES ──────────────────────────────────────────────────────────────────
print('\n=== ROLES ===')
check('GET /api/roles', 'GET', '/api/roles', token=T)

# ── DEPARTMENTS ────────────────────────────────────────────────────────────
print('\n=== DEPARTMENTS ===')
code, raw = check('GET /api/departments', 'GET', '/api/departments', token=T)
depts = json.loads(raw).get('items', []) if code == 200 else []
did = depts[0]['id'] if depts else ''
if did:
    check('GET /api/departments/{id}', 'GET', f'/api/departments/{did}', token=T)
    code2, raw2 = check('POST /api/departments', 'POST', '/api/departments',
                        {'code': 'IT', 'name': 'IT Department', 'is_active': True}, token=T)
    if code2 in (200, 201):
        new_did = json.loads(raw2)['id']
        check('PATCH /api/departments/{id}', 'PATCH', f'/api/departments/{new_did}',
              {'name': 'IT Dept Updated'}, token=T)

# ── PROJECTS ───────────────────────────────────────────────────────────────
print('\n=== PROJECTS ===')
check('GET /api/projects', 'GET', '/api/projects', token=T)
_, me_raw = req('GET', '/api/auth/me', token=T)
me = json.loads(me_raw)
if did:
    code2, raw2 = check('POST /api/projects', 'POST', '/api/projects', {
        'code': 'PRJ001', 'name': 'Test Project', 'product_name': 'Drug A',
        'project_type': 'DEVELOPMENT', 'market': 'US',
        'department_id': did, 'manager_id': me['id'],
        'start_date': '2025-01-01', 'target_date': '2025-12-31'
    }, token=T)
    if code2 in (200, 201):
        pid = json.loads(raw2)['id']
        check('GET /api/projects/{id}', 'GET', f'/api/projects/{pid}', token=T)
        check('GET /api/projects/{id}/members', 'GET', f'/api/projects/{pid}/members', token=T)
        check('GET /api/projects/{id}/milestones', 'GET', f'/api/projects/{pid}/milestones', token=T)

# ── NOTEBOOKS ──────────────────────────────────────────────────────────────
print('\n=== NOTEBOOKS ===')
check('GET /api/notebooks', 'GET', '/api/notebooks', token=T)

# ── EXPERIMENTS ────────────────────────────────────────────────────────────
print('\n=== EXPERIMENTS ===')
check('GET /api/experiments', 'GET', '/api/experiments', token=T)

# ── ATR ────────────────────────────────────────────────────────────────────
print('\n=== ATR ===')
check('GET /api/atr', 'GET', '/api/atr', token=T)

# ── SEARCH ─────────────────────────────────────────────────────────────────
print('\n=== SEARCH ===')
check('GET /api/search?q=test', 'GET', '/api/search?q=test', token=T)

# ── ADMIN ──────────────────────────────────────────────────────────────────
print('\n=== ADMIN ===')
check('GET /api/admin/settings', 'GET', '/api/admin/settings', token=T)
check('GET /api/admin/master-data/chemicals', 'GET', '/api/admin/master-data/chemicals', token=T, expect=(200, 404))

# ── INVENTORY - Materials ──────────────────────────────────────────────────
print('\n=== INV MATERIALS ===')
check('GET /api/inventory/materials', 'GET', '/api/inventory/materials', token=T)
check('GET /api/inventory/manufacturers', 'GET', '/api/inventory/manufacturers', token=T)
check('GET /api/inventory/batches', 'GET', '/api/inventory/batches', token=T)
check('GET /api/inventory/stock-requests', 'GET', '/api/inventory/stock-requests', token=T)
check('GET /api/inventory/mappings', 'GET', '/api/inventory/mappings', token=T, expect=(200, 404))

# ── INVENTORY - Equipment ──────────────────────────────────────────────────
print('\n=== INV EQUIPMENT ===')
check('GET /api/inventory/equipment-types', 'GET', '/api/inventory/equipment-types', token=T)
check('GET /api/inventory/instrument-types', 'GET', '/api/inventory/instrument-types', token=T)
check('GET /api/inventory/column-types', 'GET', '/api/inventory/column-types', token=T)
check('GET /api/inventory/equipment-catalogue', 'GET', '/api/inventory/equipment-catalogue', token=T)
check('GET /api/inventory/instrument-catalogue', 'GET', '/api/inventory/instrument-catalogue', token=T)
check('GET /api/inventory/column-catalogue', 'GET', '/api/inventory/column-catalogue', token=T)

# ── INVENTORY - Schedules ──────────────────────────────────────────────────
print('\n=== INV SCHEDULES ===')
check('GET /api/inventory/maintenance-schedules', 'GET', '/api/inventory/maintenance-schedules', token=T)
check('GET /api/inventory/calibration-schedules', 'GET', '/api/inventory/calibration-schedules', token=T)
check('GET /api/inventory/equipment-verifications', 'GET', '/api/inventory/equipment-verifications', token=T, expect=(200, 404))
check('GET /api/inventory/instrument-verifications', 'GET', '/api/inventory/instrument-verifications', token=T, expect=(200, 404))
check('GET /api/inventory/batch-verifications', 'GET', '/api/inventory/batch-verifications', token=T, expect=(200, 404))

# ── INVENTORY - Dashboard/Reports/Audit ────────────────────────────────────
print('\n=== INV DASHBOARD/AUDIT/REPORTS ===')
check('GET /api/inventory/dashboard', 'GET', '/api/inventory/dashboard', token=T)
check('GET /api/inventory/audit', 'GET', '/api/inventory/audit', token=T)
check('GET /api/inventory/reports/batch-inventory', 'GET', '/api/inventory/reports/batch-inventory', token=T)
check('GET /api/inventory/reports/expiry', 'GET', '/api/inventory/reports/expiry', token=T)
check('GET /api/inventory/reports/stock-requests', 'GET', '/api/inventory/reports/stock-requests', token=T)
check('GET /api/inventory/reports/equipment-status', 'GET', '/api/inventory/reports/equipment-status', token=T)

# ── Summary ────────────────────────────────────────────────────────────────
print(f'\n{"="*50}')
print(f'RESULT: {passed} passed, {failed} failed')
if failures:
    print('\nFAILURES:')
    for f in failures:
        print(f'  {f}')
else:
    print('All endpoints passed!')
