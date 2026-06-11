"""
Full CRUD smoke test — Create, Read, Update, Delete for every module.
Run: python test_crud.py
"""
import sys
import json
import urllib.request
import urllib.error
import urllib.parse
sys.path.insert(0, '.')

BASE = 'http://127.0.0.1:8001'
passed = 0
failed = 0
failures = []


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _do(method, path, body=None, token=None, form=False):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if body and form:
        data = urllib.parse.urlencode(body).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    elif body:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    else:
        data = None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=10)
        raw = resp.read()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'_raw': raw.decode(errors='replace')}
    except Exception as ex:
        return 0, {'_raw': str(ex)}


def check(label, method, path, body=None, token=None, expect=(200, 201), form=False):
    global passed, failed
    code, resp = _do(method, path, body, token, form)
    ok = code in expect
    icon = 'OK  ' if ok else 'FAIL'
    print(f'  [{code}] {icon}  {label}')
    if not ok:
        detail = resp.get('detail') or resp.get('_raw', '')
        if isinstance(detail, list):
            detail = detail[0] if detail else ''
        print(f'         {str(detail)[:200]}')
        failures.append(f'[{code}] {label}')
    if ok:
        passed += 1
    else:
        failed += 1
    return code, resp


# ── Login helpers ─────────────────────────────────────────────────────────────

def login(username, password='Admin@123'):
    code, resp = _do('POST', '/api/auth/login', {'username': username, 'password': password})
    if code != 200:
        print(f'  LOGIN FAILED [{code}] for {username}: {resp}')
        sys.exit(1)
    return resp['access_token'], resp['refresh_token']


# ═══════════════════════════════════════════════════════════════════════════════
# START
# ═══════════════════════════════════════════════════════════════════════════════

T_QA, RT_QA = login('sys.admin')
T_TL, _ = login('tl.user')
T_HOD, _ = login('hod.user')
T_CHEM, _ = login('chem.user')

_, me = _do('GET', '/api/auth/me', token=T_QA)
QA_ID = me['id']
_, me_tl = _do('GET', '/api/auth/me', token=T_TL)
TL_ID = me_tl['id']

import time as _time
_ts = str(int(_time.time()))[-4:]

print(f'Tokens obtained. QA={QA_ID[:8]}...\n')


# ═══════════════════════════════════════════════════════════════════════════════
# 1. AUTH
# ═══════════════════════════════════════════════════════════════════════════════
print('=' * 60)
print('1. AUTH')
print('=' * 60)

check('GET  /api/health', 'GET', '/api/health')
check('GET  /api/auth/me (QA)', 'GET', '/api/auth/me', token=T_QA)
check('GET  /api/auth/me (TL)', 'GET', '/api/auth/me', token=T_TL)
check('GET  /api/auth/me (HOD)', 'GET', '/api/auth/me', token=T_HOD)
check('GET  /api/auth/me (CHEM)', 'GET', '/api/auth/me', token=T_CHEM)
check('POST /api/auth/refresh', 'POST', '/api/auth/refresh', {'refresh_token': RT_QA})
# Logout tested at end to avoid rate-limit re-login mid-test


# ═══════════════════════════════════════════════════════════════════════════════
# 2. USERS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('2. USERS')
print('=' * 60)

# Get roles for user creation
_, roles_resp = _do('GET', '/api/roles', token=T_QA)
roles = roles_resp if isinstance(roles_resp, list) else roles_resp.get('items', [])
chem_role_id = next((r['id'] for r in roles if r['code'] == 'CHEM'), None)
_, dept_resp = _do('GET', '/api/departments/', token=T_QA)
depts = dept_resp.get('items', [])
DEPT_ID = depts[0]['id'] if depts else None

check('GET  /api/users (list)', 'GET', '/api/users', token=T_QA)
check('GET  /api/users?page=1&page_size=2', 'GET', '/api/users?page=1&page_size=2', token=T_QA)
check('GET  /api/users/{id} (self)', 'GET', f'/api/users/{QA_ID}', token=T_QA)

# Create user
new_user_payload = {
    'username': f'test.chem{_ts}', 'emp_no': f'EMP{_ts}',
    'first_name': 'Test', 'last_name': 'Chemist',
    'email': f'test.chem{_ts}@chemia.local',
    'password': 'Admin@123',
    'role': 'CHEM',
    'department_id': DEPT_ID,
    'designation': 'Junior Chemist',
}
code, new_user = check('POST /api/users (create)', 'POST', '/api/users/', new_user_payload, token=T_QA)
NEW_USER_ID = new_user.get('id') if code in (200, 201) else None

if NEW_USER_ID:
    check('GET  /api/users/{id} (new)', 'GET', f'/api/users/{NEW_USER_ID}', token=T_QA)
    check('PATCH /api/users/{id} (update)', 'PATCH', f'/api/users/{NEW_USER_ID}',
          {'first_name': 'TestUpdated', 'designation': 'Senior Chemist'}, token=T_QA)
    check('POST /api/users/{id}/deactivate', 'POST', f'/api/users/{NEW_USER_ID}/deactivate', token=T_QA)
    check('POST /api/users/{id}/activate', 'POST', f'/api/users/{NEW_USER_ID}/activate', token=T_QA)

check('GET  /api/roles (list)', 'GET', '/api/roles', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. DEPARTMENTS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('3. DEPARTMENTS')
print('=' * 60)

check('GET  /api/departments (list)', 'GET', '/api/departments/', token=T_QA)
check('GET  /api/departments/{id}', 'GET', f'/api/departments/{DEPT_ID}', token=T_QA)

code, new_dept = check('POST /api/departments (create)', 'POST', '/api/departments/',
                       {'code': f'FD{_ts}', 'name': 'Formulation Dev', 'is_active': True}, token=T_QA)
NEW_DEPT_ID = new_dept.get('id') if code in (200, 201) else None

if NEW_DEPT_ID:
    check('PATCH /api/departments/{id} (update)', 'PATCH', f'/api/departments/{NEW_DEPT_ID}',
          {'name': 'Formulation Development', 'description': 'FD dept'}, token=T_QA)
    check('GET  /api/departments/{id} (after update)', 'GET', f'/api/departments/{NEW_DEPT_ID}', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PROJECTS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('4. PROJECTS')
print('=' * 60)

check('GET  /api/projects (list)', 'GET', '/api/projects/', token=T_QA)

code, proj = check('POST /api/projects (create)', 'POST', '/api/projects/', {
    'code': f'PRJ{_ts}', 'name': 'CRUD Test Project',
    'product_name': 'Test Drug', 'project_type': 'DEVELOPMENT',
    'market': 'US', 'department_id': DEPT_ID, 'manager_id': QA_ID,
    'start_date': '2025-01-01', 'target_date': '2025-12-31'
}, token=T_QA)
PROJ_ID = proj.get('id') if code in (200, 201) else None

if PROJ_ID:
    check('GET  /api/projects/{id}', 'GET', f'/api/projects/{PROJ_ID}', token=T_QA)
    check('PATCH /api/projects/{id} (update name)', 'PATCH', f'/api/projects/{PROJ_ID}',
          {'name': 'CRUD Test Project Updated', 'status': 'ON HOLD'}, token=T_QA)
    check('PATCH /api/projects/{id} (status->ACTIVE)', 'PATCH', f'/api/projects/{PROJ_ID}',
          {'status': 'ACTIVE'}, token=T_QA)

    # Members
    check('GET  /api/projects/{id}/members', 'GET', f'/api/projects/{PROJ_ID}/members', token=T_QA)
    PROJ_CODE = f'PRJ{_ts}'
    code, _ = check('POST /api/projects/{id}/members (add TL)', 'POST',
                    f'/api/projects/{PROJ_ID}/members', {'user_ids': [TL_ID]}, token=T_QA, expect=(200, 201, 204))
    check('DELETE /api/projects/{id}/members/{uid}', 'DELETE',
          f'/api/projects/{PROJ_ID}/members/{TL_ID}', token=T_QA, expect=(200, 204))

    # Milestones
    check('GET  /api/projects/{id}/milestones', 'GET', f'/api/projects/{PROJ_ID}/milestones', token=T_QA)
    code, ms = check('POST /api/projects/{id}/milestones (create)', 'POST',
                     f'/api/projects/{PROJ_ID}/milestones',
                     {'name': 'Milestone 1', 'due_date': '2025-06-30', 'status': 'PENDING'},
                     token=T_QA)
    MS_ID = ms.get('id') if code in (200, 201) else None
    if MS_ID:
        check('PATCH /api/projects/{id}/milestones/{ms_id}', 'PATCH',
              f'/api/projects/{PROJ_ID}/milestones/{MS_ID}',
              {'name': 'Milestone 1 Updated', 'status': 'IN PROGRESS'}, token=T_QA)
        check('DELETE /api/projects/{id}/milestones/{ms_id}', 'DELETE',
              f'/api/projects/{PROJ_ID}/milestones/{MS_ID}', token=T_QA, expect=(200, 204))


# ═══════════════════════════════════════════════════════════════════════════════
# 5. NOTEBOOKS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('5. NOTEBOOKS')
print('=' * 60)

check('GET  /api/notebooks (list)', 'GET', '/api/notebooks', token=T_QA)

if not PROJ_ID:
    # Fetch existing project
    _, proj_list = _do('GET', '/api/projects/', token=T_QA)
    items = proj_list.get('items', [])
    if items:
        PROJ_ID = items[0]['id']
        PROJ_CODE = items[0]['code']

nb_payload = {
    'title': 'CRUD Test Notebook',
    'project_id': PROJ_ID,
    'description': 'Testing notebook CRUD',
}
code, nb = check('POST /api/notebooks (create)', 'POST', '/api/notebooks/', nb_payload, token=T_QA)
NB_ID = nb.get('id') if code in (200, 201) else None

if NB_ID:
    check('GET  /api/notebooks/{id}', 'GET', f'/api/notebooks/{NB_ID}', token=T_QA)
    check('PATCH /api/notebooks/{id} (update)', 'PATCH', f'/api/notebooks/{NB_ID}',
          {'title': 'CRUD Notebook Updated', 'description': 'Updated desc'}, token=T_QA)
    # Permissions
    check('GET  /api/notebooks/{id}/permissions', 'GET',
          f'/api/notebooks/{NB_ID}/permissions', token=T_QA, expect=(200, 404))


# ═══════════════════════════════════════════════════════════════════════════════
# 6. EXPERIMENTS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('6. EXPERIMENTS')
print('=' * 60)

check('GET  /api/experiments (list)', 'GET', '/api/experiments', token=T_QA)

EXP_ID = None
if NB_ID:
    code, exp = check('POST /api/experiments (create)', 'POST', '/api/experiments/', {
        'title': 'CRUD Test Experiment',
        'notebook_id': NB_ID,
        'objective': 'Test CRUD operations',
    }, token=T_QA)
    EXP_ID = exp.get('id') if code in (200, 201) else None

    if EXP_ID:
        check('GET  /api/experiments/{id}', 'GET', f'/api/experiments/{EXP_ID}', token=T_QA)
        check('PATCH /api/experiments/{id} (update)', 'PATCH', f'/api/experiments/{EXP_ID}',
              {'title': 'CRUD Experiment Updated'}, token=T_QA)
        check('GET  /api/experiments/{id}/sections', 'GET',
              f'/api/experiments/{EXP_ID}/sections', token=T_QA, expect=(200, 404))
        check('GET  /api/experiments/{id}/history', 'GET',
              f'/api/experiments/{EXP_ID}/history', token=T_QA, expect=(200, 404))


# ═══════════════════════════════════════════════════════════════════════════════
# 7. ATR
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('7. ATR')
print('=' * 60)

check('GET  /api/atr (list)', 'GET', '/api/atr', token=T_QA)

code, atr = check('POST /api/atr (create)', 'POST', '/api/atr/', {
    'test_type': 'STABILITY',
    'objectives': 'Test ATR CRUD',
    'project_id': PROJ_ID,
}, token=T_QA)
ATR_ID = atr.get('id') if code in (200, 201) else None

if ATR_ID:
    check('GET  /api/atr/{id}', 'GET', f'/api/atr/{ATR_ID}', token=T_QA)
    check('PATCH /api/atr/{id} (update)', 'PATCH', f'/api/atr/{ATR_ID}',
          {'objectives': 'Test ATR CRUD — updated'}, token=T_QA)

    # Workflow: NEW → SUBMITTED → VERIFIED (assigned) → COMPLETED
    check('POST /api/atr/{id}/submit', 'POST', f'/api/atr/{ATR_ID}/submit', token=T_QA)
    check('POST /api/atr/{id}/assign', 'POST', f'/api/atr/{ATR_ID}/assign',
          {'assigned_to': TL_ID, 'due_date': '2025-12-31'}, token=T_QA)
    check('POST /api/atr/{id}/complete', 'POST', f'/api/atr/{ATR_ID}/complete',
          {'result': 'PASS', 'result_observations': 'All parameters within limits'}, token=T_QA)

# Create a second ATR to test cancel
code2, atr2 = check('POST /api/atr (create for cancel)', 'POST', '/api/atr/', {
    'test_type': 'ASSAY',
    'objectives': 'Test ATR cancel workflow',
    'project_id': PROJ_ID,
}, token=T_QA)
ATR_ID2 = atr2.get('id') if code2 in (200, 201) else None
if ATR_ID2:
    check('POST /api/atr/{id}/submit (before cancel)', 'POST', f'/api/atr/{ATR_ID2}/submit', token=T_QA)
    check('POST /api/atr/{id}/cancel', 'POST', f'/api/atr/{ATR_ID2}/cancel', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 8. SEARCH
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('8. SEARCH')
print('=' * 60)

check('GET /api/search/experiments?q=CRUD', 'GET', '/api/search/experiments?q=CRUD', token=T_QA)
check('GET /api/search/notebooks?q=CRUD', 'GET', '/api/search/notebooks?q=CRUD', token=T_QA)
check('GET /api/search/projects?q=CRUD', 'GET', '/api/search/projects?q=CRUD', token=T_QA)
check('GET /api/search/atrs?q=CRUD', 'GET', '/api/search/atrs?q=CRUD', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 9. ADMIN
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('9. ADMIN')
print('=' * 60)

check('GET  /api/admin/settings/company', 'GET', '/api/admin/settings/company', token=T_QA)
check('PATCH /api/admin/settings/company (update)', 'PATCH', '/api/admin/settings/company',
      {'company_name': 'Chemia ELN Corp', 'address': '123 Lab Street'}, token=T_QA)
check('GET  /api/admin/settings/crd', 'GET', '/api/admin/settings/crd', token=T_QA)
check('PATCH /api/admin/settings/crd (update)', 'PATCH', '/api/admin/settings/crd',
      {'reauth_submit': False, 'reauth_verify': False}, token=T_QA)
check('GET  /api/admin/audit', 'GET', '/api/admin/audit', token=T_QA)
check('GET  /api/admin/sequences', 'GET', '/api/admin/sequences', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 10. DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('10. DASHBOARD')
print('=' * 60)

check('GET /api/dashboard/counts', 'GET', '/api/dashboard/counts', token=T_QA)
check('GET /api/dashboard/my-activity', 'GET', '/api/dashboard/my-activity', token=T_QA)
check('GET /api/dashboard/approval-queue', 'GET', '/api/dashboard/approval-queue', token=T_QA)
check('GET /api/dashboard/verification-queue', 'GET', '/api/dashboard/verification-queue', token=T_QA)
check('GET /api/dashboard/rework-inbox', 'GET', '/api/dashboard/rework-inbox', token=T_QA)
check('GET /api/dashboard/sla-alerts', 'GET', '/api/dashboard/sla-alerts', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 11. INVENTORY — MANUFACTURERS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('11. INVENTORY — MANUFACTURERS')
print('=' * 60)

check('GET  /api/inventory/manufacturers (list)', 'GET', '/api/inventory/manufacturers', token=T_QA)

code, mfr = check('POST /api/inventory/manufacturers (create)', 'POST', '/api/inventory/manufacturers',
                  {'code': f'SIG{_ts}', 'name': 'Sigma Aldrich', 'country': 'US', 'is_active': True}, token=T_QA)
MFR_ID = mfr.get('id') if code in (200, 201) else None

if MFR_ID:
    check('GET  /api/inventory/manufacturers/{id}', 'GET',
          f'/api/inventory/manufacturers/{MFR_ID}', token=T_QA)
    check('PATCH /api/inventory/manufacturers/{id}', 'PATCH',
          f'/api/inventory/manufacturers/{MFR_ID}',
          {'name': 'Sigma-Aldrich Inc', 'website': 'https://sigma.com'}, token=T_QA)
    check('PATCH /api/inventory/manufacturers/{id}/toggle', 'PATCH',
          f'/api/inventory/manufacturers/{MFR_ID}/toggle', token=T_QA)
    check('PATCH /api/inventory/manufacturers/{id}/toggle (re-enable)', 'PATCH',
          f'/api/inventory/manufacturers/{MFR_ID}/toggle', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 12. INVENTORY — MATERIALS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('12. INVENTORY — MATERIALS')
print('=' * 60)

check('GET  /api/inventory/materials (list)', 'GET', '/api/inventory/materials', token=T_QA)

code, mat = check('POST /api/inventory/materials (create)', 'POST', '/api/inventory/materials', {
    'code': f'ACN{_ts}', 'name': 'Acetonitrile', 'material_type': 'SOLVENT',
    'cas_no': '75-05-8', 'storage_condition': 'Room Temperature', 'is_active': True,
}, token=T_QA)
MAT_ID = mat.get('id') if code in (200, 201) else None

if MAT_ID:
    check('GET  /api/inventory/materials/{id}', 'GET', f'/api/inventory/materials/{MAT_ID}', token=T_QA)
    check('PATCH /api/inventory/materials/{id}', 'PATCH', f'/api/inventory/materials/{MAT_ID}',
          {'name': 'Acetonitrile (HPLC grade)', 'reorder_level': 5.0}, token=T_QA)
    check('PATCH /api/inventory/materials/{id}/toggle', 'PATCH',
          f'/api/inventory/materials/{MAT_ID}/toggle', token=T_QA)
    check('PATCH /api/inventory/materials/{id}/toggle (re-enable)', 'PATCH',
          f'/api/inventory/materials/{MAT_ID}/toggle', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 13. INVENTORY — BATCHES
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('13. INVENTORY — BATCHES')
print('=' * 60)

check('GET  /api/inventory/batches (list)', 'GET', '/api/inventory/batches', token=T_QA)

BATCH_ID = None
if MAT_ID:
    code, batch = check('POST /api/inventory/batches (create)', 'POST', '/api/inventory/batches', {
        'material_id': MAT_ID, 'batch_no': f'BATCH-ACN-{_ts}',
        'manufacturer_id': MFR_ID,
        'qty_received': 20.0, 'unit': 'L',
        'mfg_date': '2024-01-01', 'expiry_date': '2027-01-01',
        'location': 'Shelf A-1',
    }, token=T_QA)
    BATCH_ID = batch.get('id') if code in (200, 201) else None

    if BATCH_ID:
        check('GET  /api/inventory/batches/{id}', 'GET', f'/api/inventory/batches/{BATCH_ID}', token=T_QA)
        check('PATCH /api/inventory/batches/{id}', 'PATCH', f'/api/inventory/batches/{BATCH_ID}',
              {'location': 'Shelf A-3', 'notes': 'Updated batch'}, token=T_QA)
        check('PATCH /api/inventory/batches/{id}/toggle', 'PATCH',
              f'/api/inventory/batches/{BATCH_ID}/toggle', token=T_QA)
        check('PATCH /api/inventory/batches/{id}/toggle (re-enable)', 'PATCH',
              f'/api/inventory/batches/{BATCH_ID}/toggle', token=T_QA)

        # Issue
        check('POST /api/inventory/batches/{id}/issue', 'POST',
              f'/api/inventory/batches/{BATCH_ID}/issue',
              {'qty': 2.0, 'purpose': 'Testing', 'issued_to': QA_ID}, token=T_QA)

        # Allocate
        check('POST /api/inventory/batches/{id}/allocate', 'POST',
              f'/api/inventory/batches/{BATCH_ID}/allocate',
              {'qty': 1.0, 'project_code': PROJ_CODE, 'purpose': 'CRUD test'}, token=T_QA)

        # Events
        check('GET  /api/inventory/batches/{id}/events', 'GET',
              f'/api/inventory/batches/{BATCH_ID}/events', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 14. INVENTORY — BATCH VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('14. INVENTORY — BATCH VERIFICATIONS')
print('=' * 60)

check('GET  /api/inventory/batch-verifications (list)', 'GET',
      '/api/inventory/batch-verifications', token=T_QA)

BV_ID = None
if BATCH_ID:
    code, bv = check('POST /api/inventory/batch-verifications (create)', 'POST',
                     '/api/inventory/batch-verifications',
                     {'request_no': f'BV-{_ts}', 'batch_id': BATCH_ID, 'remarks': 'Initial verification'}, token=T_QA)
    BV_ID = bv.get('id') if code in (200, 201) else None

    if BV_ID:
        check('PATCH /api/inventory/batch-verifications/{id}/verify', 'PATCH',
              f'/api/inventory/batch-verifications/{BV_ID}/verify',
              {'remarks': 'Passed QC'}, token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 15. INVENTORY — STOCK REQUESTS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('15. INVENTORY — STOCK REQUESTS')
print('=' * 60)

check('GET  /api/inventory/stock-requests (list)', 'GET', '/api/inventory/stock-requests', token=T_QA)

SR_ID = None
if MAT_ID:
    code, sr = check('POST /api/inventory/stock-requests (create)', 'POST',
                     '/api/inventory/stock-requests', {
                         'request_no': f'SR-{_ts}', 'material_id': MAT_ID,
                         'qty_required': 5.0, 'unit': 'L',
                         'purpose': 'CRUD test',
                     }, token=T_CHEM)
    SR_ID = sr.get('id') if code in (200, 201) else None

    if SR_ID:
        check('GET  /api/inventory/stock-requests/{id}', 'GET',
              f'/api/inventory/stock-requests/{SR_ID}', token=T_QA)
        check('PATCH /api/inventory/stock-requests/{id}/approve', 'PATCH',
              f'/api/inventory/stock-requests/{SR_ID}/approve',
              {'remarks': 'Approved for testing'}, token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 16. INVENTORY — MANUFACTURER MAPPINGS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('16. INVENTORY — MANUFACTURER MAPPINGS')
print('=' * 60)

check('GET  /api/inventory/mappings (list)', 'GET', '/api/inventory/mappings', token=T_QA)

MAPPING_ID = None
if MAT_ID and MFR_ID:
    code, mapping = check('POST /api/inventory/mappings (create)', 'POST', '/api/inventory/mappings', {
        'material_id': MAT_ID, 'manufacturer_id': MFR_ID,
        'catalogue_no': 'CAT-ACN-001', 'technical_grade': 'HPLC',
        'lead_time_days': 7, 'min_order_qty': 1.0,
    }, token=T_QA)
    MAPPING_ID = mapping.get('id') if code in (200, 201) else None

    if MAPPING_ID:
        check('PATCH /api/inventory/mappings/{id}', 'PATCH',
              f'/api/inventory/mappings/{MAPPING_ID}',
              {'catalogue_no': 'CAT-ACN-002', 'lead_time_days': 5}, token=T_QA)
        check('DELETE /api/inventory/mappings/{id}', 'DELETE',
              f'/api/inventory/mappings/{MAPPING_ID}', token=T_QA, expect=(200, 204))


# ═══════════════════════════════════════════════════════════════════════════════
# 17. INVENTORY — EQUIPMENT MASTER (Types)
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('17. INVENTORY — EQUIPMENT TYPES')
print('=' * 60)

check('GET  /api/inventory/equipment-types (list)', 'GET', '/api/inventory/equipment-types', token=T_QA)

code, et = check('POST /api/inventory/equipment-types (create)', 'POST',
                 '/api/inventory/equipment-types',
                 {'code': f'ROTA{_ts}', 'name': 'Rotary Evaporator', 'description': 'For solvent removal'}, token=T_QA)
ET_ID = et.get('id') if code in (200, 201) else None

if ET_ID:
    check('GET  /api/inventory/equipment-types/{id}', 'GET',
          f'/api/inventory/equipment-types/{ET_ID}', token=T_QA)
    check('PATCH /api/inventory/equipment-types/{id}', 'PATCH',
          f'/api/inventory/equipment-types/{ET_ID}',
          {'name': 'Rotary Evaporator (Rotavap)'}, token=T_QA)
    check('PATCH /api/inventory/equipment-types/{id}/toggle', 'PATCH',
          f'/api/inventory/equipment-types/{ET_ID}/toggle', token=T_QA)
    check('PATCH /api/inventory/equipment-types/{id}/toggle (re-enable)', 'PATCH',
          f'/api/inventory/equipment-types/{ET_ID}/toggle', token=T_QA)

# Instrument types
print()
check('GET  /api/inventory/instrument-types (list)', 'GET', '/api/inventory/instrument-types', token=T_QA)

code, it = check('POST /api/inventory/instrument-types (create)', 'POST',
                 '/api/inventory/instrument-types',
                 {'code': f'HPLC{_ts}', 'name': 'HPLC System', 'description': 'High Performance Liquid Chromatography'}, token=T_QA)
IT_ID = it.get('id') if code in (200, 201) else None

if IT_ID:
    check('PATCH /api/inventory/instrument-types/{id}', 'PATCH',
          f'/api/inventory/instrument-types/{IT_ID}',
          {'name': 'HPLC System'}, token=T_QA)
    check('PATCH /api/inventory/instrument-types/{id}/toggle', 'PATCH',
          f'/api/inventory/instrument-types/{IT_ID}/toggle', token=T_QA)
    check('PATCH /api/inventory/instrument-types/{id}/toggle (re-enable)', 'PATCH',
          f'/api/inventory/instrument-types/{IT_ID}/toggle', token=T_QA)

# Column types
print()
check('GET  /api/inventory/column-types (list)', 'GET', '/api/inventory/column-types', token=T_QA)

code, ct = check('POST /api/inventory/column-types (create)', 'POST',
                 '/api/inventory/column-types', {
                     'code': f'C18{_ts}', 'name': 'C18 150mm',
                     'description': 'Reverse phase C18',
                     'length_mm': 150, 'particle_size_um': 5.0,
                 }, token=T_QA)
CT_ID = ct.get('id') if code in (200, 201) else None

if CT_ID:
    check('PATCH /api/inventory/column-types/{id}', 'PATCH',
          f'/api/inventory/column-types/{CT_ID}',
          {'name': 'C18 ODS 150mm', 'description': 'Updated C18 column type'}, token=T_QA)
    check('PATCH /api/inventory/column-types/{id}/toggle', 'PATCH',
          f'/api/inventory/column-types/{CT_ID}/toggle', token=T_QA)
    check('PATCH /api/inventory/column-types/{id}/toggle (re-enable)', 'PATCH',
          f'/api/inventory/column-types/{CT_ID}/toggle', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 18. INVENTORY — EQUIPMENT CATALOGUE
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('18. INVENTORY — EQUIPMENT CATALOGUE')
print('=' * 60)

check('GET  /api/inventory/equipment-catalogue (list)', 'GET', '/api/inventory/equipment-catalogue', token=T_QA)

EQ_CAT_ID = None
if ET_ID:
    code, eq = check('POST /api/inventory/equipment-catalogue (create)', 'POST',
                     '/api/inventory/equipment-catalogue', {
                         'asset_id': f'EQ-{_ts}', 'name': 'Rotavap Unit 1',
                         'equipment_type_id': ET_ID,
                         'serial_no': 'SN-ROTA-001', 'manufacturer': 'Buchi',
                         'model': 'R-300', 'location': 'Lab A', 'status': 'ACTIVE',
                     }, token=T_QA)
    EQ_CAT_ID = eq.get('id') if code in (200, 201) else None

    if EQ_CAT_ID:
        check('GET  /api/inventory/equipment-catalogue/{id}', 'GET',
              f'/api/inventory/equipment-catalogue/{EQ_CAT_ID}', token=T_QA)
        check('PATCH /api/inventory/equipment-catalogue/{id}', 'PATCH',
              f'/api/inventory/equipment-catalogue/{EQ_CAT_ID}',
              {'location': 'Lab B', 'notes': 'Moved to Lab B'}, token=T_QA)
        check('PATCH /api/inventory/equipment-catalogue/{id}/toggle', 'PATCH',
              f'/api/inventory/equipment-catalogue/{EQ_CAT_ID}/toggle', token=T_QA)
        check('PATCH /api/inventory/equipment-catalogue/{id}/toggle (re-enable)', 'PATCH',
              f'/api/inventory/equipment-catalogue/{EQ_CAT_ID}/toggle', token=T_QA)

# Instrument catalogue
print()
check('GET  /api/inventory/instrument-catalogue (list)', 'GET', '/api/inventory/instrument-catalogue', token=T_QA)

INST_CAT_ID = None
if IT_ID:
    code, inst = check('POST /api/inventory/instrument-catalogue (create)', 'POST',
                       '/api/inventory/instrument-catalogue', {
                           'asset_id': f'INST-{_ts}', 'name': 'HPLC System 1',
                           'instrument_type_id': IT_ID,
                           'serial_no': 'SN-HPLC-001', 'manufacturer': 'Agilent',
                           'model': '1260 Infinity', 'location': 'Lab A', 'status': 'ACTIVE',
                       }, token=T_QA)
    INST_CAT_ID = inst.get('id') if code in (200, 201) else None

    if INST_CAT_ID:
        check('PATCH /api/inventory/instrument-catalogue/{id}', 'PATCH',
              f'/api/inventory/instrument-catalogue/{INST_CAT_ID}',
              {'location': 'Instrument Room'}, token=T_QA)

# Column catalogue
print()
check('GET  /api/inventory/column-catalogue (list)', 'GET', '/api/inventory/column-catalogue', token=T_QA)

COL_CAT_ID = None
if CT_ID:
    code, col = check('POST /api/inventory/column-catalogue (create)', 'POST',
                      '/api/inventory/column-catalogue', {
                          'column_id': f'COL-{_ts}', 'name': 'C18 Column 1',
                          'column_type_id': CT_ID,
                          'serial_no': 'SN-C18-001',
                          'max_injections': 500, 'status': 'ACTIVE',
                      }, token=T_QA)
    COL_CAT_ID = col.get('id') if code in (200, 201) else None

    if COL_CAT_ID:
        check('PATCH /api/inventory/column-catalogue/{id}', 'PATCH',
              f'/api/inventory/column-catalogue/{COL_CAT_ID}',
              {'notes': 'New column, first use'}, token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 19. INVENTORY — MAINTENANCE SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('19. INVENTORY — MAINTENANCE SCHEDULES')
print('=' * 60)

check('GET  /api/inventory/maintenance-schedules (list)', 'GET',
      '/api/inventory/maintenance-schedules', token=T_QA)

MS_SCHED_ID = None
if EQ_CAT_ID:
    code, ms = check('POST /api/inventory/maintenance-schedules (create)', 'POST',
                     '/api/inventory/maintenance-schedules', {
                         'equipment_id': EQ_CAT_ID, 'maintenance_type': 'PREVENTIVE',
                         'scheduled_date': '2025-12-31',
                         'notes': 'Annual maintenance',
                     }, token=T_QA)
    MS_SCHED_ID = ms.get('id') if code in (200, 201) else None

    if MS_SCHED_ID:
        check('GET  /api/inventory/maintenance-schedules/{id}', 'GET',
              f'/api/inventory/maintenance-schedules/{MS_SCHED_ID}', token=T_QA)
        check('PATCH /api/inventory/maintenance-schedules/{id}', 'PATCH',
              f'/api/inventory/maintenance-schedules/{MS_SCHED_ID}',
              {'notes': 'Annual maintenance - updated'}, token=T_QA)
        check('PATCH /api/inventory/maintenance-schedules/{id}/complete', 'PATCH',
              f'/api/inventory/maintenance-schedules/{MS_SCHED_ID}/complete',
              {'completed_date': '2025-12-31', 'remarks': 'Maintenance completed successfully'}, token=T_QA)

    # Create another to test cancel
    code2, ms2 = check('POST /api/inventory/maintenance-schedules (for cancel)', 'POST',
                       '/api/inventory/maintenance-schedules', {
                           'equipment_id': EQ_CAT_ID, 'maintenance_type': 'CORRECTIVE',
                           'scheduled_date': '2025-11-30',
                           'notes': 'Corrective maintenance',
                       }, token=T_QA)
    MS_SCHED_ID2 = ms2.get('id') if code2 in (200, 201) else None
    if MS_SCHED_ID2:
        check('PATCH /api/inventory/maintenance-schedules/{id}/cancel', 'PATCH',
              f'/api/inventory/maintenance-schedules/{MS_SCHED_ID2}/cancel',
              {'remarks': 'No longer needed'}, token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 20. INVENTORY — CALIBRATION SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('20. INVENTORY — CALIBRATION SCHEDULES')
print('=' * 60)

check('GET  /api/inventory/calibration-schedules (list)', 'GET',
      '/api/inventory/calibration-schedules', token=T_QA)

CAL_ID = None
if INST_CAT_ID:
    code, cal = check('POST /api/inventory/calibration-schedules (create)', 'POST',
                      '/api/inventory/calibration-schedules', {
                          'instrument_id': INST_CAT_ID, 'calibration_type': 'ANNUAL',
                          'scheduled_date': '2025-12-31',
                          'notes': 'Annual calibration',
                      }, token=T_QA)
    CAL_ID = cal.get('id') if code in (200, 201) else None

    if CAL_ID:
        check('PATCH /api/inventory/calibration-schedules/{id}', 'PATCH',
              f'/api/inventory/calibration-schedules/{CAL_ID}',
              {'notes': 'Annual calibration - updated'}, token=T_QA)
        check('PATCH /api/inventory/calibration-schedules/{id}/complete', 'PATCH',
              f'/api/inventory/calibration-schedules/{CAL_ID}/complete',
              {'completed_date': '2025-12-31', 'remarks': 'Calibrated and certified'}, token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 21. INVENTORY — EQUIPMENT VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('21. INVENTORY — EQUIPMENT/INSTRUMENT VERIFICATIONS')
print('=' * 60)

check('GET  /api/inventory/equipment-verifications (list)', 'GET',
      '/api/inventory/equipment-verifications', token=T_QA)

EQV_ID = None
if EQ_CAT_ID:
    code, eqv = check('POST /api/inventory/equipment-verifications (create)', 'POST',
                      '/api/inventory/equipment-verifications',
                      {'request_no': f'EQV-{_ts}', 'equipment_id': EQ_CAT_ID, 'remarks': 'Daily check'}, token=T_QA)
    EQV_ID = eqv.get('id') if code in (200, 201) else None

    if EQV_ID:
        check('PATCH /api/inventory/equipment-verifications/{id}/verify', 'PATCH',
              f'/api/inventory/equipment-verifications/{EQV_ID}/verify',
              {'remarks': 'Equipment OK'}, token=T_QA)

# Instrument verifications
check('GET  /api/inventory/instrument-verifications (list)', 'GET',
      '/api/inventory/instrument-verifications', token=T_QA)

INV_V_ID = None
if INST_CAT_ID:
    code, inv_v = check('POST /api/inventory/instrument-verifications (create)', 'POST',
                        '/api/inventory/instrument-verifications',
                        {'request_no': f'INV-{_ts}', 'instrument_id': INST_CAT_ID, 'remarks': 'System suitability'}, token=T_QA)
    INV_V_ID = inv_v.get('id') if code in (200, 201) else None

    if INV_V_ID:
        check('PATCH /api/inventory/instrument-verifications/{id}/verify', 'PATCH',
              f'/api/inventory/instrument-verifications/{INV_V_ID}/verify',
              {'remarks': 'Instrument OK'}, token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 22. INVENTORY — DASHBOARD, AUDIT TRAIL, REPORTS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('22. INVENTORY — DASHBOARD / AUDIT / REPORTS')
print('=' * 60)

check('GET /api/inventory/dashboard/kpis', 'GET', '/api/inventory/dashboard/kpis', token=T_QA)
check('GET /api/inventory/dashboard/available-stock', 'GET', '/api/inventory/dashboard/available-stock', token=T_QA)
check('GET /api/inventory/dashboard/expiring-soon', 'GET', '/api/inventory/dashboard/expiring-soon', token=T_QA)
check('GET /api/inventory/dashboard/pending-actions', 'GET', '/api/inventory/dashboard/pending-actions', token=T_QA)
check('GET /api/inventory/audit-trail', 'GET', '/api/inventory/audit-trail', token=T_QA)
check('GET /api/inventory/audit-trail?entity_type=BATCH', 'GET',
      '/api/inventory/audit-trail?entity_type=BATCH', token=T_QA)
check('GET /api/inventory/reports/batch-inventory', 'GET', '/api/inventory/reports/batch-inventory', token=T_QA)
check('GET /api/inventory/reports/expiry', 'GET', '/api/inventory/reports/expiry', token=T_QA)
check('GET /api/inventory/reports/stock-requests', 'GET', '/api/inventory/reports/stock-requests', token=T_QA)
check('GET /api/inventory/reports/equipment-status', 'GET', '/api/inventory/reports/equipment-status', token=T_QA)
check('GET /api/inventory/reports/equipment-status?asset_type=INSTRUMENT', 'GET',
      '/api/inventory/reports/equipment-status?asset_type=INSTRUMENT', token=T_QA)


# ═══════════════════════════════════════════════════════════════════════════════
# 23. AUTH — LOGOUT (done last to avoid rate-limit re-login)
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('23. AUTH — LOGOUT')
print('=' * 60)

check('POST /api/auth/logout', 'POST', '/api/auth/logout', {'refresh_token': RT_QA}, expect=(200, 204))


# ═══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print(f'FINAL: {passed} passed, {failed} failed out of {passed+failed} total')
print('=' * 60)
if failures:
    print('FAILURES:')
    for f in failures:
        print(f'  {f}')
else:
    print('ALL ENDPOINTS PASSED!')
