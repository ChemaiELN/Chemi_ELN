# Backend Analysis — Laurus ELN FastAPI Backend

## 1. Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI 0.115.5 (Python) |
| ASGI Server | Uvicorn 0.32.1 |
| ORM | SQLAlchemy 2.0.36 (sync) |
| Database | PostgreSQL (psycopg2-binary 2.9.10) |
| Auth | python-jose 3.3.0 (JWT HS256), bcrypt 5.0.0 |
| Validation | Pydantic v2 |
| Migrations | Alembic 1.14.0 |
| File uploads | python-multipart 0.0.17 |
| HTTP client | httpx 0.28.1 (AD integration calls) |
| PDF | xhtml2pdf 0.2.17 |
| Barcode/QR | python-barcode 0.16.1, qrcode 8.2 |
| Chemistry | rdkit 2026.3.5 (mol structure rendering) |
| Office formats | openpyxl 3.1.5, python-docx 1.2.0, lxml 6.1.1 |

---

## 2. Project Architecture

```
app/
├── main.py                  # FastAPI app init, CORS, router registration, startup
├── config.py                # Pydantic Settings (env vars)
├── database.py              # SQLAlchemy engine, session, Base
├── dependencies.py          # get_current_user(), get_db()
├── auth/
│   ├── router.py            # /api/auth endpoints
│   └── utils.py             # JWT create/decode, password hashing
├── shared/
│   ├── privileges.py        # RBAC privilege catalog + helpers
│   ├── ard_settings.py      # ARD feature flags
│   └── files.py             # File upload/download utilities
├── modules/
│   ├── users/               # User CRUD
│   ├── departments/         # Department CRUD
│   ├── labs/                # Lab CRUD
│   ├── roles/               # Role CRUD
│   ├── role_privileges/     # Privilege matrix
│   ├── admin/               # Global settings, ID sequences
│   ├── master_data/         # Chemicals, instruments, sites
│   ├── workflow_templates/  # Workflow template CRUD
│   ├── calc_templates/      # Calc sheet template CRUD
│   ├── projects/            # ADC projects, notebooks, experiments
│   ├── cgt/                 # CGT projects, notebooks, experiments
│   ├── ard/                 # ARD module (ATR, tests, experiments, templates)
│   ├── inventory/           # Inventory module (30+ sub-modules)
│   └── sse/                 # Server-Sent Events
└── models/                  # SQLAlchemy ORM models (all tables)
```

---

## 3. Configuration (`.env` variables)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | string | required | PostgreSQL connection string |
| `SECRET_KEY` | string | required | JWT signing key |
| `ALGORITHM` | string | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | `30` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | int | `7` | Refresh token TTL |
| `CORS_ORIGINS` | list | `["http://localhost:5173"]` | Allowed CORS origins |
| `UPLOAD_DIR` | string | `"uploads"` | File upload root directory |
| `MAX_UPLOAD_BYTES` | int | `52428800` (50 MB) | Max single file upload |
| `MAX_BODY_BYTES` | int | `10485760` (10 MB) | Max request body |
| `AD_API_BASE_URL` | string | optional | External AD system base URL |
| `AD_INTEGRATION_API_KEY` | string | optional | Auth key for inbound AD push-back |
| `AD_DEFAULT_TL_USERNAME` | string | optional | Default ARD TL for external ATR creation |

---

## 4. Database Connection

- Engine: `create_engine(url, pool_pre_ping=True, pool_size=10, max_overflow=20)`
- Session: `SessionLocal` — sync, `autocommit=False`, `autoflush=False`
- `get_db()` dependency yields `SessionLocal`, closes on exit

---

## 5. Authentication & Authorization

### JWT Tokens
- **Access token** payload: `{sub: user_id, exp, type: "access", ver: token_version}`
- **Refresh token** payload: `{sub: user_id, exp, type: "refresh"}`
- Algorithm: HS256
- `token_version` on user record invalidates all prior tokens on logout (no blacklist)

### `get_current_user()` Flow
1. Extract `Bearer` token from `Authorization` header via `HTTPBearer`
2. Decode JWT — reject if invalid/expired or `type != "access"`
3. Query `User` by UUID from `sub` — reject if not found or `is_active=false`
4. Check `decoded.ver == user.token_version` — reject if mismatch
5. Return user ORM object

### Account Lock
- Track `failed_login_count` on user record
- On reaching `global_settings.lock_user_after_x_attempts` (default 5): set `locked_until = now + 30 min`
- Successful login resets `failed_login_count = 0`

### RBAC Privilege System

**PRIVILEGE_CATALOG keys:**
- `admin.settings`, `admin.excel_templates`, `admin.notifications`, `admin.role_privileges`
- `users.manage`, `departments.manage`, `labs.manage`, `master_data.manage`
- `calc_templates.manage`, `project.manage`, `notebook.manage`, `experiment.manage`
- `atr.manage`, `ard.manage`

**`user_has_privilege(db, user, key)` logic:**
1. `SUPER_ADMIN` role → always `true`
2. User must be in department `QA`, `QC`, or `AD`
3. Legacy bypass: `HOD` role in `QA` dept → always `true`
4. Otherwise: check `role_privileges` table for `{role_id, privilege_key, is_granted: true}`

**Creator Role Restriction:** Only `HOD`, `TL`, `SUPER_ADMIN` may create projects/notebooks/experiments. QA dept users are view-only.

**Assignment-Restricted Roles:** `CHEM`, `ANALYST` — can only see notebooks/experiments explicitly assigned to them.

### ARD RBAC
- All ARD routes require user in `ARD` dept OR `SUPER_ADMIN` (or explicit external requester checks)
- Role helpers: `is_analyst`, `is_tl`, `is_hod`, `is_qa`, `is_admin`, `is_lab_role`, etc.
- Electronic signature: password re-entry required for gated workflow transitions (bcrypt verification)

---

## 6. All API Modules & Endpoints

### 6.1 Auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Login; returns access + refresh tokens |
| POST | `/refresh` | Refresh tokens |
| POST | `/logout` | Increment token_version (invalidate all sessions) |
| POST | `/verify-password` | E-signature password check |
| GET | `/me` | Current user profile |
| GET | `/security-questions` | List of 8 predefined security questions |
| POST | `/me/security-questions` | Save user's security question answers |
| POST | `/forgot-password/verify` | Verify security answers → return reset token |
| POST | `/forgot-password/reset` | Reset password with reset token |

### 6.2 Users (`/api/users`)

| Method | Path | Query Params |
|--------|------|-------------|
| GET | `/` | `search, role_id, role_code, dept_id, is_active, page, limit` |
| POST | `/` | — |
| GET | `/lookup` | `search, role_code, dept_code, limit` |
| GET | `/:user_id` | — |
| PATCH | `/:user_id` | — |
| POST | `/:user_id/reset-password` | — |
| DELETE | `/:user_id` | Soft deactivate |

### 6.3 Departments (`/api/departments`)

| Method | Path |
|--------|------|
| GET | `/lookup` |
| GET | `/role-mapping` |
| GET | `/` |
| POST | `/` |
| GET | `/:dept_id` |
| PATCH | `/:dept_id` |
| DELETE | `/:dept_id` |

### 6.4 Labs (`/api/labs`)

| Method | Path | Query |
|--------|------|-------|
| GET | `/lookup` | `?department_id` |
| GET | `/` | `?department_id` |
| POST | `/` | — |
| GET | `/:lab_id` | — |
| PATCH | `/:lab_id` | — |
| DELETE | `/:lab_id` | — |

### 6.5 Roles (`/api/roles`)

| Method | Path |
|--------|------|
| GET | `/` (`?include_inactive`) |
| POST | `/` |
| PATCH | `/:role_id` |
| DELETE | `/:role_id` |

### 6.6 Role Privileges (`/api/role-privileges`)

| Method | Path |
|--------|------|
| GET | `/` — full matrix: `{roles, privileges, grants}` |
| PUT | `/` — bulk save matrix |

### 6.7 Admin Settings (`/api/admin/settings`)

| Method | Path |
|--------|------|
| GET | `/` |
| PATCH | `/` |

### 6.8 Master Data (`/api/master-data`)

| Method | Path |
|--------|------|
| GET | `/items` (`?category, search`) |
| GET/POST | `/chemicals` |
| PATCH/DELETE | `/chemicals/:id` |
| GET/POST | `/instruments` |
| PATCH/DELETE | `/instruments/:id` |
| GET/POST | `/sites` |
| PATCH/DELETE | `/sites/:id` |

### 6.9 ID Sequences (`/api/admin/id-sequences`, `/api/id-sequences`)

| Method | Path |
|--------|------|
| GET/POST | `/admin/id-sequences` |
| PATCH/DELETE | `/admin/id-sequences/:config_id` |
| POST | `/id-sequences/:code/next` |

### 6.10 ADC Projects (`/api/projects`)

| Method | Path |
|--------|------|
| GET | `/hod-dashboard` |
| GET | `/next-code` |
| GET | `/` (`?status, search, skip, limit, assigned_only`) |
| POST | `/` |
| GET/PATCH/DELETE | `/:project_id` |
| GET/POST | `/:project_id/members` |
| DELETE | `/:project_id/members/:user_id` |
| GET | `/:project_id/routes` |
| GET/POST | `/:project_id/attachments` |
| DELETE | `/:project_id/attachments/:attach_id` |
| GET/PUT | `/:project_id/risk-assessment` |
| POST | `/:project_id/risk-assessment/rows` |
| PATCH/DELETE | `/:project_id/risk-assessment/rows/:row_id` |

### 6.11 ADC Notebooks

| Method | Path |
|--------|------|
| GET/POST | `/projects/:project_id/notebooks` |
| GET | `/notebooks` (`?search, status, project_id, assigned_to_me, page, limit`) |
| GET | `/notebooks/tl-dashboard` |
| GET/PATCH | `/notebooks/:notebook_id` |
| GET | `/notebooks/:notebook_id/template-snapshot` |
| GET | `/notebooks/:notebook_id/assigned-users` |
| POST | `/notebooks/:notebook_id/assign-user` |
| DELETE | `/notebooks/:notebook_id/unassign/:user_id` |

### 6.12 ADC Experiments

| Method | Path |
|--------|------|
| GET | `/experiments` |
| GET | `/experiments/my-dashboard` |
| GET | `/notebooks/:notebook_id/experiments` (`?section_key`) |
| POST | `/notebooks/:notebook_id/experiments` |
| GET/PATCH | `/experiments/:exp_id` |
| GET | `/experiments/:exp_id/assigned-users` |
| POST | `/experiments/:exp_id/assign-user` |
| DELETE | `/experiments/:exp_id/unassign/:user_id` |
| POST | `/experiments/:exp_id/submit-to-ad` |
| POST | `/experiments/:exp_id/submit` |
| POST | `/experiments/:exp_id/approve` |
| POST | `/experiments/:exp_id/reject` |
| POST | `/experiments/:exp_id/unlock` |
| POST | `/experiments/:exp_id/void` |
| POST | `/experiments/:exp_id/scientist-sign` |
| GET/POST | `/experiments/:exp_id/files` |
| DELETE | `/experiments/:exp_id/files/:file_id` |
| GET | `/experiments/:exp_id/report.pdf` |
| POST | `/experiments/:exp_id/clone` |
| GET/POST | `/experiments/:exp_id/reviews` |
| POST | `/experiments/:exp_id/reviews/:reviewer_id/sign` |
| GET/POST | `/experiments/:exp_id/atr-requests` |
| POST | `/atr/:atr_no/complete` (AD push-back; `X-ADC-Integration-Key` auth) |

**ADC Experiment status flow:** `DRAFT → SUBMITTED → APPROVED | REJECTED → (UNLOCKED) → DRAFT`

### 6.13 Workflow Templates (`/api/workflow-templates`)

| Method | Path |
|--------|------|
| GET | `/` (`?category, is_active`) |
| GET/PATCH/DELETE | `/:template_id` |
| POST | `/` |
| GET | `/:template_id/versions` |

### 6.14 Calc Templates (`/api/calc-templates`)

Same pattern as workflow templates.

### 6.15 CGT Module (`/api/cgt`)

| Method | Path |
|--------|------|
| GET/POST | `/cgt/projects` |
| GET | `/cgt/projects/next-code` |
| GET/PATCH/DELETE | `/cgt/projects/:id` |
| GET/POST | `/cgt/projects/:id/notebooks` |
| GET/PATCH | `/cgt/notebooks/:id` |
| POST/DELETE | `/cgt/notebooks/:id/assign-user` |
| GET/POST | `/cgt/notebooks/:id/experiments` |
| GET/PATCH | `/cgt/experiments/:id` |
| POST | `/cgt/experiments/:id/submit` |
| POST | `/cgt/experiments/:id/approve` |
| GET | `/cgt/experiments/:id/report.pdf` |
| GET/POST | `/cgt/experiments/:id/assign-user` |

### 6.16 ARD — ATRs (`/api/ard/atrs`)

| Method | Path |
|--------|------|
| GET | `/counts` |
| GET | `/` (`?status, statuses, tab, q, scope, page, pageSize`) |
| GET | `/:atr_id` |
| GET | `/:atr_id/audit-log` |
| POST | `/` |
| PUT | `/:atr_id` |
| POST | `/:atr_id/transition` |
| DELETE | `/:atr_id` |
| POST | `/:atr_id/change-owner` |
| POST | `/:atr_id/mandate-certification` |
| POST | `/:atr_id/assign-tl` |
| POST | `/:atr_id/reassign-qa` |
| POST | `/:atr_id/clarifications` |
| POST | `/:atr_id/request-certification` |
| POST | `/:atr_id/certify` |
| POST | `/:atr_id/certification-rework` |
| POST | `/:atr_id/link-experiment` |
| POST | `/:atr_id/samples/:sample_id/tests` |
| PATCH | `/:atr_id/samples/:sample_id` |
| DELETE | `/:atr_id/samples/:sample_id/tests/:test_id` |
| POST | `/:atr_id/tests/:test_id/assign` |

**ATR Status States:** `DRAFT → SAVED → NEW (or REQUESTED → DEPT_TL_APPROVED → NEW) → QA_PRE_APPROVAL → PARTIAL → IN_PROGRESS → PENDING_APPROVAL → CERTIFICATION_REQUESTED → CERTIFIED | CERTIFICATION_REWORK | WITHDRAWN | REJECTED | CLARIFIED | PENDING_CLARIFICATION | ENHANCEMENT_REQUESTED | CERT_REWORK | APPROVED`

**ATR Number format:** `ATR/{year}/{MMDD}/{seq:03d}` (e.g. `ATR/2025/0812/001`)

### 6.17 ARD — Tests (`/api/ard/tests`)

| Method | Path |
|--------|------|
| GET | `/` (`?status, q, view, page, pageSize`) |
| GET/POST | `/bulk-assign` |
| GET | `/:atr_id/:test_id` |
| GET | `/:atr_id/:test_id/qualified-analysts` |
| POST | `/:atr_id/:test_id/assign` |
| POST | `/:atr_id/:test_id/claim` |
| POST | `/:atr_id/:test_id/delegate` |
| POST | `/:atr_id/:test_id/start` |
| POST | `/:atr_id/:test_id/save-results` |
| POST | `/:atr_id/:test_id/submit` |
| POST | `/:atr_id/:test_id/verify` |
| POST | `/:atr_id/:test_id/rework` |
| POST | `/:atr_id/:test_id/unlock` |
| POST | `/:atr_id/:test_id/withdraw` |
| POST | `/:atr_id/:test_id/cancel` |
| POST | `/:atr_id/:test_id/final-report` |
| POST | `/:atr_id/:test_id/publish` |
| POST | `/:atr_id/:test_id/accept-test` |
| POST | `/:atr_id/:test_id/unsatisfactory` |

**Test status flow:** `UNASSIGNED → PENDING → ASSIGNED → STARTED → SUBMITTED → VERIFIED → ACCEPTED | UNSATISFACTORY | PUBLISHED | CANCELLED | WITHDRAWN | UNLOCKED`

**AR Number format:** `E-{TECH}{MMYY}/{seq:03d}`

### 6.18 ARD — Experiments (`/api/ard/experiments`)

| Method | Path |
|--------|------|
| GET | `/` |
| POST | `/` |
| GET | `/pending-review` |
| GET | `/lookup/by-code/:code` |
| GET/PATCH | `/:experiment_id` |
| POST | `/:experiment_id/transition` |
| POST | `/:experiment_id/clone` |
| POST | `/:experiment_id/clone-blank` |
| POST | `/:experiment_id/restore` |
| GET | `/:experiment_id/check-lock` |
| POST | `/:experiment_id/acquire-lock` |
| DELETE | `/:experiment_id/lock` |
| GET | `/:experiment_id/versions` |
| GET | `/:experiment_id/versions/compare` |
| GET | `/:experiment_id/report.pdf` |
| POST | `/:experiment_id/section-comments` |
| DELETE | `/:experiment_id/section-comments/:comment_id` |
| POST | `/:experiment_id/clarifications` |
| DELETE | `/:experiment_id/clarifications/:clarification_id` |
| GET/POST/DELETE | `/:experiment_id/post-analytical` |
| POST | `/:experiment_id/takeover` |
| POST | `/:experiment_id/reassign-reviewer` |
| PATCH | `/:experiment_id/highlight` |
| POST | `/:experiment_id/stp/update-sample-weights` |
| POST | `/:experiment_id/stp/import-empower` |
| POST | `/:experiment_id/stp/push-results` |

**ARD Experiment status flow:** `IN_PROGRESS → [VERIFICATION_REQUESTED → VERIFIED/VERIFICATION_REWORK] → SUBMITTED → APPROVED/REWORK → UNLOCK_REQUESTED → UNLOCKED → IN_PROGRESS | DEACTIVATED`

**Edit lock:** 30-minute lock, one user at a time. Lock owner, TL, HOD, Admin can release.

**Version snapshots:** Every PATCH creates a SHA-256 snapshot. Up to 50 retained.

**Experiment code format:** `EXP-{year}-{seq:05d}`

### 6.19 ARD — Templates (`/api/ard/templates`)

Standard CRUD + publish workflow: `DRAFT → PENDING_APPROVAL → PUBLISHED | REWORK`

Family-based versioning via `family_id`.

### 6.20 ARD — Other Endpoints

| Prefix | Purpose |
|--------|---------|
| `/api/ard/master-data` | Techniques, test configs, test groups, attributes, form types, data items, content blocks, settings, qualifications |
| `/api/ard/users` | ARD-specific user management (teams, qualifications) |
| `/api/ard/teams` | Team CRUD |
| `/api/ard/projects` | ARD project + specification CRUD |
| `/api/ard/notebooks` | ARD notebook CRUD |
| `/api/ard/uploads` | Polymorphic file attachments |
| `/api/ard/qc-trf` | QC Transfer Request Forms |
| `/api/ard/search` | Cross-module search |
| `/api/ard/audit` | ARD audit log |
| `/api/ard/notifications` | Notification read/unread tracking |
| `/api/ard/reporting` | ATR reports: summary/detailed HTML + PDF, CoA, barcode |
| `/api/ard/dashboard` | Dashboard metrics |

### 6.21 Inventory Module (`/api/inventory/...`)

30+ sub-routers:

| Sub-module | Purpose |
|-----------|---------|
| `consumable-types` | Consumable type master |
| `materials` | Material master (chemical/formulation props) |
| `manufacturers` | Manufacturer + qualification files |
| `manufacturer-mappings` | Material-manufacturer mappings |
| `equipment-types` | Equipment type master |
| `instrument-types` | Instrument type master |
| `column-types` | Column type master |
| `equipment` | Equipment catalogue + calibration |
| `instruments` | Instrument catalogue + calibration |
| `columns` | Column catalogue + injection tracking |
| `batches` | Batch CRUD + pack management |
| `stock-requests` | Two-stage stock approval workflow |
| `checklists` | Maintenance/calibration checklists |
| `measurement-master` | Measurement units master |
| `log-mappings` | Equipment/instrument log mapping |
| `instrument-specs` | Instrument specifications |
| `schedules` | Maintenance/calibration schedules |
| `master-templates` | Checklist master templates |
| `spare-parts` | Spare parts inventory |
| `work-orders` | Maintenance/calibration work orders |
| `gate-passes` | Equipment dispatch/return |
| `usage-logs` | Equipment/instrument/column usage |
| `lookup` | General inventory lookups |
| `uom` | Unit of measure dimensions + units |
| `test-master` | Test types/names/methods |
| `dashboard` | Inventory KPI dashboard |
| `reports` | Inventory reports |
| `storage-conditions` | Storage condition master |
| `storage-locations` | Storage location master |
| `audit-trail` | Inventory audit trail |

### 6.22 SSE (`/api/sse`)

| Method | Path |
|--------|------|
| GET | `/events?token=<jwt>` |

- Auth via query param (EventSource limitation)
- Events: `refresh`, `atrs`, `experiments`
- Keepalive comment every 30 seconds
- Per-client queue, max size 50

---

## 7. Database Tables — Complete Reference

### Admin / Auth Tables

| Table | Key Columns |
|-------|-------------|
| `roles` | `id UUID PK`, `code VARCHAR(20) UNIQUE`, `name`, `is_active` |
| `departments` | `id UUID PK`, `code VARCHAR(20) UNIQUE`, `name`, `is_active`, `created_by FK users` |
| `labs` | `id UUID PK`, `code VARCHAR(20) UNIQUE`, `name`, `department_id FK`, `is_active` |
| `users` | `id UUID PK`, `username UNIQUE`, `emp_no UNIQUE`, `email UNIQUE`, `password_hash`, `role_id FK`, `department_id FK`, `lab_id FK`, `failed_login_count`, `locked_until`, `token_version`, `must_reset_password`, `is_active` |
| `department_role_mapping` | `id UUID PK`, `department_id FK CASCADE`, `role_id FK CASCADE`; UNIQUE(dept, role) |
| `role_privileges` | `id UUID PK`, `role_id FK`, `department_id FK nullable`, `privilege_key VARCHAR(50)`, `is_granted BOOL`, `updated_by FK` |
| `user_security_questions` | `id UUID PK`, `user_id FK CASCADE`, `question_index INT`, `answer_hash`; UNIQUE(user_id, question_index) |
| `global_settings` | Single row (`id INT DEFAULT 1`), all app settings |

### Master Data Tables

| Table | Key Columns |
|-------|-------------|
| `master_data_items` | `id UUID PK`, `category VARCHAR(50)`, `code VARCHAR(50)`, `name`; UNIQUE(category, code) |
| `lookup_chemicals` | `id UUID PK`, `chemical_name`, `cas_no`, `formula`, `mol_wt NUMERIC(10,4)`, `purity_pct NUMERIC(5,2)`, `is_active` |
| `lookup_instruments` | `id UUID PK`, `instrument_code UNIQUE`, `instrument_type`, `instrument_name`, `calibration_status`, `is_active` |
| `sites` | `id UUID PK`, `code UNIQUE`, `name`, `is_active` |

### ID Sequence Tables

| Table | Key Columns |
|-------|-------------|
| `id_sequence_configs` | `id UUID PK`, `code UNIQUE`, `prefix`, `separator`, `include_year`, `year_digits`, `sequence_digits`, `reset_yearly` |
| `id_sequence_counters` | `id UUID PK`, `config_id FK CASCADE`, `year SMALLINT nullable`, `period VARCHAR(10) nullable`, `last_value INT`; UNIQUE(config_id, year, period) |

### ADC Project Tables

| Table | Key Columns |
|-------|-------------|
| `projects` | `id UUID PK`, `code UNIQUE`, `name`, `product_name`, `project_type`, `department_id FK`, `status`, many optional fields |
| `project_users` | `project_id + user_id PK`, `role`, `added_by FK` |
| `routes` | `id UUID PK`, `project_id FK`, `code`, `name`, `sort_order`, `status` |
| `stages` | `id UUID PK`, `route_id FK`, `project_id FK`, `code`, `name`, `sort_order`, `status` |
| `milestones` | `id UUID PK`, `project_id FK`, `name`, `due_date`, `status`, `pct SMALLINT` |
| `project_attachments` | `id UUID PK`, `project_id FK`, `filename`, `file_path`, `file_size`, `uploaded_by FK` |
| `project_risk_assessments` | `id UUID PK`, `project_id FK UNIQUE`, assessment fields |
| `project_risk_rows` | `id UUID PK`, `assessment_id FK`, risk matrix fields |

### ADC Notebook / Experiment Tables

| Table | Key Columns |
|-------|-------------|
| `notebooks` | `id UUID PK`, `code UNIQUE`, `title`, `project_id FK`, `type`, `template_id FK nullable`, `template_snapshot JSON`, `status` |
| `notebook_permissions` | `id UUID PK`, `notebook_id FK`, `user_id FK`; all 11 permission booleans; UNIQUE(notebook, user) |
| `experiments` | `id UUID PK`, `notebook_id FK`, `base_code`, `version SMALLINT`, `full_code UNIQUE`, `title`, `screen_key`, `data JSON`, `status`, `is_latest_version BOOL`, many workflow tracking fields |
| `experiment_assignments` | `id UUID PK`, `experiment_id FK CASCADE`, `user_id FK`; UNIQUE(experiment, user) |
| `experiment_files` | `id UUID PK`, `experiment_id FK`, `section_key`, `filename`, `file_path`, `uploaded_by FK` |
| `experiment_atr_requests` | `id UUID PK`, `experiment_id FK CASCADE`, `atr_no UNIQUE`, `section_id`, `data_snapshot JSON`, `status` |
| `experiment_reviews` | `id UUID PK`, `experiment_id FK CASCADE`, `reviewer_id FK`; UNIQUE(experiment, reviewer) |
| `experiment_history` | `id UUID PK`, `experiment_id FK CASCADE`, `actor_id FK`, `action`, `details JSON` |

### CGT Tables

| Table | Description |
|-------|-------------|
| `cgt_projects` | CGT project master |
| `cgt_notebooks` | CGT notebook |
| `cgt_notebook_permissions` | CGT notebook permissions |
| `cgt_experiments` | CGT experiment |
| `cgt_experiment_assignments` | CGT experiment user assignments |

### ARD Tables

| Table | Description |
|-------|-------------|
| `ard_techniques` | Test technique master |
| `ard_test_configurations` | Test configuration master |
| `ard_test_groups` | Test group master |
| `ard_test_group_members` | Group-test membership |
| `ard_attributes` | Attribute master |
| `ard_form_types` | ATR form type master |
| `ard_data_items` | Data item master |
| `ard_settings` | Feature flags (key-value) |
| `ard_analyst_qualifications` | Analyst technique certifications |
| `ard_qualification_alerts` | Expiry alerts |
| `ard_content_blocks` | Reusable template content blocks |
| `ard_teams` | Team definitions with TL-analyst mapping |
| `ard_atr_forms` | ATR form (60+ columns) |
| `ard_atr_samples` | ATR samples |
| `ard_test_requests` | Individual test requests on ATR |
| `ard_experiments` | ARD experiment (edit lock, version snapshots) |
| `ard_templates` | ARD experiment template (family versioning) |
| `ard_notebooks` | ARD notebook |
| `ard_projects` | ARD project |
| `ard_project_specifications` | Specification versions per ARD project |
| `ard_qc_trf_forms` | QC Transfer Request Forms |
| `ard_notification_read` | Notification read status |
| `ard_audit_log` | ARD audit trail |
| `ard_attachments` | Polymorphic file attachments |

### Inventory Tables (all prefixed `inv_`)

| Table | Description |
|-------|-------------|
| `inv_materials` | Material master |
| `inv_batches` | Batch inventory |
| `inv_batch_events` | Quantity ledger events |
| `inv_batch_packs` | Sub-batch packs |
| `inv_stock_requests` | Stock request workflow |
| `inv_equipment_catalogue` | Equipment master |
| `inv_instrument_catalogue` | Instrument master |
| `inv_column_catalogue` | Column master |
| `inv_checklists` | Maintenance checklists |
| `inv_work_orders` | Work orders |
| `inv_schedules` | Maintenance/calibration schedules |
| `inv_gate_passes` | Equipment gate passes |
| `inv_usage_logs` | Usage tracking |
| `inv_audit_trail` | Inventory audit |
| `inv_uom_dimensions` | UOM dimensions |
| `inv_uom_units` | UOM unit conversions |
| `inv_general_lookup` | General lookup values |
| `inv_storage_conditions` | Storage conditions |
| `inv_storage_locations` | Storage locations |
| `inv_manufacturers` | Manufacturer master |
| `inv_manufacturer_mapping` | Material-manufacturer mapping |

---

## 8. Key Business Rules

### Sequential ID Generation
All auto-increment codes use `SELECT FOR UPDATE` on counter rows:
- **Project codes:** `{prefix}/{year}/{seq}` via `project_code_counter`
- **ATR numbers:** `ATR/{year}/{MMDD}/{seq:03d}` via `id_sequence_counters`
- **ARD experiment codes:** `EXP-{year}-{seq:05d}` (scan-based)
- **AR test numbers:** `E-{TECH}{MMYY}/{seq:03d}` (scan-based)

### Inventory Quantity Ledger
Every consumption writes `inv_batch_events` with `event_type`, `performed_by`, `ref_no`, `module`, `purpose`, `project_code`. Deductions on:
- ATR submission (chemical lots in samples)
- ADC experiment `submit-to-ad` (sample quantities)
- Stock request fulfillment

### Template Snapshot Freezing
When a notebook is created from a workflow template, `template_snapshot` freezes the definition at that moment. Later template edits do not affect existing notebooks/experiments.

### Electronic Signatures
Configured per operation via `ard_settings` boolean flags. When enabled, the API requires `body.password` verified against `user.password_hash` via bcrypt. Operations: ATR workflow transitions, test assignment, experiment submit/approve, QA certification.

### Analyst Qualification Gating
If a technique has qualification records, only analysts in `ard_analyst_qualifications` for that technique can be assigned tests.

### Calibration/Maintenance Interlock
At experiment SUBMITTED/APPROVED/VERIFIED, all equipment/instrument/column rows validated:
- Status `OUT_OF_SERVICE`, `INACTIVE`, or `DECOMMISSIONED` → 400 blocked
- `next_calibration_date` in past → 400 blocked

### Cross-Sub-Team Assignment (B-40)
TLs can only assign tests to analysts in their own sub-team (`ard_teams.tl_analyst_map`). HOD/Admin bypass this.

### Co-Submission (B-77)
When ARD experiment transitions to `SUBMITTED`, linked ATR IDs (draft) are also transitioned to `REQUESTED`.

### Account Lock
On reaching `lock_user_after_x_attempts` failed logins: `locked_until = now + 30 minutes`. Successful login resets count.

### Token Invalidation
`user.token_version` incremented on logout. Tokens with mismatched `ver` are rejected.

---

## 9. File Upload/Download

- **Storage:** Local filesystem under `UPLOAD_DIR` (`uploads/`)
- **Filename:** Stored as `uuid4().hex + extension`
- **Allowed extensions:** `.pdf, .doc, .docx, .xlsx, .xls, .png, .jpg, .jpeg, .gif, .webp`
- **Max size:** 50 MB (per file)
- **Download:** Served as file stream with original filename

---

## 10. Middleware

- **CORS:** Configured with `allow_origins`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`
- No rate limiting
- No request body size middleware (enforced per-endpoint)

---

## 11. Startup Events

1. Capture asyncio event loop for SSE thread-safe broadcasting
2. Run idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` startup migrations for schema drift fixes

---

## 12. Outbound Integrations

- **AD Integration:** `httpx` calls to `AD_API_BASE_URL`
- **Inbound push-back:** `POST /atr/:atr_no/complete` authenticated via `X-ADC-Integration-Key` header

---

## 13. Migration Risks & Areas Requiring Special Attention

| Area | Risk | Mitigation |
|------|------|------------|
| Sequential ID generation | Race conditions on concurrent requests | Use `SELECT FOR UPDATE` in Sequelize transactions |
| JSON column deep-merge (experiments) | Must merge per section_key, not replace entire JSON | Implement deep-merge logic in service layer |
| SSE (real-time events) | Node.js requires different broadcast mechanism | Use EventEmitter + `res.write()` with `text/event-stream` |
| PDF generation | RDKit (Python/C++) unavailable in Node.js | Use `puppeteer` for HTML→PDF or `pdfmake`; mol rendering needs separate service or skip |
| Barcode/QR generation | Python-specific libs | Use `bwip-js` (barcode) + `qrcode` (npm) |
| File upload limits | Enforced per-endpoint in FastAPI | Use `multer` in Express with per-route size limits |
| Startup schema migrations | Python `ALTER TABLE IF NOT EXISTS` on startup | Move to proper Sequelize migrations |
| Inventory UOM conversions | Custom unit conversion logic | Re-implement in TypeScript |
| Bcrypt hashes | Python bcrypt hashes are compatible with Node.js bcrypt | Use `bcrypt` npm package (same format) |
| `flag_modified()` SQLAlchemy quirk | JSON mutation tracking | Not needed in Sequelize — reassign entire object |
| Multi-instance SSE | In-process EventEmitter not shared across instances | Use Redis pub/sub if horizontal scaling needed |
