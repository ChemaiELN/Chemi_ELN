# Backend Migration Plan — v1.0.0 → v2.0.0

This document describes every change required to upgrade the existing `backend/`
to match `backend-new/`. Changes are split into **14 phases** ordered by
dependency (foundational changes first, feature modules last).

> **Rule:** Do not start a phase until the previous one is complete and
> confirmed. Each phase is self-contained and independently testable.

---

## Phase Overview

| # | Phase | Files Touched | Risk |
|---|-------|--------------|------|
| 1 | [Foundation — PUUID & base.py](#phase-1-foundation--puuid--basepy) | `app/models/base.py` | High (global DB type change) |
| 2 | [Global Settings Model](#phase-2-global-settings-model) | `app/models/settings.py` | Medium | ✅ Done |
| 3 | [CRD Settings Expansion](#phase-3-crd-settings-expansion) | `app/models/settings.py` | Medium | ✅ Done |
| 4 | [Role System Expansion](#phase-4-role-system-expansion) | `app/models/user.py` | Low | ✅ Done |
| 5 | [User Model Enhancements](#phase-5-user-model-enhancements) | `app/models/user.py`, `app/schemas/user.py` | Medium | ✅ Done |
| 6 | [Experiment Core Enhancements](#phase-6-experiment-core-enhancements) | `app/models/experiment.py` | High | ✅ Done |
| 7 | [Experiment Inputs & Parameters Expansion](#phase-7-experiment-inputs--parameters-expansion) | `app/models/experiment.py` | Medium | ✅ Done |
| 8 | [Master Data Models + Router](#phase-8-master-data-models--router) | `app/models/master_data.py` (new), `app/routers/master_data.py` (new) | Medium | ✅ Done |
| 9 | [Services Layer](#phase-9-services-layer) | `app/services/` (new folder), `app/utils/global_settings.py` (new), `app/utils/tokens.py` (new), `app/utils/token_cleanup.py` (new), `app/utils/retention_cleanup.py` (new) | Medium | ✅ Done |
| 10 | [Dashboard Module](#phase-10-dashboard-module) | `app/routers/dashboard.py` (new) | Low | ✅ Done |
| 11 | [Search Module](#phase-11-search-module) | `app/routers/search.py` (new) | Low | ✅ Done |
| 12 | [Role Privileges Module](#phase-12-role-privileges-module) | `app/routers/role_privileges.py` (new), `app/schemas/role_privilege.py` (new) | Low | ✅ Done |
| 13 | [PDF Export Module](#phase-13-pdf-export-module) | `app/routers/pdf_export.py` (new) | Low | ✅ Done |
| 14 | [main.py — Version & Router Registration](#phase-14-mainpy--version--router-registration) | `app/main.py` | Low | ✅ Done |

---

## Phase 1: Foundation — PUUID & base.py

**Goal:** Add the `PUUID` native PostgreSQL UUID type alias to `base.py`.
All subsequent phases use this. Existing `String(36)` columns across every
model must be migrated to `PUUID`.

### Files
- `app/models/base.py`

### Changes
| Item | Description |
|------|-------------|
| Add `PUUID` | `PUUID = _PgUUID(as_uuid=False)` using `sqlalchemy.dialects.postgresql.UUID` |
| Import update | Add `from sqlalchemy.dialects.postgresql import UUID as _PgUUID` |

### DB Impact
Every primary key and foreign key UUID column in every model changes from
`String(36)` → `PUUID`. This is a **PostgreSQL-only** change (column type
`VARCHAR(36)` → `UUID`). Requires a DB migration covering all tables:

`roles`, `role_privileges`, `users`, `password_reset_tokens`, `refresh_tokens`,
`departments`, `projects`, `notebooks`, `notebook_permissions`, `experiments`,
`experiment_inputs`, `experiment_parameters`, `experiment_tlc`,
`experiment_attachments`, `experiment_history`, `experiment_comments`,
`atr`, `unlock_requests`, `sequences`, `audit_logs`, `notification_settings`,
`excel_templates`

### Test Checkpoint
- Server starts without error
- Existing login endpoint returns token (UUID FK chain intact)

---

## Phase 2: Global Settings Model

**Goal:** Add the brand-new `global_settings` table which centralises
system-wide feature flags, file size limits, SMTP config, and search limits.
This table is referenced by utility helpers added in Phase 9.

### Files
- `app/models/settings.py`

### Changes
| Item | Description |
|------|-------------|
| New class `GlobalSettings` | New single-row table (`id=1`) — full details below |

### New Table: `global_settings`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | `SmallInteger` PK | `1` | Singleton row |
| `auth_type` | `String(20)` | `"Application"` | LDAP / Application |
| `use_random_password_through_mail` | `Boolean` | `False` | |
| `default_password` | `String(255)`, Optional | — | |
| `lock_user_after_x_attempts` | `SmallInteger` | `5` | |
| `password_expiry_days` | `SmallInteger` | `90` | |
| `image_file_size_kb` | `SmallInteger` | `2048` | 2 MB |
| `attachment_size_kb` | `Integer` | `51200` | 50 MB |
| `configure_customer_enabled` | `Boolean` | `False` | |
| `include_equipment_inventory` | `Boolean` | `False` | |
| `instrument_service_ip` | `String(255)`, Optional | — | |
| `qa_privilege_role` | `String(20)` | `"QA"` | |
| `email_notification_enabled` | `Boolean` | `False` | |
| `smtp_host` | `String(255)`, Optional | — | |
| `smtp_port` | `SmallInteger`, Optional | `587` | |
| `smtp_pool_address` | `String(255)`, Optional | — | |
| `smtp_auth_enabled` | `Boolean` | `False` | |
| `experiment_qa_remarks_enabled` | `Boolean` | `True` | |
| `experiment_report_stage` | `String(30)` | `"Before Approval"` | |
| `experiment_per_limit` | `SmallInteger` | `999` | |
| `notebook_experiment_limit` | `SmallInteger` | `999` | |
| `experiment_search_result_limit` | `SmallInteger` | `100` | |
| `company_logo_path` | `String(500)`, Optional | — | |
| `updated_at` | `DateTime` | `now_utc` | |

### DB Impact
New table creation only. No existing tables affected.

### Test Checkpoint
- Alembic migration runs without error
- `GET /api/admin/` can read global settings row

---

## Phase 3: CRD Settings Expansion

**Goal:** Add ~28 new columns to the existing `crd_settings` table to support
SLA tracking, extended re-auth flags, new procedure/scheme/TLC display modes,
and input default values.

### Files
- `app/models/settings.py`

### New Columns on `crd_settings`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `sample_notebook_code` | `String(100)`, Optional | — | Preview of notebook code format |
| `mandate_tl_approval_atr` | `Boolean` | `True` | ATR flow setting |
| `verification_request_flow` | `Boolean` | `True` | Enable verification request step |
| `route_and_stage` | `Boolean` | `True` | Enable route/stage on experiments |
| `clone_procedure_without_numerical_data` | `Boolean` | `False` | Clone behaviour |
| `closing_stage` | `String(20)` | `"APPROVED"` | When experiment is closed |
| `experiment_report_stage` | `String(20)` | `"APPROVED"` | When report is available |
| `scheme_type` | `String(30)` | `"INLINE_KETCHER"` | EXTERNAL_FILE / INLINE_MARVIN / INLINE_KETCHER |
| `procedure_display` | `String(20)` | `"INTEGRATED"` | INTEGRATED / SEPARATE / LINEAR / TABULAR |
| `include_observation_start_end_time` | `Boolean` | `False` | Step time tracking |
| `tlc_type` | `String(20)` | `"INLINE"` | EXTERNAL_FILE / INLINE |
| `tlc_row_count` | `SmallInteger` | `3` | Default TLC rows |
| `reference_experiment_link_code` | `String(50)`, Optional | — | Clone reference code |
| `include_reference_for_cloned_experiments` | `Boolean` | `True` | |
| `sla_experiments_days` | `SmallInteger` | `30` | SLA threshold for experiment completion |
| `sla_delayed_submission_days` | `SmallInteger` | `7` | SLA for delayed submission |
| `sla_delayed_approval_days` | `SmallInteger` | `14` | SLA for delayed approval |
| `reauth_save` | `Boolean` | `False` | Re-auth on save (FIX-47) |
| `reauth_submit_for_verification` | `Boolean` | `True` | Re-auth on submit for verification |
| `reauth_verification` | `Boolean` | `True` | Re-auth on verification step |
| `reauth_deactivate` | `Boolean` | `True` | Re-auth on deactivate user |
| `reauth_attachment_upload` | `Boolean` | `False` | Re-auth on attachment upload |
| `input_default_mol_weight` | `Numeric(10,4)`, Optional | — | Default mol weight (FIX-56) |
| `input_default_quantity` | `Numeric(12,4)`, Optional | — | Default quantity (FIX-56) |
| `input_auto_calc_moles` | `Boolean` | `True` | Auto-calc moles (FIX-56) |
| `input_default_mole_ratio` | `Numeric(8,4)`, Optional | — | Default mole ratio (FIX-56) |

### DB Impact
`ALTER TABLE crd_settings ADD COLUMN ...` for each new field (all nullable or
have defaults — no data loss risk).

### Test Checkpoint
- Admin CRD settings endpoint returns new fields (with default values)

---

## Phase 4: Role System Expansion

**Goal:** Add new role codes `HOD`, `ARD_TL`, `ARD_ANALYST`, `ARD_HOD` to the
`VALID_ROLES` constant and update the `Role.description` column type.

### Files
- `app/models/user.py`

### Changes
| Item | Old | New |
|------|-----|-----|
| `VALID_ROLES` constant | `{"QA", "TL", "CHEM"}` | `{"QA", "HOD", "TL", "CHEM", "ARD_TL", "ARD_ANALYST", "ARD_HOD"}` |
| `Role.description` column type | `String(500)` | `Text` |

### DB Impact
- `ALTER TABLE roles ALTER COLUMN description TYPE TEXT` — safe, expanding only

### Test Checkpoint
- Seed new roles via admin or migration
- Existing role-based auth still works

---

## Phase 5: User Model Enhancements

**Goal:** Add 6 new user profile fields to the `users` table and expose them
through the user schema.

### Files
- `app/models/user.py`
- `app/schemas/user.py`

### New Columns on `users`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `middle_initials` | `String(20)`, Optional | — | FIX-53 |
| `contact_no` | `String(30)`, Optional | — | FIX-53: contact number |
| `site` | `String(100)`, Optional | — | FIX-37/55: physical site |
| `dashboard_reference` | `String(100)`, Optional | — | FIX-55 |
| `allow_settings_update` | `Boolean` | `False` | FIX-55: can user change their own settings |
| `must_reset_password` | `Boolean` | `False` | FIX-53: force reset on next login |

### Schema Changes
- Add the 6 new fields to `UserResponse` and `UserUpdate` Pydantic schemas

### DB Impact
`ALTER TABLE users ADD COLUMN ...` for each field (all nullable or defaulted).

### Test Checkpoint
- `GET /api/users/me` returns new fields
- `PATCH /api/users/{id}` accepts new fields

---

## Phase 6: Experiment Core Enhancements

**Goal:** Add new columns to the `experiments` table, remove the dropped
`scheme_mol` column, widen the `status` field, add two entirely new tables
(`experiment_steps` and `experiment_equipment`), and update the `Experiment`
model relationships.

### Files
- `app/models/experiment.py`

### Column Changes on `experiments`

| Column | Change | Details |
|--------|--------|---------|
| `status` | Type widened | `String(20)` → `String(30)` (new status `VERIFICATION REQUESTED` is 24 chars) |
| `scheme_mol` | **REMOVED** | Column dropped — migrate data out if needed before dropping |
| `precautions` | **NEW** `Text`, Optional | FIX-28: HTML rich text precautions tab |
| `is_highlighted` | **NEW** `Boolean`, default `False` | FIX-46: highlight flag |
| `highlight_comments` | **NEW** `Text`, Optional | FIX-46 |
| `post_verification_remarks` | **NEW** `Text`, Optional | FIX-30: QA post-approval remarks |
| `reference_exp_code` | **NEW** `String(60)`, Optional | FIX-21: clone tracking |
| `improvement_suggestions` | **NEW** `Text`, Optional | FIX-23: rework suggestions |
| `save_comments` | **NEW** `Text`, Optional | FIX-47: e-signature save comments |
| `tlc_drawing_path` | **NEW** `String(500)`, Optional | FIX-29: inline TLC plate drawing |
| `submitted_to` | **NEW** `PUUID → users.id`, Optional | FIX-06: who it was sent to for review |
| `submitted_to_at` | **NEW** `DateTime`, Optional | FIX-06: when sent to reviewer |

### New Relationships on `Experiment` model
- `steps` → `ExperimentStep` (FIX-01)
- `equipment` → `ExperimentEquipment` (FIX-20)
- `route` → `Route` (FIX-36: for PDF export)
- `stage` → `Stage` (FIX-36: for PDF export)
- `comments` → `ExperimentComment` (FIX-36)
- `submitter` → `User` via `submitted_by`
- `reviewer` → `User` via `submitted_to`

### New Table: `experiment_steps`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `PUUID` PK | |
| `experiment_id` | `PUUID` FK → `experiments.id` | |
| `step_no` | `Integer` | 1, 2, 3 … |
| `procedure_text` | `Text`, Optional | HTML rich text |
| `observation_text` | `Text`, Optional | HTML rich text |
| `qty` | `String(50)`, Optional | e.g. "15 mL" |
| `temperature` | `String(50)`, Optional | e.g. "20 °C" |
| `attachment_path` | `String(500)`, Optional | |
| `attachment_name` | `String(255)`, Optional | |
| `attachment_size` | `BigInteger`, Optional | bytes |
| `created_at` | `DateTime` | |

### New Table: `experiment_equipment`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `PUUID` PK | |
| `experiment_id` | `PUUID` FK → `experiments.id` | |
| `instrument_code` | `String(50)` | |
| `instrument_type` | `String(100)`, Optional | HPLC / Balance / Reactor |
| `instrument_name` | `String(255)`, Optional | |
| `maintenance_status` | `String(30)`, Optional | Ok / Not Ok |
| `calibration_status` | `String(30)`, Optional | Ok / Not Ok / Due |
| `start_time` | `DateTime`, Optional | |
| `end_time` | `DateTime`, Optional | |
| `remarks` | `String(500)`, Optional | |
| `added_by` | `PUUID` FK → `users.id`, Optional | |
| `added_at` | `DateTime` | |

### Also: `experiment_history` — New Columns

| Column | Type | Notes |
|--------|------|-------|
| `improvement_suggestions` | `Text`, Optional | FIX-23 |
| `submitted_to_user_id` | `PUUID` FK → `users.id`, Optional | FIX-06 |
| `save_comments` | `Text`, Optional | FIX-47 |
| `action` column | `String(20)` → `String(30)` | New action names are longer |

### Also: `experiment_tlc` — New Column

| Column | Type | Notes |
|--------|------|-------|
| `drawing_path` | `String(500)`, Optional | FIX-29: inline TLC plate drawing |

### DB Impact
- Widen `experiments.status` and `experiment_history.action`
- Drop `experiments.scheme_mol`
- Add all new columns to `experiments`, `experiment_history`, `experiment_tlc`
- Create two new tables: `experiment_steps`, `experiment_equipment`

### Test Checkpoint
- `GET /api/experiments/{id}` returns new fields
- Steps and equipment sub-resources exist on the model

---

## Phase 7: Experiment Inputs & Parameters Expansion

**Goal:** Expand `experiment_inputs` with 12 new columns for batch/vendor/
calculated fields, and expand `experiment_parameters` with formula engine
support (code, INPUT/OUTPUT type, formula expression, evaluated value, UOM).

### Files
- `app/models/experiment.py`

### New Columns on `experiment_inputs`

| Column | Type | Notes |
|--------|------|-------|
| `formula` | `String(100)`, Optional | Molecular formula |
| `batch_lot_no` | `String(100)`, Optional | Batch/Lot No. |
| `vendor_name` | `String(255)`, Optional | |
| `batch_no` | `String(100)`, Optional | Internal batch number |
| `available_qty` | `Numeric(12,4)`, Optional | |
| `required_qty` | `Numeric(12,4)`, Optional | |
| `required_qty_unit` | `String(20)`, Optional | gm / mL / mg |
| `density` | `Numeric(10,4)`, Optional | |
| `strength` | `Numeric(8,2)`, Optional | Strength (%) |
| `ww_ratio` | `Numeric(8,4)`, Optional | w/w or w/vol ratio |
| `molarity` | `Numeric(10,4)`, Optional | Molarity (M) |
| `remarks` | `Text`, Optional | |

### Column Type Changes on `experiment_inputs`

| Column | Old | New |
|--------|-----|-----|
| `cas_no` | `String(20)` | `String(30)` |
| `quantity` | `Numeric(10,4)` | `Numeric(12,4)` |
| `moles` | `Numeric(12,6)` | `Numeric(14,8)` |

### New Columns on `experiment_parameters` (Formula Engine — FIX-03)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `code` | `String(20)`, Optional | — | P1, P2 … for formula references |
| `input_output` | `String(10)` | `"INPUT"` | INPUT or OUTPUT |
| `user_entered_or_formula` | `String(20)` | `"USER ENTERED"` | USER ENTERED or FORMULA |
| `param_type` | `String(10)` | `"NUMBER"` | NUMBER or TEXT |
| `formula_expression` | `String(500)`, Optional | — | e.g. `"P1+P2"` |
| `parameter_value` | `Numeric(20,6)`, Optional | — | Evaluated numeric value |
| `uom` | `String(30)`, Optional | — | Unit of measure |
| `remarks` | `String(500)`, Optional | — | |

> **Note:** `name` (existing) is conceptually renamed to `parameter_name` in
> the new backend. The old `name` and `value`/`unit` columns are kept for
> backward compatibility; new code uses `parameter_name`, `parameter_value`,
> `uom`.

### Also: `excel_templates` — Column Type Fix

| Column | Old | New |
|--------|-----|-----|
| `file_size` | `String(20)` (text) | `BigInteger` (bytes as integer) |

### DB Impact
- `ALTER TABLE experiment_inputs ADD COLUMN ...` × 12
- `ALTER TABLE experiment_inputs ALTER COLUMN cas_no/quantity/moles TYPE ...`
- `ALTER TABLE experiment_parameters ADD COLUMN ...` × 8
- `ALTER TABLE excel_templates ALTER COLUMN file_size TYPE BIGINT`

### Test Checkpoint
- Experiment inputs accept new fields via API
- Parameter rows can store formula expression and numeric value

---

## Phase 8: Master Data Models + Router

**Goal:** Add 4 new tables for chemical catalogue, instrument inventory,
sites, and experiment-template links. Add the full `master_data` router
with CRUD for each resource.

### Files
- `app/models/master_data.py` ← **new file**
- `app/routers/master_data.py` ← **new file**

### New Table: `lookup_chemicals`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `PUUID` PK | |
| `chemical_name` | `String(255)` | |
| `cas_no` | `String(30)`, Optional | |
| `formula` | `String(100)`, Optional | |
| `mol_wt` | `Numeric(10,4)`, Optional | |
| `vendor_name` | `String(255)`, Optional | |
| `density` | `Numeric(10,4)`, Optional | |
| `purity_pct` | `Numeric(5,2)`, Optional | |
| `is_active` | `Boolean` | default `True` |
| `created_by` | `PUUID` FK → `users.id`, Optional | |
| `created_at` | `DateTime` | |
| `updated_at` | `DateTime` | |

### New Table: `lookup_instruments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `PUUID` PK | |
| `instrument_code` | `String(50)` UNIQUE | |
| `instrument_type` | `String(100)`, Optional | HPLC / Balance / Reactor |
| `instrument_name` | `String(255)` | |
| `maintenance_status` | `String(30)`, Optional | Ok / Due |
| `calibration_status` | `String(30)`, Optional | Ok / Due / Expired |
| `is_active` | `Boolean` | default `True` |
| `created_by` | `PUUID` FK → `users.id`, Optional | |
| `created_at` | `DateTime` | |
| `updated_at` | `DateTime` | |

### New Table: `sites`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `PUUID` PK | |
| `code` | `String(20)` UNIQUE | |
| `name` | `String(100)` | |
| `is_active` | `Boolean` | default `True` |
| `created_at` | `DateTime` | |

### New Table: `experiment_excel_templates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `PUUID` PK | |
| `experiment_id` | `PUUID` FK → `experiments.id` | |
| `template_id` | `PUUID` FK → `excel_templates.id` | |
| `linked_at` | `DateTime` | |
| `linked_by` | `PUUID` FK → `users.id`, Optional | |

### New Endpoints — `/api/master-data/...`

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/master-data/chemicals` | QA / HOD |
| GET | `/api/master-data/chemicals` | Any |
| GET | `/api/master-data/chemicals/{id}` | Any |
| PATCH | `/api/master-data/chemicals/{id}` | QA / HOD |
| DELETE | `/api/master-data/chemicals/{id}` | QA / HOD |
| POST | `/api/master-data/instruments` | QA / HOD |
| GET | `/api/master-data/instruments` | Any |
| GET | `/api/master-data/instruments/{id}` | Any |
| PATCH | `/api/master-data/instruments/{id}` | QA / HOD |
| DELETE | `/api/master-data/instruments/{id}` | QA / HOD |
| POST | `/api/master-data/sites` | QA / HOD |
| GET | `/api/master-data/sites` | Any |
| PATCH | `/api/master-data/sites/{id}` | QA / HOD |
| DELETE | `/api/master-data/sites/{id}` | QA / HOD |

### DB Impact
Create 4 new tables. No existing tables affected.

### Test Checkpoint
- `POST /api/master-data/chemicals` creates a record
- `GET /api/master-data/instruments` returns empty list (no error)

---

## Phase 9: Services Layer

**Goal:** Add the `services/` package with two service modules, and add four
new utility helper files to `utils/`.

### Files
- `app/services/__init__.py` ← **new file**
- `app/services/esignature.py` ← **new file**
- `app/services/formula_engine.py` ← **new file**
- `app/utils/global_settings.py` ← **new file**
- `app/utils/tokens.py` ← **new file**
- `app/utils/token_cleanup.py` ← **new file**
- `app/utils/retention_cleanup.py` ← **new file**

### `app/services/esignature.py`
- `class ESignatureRequired(HTTPException)` — 403 with message
- `verify_esignature(db, user, password, *, require, action)` — verifies bcrypt hash
- `get_crd_settings(db)` — returns singleton `CRDSettings` row (creates if missing)

### `app/services/formula_engine.py`
- `evaluate_formula(expression, param_map)` — safely evaluates math formulas using AST (no `eval`)
- `recalculate_experiment_parameters(db, experiment_id)` — multi-pass resolution of OUTPUT params

### `app/utils/global_settings.py`
- `get_global_settings_row(db)` — singleton `GlobalSettings` row
- `get_crd_settings_row(db)` — singleton `CRDSettings` row
- `get_smtp_settings_row(db)` — singleton `SMTPConfig` row
- `resolve_upload_limit_bytes(db, filename, is_image)` — effective upload cap from DB + env
- `experiment_search_limit(db)` — max search results from `GlobalSettings`

### `app/utils/tokens.py` / `token_cleanup.py` / `retention_cleanup.py`
- Helpers for token lifecycle and data retention (background cleanup tasks)

### DB Impact
None — code only.

### Test Checkpoint
- Import `from app.services.esignature import verify_esignature` works without error
- Import `from app.utils.global_settings import experiment_search_limit` works

---

## Phase 10: Dashboard Module

**Goal:** Add the dashboard router providing 6 aggregation and queue endpoints.
Depends on Phase 9 (`get_crd_settings`).

### Files
- `app/routers/dashboard.py` ← **new file**

### New Endpoints — `/api/dashboard/...`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/counts` | Experiment counts by status + ATR queue counts for current user |
| GET | `/api/dashboard/verification-queue` | Experiments submitted to current user (paginated) |
| GET | `/api/dashboard/approval-queue` | Verified experiments user can approve (paginated) |
| GET | `/api/dashboard/rework-inbox` | Experiments returned to user for rework (paginated) |
| GET | `/api/dashboard/sla-alerts` | Overdue experiments based on `crd_settings.sla_*` thresholds |
| GET | `/api/dashboard/my-activity` | Recent `ExperimentHistory` actions by current user |

### Access Control
All endpoints require any authenticated user. QA and HOD roles see all
experiments; other roles see only notebooks they have `can_view` permission on.

### DB Impact
None — read-only queries only.

### Test Checkpoint
- `GET /api/dashboard/counts` returns `{"experiments": {...}, "atr": {...}}`
- `GET /api/dashboard/sla-alerts` returns SLA counts without error

---

## Phase 11: Search Module

**Goal:** Add the global search router providing 5 search endpoints across
experiments, parameters, ATRs, notebooks, and projects.
Depends on Phase 9 (`experiment_search_limit` utility).

### Files
- `app/routers/search.py` ← **new file**

### New Endpoints — `/api/search/...`

| Method | Path | Description | Key Query Params |
|--------|------|-------------|-----------------|
| GET | `/api/search/experiments` | Full-text search across code, title, aim, conclusion | `q`, `status`, `notebook_id`, `project_id`, `yield_min`, `yield_max`, `latest_only`, `page`, `page_size` |
| GET | `/api/search/experiments/by-parameters` | Search by parameter code and value range | `param_code`, `value_min`, `value_max`, `uom` |
| GET | `/api/search/atrs` | ATR search | `q`, `status`, `test_type`, `raised_by_me`, `assigned_to_me` |
| GET | `/api/search/notebooks` | Notebook search | `q`, `project_id`, `status` |
| GET | `/api/search/projects` | Project search | `q`, `status`, `department_id` |

### Access Control
All authenticated users. QA/HOD bypass notebook permission filter; others
see only their permitted notebooks.

### DB Impact
None — read-only queries only.

### Test Checkpoint
- `GET /api/search/experiments?q=test` returns paginated list
- `GET /api/search/experiments/by-parameters?param_code=P1&value_min=0` works

---

## Phase 12: Role Privileges Module

**Goal:** Add fine-grained privilege management endpoints and the roles
listing endpoint. Add the `role_privilege` schema file.

### Files
- `app/routers/role_privileges.py` ← **new file**
- `app/schemas/role_privilege.py` ← **new file**

### New Schema (`app/schemas/role_privilege.py`)
- `RoleShort` — id, code, name
- `RolePrivilegeCreate` — role_id, department_id, privilege_key, is_granted
- `RolePrivilegeUpdate` — is_granted (only updatable field)
- `RolePrivilegeResponse` — full response with nested role and department objects

### New Endpoints — `/api/roles/` and `/api/role-privileges/...`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/roles/` | List all roles (for dropdowns) | Any |
| POST | `/api/role-privileges/` | Create a privilege grant | QA only |
| GET | `/api/role-privileges/` | List privileges (filter by role, dept, key) | Any |
| GET | `/api/role-privileges/{id}` | Get single privilege | Any |
| PATCH | `/api/role-privileges/{id}` | Update `is_granted` | QA only |
| DELETE | `/api/role-privileges/{id}` | Remove a privilege | QA only |

### DB Impact
None — uses existing `role_privileges` and `roles` tables (already in schema).

### Test Checkpoint
- `GET /api/roles/` returns seeded roles
- `POST /api/role-privileges/` creates a record (QA token required)

---

## Phase 13: PDF Export Module

**Goal:** Add the experiment PDF/text export endpoint.
Depends on Phase 6 (experiment `steps`, `equipment`, `route`, `stage`
relationships must exist on the model).

### Files
- `app/routers/pdf_export.py` ← **new file**

### New Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/experiments/{exp_id}/export-pdf` | Download experiment as text report (or PDF if WeasyPrint installed) |

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `include_steps` | bool | `True` | Include procedure steps |
| `include_inputs` | bool | `True` | Include reagents/inputs table |
| `include_parameters` | bool | `True` | Include parameters table |
| `include_equipment` | bool | `True` | Include equipment used |
| `include_tlc` | bool | `True` | Include TLC data |
| `include_comments` | bool | `False` | Include experiment comments |

### Response
- `Content-Type: text/plain` (fallback) or `application/pdf` (if WeasyPrint is installed)
- `Content-Disposition: attachment; filename="{full_code}_report.txt"`

### DB Impact
None — read-only.

### Test Checkpoint
- `GET /api/experiments/{id}/export-pdf` returns a downloadable file
- Response headers contain `Content-Disposition: attachment`

---

## Phase 14: main.py — Version & Router Registration

**Goal:** Register all new routers in `main.py` and bump the API version
to `2.0.0`.

### Files
- `app/main.py`

### Changes

| Item | Old | New |
|------|-----|-----|
| `version` | `"1.0.0"` | `"2.0.0"` |
| Health check response | `{"status": "ok"}` | `{"status": "ok", "app": ..., "version": "2.0.0"}` |
| Router imports | 11 routers | 15 routers (+ dashboard, search, master_data, pdf_export) |
| Router registrations | 11 entries | 15 entries |

### New Router Registrations

```python
app.include_router(rp.router,           prefix="/api/role-privileges",  tags=["Role Privileges"])
app.include_router(rp.roles_router,     prefix="/api/roles",            tags=["Roles"])
app.include_router(dashboard.router,    prefix="/api/dashboard",        tags=["Dashboard"])
app.include_router(search.router,       prefix="/api/search",           tags=["Search"])
app.include_router(master_data.router,  prefix="/api/master-data",      tags=["Master Data"])
app.include_router(pdf_export.router,   prefix="/api/experiments",      tags=["PDF Export"])
```

### Test Checkpoint
- `GET /api/health` returns `{"version": "2.0.0"}`
- `GET /api/docs` shows all 27 new endpoints in Swagger UI
- Full smoke test of one endpoint from each new module

---

## Dependency Graph

```
Phase 1 (PUUID)
    └── Phase 2 (GlobalSettings)
    └── Phase 3 (CRD Settings)
    └── Phase 4 (Roles)
            └── Phase 5 (Users)
    └── Phase 6 (Experiment Core)
            └── Phase 7 (Inputs & Parameters)
            └── Phase 13 (PDF Export)
    └── Phase 8 (Master Data)
    └── Phase 9 (Services & Utils)
            └── Phase 10 (Dashboard)
            └── Phase 11 (Search)
    └── Phase 12 (Role Privileges)

All phases → Phase 14 (main.py)
```

---

## Quick Reference — New Tables by Phase

| Phase | New Table(s) |
|-------|-------------|
| 2 | `global_settings` |
| 6 | `experiment_steps`, `experiment_equipment` |
| 8 | `lookup_chemicals`, `lookup_instruments`, `sites`, `experiment_excel_templates` |

**Total new tables: 7**

---

## Quick Reference — New Endpoints by Phase

| Phase | Count | Prefix |
|-------|-------|--------|
| 8 | 14 | `/api/master-data/` |
| 10 | 6 | `/api/dashboard/` |
| 11 | 5 | `/api/search/` |
| 12 | 6 | `/api/role-privileges/` + `/api/roles/` |
| 13 | 1 | `/api/experiments/{id}/export-pdf` |

**Total new endpoints: 32**
