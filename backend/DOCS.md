# Chemia ELN — Backend API Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Setup & Running](#4-setup--running)
5. [Authentication](#5-authentication)
6. [Roles & Permissions](#6-roles--permissions)
7. [API Modules](#7-api-modules)
   - [Auth](#71-auth)
   - [Users](#72-users)
   - [Roles](#73-roles)
   - [Departments](#74-departments)
   - [Projects](#75-projects)
   - [Routes & Stages](#76-routes--stages)
   - [Notebooks](#77-notebooks)
   - [Experiments](#78-experiments)
   - [ATR (Analytical Testing Requests)](#79-atr)
   - [Search](#710-search)
   - [Dashboard](#711-dashboard)
   - [Admin](#712-admin)
   - [Master Data](#713-master-data)
   - [Excel Templates](#714-excel-templates)
   - [Unlock Requests](#715-unlock-requests)
   - [Notification Settings](#716-notification-settings)
   - [Role Privileges](#717-role-privileges)
   - [Inventory — Manufacturers](#718-inventory--manufacturers)
   - [Inventory — Materials](#719-inventory--materials)
   - [Inventory — Batches](#720-inventory--batches)
   - [Inventory — Batch Verifications](#721-inventory--batch-verifications)
   - [Inventory — Stock Requests](#722-inventory--stock-requests)
   - [Inventory — Manufacturer Mappings](#723-inventory--manufacturer-mappings)
   - [Inventory — Equipment / Instrument / Column Types](#724-inventory--equipment--instrument--column-types)
   - [Inventory — Equipment / Instrument / Column Catalogue](#725-inventory--equipment--instrument--column-catalogue)
   - [Inventory — Maintenance Schedules](#726-inventory--maintenance-schedules)
   - [Inventory — Calibration Schedules](#727-inventory--calibration-schedules)
   - [Inventory — Equipment Verifications](#728-inventory--equipment-verifications)
   - [Inventory — Instrument Verifications](#729-inventory--instrument-verifications)
   - [Inventory — Dashboard](#730-inventory--dashboard)
   - [Inventory — Audit Trail](#731-inventory--audit-trail)
   - [Inventory — Reports](#732-inventory--reports)
8. [Experiment Lifecycle](#8-experiment-lifecycle)
9. [Version Control & Diff](#9-version-control--diff)
10. [Rich-Text Storage](#10-rich-text-storage)
11. [Database Notes](#11-database-notes)
12. [Testing](#12-testing)

---

## 1. Overview

Chemia ELN is an Electronic Lab Notebook system for pharmaceutical R&D. It manages the full lifecycle of chemical experiments — from project creation through experiment authoring, multi-level review (Chemist → Team Lead → HOD → QA), and analytical testing. The inventory module tracks reagents, solvents, equipment, and instruments with full audit trails.

**Base URL:** `http://127.0.0.1:8001`  
**Interactive docs:** `http://127.0.0.1:8001/docs` (Swagger UI)  
**OpenAPI spec:** `http://127.0.0.1:8001/openapi.json`

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0 (mapped_column / Mapped) |
| Validation | Pydantic v2 |
| Database | PostgreSQL (psycopg2) |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| Rate limiting | slowapi (5 logins/minute) |
| Rich-text diff | difflib + BeautifulSoup4 |
| Server | Uvicorn |

---

## 3. Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py          # Settings from .env
│   │   └── security.py        # JWT + bcrypt helpers
│   ├── db/
│   │   └── session.py         # SQLAlchemy engine & SessionLocal
│   ├── models/                # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── notebook.py
│   │   ├── experiment.py      # Experiment + sub-models (Input, Parameter, Step, Equipment, TLC, History)
│   │   ├── atr.py
│   │   ├── inventory/         # All inventory models
│   │   └── ...
│   ├── modules/               # Route handlers (one folder per domain)
│   │   ├── auth/
│   │   ├── users/
│   │   ├── departments/
│   │   ├── projects/
│   │   ├── notebooks/
│   │   ├── experiments/
│   │   ├── atr/
│   │   ├── search/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── inventory/         # Flat files: batches.py, materials.py, etc.
│   ├── schemas/               # Pydantic request/response models
│   ├── services/              # Business logic (esignature, experiment_service)
│   ├── utils/
│   │   ├── audit.py           # log_action() — writes to audit_log table
│   │   ├── deps.py            # get_current_user, require_roles
│   │   ├── richtext.py        # HTML diff, strip_html, sanitise_html
│   │   └── sequences.py       # Auto-incrementing code generators
│   └── main.py                # App factory, router registration, CORS
├── alembic/                   # Migration scripts
├── .env                       # Environment variables
├── test_endpoints.py          # Smoke test (26 endpoints)
└── test_crud.py               # Full CRUD test (152 endpoints)
```

---

## 4. Setup & Running

### Environment variables (`.env`)

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/chemia_eln
SECRET_KEY=<your-random-32-char-secret-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Run migrations

```bash
cd backend
alembic upgrade head
```

### Start the server

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### Seed default users

Run `seed.py` (or the inline seed script) to create the four default accounts:

| Username | Role | Password |
|---|---|---|
| `sys.admin` | QA (System Admin) | `&lt;password&gt;` |
| `tl.user` | TL (Team Lead) | `&lt;password&gt;` |
| `hod.user` | HOD (Head of Department) | `&lt;password&gt;` |
| `chem.user` | CHEM (Chemist) | `&lt;password&gt;` |

---

## 5. Authentication

All endpoints (except `/api/health`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`) require a Bearer token.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "sys.admin",
  "password": "&lt;password&gt;"
}
```

**Response:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<uuid>",
  "token_type": "bearer"
}
```

**Rate limit:** 5 login attempts per minute per IP. Returns `429` when exceeded.

### Using the token

```http
Authorization: Bearer <access_token>
```

### Refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refresh_token": "<uuid>" }
```

### Logout

```http
POST /api/auth/logout
Content-Type: application/json

{ "refresh_token": "<uuid>" }
```

### Password management

```http
POST /api/auth/change-password
{ "current_password": "...", "new_password": "..." }

POST /api/auth/forgot-password
{ "email": "user@example.com" }

POST /api/auth/reset-password
{ "token": "<reset-token>", "new_password": "..." }
```

---

## 6. Roles & Permissions

Four roles in the system:

| Code | Name | Description |
|---|---|---|
| `QA` | Quality Assurance / System Admin | Full access to all modules, admin settings, user management |
| `TL` | Team Lead | Can verify experiments, manage notebooks and projects |
| `HOD` | Head of Department | Can approve experiments |
| `CHEM` | Chemist | Can create and submit experiments, raise stock requests |

### Notebook-level permissions

For experiments, access is controlled at the notebook level via `NotebookPermission`:

| Flag | Meaning |
|---|---|
| `can_view` | Can read the notebook and its experiments |
| `can_edit` | Can create/update experiments in this notebook |
| `can_comment` | Can post comments on experiments |
| `can_submit` | Can submit experiments for review |

QA and TL always have full notebook access regardless of explicit grants.

### E-Signature (re-authentication)

Certain workflow actions (submit, verify, approve) may require the user to re-enter their password as an electronic signature. This is controlled by CRD settings (`reauth_submit`, `reauth_verify`). When enabled, the request body must include a `password` field.

---

## 7. API Modules

### 7.1 Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Obtain access + refresh tokens |
| `POST` | `/api/auth/refresh` | Exchange refresh token for new access token |
| `POST` | `/api/auth/logout` | Invalidate refresh token |
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/auth/change-password` | Change own password |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `POST` | `/api/auth/reset-password` | Complete password reset |

---

### 7.2 Users

**Required role:** QA for create/update/activate/deactivate. Any authenticated user can read.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List users (paginated: `page`, `page_size`) |
| `POST` | `/api/users/` | Create user |
| `GET` | `/api/users/{id}` | Get user by ID |
| `PATCH` | `/api/users/{id}` | Update user |
| `POST` | `/api/users/{id}/activate` | Activate user account |
| `POST` | `/api/users/{id}/deactivate` | Deactivate user account |

**Create user payload:**
```json
{
  "username": "jane.doe",
  "emp_no": "EMP042",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@chemia.local",
  "password": "&lt;password&gt;",
  "role": "CHEM",
  "department_id": "<uuid>",
  "designation": "Senior Chemist"
}
```

Note: use `role` (role code string like `"CHEM"`) not `role_id`.

---

### 7.3 Roles

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/roles/` | List all roles |

Returns the four built-in roles: `QA`, `TL`, `HOD`, `CHEM`.

---

### 7.4 Departments

**Required role:** QA for create/update.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/departments/` | List departments (paginated) |
| `POST` | `/api/departments/` | Create department |
| `GET` | `/api/departments/{id}` | Get department |
| `PATCH` | `/api/departments/{id}` | Update department |

**Create payload:**
```json
{ "code": "RD001", "name": "R&D Chemistry", "is_active": true }
```

---

### 7.5 Projects

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects/` | List projects (paginated) |
| `POST` | `/api/projects/` | Create project |
| `GET` | `/api/projects/{id}` | Get project |
| `PATCH` | `/api/projects/{id}` | Update project |
| `GET` | `/api/projects/{id}/members` | List project members |
| `POST` | `/api/projects/{id}/members` | Add members |
| `DELETE` | `/api/projects/{id}/members/{user_id}` | Remove member |
| `GET` | `/api/projects/{id}/milestones` | List milestones |
| `POST` | `/api/projects/{id}/milestones` | Create milestone |
| `PATCH` | `/api/projects/{id}/milestones/{ms_id}` | Update milestone |
| `DELETE` | `/api/projects/{id}/milestones/{ms_id}` | Delete milestone |

**Create project payload:**
```json
{
  "code": "PRJ001",
  "name": "Ibuprofen Formulation",
  "product_name": "Ibuprofen 400mg",
  "project_type": "DEVELOPMENT",
  "market": "US",
  "department_id": "<uuid>",
  "manager_id": "<uuid>",
  "start_date": "2025-01-01",
  "target_date": "2025-12-31"
}
```

**Add members payload:** `{ "user_ids": ["<uuid>", "<uuid>"] }`

**Project statuses:** `ACTIVE`, `ON HOLD`, `COMPLETED`, `CANCELLED`

---

### 7.6 Routes & Stages

Projects can have synthesis routes, each with ordered stages.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/routes/{project_id}/routes` | List routes |
| `POST` | `/api/routes/{project_id}/routes` | Create route |
| `GET` | `/api/routes/{project_id}/routes/{route_id}` | Get route |
| `PATCH` | `/api/routes/{project_id}/routes/{route_id}` | Update route |
| `POST` | `/api/routes/{project_id}/routes/{route_id}/stages` | Add stage |
| `PATCH` | `/api/routes/{project_id}/routes/{route_id}/stages/{stage_id}` | Update stage |
| `DELETE` | `/api/routes/{project_id}/routes/{route_id}/stages/{stage_id}` | Delete stage |

---

### 7.7 Notebooks

Notebooks belong to a project and optionally to a route/stage. They are the containers for experiments.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notebooks/` | List notebooks |
| `POST` | `/api/notebooks/` | Create notebook |
| `GET` | `/api/notebooks/{id}` | Get notebook |
| `PATCH` | `/api/notebooks/{id}` | Update notebook |
| `GET` | `/api/notebooks/{id}/permissions` | List notebook permissions |
| `POST` | `/api/notebooks/{id}/permissions` | Grant permission to a user |
| `PATCH` | `/api/notebooks/{id}/permissions/{user_id}` | Update permission flags |
| `DELETE` | `/api/notebooks/{id}/permissions/{user_id}` | Revoke permission |

**Create notebook payload:**
```json
{
  "title": "Synthesis Route A — Stage 1",
  "project_id": "<uuid>",
  "description": "Initial synthesis experiments"
}
```

**Permission grant payload:**
```json
{
  "user_id": "<uuid>",
  "can_view": true,
  "can_edit": true,
  "can_comment": true,
  "can_submit": true
}
```

**Notebook codes** are auto-generated from the project/route/stage chain:  
`PRJ001-NB001`, `PRJ001-R1-S2-NB003`, etc.

---

### 7.8 Experiments

Experiments are the core record. They support multi-level review, versioning, rich-text content, and sub-resources (inputs, parameters, steps, equipment, TLC records, attachments, comments).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/experiments/` | List experiments (filterable) |
| `POST` | `/api/experiments/` | Create experiment |
| `GET` | `/api/experiments/{id}` | Get full experiment |
| `PATCH` | `/api/experiments/{id}` | Update experiment |
| `GET` | `/api/experiments/{id}/versions` | List all versions |
| `GET` | `/api/experiments/{id}/history` | Status change history |
| `GET` | `/api/experiments/{id}/diff/{other_id}` | Rich-text diff between versions |
| `GET` | `/api/experiments/{id}/export-pdf` | Export as PDF |

**Workflow actions:**

| Method | Path | Who | Description |
|---|---|---|---|
| `POST` | `/{id}/submit` | CHEM | Submit for verification |
| `POST` | `/{id}/verify` | TL | Verify (approve to HOD) |
| `POST` | `/{id}/approve` | HOD | Final approval |
| `POST` | `/{id}/reject` | TL / HOD | Reject with reason |
| `POST` | `/{id}/revise` | CHEM | Revise after rejection |
| `POST` | `/{id}/void` | QA | Void an experiment |
| `POST` | `/{id}/unlock` | QA | Unlock an approved experiment |
| `POST` | `/{id}/new-version` | CHEM | Create new version from approved |

**Sub-resources:**

| Resource | Endpoints |
|---|---|
| Inputs (reactants/reagents) | `GET/POST /{id}/inputs`, `PATCH/DELETE /{id}/inputs/{input_id}` |
| Parameters | `GET/POST /{id}/parameters`, `PATCH/DELETE /{id}/parameters/{param_id}` |
| Steps | `GET/POST /{id}/steps`, `PATCH/DELETE /{id}/steps/{step_id}` |
| Equipment used | `GET/POST /{id}/equipment`, `PATCH/DELETE /{id}/equipment/{eq_id}` |
| TLC records | `GET/POST /{id}/tlc` |
| Comments | `GET/POST /{id}/comments` |
| Attachments | `GET/POST /{id}/attachments`, `GET/DELETE /{id}/attachments/{att_id}` |

**Create experiment payload:**
```json
{
  "notebook_id": "<uuid>",
  "title": "Synthesis of Compound A — Attempt 1",
  "aim": "<p>Synthesise compound A via route B.</p>",
  "objective": "<p>Achieve >85% yield.</p>",
  "procedure": "<p>Step 1: ...</p>",
  "starting_material": "Reagent X",
  "target_product": "Compound A"
}
```

Rich-text fields (`aim`, `objective`, `procedure`, `observations`, `conclusion`) accept HTML from react-quill.

**List query params:** `notebook_id`, `project_id`, `status`, `latest_only` (default `true`), `search`, `date_from`, `date_to`, `page`, `page_size`

---

### 7.9 ATR

Analytical Testing Requests link to projects and track analytical workflows.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/atr/` | List ATRs |
| `POST` | `/api/atr/` | Create ATR |
| `GET` | `/api/atr/{id}` | Get ATR |
| `PATCH` | `/api/atr/{id}` | Update ATR |
| `POST` | `/api/atr/{id}/submit` | Submit ATR |
| `POST` | `/api/atr/{id}/assign` | Assign to analyst |
| `POST` | `/api/atr/{id}/complete` | Mark as complete |
| `POST` | `/api/atr/{id}/cancel` | Cancel ATR |
| `GET/POST` | `/api/atr/{id}/attachments` | Manage attachments |
| `GET/DELETE` | `/api/atr/{id}/attachments/{att_id}` | Single attachment |

**Create ATR payload:**
```json
{
  "project_id": "<uuid>",
  "test_type": "STABILITY",
  "objectives": "Determine shelf life under accelerated conditions"
}
```

**ATR codes** are auto-generated: `ATR00001`, `ATR00002`, etc.

---

### 7.10 Search

Full-text search across major entities.

| Method | Path | Query params |
|---|---|---|
| `GET` | `/api/search/experiments` | `q`, `status`, `project_id`, `date_from`, `date_to` |
| `GET` | `/api/search/experiments/by-parameters` | `param_name`, `param_value` |
| `GET` | `/api/search/notebooks` | `q`, `project_id` |
| `GET` | `/api/search/projects` | `q`, `status` |
| `GET` | `/api/search/atrs` | `q`, `status` |

All search endpoints return paginated results and respect role-based visibility (Chemists only see experiments in notebooks they have access to).

---

### 7.11 Dashboard

Summary data for the logged-in user's home screen.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/counts` | Entity counts by status |
| `GET` | `/api/dashboard/my-activity` | Recent actions by current user |
| `GET` | `/api/dashboard/verification-queue` | Experiments awaiting TL verification |
| `GET` | `/api/dashboard/approval-queue` | Experiments awaiting HOD approval |
| `GET` | `/api/dashboard/rework-inbox` | Experiments returned for rework |
| `GET` | `/api/dashboard/sla-alerts` | Experiments past their SLA deadline |

---

### 7.12 Admin

**Required role:** QA for all admin endpoints.

| Method | Path | Description |
|---|---|---|
| `GET/PATCH` | `/api/admin/settings/company` | Company name, address, logo |
| `GET/PATCH` | `/api/admin/settings/crd` | CRD (re-auth) flags |
| `GET` | `/api/admin/sequences` | List all sequence counters |
| `GET` | `/api/admin/sequences/{scope_key}` | Single sequence counter |
| `GET` | `/api/admin/audit` | System-wide audit log |

**CRD settings** control which workflow actions require e-signature re-authentication:
```json
{
  "reauth_submit": false,
  "reauth_verify": false
}
```

---

### 7.13 Master Data

Reference data for chemicals and instruments.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/master-data/chemicals` | Chemical reference library |
| `GET/PATCH/DELETE` | `/api/master-data/chemicals/{id}` | Single chemical |
| `GET/POST` | `/api/master-data/instruments` | Instrument reference library |
| `GET/PATCH/DELETE` | `/api/master-data/instruments/{id}` | Single instrument |
| `GET/POST` | `/api/master-data/sites` | Site/location definitions |
| `PATCH/DELETE` | `/api/master-data/sites/{id}` | Single site |

---

### 7.14 Excel Templates

Upload and manage Excel report templates.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/excel-templates/` | List / upload template |
| `GET/PATCH/DELETE` | `/api/excel-templates/{id}` | Manage single template |
| `GET` | `/api/excel-templates/{id}/download` | Download template file |
| `POST` | `/api/excel-templates/{id}/activate` | Activate template |
| `POST` | `/api/excel-templates/{id}/deactivate` | Deactivate template |

---

### 7.15 Unlock Requests

When a Chemist needs to edit an already-approved experiment, they raise an unlock request that QA must approve.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/unlock-requests/` | List / create unlock request |
| `GET` | `/api/unlock-requests/{id}` | Get request |
| `POST` | `/api/unlock-requests/{id}/approve` | QA approves — experiment status → UNLOCKED |
| `POST` | `/api/unlock-requests/{id}/reject` | QA rejects |

---

### 7.16 Notification Settings

Per-user notification preferences.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/notification-settings/` | List / create setting |
| `GET/PATCH/DELETE` | `/api/notification-settings/{id}` | Manage single setting |
| `POST` | `/api/notification-settings/{id}/toggle` | Enable / disable |

---

### 7.17 Role Privileges

Fine-grained privilege definitions per role.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/role-privileges/` | List / create privilege |
| `GET/PATCH/DELETE` | `/api/role-privileges/{id}` | Manage single privilege |

---

### 7.18 Inventory — Manufacturers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/manufacturers` | List manufacturers |
| `POST` | `/api/inventory/manufacturers` | Create manufacturer |
| `GET` | `/api/inventory/manufacturers/{id}` | Get manufacturer |
| `PATCH` | `/api/inventory/manufacturers/{id}` | Update manufacturer |
| `PATCH` | `/api/inventory/manufacturers/{id}/toggle` | Toggle active/inactive |

**Create payload:**
```json
{ "code": "SIGMA", "name": "Sigma-Aldrich", "country": "US", "is_active": true }
```

---

### 7.19 Inventory — Materials

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/materials` | List materials |
| `POST` | `/api/inventory/materials` | Create material |
| `GET` | `/api/inventory/materials/{id}` | Get material |
| `PATCH` | `/api/inventory/materials/{id}` | Update material |
| `PATCH` | `/api/inventory/materials/{id}/toggle` | Toggle active/inactive |
| `PUT` | `/api/inventory/materials/{id}/chemical-props` | Set chemical properties |
| `PUT` | `/api/inventory/materials/{id}/formulation-props` | Set formulation properties |

**Create payload:**
```json
{
  "code": "ACN-001",
  "name": "Acetonitrile",
  "material_type": "SOLVENT",
  "cas_no": "75-05-8",
  "storage_condition": "Room Temperature",
  "is_active": true
}
```

**Material types:** `SOLVENT`, `REAGENT`, `REFERENCE_STANDARD`, `API`, `EXCIPIENT`, `OTHER`

---

### 7.20 Inventory — Batches

Batches represent physical stock receipts of a material.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/batches` | List batches |
| `POST` | `/api/inventory/batches` | Receive new batch |
| `GET` | `/api/inventory/batches/{id}` | Get batch |
| `PATCH` | `/api/inventory/batches/{id}` | Update batch details |
| `PATCH` | `/api/inventory/batches/{id}/toggle` | Toggle active/inactive |
| `POST` | `/api/inventory/batches/{id}/issue` | Issue quantity to a user |
| `POST` | `/api/inventory/batches/{id}/allocate` | Allocate quantity to a project |
| `GET` | `/api/inventory/batches/{id}/events` | Batch transaction history |

**Create batch payload:**
```json
{
  "material_id": "<uuid>",
  "batch_no": "BATCH-ACN-2025-001",
  "manufacturer_id": "<uuid>",
  "qty_received": 20.0,
  "unit": "L",
  "mfg_date": "2024-01-01",
  "expiry_date": "2027-01-01",
  "location": "Shelf A-1"
}
```

**Issue payload:** `{ "qty": 2.0, "purpose": "HPLC analysis", "issued_to": "<user_uuid>" }`

**Allocate payload:** `{ "qty": 1.0, "project_code": "PRJ001", "purpose": "Synthesis run 3" }`

---

### 7.21 Inventory — Batch Verifications

QC verification records for batches before use.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/batch-verifications` | List verifications |
| `POST` | `/api/inventory/batch-verifications` | Create verification request |
| `GET` | `/api/inventory/batch-verifications/{id}` | Get verification |
| `PATCH` | `/api/inventory/batch-verifications/{id}/verify` | Mark as verified (PASS) |
| `PATCH` | `/api/inventory/batch-verifications/{id}/reject` | Reject batch |

**Create payload:** `{ "request_no": "BV-2025-001", "batch_id": "<uuid>", "remarks": "Pre-use check" }`

---

### 7.22 Inventory — Stock Requests

Chemists raise stock requests when they need materials.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/stock-requests` | List requests |
| `POST` | `/api/inventory/stock-requests` | Raise request |
| `GET` | `/api/inventory/stock-requests/{id}` | Get request |
| `PATCH` | `/api/inventory/stock-requests/{id}` | Update request |
| `PATCH` | `/api/inventory/stock-requests/{id}/approve` | Approve |
| `PATCH` | `/api/inventory/stock-requests/{id}/reject` | Reject |
| `PATCH` | `/api/inventory/stock-requests/{id}/fulfill` | Mark fulfilled |
| `PATCH` | `/api/inventory/stock-requests/{id}/cancel` | Cancel |
| `GET` | `/api/inventory/stock-requests/{id}/events` | Status history |

**Create payload:**
```json
{
  "request_no": "SR-2025-001",
  "material_id": "<uuid>",
  "qty_required": 5.0,
  "unit": "L",
  "purpose": "Synthesis experiment batch 3"
}
```

---

### 7.23 Inventory — Manufacturer Mappings

Maps materials to their approved manufacturers (supplier catalogue entries).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/mappings` | List mappings |
| `POST` | `/api/inventory/mappings` | Create mapping |
| `PATCH` | `/api/inventory/mappings/{id}` | Update mapping |
| `DELETE` | `/api/inventory/mappings/{id}` | Delete mapping |

**Create payload:**
```json
{
  "material_id": "<uuid>",
  "manufacturer_id": "<uuid>",
  "catalogue_no": "271004",
  "technical_grade": "HPLC",
  "lead_time_days": 7,
  "min_order_qty": 1.0
}
```

---

### 7.24 Inventory — Equipment / Instrument / Column Types

Master type definitions. All three follow the same pattern.

| Endpoint prefix | Resource |
|---|---|
| `/api/inventory/equipment-types` | Equipment type master |
| `/api/inventory/instrument-types` | Instrument type master |
| `/api/inventory/column-types` | Chromatography column type master |

Each supports: `GET` (list), `POST` (create), `GET /{id}`, `PATCH /{id}`, `PATCH /{id}/toggle`.

**Create equipment-type payload:** `{ "code": "ROTAVAP", "name": "Rotary Evaporator", "description": "..." }`

**Create column-type payload:**
```json
{
  "code": "C18-150",
  "name": "C18 150mm",
  "description": "Reverse phase C18",
  "length_mm": 150,
  "particle_size_um": 5.0
}
```

---

### 7.25 Inventory — Equipment / Instrument / Column Catalogue

Individual assets registered in the lab.

| Endpoint prefix | Resource |
|---|---|
| `/api/inventory/equipment-catalogue` | Physical equipment assets |
| `/api/inventory/instrument-catalogue` | Analytical instruments |
| `/api/inventory/column-catalogue` | Chromatography columns (tracked by injection count) |

Each supports: `GET` (list), `POST` (create), `GET /{id}`, `PATCH /{id}`, `PATCH /{id}/toggle`.

**Create equipment-catalogue payload:**
```json
{
  "asset_id": "EQ-0001",
  "name": "Rotavap Unit 1",
  "equipment_type_id": "<uuid>",
  "serial_no": "SN-ROTA-001",
  "manufacturer": "Buchi",
  "model": "R-300",
  "location": "Lab A",
  "status": "ACTIVE"
}
```

**Create column-catalogue payload:**
```json
{
  "column_id": "COL-0001",
  "name": "C18 Column 1",
  "column_type_id": "<uuid>",
  "serial_no": "SN-C18-001",
  "max_injections": 500,
  "status": "ACTIVE"
}
```

---

### 7.26 Inventory — Maintenance Schedules

Planned maintenance events for equipment.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/maintenance-schedules` | List schedules |
| `POST` | `/api/inventory/maintenance-schedules` | Create schedule |
| `GET` | `/api/inventory/maintenance-schedules/{id}` | Get schedule |
| `PATCH` | `/api/inventory/maintenance-schedules/{id}` | Update schedule |
| `PATCH` | `/api/inventory/maintenance-schedules/{id}/complete` | Mark completed |
| `PATCH` | `/api/inventory/maintenance-schedules/{id}/cancel` | Cancel schedule |

**Create payload:**
```json
{
  "equipment_id": "<uuid>",
  "maintenance_type": "PREVENTIVE",
  "scheduled_date": "2025-12-31",
  "technician": "John Smith",
  "notes": "Annual service"
}
```

**Complete payload:** `{ "completed_date": "2025-12-31", "remarks": "Service completed" }`

**Maintenance types:** `PREVENTIVE`, `CORRECTIVE`, `CALIBRATION`

---

### 7.27 Inventory — Calibration Schedules

Planned calibration events for analytical instruments.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/calibration-schedules` | List schedules |
| `POST` | `/api/inventory/calibration-schedules` | Create schedule |
| `GET` | `/api/inventory/calibration-schedules/{id}` | Get schedule |
| `PATCH` | `/api/inventory/calibration-schedules/{id}` | Update schedule |
| `PATCH` | `/api/inventory/calibration-schedules/{id}/complete` | Mark completed |
| `PATCH` | `/api/inventory/calibration-schedules/{id}/cancel` | Cancel schedule |

**Create payload:**
```json
{
  "instrument_id": "<uuid>",
  "calibration_type": "ANNUAL",
  "scheduled_date": "2025-12-31",
  "technician": "External Calibration Lab",
  "certificate_no": "CERT-2025-001",
  "notes": "Annual NABL calibration"
}
```

**Complete payload:** `{ "completed_date": "2025-12-31", "remarks": "Certificate received" }`

---

### 7.28 Inventory — Equipment Verifications

Daily / periodic checks on equipment before use.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/equipment-verifications` | List verifications |
| `POST` | `/api/inventory/equipment-verifications` | Create verification |
| `GET` | `/api/inventory/equipment-verifications/{id}` | Get verification |
| `PATCH` | `/api/inventory/equipment-verifications/{id}/verify` | Pass verification |
| `PATCH` | `/api/inventory/equipment-verifications/{id}/reject` | Fail verification |

**Create payload:** `{ "request_no": "EQV-2025-001", "equipment_id": "<uuid>", "remarks": "Pre-use check" }`

---

### 7.29 Inventory — Instrument Verifications

System suitability / performance checks for analytical instruments.

Same structure as Equipment Verifications, with `instrument_id` instead of `equipment_id`.

**Create payload:** `{ "request_no": "INV-2025-001", "instrument_id": "<uuid>", "remarks": "SST check" }`

---

### 7.30 Inventory — Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/dashboard/kpis` | Total stock, expiring count, pending requests |
| `GET` | `/api/inventory/dashboard/available-stock` | Available qty per material |
| `GET` | `/api/inventory/dashboard/expiring-soon` | Batches expiring within 90 days |
| `GET` | `/api/inventory/dashboard/pending-actions` | Pending verifications, requests |

---

### 7.31 Inventory — Audit Trail

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/audit-trail` | Inventory-specific audit log |

**Query params:** `entity_type` (e.g. `BATCH`, `MATERIAL`), `entity_id`, `date_from`, `date_to`, `page`, `page_size`

---

### 7.32 Inventory — Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/reports/batch-inventory` | Current stock levels per material |
| `GET` | `/api/inventory/reports/expiry` | Expiry status report |
| `GET` | `/api/inventory/reports/stock-requests` | Stock request summary |
| `GET` | `/api/inventory/reports/equipment-status` | Equipment / instrument status (`?asset_type=INSTRUMENT`) |

---

## 8. Experiment Lifecycle

```
DRAFT
  │
  ├─[submit]──────► SUBMITTED (awaiting TL verification)
  │                     │
  │               [verify]│[reject]
  │                     │        │
  │                     ▼        ▼
  │               VERIFIED    REJECTED
  │                  │             │
  │           [approve]│[reject]  [revise]
  │                  │        │    │
  │                  ▼        ▼    └──► DRAFT (new revision)
  │              APPROVED  REJECTED
  │                  │
  │             [unlock request → QA approves]
  │                  │
  │                  ▼
  │              UNLOCKED
  │                  │
  │             [new-version]
  │                  │
  └──────────────────┘  (new Experiment row, version+1)
```

Each status transition is recorded in `experiment_history` with the actor, timestamp, and a full JSON snapshot of the experiment at that moment.

---

## 9. Version Control & Diff

When `POST /experiments/{id}/new-version` is called, a new `Experiment` row is inserted with `version = N+1`, `root_experiment_id` pointing to the original, and `is_latest_version = true` (the old row is set to `false`).

**Comparing two versions:**

```http
GET /api/experiments/{v1_id}/diff/{v2_id}?field=procedure&format=html
```

Returns:
```json
{
  "field": "procedure",
  "format": "html",
  "similarity": 0.82,
  "diff": "<del class=\"rt-del\">old words</del><ins class=\"rt-ins\">new words</ins>",
  "plain_before": "stripped old text",
  "plain_after": "stripped new text",
  "exp_id": "...",
  "other_id": "..."
}
```

Use `format=unified` for a plain-text unified diff (git-style).

Diffable fields: `aim`, `objective`, `procedure`, `observations`, `conclusion`

---

## 10. Rich-Text Storage

Rich-text fields (`aim`, `objective`, `procedure`, `observations`, `conclusion`) are stored as **raw HTML** produced by `react-quill`. The backend:

- **Stores** HTML as-is in `TEXT` columns
- **Sanitises** on read using `sanitise_html()` — removes scripts, `on*` handlers, unknown tags
- **Strips** to plain text via `strip_html()` for search indexing and diff input
- **Diffs** at word level using `difflib.SequenceMatcher`, wrapping changes in `<ins>`/`<del>` tags

The audit log records a unified diff of changed rich-text fields whenever an experiment is saved.

---

## 11. Database Notes

**Connection string:** `postgresql://postgres:Admin%40123@localhost:5432/chemia_eln`

**Key tables:**

| Table | Description |
|---|---|
| `users` | User accounts |
| `roles` | Four built-in roles |
| `departments` | Organisational departments |
| `projects` | R&D projects |
| `notebooks` | Experiment containers |
| `notebook_permissions` | Per-user notebook access flags |
| `experiments` | Core experiment records |
| `experiment_history` | Audit trail + JSON snapshots at each status change |
| `experiment_inputs` | Reactants / reagents tab |
| `experiment_parameters` | Parameters tab |
| `experiment_steps` | Step-by-step procedure |
| `experiment_equipment` | Equipment used |
| `experiment_tlc` | TLC records |
| `atr` | Analytical testing requests |
| `sequence_counters` | Auto-incrementing code counters (NB, ATR, EXP) |
| `audit_log` | System-wide action log |
| `inventory_*` | All inventory tables |

**Sequences** are stored in `sequence_counters` with a `scope_key`. Examples:
- `NB:PRJ001` → notebook numbers within project PRJ001
- `EXP` → global experiment counter
- `ATR` → global ATR counter

**Check constraint on `experiments.status`:**  
Valid values: `DRAFT`, `INPROGRESS`, `VERIFICATION REQUESTED`, `SUBMITTED`, `VERIFIED`, `APPROVED`, `REWORK`, `REJECTED`, `UNLOCKED`, `VOID`

---

## 12. Testing

Two test scripts are included:

### Smoke test (26 endpoints)
```bash
python test_endpoints.py
```
Covers basic GET endpoints across all modules. Runs in ~5 seconds.

### Full CRUD test (152 endpoints)
```bash
python test_crud.py
```
Covers complete Create / Read / Update / Delete / workflow operations across all 23 modules using all four user roles.

**Note:** The login endpoint is rate-limited to 5 requests per minute. The CRUD test makes exactly 4 login calls at startup and 1 logout at the end — if you run it immediately after a previous run, wait ~65 seconds for the rate limit window to reset.

**Last result:** 158/158 passed.
