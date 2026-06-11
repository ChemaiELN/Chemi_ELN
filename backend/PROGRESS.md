# Chemia ELN — Development Progress

> Status as of **June 2026**. All phases completed and verified (158/158 API tests passing).

---

## Phase 1 — Foundation & Auth
> Core infrastructure, user management, authentication

- [x] Project scaffold — FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic
- [x] `.env` configuration (`DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, token expiry)
- [x] Database session factory (`SessionLocal`, engine)
- [x] Base model with UUID primary keys and UTC timestamps
- [x] **Auth module**
  - [x] `POST /api/auth/login` — JWT access token + refresh token
  - [x] `POST /api/auth/refresh` — exchange refresh token
  - [x] `POST /api/auth/logout` — invalidate refresh token
  - [x] `GET /api/auth/me` — current user profile
  - [x] `POST /api/auth/change-password`
  - [x] `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`
  - [x] Rate limiting on login — 5 requests / minute (slowapi)
  - [x] bcrypt password hashing (direct, no passlib)
- [x] **Roles** — four built-in roles: `QA`, `TL`, `HOD`, `CHEM`
- [x] **Users module**
  - [x] `GET/POST /api/users/` — list + create
  - [x] `GET/PATCH /api/users/{id}` — read + update
  - [x] `POST /api/users/{id}/activate` + `/deactivate`
- [x] `GET /api/roles/` — list roles
- [x] `GET /api/health` — health check
- [x] JWT dependency `get_current_user`, role guard `require_roles`
- [x] **Initial migration** (`58d8fa04abad`) — all core tables created

---

## Phase 2 — Organisational Structure
> Departments, Projects, Routes, Milestones

- [x] **Departments module**
  - [x] `GET/POST /api/departments/` — list + create
  - [x] `GET/PATCH /api/departments/{id}` — read + update
- [x] **Projects module**
  - [x] `GET/POST /api/projects/` — list + create
  - [x] `GET/PATCH /api/projects/{id}` — read + update
  - [x] Project statuses: `ACTIVE`, `ON HOLD`, `COMPLETED`, `CANCELLED`
  - [x] `GET/POST /api/projects/{id}/members` — add/list members
  - [x] `DELETE /api/projects/{id}/members/{user_id}` — remove member
  - [x] `GET/POST /api/projects/{id}/milestones` — list + create
  - [x] `PATCH/DELETE /api/projects/{id}/milestones/{ms_id}` — update + delete
- [x] **Routes & Stages module**
  - [x] `GET/POST /api/routes/{project_id}/routes`
  - [x] `GET/PATCH /api/routes/{project_id}/routes/{route_id}`
  - [x] `POST /api/routes/{project_id}/routes/{route_id}/stages`
  - [x] `PATCH/DELETE .../{route_id}/stages/{stage_id}`
- [x] Sequence counter utility (`sequence_counters` table) for auto-generating codes
- [x] Audit log — `log_action()` writing to `audit_log` table

---

## Phase 3 — Notebooks & Notebook Permissions
> Experiment containers with per-user access control

- [x] **Notebooks module**
  - [x] `GET/POST /api/notebooks/` — list + create
  - [x] `GET/PATCH /api/notebooks/{id}` — read + update
  - [x] Notebook code auto-generation from project/route/stage chain (e.g. `PRJ001-R1-S2-NB003`)
- [x] **Notebook permissions**
  - [x] `GET/POST /api/notebooks/{id}/permissions`
  - [x] `PATCH /api/notebooks/{id}/permissions/{user_id}` — update flags
  - [x] `DELETE /api/notebooks/{id}/permissions/{user_id}` — revoke
  - [x] Permission flags: `can_view`, `can_edit`, `can_comment`, `can_submit`
  - [x] QA and TL bypass — always have full access

---

## Phase 4 — Experiments (Core ELN)
> The primary research record with full lifecycle management

- [x] **Experiments module — CRUD**
  - [x] `GET/POST /api/experiments/` — list (with filters) + create
  - [x] `GET/PATCH /api/experiments/{id}` — read + update
  - [x] Rich-text fields stored as HTML from react-quill (`aim`, `objective`, `procedure`, `observations`, `conclusion`)
  - [x] Experiment code auto-generation (e.g. `PRJ001/E00001`)
- [x] **Experiment workflow** (status machine)
  - [x] `POST /{id}/submit` — CHEM submits (DRAFT → SUBMITTED)
  - [x] `POST /{id}/verify` — TL verifies (SUBMITTED → VERIFIED)
  - [x] `POST /{id}/approve` — HOD approves (VERIFIED → APPROVED)
  - [x] `POST /{id}/reject` — TL/HOD rejects with reason
  - [x] `POST /{id}/revise` — CHEM revises after rejection
  - [x] `POST /{id}/void` — QA voids an experiment
  - [x] `POST /{id}/unlock` — QA unlocks approved experiment
  - [x] `POST /{id}/new-version` — creates version N+1 row
  - [x] `GET /{id}/versions` — list all versions
- [x] **E-Signature** — optional password re-entry on submit/verify (controlled by CRD settings)
- [x] **Sub-resources**
  - [x] Inputs (reactants/reagents) — `GET/POST /{id}/inputs`, `PATCH/DELETE /{id}/inputs/{input_id}`
  - [x] Parameters — `GET/POST /{id}/parameters`, `PATCH/DELETE /{id}/parameters/{param_id}`
  - [x] Steps — `GET/POST /{id}/steps`, `PATCH/DELETE /{id}/steps/{step_id}`
  - [x] Equipment used — `GET/POST /{id}/equipment`, `PATCH/DELETE /{id}/equipment/{eq_id}`
  - [x] TLC records — `GET/POST /{id}/tlc`
  - [x] Comments — `GET/POST /{id}/comments`
  - [x] Attachments — `GET/POST /{id}/attachments`, `GET/DELETE /{id}/attachments/{att_id}`
- [x] **Version history** — `GET /{id}/history` (JSON snapshot at every status change)
- [x] **Rich-text diff** — `GET /{id}/diff/{other_id}?field=procedure&format=html`
  - [x] HTML output with `<ins>`/`<del>` word-level highlighting
  - [x] Unified-diff plain text output
  - [x] Similarity ratio (0.0 – 1.0)
- [x] **PDF export** — `GET /{id}/export-pdf`
- [x] Migrations: `add_experiment_history`, `add_missing_fields_versioning`, `comprehensive_model_fixes`

---

## Phase 5 — ATR (Analytical Testing Requests)
> Analytical testing linked to experiments and projects

- [x] **ATR module — CRUD**
  - [x] `GET/POST /api/atr/` — list + create
  - [x] `GET/PATCH /api/atr/{id}` — read + update
  - [x] ATR code auto-generation (`ATR00001`, `ATR00002`, …)
- [x] **ATR workflow**
  - [x] `POST /{id}/submit` — raise ATR (NEW → SUBMITTED)
  - [x] `POST /{id}/assign` — QA/TL assigns to analyst (SUBMITTED → VERIFIED)
  - [x] `POST /{id}/complete` — analyst records result (VERIFIED → COMPLETED)
  - [x] `POST /{id}/cancel` — cancel any non-completed ATR
- [x] **ATR attachments** — `GET/POST /{id}/attachments`, `GET/DELETE /{id}/attachments/{att_id}`

---

## Phase 6 — Search & Dashboard
> Cross-module search and user home screen

- [x] **Search module**
  - [x] `GET /api/search/experiments` — full-text + filters (status, project, date range)
  - [x] `GET /api/search/experiments/by-parameters` — search by parameter name/value
  - [x] `GET /api/search/notebooks`
  - [x] `GET /api/search/projects`
  - [x] `GET /api/search/atrs`
  - [x] Role-scoped results (Chemists only see permitted notebooks)
- [x] **Dashboard module**
  - [x] `GET /api/dashboard/counts` — entity counts by status
  - [x] `GET /api/dashboard/my-activity` — recent actions by current user
  - [x] `GET /api/dashboard/verification-queue` — pending TL verifications
  - [x] `GET /api/dashboard/approval-queue` — pending HOD approvals
  - [x] `GET /api/dashboard/rework-inbox` — experiments returned for rework
  - [x] `GET /api/dashboard/sla-alerts` — experiments past SLA deadline

---

## Phase 7 — Admin & System Settings
> System-wide configuration, audit trail, master data

- [x] **Admin module**
  - [x] `GET/PATCH /api/admin/settings/company` — company name, address, logo
  - [x] `GET/PATCH /api/admin/settings/crd` — e-signature re-auth flags (`reauth_submit`, `reauth_verify`)
  - [x] `GET /api/admin/sequences` — view all sequence counters
  - [x] `GET /api/admin/audit` — system-wide audit log
- [x] **Master Data module**
  - [x] `GET/POST/PATCH/DELETE /api/master-data/chemicals` — chemical reference library
  - [x] `GET/POST/PATCH/DELETE /api/master-data/instruments` — instrument reference library
  - [x] `GET/POST/PATCH/DELETE /api/master-data/sites` — site/location definitions
- [x] **Excel Templates module**
  - [x] Upload, list, download, activate, deactivate report templates
- [x] **Role Privileges module** — fine-grained privilege definitions per role
- [x] **Notification Settings** — per-user notification preferences with toggle
- [x] **Unlock Requests** — Chemist requests to re-edit approved experiments; QA approve/reject
- [x] Migration: `restore_roles_and_privileges`, `db_integrity_fixes`

---

## Phase 8 — Inventory: Materials & Batches
> Chemical stock management with full traceability

- [x] **Manufacturers**
  - [x] `GET/POST /api/inventory/manufacturers` — list + create
  - [x] `GET/PATCH /api/inventory/manufacturers/{id}` — read + update
  - [x] `PATCH /api/inventory/manufacturers/{id}/toggle` — activate/deactivate
- [x] **Materials**
  - [x] `GET/POST /api/inventory/materials` — list + create
  - [x] `GET/PATCH /api/inventory/materials/{id}` — read + update
  - [x] `PATCH /api/inventory/materials/{id}/toggle`
  - [x] `PUT /api/inventory/materials/{id}/chemical-props` — chemical properties
  - [x] `PUT /api/inventory/materials/{id}/formulation-props` — formulation properties
  - [x] Material types: `SOLVENT`, `REAGENT`, `REFERENCE_STANDARD`, `API`, `EXCIPIENT`, `OTHER`
- [x] **Batches**
  - [x] `GET/POST /api/inventory/batches` — list + receive new batch
  - [x] `GET/PATCH /api/inventory/batches/{id}` — read + update
  - [x] `PATCH /api/inventory/batches/{id}/toggle`
  - [x] `POST /api/inventory/batches/{id}/issue` — issue qty to a user
  - [x] `POST /api/inventory/batches/{id}/allocate` — allocate qty to a project
  - [x] `GET /api/inventory/batches/{id}/events` — full transaction history
- [x] **Batch Verifications**
  - [x] `GET/POST /api/inventory/batch-verifications` — list + create QC request
  - [x] `GET /api/inventory/batch-verifications/{id}`
  - [x] `PATCH /{id}/verify` — pass QC
  - [x] `PATCH /{id}/reject` — fail QC
- [x] **Stock Requests**
  - [x] `GET/POST /api/inventory/stock-requests` — list + raise request
  - [x] `GET/PATCH /api/inventory/stock-requests/{id}`
  - [x] `PATCH /{id}/approve` / `reject` / `fulfill` / `cancel`
  - [x] `GET /{id}/events` — status history
- [x] **Manufacturer Mappings**
  - [x] `GET/POST /api/inventory/mappings` — approved supplier catalogue entries
  - [x] `PATCH/DELETE /api/inventory/mappings/{id}`
- [x] Migration: `add_inventory_master_21_tables`

---

## Phase 9 — Inventory: Equipment & Instruments
> Lab equipment and instrument tracking with maintenance and calibration

- [x] **Equipment / Instrument / Column Types** (master type definitions)
  - [x] `GET/POST /api/inventory/equipment-types` + `instrument-types` + `column-types`
  - [x] `GET/PATCH /{id}` + `PATCH /{id}/toggle` — for each type
- [x] **Equipment Catalogue** (physical assets)
  - [x] `GET/POST /api/inventory/equipment-catalogue`
  - [x] `GET/PATCH /{id}` + `PATCH /{id}/toggle`
- [x] **Instrument Catalogue**
  - [x] `GET/POST /api/inventory/instrument-catalogue`
  - [x] `GET/PATCH /{id}` + `PATCH /{id}/toggle`
- [x] **Column Catalogue** (tracks injection count)
  - [x] `GET/POST /api/inventory/column-catalogue`
  - [x] `GET/PATCH /{id}` + `PATCH /{id}/toggle`
- [x] **Maintenance Schedules**
  - [x] `GET/POST /api/inventory/maintenance-schedules` — list + schedule
  - [x] `GET/PATCH /{id}` — read + update
  - [x] `PATCH /{id}/complete` — mark done (requires `completed_date`)
  - [x] `PATCH /{id}/cancel`
  - [x] Maintenance types: `PREVENTIVE`, `CORRECTIVE`, `CALIBRATION`
- [x] **Calibration Schedules**
  - [x] `GET/POST /api/inventory/calibration-schedules` — list + schedule
  - [x] `GET/PATCH /{id}`
  - [x] `PATCH /{id}/complete` — mark done with certificate
  - [x] `PATCH /{id}/cancel`
- [x] **Equipment Verifications** (daily use checks)
  - [x] `GET/POST /api/inventory/equipment-verifications`
  - [x] `GET /{id}` + `PATCH /{id}/verify` + `PATCH /{id}/reject`
- [x] **Instrument Verifications** (system suitability checks)
  - [x] `GET/POST /api/inventory/instrument-verifications`
  - [x] `GET /{id}` + `PATCH /{id}/verify` + `PATCH /{id}/reject`

---

## Phase 10 — Inventory Dashboard, Audit & Reports
> Visibility and reporting across the inventory module

- [x] **Inventory Dashboard**
  - [x] `GET /api/inventory/dashboard/kpis` — total stock, expiring count, pending requests
  - [x] `GET /api/inventory/dashboard/available-stock` — current qty per material
  - [x] `GET /api/inventory/dashboard/expiring-soon` — batches expiring within 90 days
  - [x] `GET /api/inventory/dashboard/pending-actions` — pending verifications and requests
- [x] **Inventory Audit Trail**
  - [x] `GET /api/inventory/audit-trail` — filterable by `entity_type`, `entity_id`, date range
- [x] **Inventory Reports**
  - [x] `GET /api/inventory/reports/batch-inventory` — stock levels per material
  - [x] `GET /api/inventory/reports/expiry` — expiry status report
  - [x] `GET /api/inventory/reports/stock-requests` — request summary
  - [x] `GET /api/inventory/reports/equipment-status` — equipment/instrument status (filter by `asset_type`)

---

## Bug Fixes & Hardening

- [x] **passlib + bcrypt 5.0.0 incompatibility** — replaced passlib with direct `bcrypt` calls in `security.py` and `esignature.py`
- [x] **Experiment status check constraint** — DB had stale constraint missing `DRAFT` and `REJECTED`; updated to include all valid statuses
- [x] **Migration FK-safe drop order** — ATR child tables must be dropped before parent (`atr_test_results` → `atr_attributes` → `atr_tests` → `atr_samples`)
- [x] **NOT NULL backfills** — `experiment_parameters.name`, `atr.objectives`, `roles.created_at` backfilled before constraints applied
- [x] **Alembic stamp correction** — stale revision in `alembic_version` fixed via direct SQL
- [x] Migration: `v2_indexes_and_constraints` — performance indexes, FK child-table indexes, singleton id checks
- [x] Migration: `sync_model_drift` — full model/DB sync after divergence

---

## Testing

- [x] `test_endpoints.py` — smoke test, 26 endpoints, all GET
- [x] `test_crud.py` — full CRUD test across all 23 modules
  - [x] **158 / 158 tests passing**
  - [x] All four roles tested (QA, TL, HOD, CHEM)
  - [x] All workflow state machines exercised end-to-end
  - [x] Covers: create → read → update → workflow actions → delete

---

## Total API Coverage

| Module | Endpoints |
|---|---|
| Auth | 7 |
| Users + Roles | 7 |
| Departments | 4 |
| Projects (incl. members + milestones) | 11 |
| Routes + Stages | 7 |
| Notebooks + Permissions | 8 |
| Experiments (incl. all sub-resources + workflow) | 39 |
| ATR (incl. workflow + attachments) | 12 |
| Search | 5 |
| Dashboard | 6 |
| Admin | 7 |
| Master Data | 14 |
| Excel Templates | 8 |
| Unlock Requests | 5 |
| Notification Settings | 6 |
| Role Privileges | 5 |
| Inventory — Manufacturers | 5 |
| Inventory — Materials | 7 |
| Inventory — Batches | 8 |
| Inventory — Batch Verifications | 5 |
| Inventory — Stock Requests | 9 |
| Inventory — Manufacturer Mappings | 4 |
| Inventory — Equipment/Instrument/Column Types | 15 |
| Inventory — Equipment/Instrument/Column Catalogue | 15 |
| Inventory — Maintenance + Calibration Schedules | 12 |
| Inventory — Equipment + Instrument Verifications | 10 |
| Inventory — Dashboard | 4 |
| Inventory — Audit Trail | 1 |
| Inventory — Reports | 4 |
| **Total** | **~270** |
