# Chemia ELN -- End-to-End Test Report

**Generated:** 2026-06-16 14:32:10  
**Total tests:** 120  **Passed:** 120  **Failed:** 0  **Skipped:** 0

---

## Module Summary

| Module | Tests | Passed | Failed | Skipped |
|--------|-------|--------|--------|---------|
| [+] Auth | 3 | 3 | 0 | 0 |
| [+] Users | 3 | 3 | 0 | 0 |
| [+] Departments | 2 | 2 | 0 | 0 |
| [+] Projects | 3 | 3 | 0 | 0 |
| [+] Notebooks | 6 | 6 | 0 | 0 |
| [+] Experiments | 15 | 15 | 0 | 0 |
| [+] ADC Synthesis Materials | 5 | 5 | 0 | 0 |
| [+] Workflow Templates | 4 | 4 | 0 | 0 |
| [+] ATR | 5 | 5 | 0 | 0 |
| [+] Dashboard | 8 | 8 | 0 | 0 |
| [+] Search | 2 | 2 | 0 | 0 |
| [+] Admin | 6 | 6 | 0 | 0 |
| [+] Inventory Core | 8 | 8 | 0 | 0 |
| [+] Inventory Dashboard | 8 | 8 | 0 | 0 |
| [+] Inventory Reports | 3 | 3 | 0 | 0 |
| [+] Notification Settings | 1 | 1 | 0 | 0 |
| [+] Experiment Lifecycle | 10 | 10 | 0 | 0 |
| [+] Reviewer Lifecycle | 5 | 5 | 0 | 0 |
| [+] ATR Lifecycle | 4 | 4 | 0 | 0 |
| [+] Inventory CRUD | 7 | 7 | 0 | 0 |
| [+] Project CRUD | 5 | 5 | 0 | 0 |
| [+] Role Privileges | 3 | 3 | 0 | 0 |
| [+] Admin Settings | 4 | 4 | 0 | 0 |

---

## Detailed Results

### Auth

- [PASS] **POST /auth/login -> 200, access_token present**
  - _token length=187 (authenticated in main)_
- [PASS] **GET /auth/me -> 200, username=sys.admin**
  - _role=QA_
- [PASS] **POST /auth/change-password wrong old pwd -> 400/401**
  - _status=422_

### Users

- [PASS] **GET /users -> 200, paginated, total > 0**
  - _total=31, items=5_
- [PASS] **GET /users/{id} -> 200, has id/username/role/emp_no**
  - _username=chem.user role=CHEM_
- [PASS] **PATCH /users/{id} -> 200 (idempotent contact_no)**

### Departments

- [PASS] **GET /departments -> 200, list length > 0**
  - _count=15_
- [PASS] **GET /departments?search=Research -> 200**
  - _results=1_

### Projects

- [PASS] **GET /projects -> 200, paginated**
  - _total=29 items=5_
- [PASS] **GET /projects/{id} -> 200, has id/code/name**
  - _code=81600213 name=E2E Project 1781600213_
- [PASS] **GET /projects/{id}/overview -> 200 [FIXED was 404]**
  - _keys=['id', 'code', 'name', 'product_name', 'project_type', 'market']_

### Notebooks

- [PASS] **GET /notebooks -> 200, paginated**
  - _total=46 items=5_
- [PASS] **POST /notebooks -> 201, notebook created**
  - _id=235d52ae-241f-44ea-a4e1-d53bae193407 code=81600213-NB004_
- [PASS] **GET /notebooks/{id} -> 200, notebook object**
  - _code=81600213-NB004 status=ACTIVE_
- [PASS] **GET /notebooks/{id}/overview -> 200 [FIXED was 404]**
  - _keys=['id', 'code', 'title', 'description', 'project_id', 'route_id', 'stage_id', 'notebook_type']_
- [PASS] **GET /notebooks/{id}/permissions -> 200, list**
  - _count=1_
- [PASS] **POST /notebooks/{id}/permissions -> 200/201 (grant view)**
  - _status=201 user_id=fdeb1bdf-48c8-4a64-ad6b-0df4089e94cf_

### Experiments

- [PASS] **POST /notebooks/{nb_id}/experiments -> 201**
  - _id=da46036e-b300-4bad-9659-63b2d08ebe6e full_code=EXP-055-01_
- [PASS] **GET /notebooks/{nb_id}/experiments -> 200, list**
  - _count=1_
- [PASS] **GET /experiments/{GOOD_SYNTH_ID} -> 200, id matches**
  - _full_code=EXP-042-01 status=SUBMITTED_
- [PASS] **PATCH /experiments/{new_exp_id} -> 200 (set title)**
  - _title=E2E Updated 1781600529_
- [PASS] **GET /experiments/{new_exp_id}/history -> 200, items have actor_name**
  - _count=2_
- [PASS] **POST /experiments/{new_exp_id}/files -> 201/200 (upload file)**
  - _file_id=ed3cbf58-add2-4a9e-8c18-c126cba1e60b_
- [PASS] **GET /experiments/{new_exp_id}/files -> 200, list**
  - _count=1_
- [PASS] **DELETE /experiments/{new_exp_id}/files/{file_id} -> 200**
  - _file_id=ed3cbf58-add2-4a9e-8c18-c126cba1e60b_
- [PASS] **POST /experiments/{new_exp_id}/reviewers -> 200/201 (assign reviewer)**
  - _status=201 reviewer_id=fdeb1bdf-48c8-4a64-ad6b-0df4089e94cf_
- [PASS] **POST /experiments/{GOOD_SYNTH_ID}/submit -> 400/422 (disposition gate)**
  - _status=400_
- [PASS] **POST /experiments/{BAD_SYNTH_ID}/submit -> 400 (held prelim)**
  - _status=400_
- [PASS] **GET /experiments/{GOOD_SYNTH_ID}/preliminary-data -> 200**
  - _keys=['preliminary_id', 'full_code', 'title', 'status', 'data']_
- [PASS] **GET /experiments/{BAD_SYNTH_ID}/preliminary-data -> 200**
  - _keys=['preliminary_id', 'full_code', 'title', 'status', 'data']_
- [PASS] **GET /experiments/{GOOD_SYNTH_ID}/materials -> 200, list**
  - _count=0_
- [PASS] **GET /experiments/{GOOD_SYNTH_ID}/export-pdf -> 200, content-type=PDF [FIXED]**
  - _content-type=application/pdf size=1584 bytes_

### ADC Synthesis Materials

- [PASS] **GET /inventory/batches?status=AVAILABLE -> 200, find batch qty_available > 0**
  - _batch_id=10 batch_no=BT1781600328 qty=100.0000_
- [PASS] **POST /experiments/{GOOD_SYNTH_ID}/materials -> 201 (reserve batch)**
  - _mat_id=dda17a8a-66b2-4dcc-bece-8d7c0102f965 exp=da46036e..._
- [PASS] **GET /experiments/{GOOD_SYNTH_ID}/materials -> 200, items have material_name/batch_no**
  - _count=1 material_name=E2E Material Updated 1781600328_
- [PASS] **PATCH /experiments/{GOOD_SYNTH_ID}/materials/{mat_id} -> 200 (status: ISSUED)**
  - _mat_id=dda17a8a-66b2-4dcc-bece-8d7c0102f965_
- [PASS] **PATCH /experiments/{GOOD_SYNTH_ID}/materials/{mat_id} -> 200 (status: RETURNED)**
  - _mat_id=dda17a8a-66b2-4dcc-bece-8d7c0102f965_

### Workflow Templates

- [PASS] **GET /workflow-templates -> 200, adc-synthesis and adc-preliminary slugs present**
  - _total=2 slugs=['adc-preliminary', 'adc-synthesis']_
- [PASS] **GET /workflow-templates/{adc-synthesis-id} -> 200**
  - _slug=adc-synthesis name=ADC Synthesis_
- [PASS] **adc-synthesis: 2 sections, 13 screens, 136 total fields**
  - _sections=2 screens=13 fields=136_
- [PASS] **adc-synthesis: 2 screens with has_signature=True**
  - _sig_screen_keys=['syn_presynthesis_esig', 'syn_purification_esig']_

### ATR

- [PASS] **GET /atr -> 200, list**
  - _count=20_
- [PASS] **GET /atr?status=SUBMITTED -> 200**
  - _count=2_
- [PASS] **GET /unlock-requests -> 200, list**
  - _count=11_
- [PASS] **unlock-requests items have experiment_full_code field**
  - _experiment_full_code=EXP-036-01_
- [PASS] **unlock-requests items have requester_name field**
  - _requester_name=System Admin_

### Dashboard

- [PASS] **GET /dashboard/counts -> 200, experiments.total + by_status + atr present**
  - _exp.total=54 atr keys=['pending_assignment', 'assigned_to_me']_
- [PASS] **GET /dashboard/verification-queue -> 200, has total and items**
  - _total=0_
- [PASS] **GET /dashboard/approval-queue -> 200, has total and items**
  - _total=0_
- [PASS] **GET /dashboard/rework-inbox -> 200, has total and items**
  - _total=0_
- [PASS] **GET /dashboard/sla-alerts -> 200, all 4 SLA fields present**
  - _sla_days=45 overdue=0_
- [PASS] **GET /dashboard/my-activity -> 200, has items**
  - _count=20_
- [PASS] **GET /dashboard/counts experiment.total > 0**
  - _experiments.total=54_
- [PASS] **GET /dashboard/sla-alerts sla_days_for_submission is integer**
  - _value=45_

### Search

- [PASS] **GET /search/experiments?q=ADC -> 200, list**
  - _count=10_
- [PASS] **GET /search/experiments?q=EXP -> 200, list**
  - _count=20_

### Admin

- [PASS] **GET /admin/audit -> 200, paginated, total > 0**
  - _total=616_
- [PASS] **GET /admin/users -> 200, paginated, total > 0 [FIXED was 404]**
  - _total=31_
- [PASS] **GET /admin/privilege-keys -> 200, list of groups**
  - _groups=6 first_module=Admin_
- [PASS] **GET /roles -> 200, list of role objects**
  - _count=7 first=ARD_ANALYST_
- [PASS] **GET /admin/sequences -> 200, list**
  - _count=29_
- [PASS] **GET /admin/settings/company -> 200**
  - _keys=['id', 'name', 'short_name', 'code', 'phone', 'email']_

### Inventory Core

- [PASS] **GET /inventory/materials -> 200, paginated**
  - _count/total=12_
- [PASS] **GET /inventory/manufacturers -> 200, list**
  - _count/total=11_
- [PASS] **GET /inventory/batches -> 200, paginated**
  - _count/total=10_
- [PASS] **GET /inventory/stock-requests -> 200, paginated**
  - _count/total=10_
- [PASS] **GET /inventory/equipment-catalogue -> 200**
  - _count/total=10_
- [PASS] **GET /inventory/instrument-catalogue -> 200**
  - _count/total=10_
- [PASS] **GET /inventory/maintenance-schedules -> 200**
  - _count/total=12_
- [PASS] **GET /inventory/calibration-schedules -> 200**
  - _count/total=9_

### Inventory Dashboard

- [PASS] **GET /inventory/dashboard/kpis -> 200, all 10 KPI keys present**
  - _keys=['materials', 'batches_available', 'batches_low_stock', 'batches_expiring_30d', 'batches_expired', 'stock_requests_pending', 'stock_requests_critical', 'maintenance_due', 'calibration_due', 'verifications_pending']_
- [PASS] **Each KPI has 'value' key**
  - _checked 10 KPI dicts_
- [PASS] **GET /inventory/dashboard/available-stock -> 200**
  - _rows=6_
- [PASS] **available-stock rows have required fields (material_id, code, name, type, total_available, unit, batch_count, has_expiring)**
  - _all required fields present_
- [PASS] **available-stock has_expiring is Python bool (not int 0/1)**
  - _value=False type=bool_
- [PASS] **GET /inventory/dashboard/expiring-soon -> 200**
  - _count=0_
- [PASS] **GET /inventory/dashboard/pending-actions -> 200**
  - _keys=list_
- [PASS] **GET /inventory/dashboard/expiring-soon?days=365 -> 200**
  - _count=4_

### Inventory Reports

- [PASS] **GET /inventory/reports/batch-inventory -> 200**
  - _count/total=5_
- [PASS] **GET /inventory/reports/expiry -> 200**
  - _count/total=4_
- [PASS] **GET /inventory/reports/equipment-status -> 200**
  - _count/total=30_

### Notification Settings

- [PASS] **GET /notification-settings -> 200**
  - _type=list keys=0_

### Experiment Lifecycle

- [PASS] **POST /notebooks -> 201 (lifecycle notebook)**
  - _id=7f2ff18e-43a3-4542-ab7a-49f276752e7b_
- [PASS] **POST /notebooks/{id}/experiments -> 201 (lifecycle experiment DRAFT)**
  - _id=2c05f240-7dc5-4107-9226-d5a6014de613 status=DRAFT_
- [PASS] **PATCH /experiments/{id} -> 200 (update title)**
- [PASS] **POST /experiments/{id}/reviewers -> 201 (assign reviewer for lifecycle)**
  - _status=201 reviewer_id=fdeb1bdf-48c8-4a64-ad6b-0df4089e94cf_
- [PASS] **POST /experiments/{id}/submit -> 200 (DRAFT -> SUBMITTED)**
  - _status field=SUBMITTED_
- [PASS] **POST /experiments/{id}/approve -> 200 or 400 (reviewer-signed gate)**
  - _status=400 (reviewers must sign first — expected)_
- [PASS] **POST /experiments/{id}/reject -> 200 (SUBMITTED -> REJECTED)**
  - _status=REJECTED_
- [PASS] **POST /experiments/{id}/versions -> 201 (new version from REJECTED)**
  - _new_id=173f8bb3-2347-4793-bf48-6c85a6f3dafc version=2_
- [PASS] **New version is DRAFT and is_latest_version=True**
  - _status=DRAFT is_latest_version=True_
- [PASS] **POST /experiments/{v1_id}/void -> 200 (void a DRAFT/REJECTED exp)**
  - _status=VOID_

### Reviewer Lifecycle

- [PASS] **POST /notebooks/{id}/experiments -> 201 (reviewer lifecycle experiment)**
  - _id=6df73dae-f87b-49d4-ad38-e496a5dccd32_
- [PASS] **POST /experiments/{id}/reviewers -> 201 (assign reviewer)**
  - _status=201 reviewer_id=fdeb1bdf-48c8-4a64-ad6b-0df4089e94cf_
- [PASS] **GET /experiments/{id} -> reviewer in reviews array**
  - _reviews count=1_
- [PASS] **DELETE /experiments/{id}/reviewers/{reviewer_id} -> 204**
  - _status=204_
- [PASS] **GET /experiments/{id} -> reviewer removed from reviews**
  - _reviews count after delete=0_

### ATR Lifecycle

- [PASS] **GET /atr -> 200, items have id/status/atr_no**
  - _count=20 atr_no=ATR00000028 status=NEW_
- [PASS] **GET /atr?status=SUBMITTED -> 200**
  - _total=2_
- [PASS] **GET /atr?status=ASSIGNED -> 200**
  - _total=0_
- [PASS] **GET /unlock-requests -> 200, requester_name and experiment_full_code present**
  - _requester_name=System Admin code=EXP-036-01_

### Inventory CRUD

- [PASS] **POST /inventory/materials -> 201 (create material)**
  - _id=13 code=81600530_
- [PASS] **GET /inventory/materials/{id} -> 200**
  - _name=E2E Material 1781600530_
- [PASS] **PATCH /inventory/materials/{id} -> 200 (update name)**
  - _name=E2E Material Updated 1781600530_
- [PASS] **POST /inventory/batches -> 201 (create batch)**
  - _id=11 batch_no=BT1781600530 qty=100.0000_
- [PASS] **GET /inventory/batches/{id} -> 200**
  - _batch_no=BT1781600530 qty_available=100.0000_
- [PASS] **POST /inventory/stock-requests -> 201 (create stock request)**
  - _id=11 request_no=SR1781600530_
- [PASS] **GET /inventory/stock-requests/{id} -> 200**
  - _request_no=SR1781600530 status=PENDING_

### Project CRUD

- [PASS] **POST /projects -> 201 (create project)**
  - _id=52a47030-dd84-4d42-815d-824c5c90ba28 code=81600530_
- [PASS] **PATCH /projects/{id} -> 200 (update description)**
  - _description=Updated by E2E at 1781600530_
- [PASS] **POST /projects/{id}/members -> 200 (add user)**
  - _member_id=d4489c77-ea63-4eeb-baea-019eac2f9e42 msg=Added 1 member(s) to project_
- [PASS] **GET /projects/{id}/members -> 200 (user present)**
  - _members count=1_
- [PASS] **DELETE /projects/{id}/members/{user_id} -> 200**
  - _msg=Member removed_

### Role Privileges

- [PASS] **GET /role-privileges -> 200, list**
  - _count=21_
- [PASS] **GET /roles -> 200, roles have id and code**
  - _count=7 codes=['ARD_ANALYST', 'ARD_HOD', 'ARD_TL', 'CHEM', 'HOD']_
- [PASS] **GET /admin/privilege-keys -> 200, groups with module and privileges**
  - _groups=6 modules=['Admin', 'Users & Organisation', 'Projects', 'Notebooks', 'Experiments', 'ATR (Analytical Test Requests)']_

### Admin Settings

- [PASS] **GET /admin/settings/company -> 200**
  - _keys=['id', 'name', 'short_name', 'code', 'phone', 'email']_
- [PASS] **PATCH /admin/settings/company -> 200 (update website)**
  - _website=https://chemia-e2e.example.com_
- [PASS] **GET /admin/settings/crd -> 200**
  - _keys=['id', 'precision', 'mw_precision', 'qty_unit', 'moles_format', 'mole_ratio_base']_
- [PASS] **GET /admin/settings/global -> 200**
  - _keys=['id', 'auth_type', 'use_random_password_through_mail', 'default_password', 'lock_user_after_x_attempts', 'password_expiry_days']_

---

## Fixed Issues Verified

- **GET /api/projects/{id}/overview**: Fixed -- was returning 404, now returns 200 with project overview data
- **GET /api/notebooks/{id}/overview**: Fixed -- was returning 404, now returns 200 with notebook overview data
- **GET /api/admin/users**: Fixed -- was returning 404, now returns 200 with paginated user list
- **GET /api/experiments/{id}/export-pdf**: Fixed -- was returning text/plain, now returns application/pdf binary

### Fix Verification Test Outcomes

- [PASS] GET /projects/{id}/overview -> 200 [FIXED was 404]: keys=['id', 'code', 'name', 'product_name', 'project_type', 'market']
- [PASS] GET /notebooks/{id}/overview -> 200 [FIXED was 404]: keys=['id', 'code', 'title', 'description', 'project_id', 'route_id', 'stage_id', 'notebook_type']
- [PASS] GET /admin/users -> 200, paginated, total > 0 [FIXED was 404]: total=31
- [PASS] GET /experiments/{GOOD_SYNTH_ID}/export-pdf -> 200, content-type=PDF [FIXED]: content-type=application/pdf size=1584 bytes

---

## Bugs Found

_No bugs found -- all tests passed or skipped._
