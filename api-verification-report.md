# API Verification Report — FastAPI → Node.js Migration

**Generated:** 2026-08-12  
**Scope:** All REST API endpoints across Auth, Inventory, ARD, ADC, CGT modules

---

## Executive Summary

| Module | FastAPI Endpoints | Node.js Has | Missing | Partial/Divergent |
|--------|------------------|-------------|---------|-------------------|
| Auth / Users / Roles | ~45 | ~38 | 2 | 18 |
| Inventory | ~110 | ~95 | 5 | 65 |
| ARD (ATR, Tests, Experiments, QC-TRF, Projects) | ~120 | ~85 | 20 | 55 |
| ADC Experiments/Notebooks/Projects | ~54 | ~46 | 8 | 30 |
| CGT Experiments/Notebooks/Projects | ~32 | ~19 | 13 | 12 |
| Calc Templates / Master Data / SSE | ~30 | ~28 | 0 | 8 |
| **TOTAL** | **~391** | **~311** | **~48** | **~188** |

---

## 1. Authentication & Users (`/auth`, `/users`)

### 1.1 Login (`POST /auth/login`)

| Property | FastAPI | Node.js | Status |
|----------|---------|---------|--------|
| Username field | `username` OR `email` | `username` only | **GAP — email login unsupported** |
| JWT env var | `SECRET_KEY` | `JWT_SECRET` | **MISMATCH** |
| Error format | `{"detail": "..."}` | `{"success": false, "message": "..."}` | **FORMAT MISMATCH** |
| Account lock | After N failures | After N failures | OK |
| Token version | Validated | Validated | OK |

### 1.2 Security Questions

| Property | FastAPI | Node.js | Status |
|----------|---------|---------|--------|
| Answer field key | `answers` | `answers` | OK |
| Question field key | `question_index` | `questionIndex` | **FIELD NAME MISMATCH** |

### 1.3 Forgot Password

| Property | FastAPI | Node.js | Status |
|----------|---------|---------|--------|
| Unknown username | Returns `400` generic | Returns `404` | **ENUMERATION VULNERABILITY** |

### 1.4 GET /me (Current User)

| Property | FastAPI | Node.js | Status |
|----------|---------|---------|--------|
| `role` | Flat object `{code, name}` | Nested include | Differs |
| `department` | Flat object `{code, name}` | Nested include | Differs |
| `permissions` | Included | Not included | **MISSING** |

### 1.5 Role Privileges

| Property | FastAPI | Node.js | Status |
|----------|---------|---------|--------|
| GET `/roles/:id/privileges` | Auth required | **No auth guard** | **SECURITY GAP** |
| Response key | `privileges` | `grants` | **MISMATCH** |
| Bulk save key | `grants` | `rows` | **MISMATCH** |
| Department scoping | `department_id IS NULL` filter | None | **LOGIC GAP** |

### 1.6 User Creation

| Property | FastAPI | Node.js | Status |
|----------|---------|---------|--------|
| Email uniqueness | Enforced (409) | Not checked | **GAP** |
| `emp_no` auto-generation | Auto-generated | Must be provided | **GAP** |
| Role-department validation | Enforced | Not enforced | **GAP** |
| SUPER_ADMIN guard on role delete | Yes | Missing | **GAP** |
| Self-deactivation guard | Yes | Missing | **GAP** |

---

## 2. Inventory

### 2.1 Authentication Gaps — CRITICAL

| Route Group | FastAPI Auth | Node.js Auth | Status |
|-------------|-------------|-------------|--------|
| Work Orders (`/work-orders/*`) | `get_current_user` on all | **ZERO** `authenticate` middleware | **CRITICAL — PUBLIC ACCESS** |
| Gate Passes (`/gate-passes/*`) | `get_current_user` on all | **ZERO** `authenticate` middleware | **CRITICAL — PUBLIC ACCESS** |

### 2.2 Quantity Ledger — CRITICAL

FastAPI has a dedicated `deduct_qty` / `deduct_pack_qty` / `restore_qty` helper with:
- Status guards (blocks CONSUMED/EXPIRED/QUARANTINE)
- FIFO pack deduction
- Automatic status transitions (CONSUMED / PARTIALLY_CONSUMED)

Node.js equivalent: **Does not exist.** All endpoints that should use it (issuance, allocate) do simple arithmetic only.

Specific gaps:
- `POST /batches/:id/reconcile` — FastAPI: **additive**. Node.js: **replaces qty** (destroys existing stock).
- `POST /batches/:id/allocate` — FastAPI: deducts qty. Node.js: creates event only, **no deduction**.
- `PATCH /batches/:id/toggle` — FastAPI: `AVAILABLE ↔ QUARANTINE`. Node.js: `AVAILABLE ↔ INACTIVE` (wrong status).

### 2.3 Work Order State Machine — HIGH

| Transition | FastAPI Target Status | Node.js Target Status | Status |
|------------|----------------------|-----------------------|--------|
| approve | `APPROVED` | `CLOSED` | **MISMATCH** |
| reinitiate | `RAISED` | `IN_PROGRESS` | **MISMATCH** |
| verify | Requires password re-auth | No password check | **MISSING E-SIG** |
| approve | SOD check (verifier ≠ approver) | No SOD check | **MISSING** |
| approve | Generates next schedule, stamps asset dates | Not implemented | **MISSING** |

### 2.4 Gate Pass — HIGH

| Feature | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| Document numbering | `RGP-YYYY-#####` / `NRGP-YYYY-#####` | Generic `GP-YYYYMMDD-NNNNN` | **FORMAT MISMATCH** |
| Approve | Password re-auth | None | **MISSING E-SIG** |
| Returns | SELECT FOR UPDATE + balance validation | No locking, no validation | **CRITICAL** |
| Returns status | `CLOSED` or `PARTIALLY_RETURNED` | Always `RETURNED` | **MISMATCH** |
| `from-work-order` | Validates EXTERNAL CALIBRATION, creates as RETURNABLE | No validation, creates as NRGP/DRAFT | **BROKEN** |

### 2.5 Stock Requests — HIGH

| Feature | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| Approval routing | BENCH_ROLES → TL stage; others auto-approve | Always `PENDING`, no routing | **LOGIC MISSING** |
| SR fulfill guard | `require_store_incharge_role()` | No role check | **MISSING** |
| Number format | `SR-YY-NNNN` | `SR/YY/NNNNN` | **FORMAT MISMATCH** |

### 2.6 Usage Logs — HIGH

| Feature | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| Start: asset status | Sets to `IN_USE` | Not updated | **MISSING** |
| End: asset status | Resets to `AVAILABLE` | Not updated | **MISSING** |
| End: column injections | Increments, auto-EXHAUSTED | Not tracked | **MISSING** |
| Status history | Merges usage + WO on timeline | Usage logs only | **INCOMPLETE** |

### 2.7 Batch Numbering — HIGH

| Counter | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| In-house batch no | Global `InvBatchNoCounter` table | Per-material-type `InvBatchNumberCounter` | **WRONG TABLE** |
| Seeding | `MAX(existing)+1` | Starts from 1 | **COLLISION RISK** |

---

## 3. ARD Module

### 3.1 ATR Form — CRITICAL GAPS

| Feature | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| Sample management (PUT `/atrs/:id`) | Full upsert/delete with codes | Updates scalar fields only | **INCOMPLETE** |
| Transition logic | 25+ rules per status | Basic status set + 1 e-sig | **SEVERELY INCOMPLETE** |
| E-signature enforcement | Configurable per-key via settings | Only 3 endpoints | **MISSING on most** |
| Audit log writes | Every state-changing op | None on ATR/test transitions | **MISSING** |
| Inventory deduction at submit | Yes (`deduct_qty` + chemical lots) | Not implemented | **MISSING** |
| Auto-advance (PARTIAL → PENDING_APPROVAL) | Yes (`_maybe_advance_to_pending_approval`) | Not implemented | **MISSING** |
| Auto-approve when all tests done | Yes (`_maybe_auto_approve_form`) | Not implemented | **MISSING** |
| `CERT_REWORK` status | FastAPI: `CERTIFICATION_REWORK` | Node.js: `CERT_REWORK` | **SPELLING MISMATCH** |

### 3.2 Missing ATR Endpoints

- `PATCH /atrs/:id/tests/:tid` — update test results
- `POST /atrs/:id/generate-ar` — batch AR number generation
- `POST /atrs/:id/clone`
- `POST /atrs/:id/raise-enhancement`
- All PDF document endpoints: `summary.pdf`, `coa.pdf`, `detailed.pdf`, `labels.pdf`
- Sample barcode label: `samples/:sid/label.png`
- Supporting docs: `GET/POST/DELETE /atrs/:id/supporting-docs`
- User lists: `GET /ard/users/tl-list`, `GET /ard/users/qa-list`

### 3.3 Test State Machine — CRITICAL

| FastAPI Status | Node.js Equivalent | Status |
|---------------|-------------------|--------|
| `IN_PROGRESS` | `STARTED` | **MISMATCH** |
| `VERIFICATION_REQUESTED` | `SUBMITTED` | **MISMATCH** |
| `VERIFICATION_REWORK` | Missing | **MISSING** |
| `DELEGATED` | Missing | **MISSING** |
| `UNLOCKED` | Missing (maps to STARTED) | **MISMATCH** |
| `TENTATIVE` | Present | OK |
| `ENHANCEMENT_REQUESTED` | Missing | **MISSING** |

### 3.4 Missing Test Endpoints

- `POST /tests/:atrId/:testId/generate-ar`
- `POST /tests/:atrId/:testId/takeover`
- `DELETE /tests/:atrId/:testId/final-report/:id`
- `POST /tests/:atrId/:testId/enhancement-requests`
- `PATCH /tests/:atrId/:testId/enhancement-requests/:id`
- `POST /tests/:atrId/:testId/publish-tentative`

### 3.5 ARD Experiment Transitions — HIGH

| Feature | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| Calibration/instrument interlock at SUBMITTED | Yes | No | **MISSING** |
| Co-submit: linked ATRs transition DRAFT→REQUESTED | Yes (B-77) | No | **MISSING** |
| `VERIFICATION_REWORK` state | In transition table | Missing entirely | **MISSING** |
| Version snapshot at APPROVED | Yes | No | **MISSING** |
| `aim_achieved`/`aim_remarks` at APPROVED | Yes | No | **MISSING** |
| Audit log on transitions | Every transition | None | **MISSING** |

---

## 4. ADC Module

### 4.1 Missing Endpoints

- `POST /experiments/:id/submit-to-ad` — entire AD integration workflow
- `POST /experiments/:id/ad-results` — server-to-server result callback
- `POST /experiments/:id/sections/:sectionId/signature` — section-level e-signature
- `GET /atr` — global ATR list
- `GET /atr/:id` — single ATR fetch
- `GET /experiments/:id/history` — audit trail

### 4.2 Business Logic Gaps — HIGH

| Feature | FastAPI | Node.js | Status |
|---------|---------|---------|--------|
| Notebook access enforcement | `assert_notebook_access()` on all reads/writes | Never called | **SECURITY GAP** |
| QA view-only gate on edits | Yes | No | **MISSING** |
| ATR creation links to ARD form | `create_requested_atr_from_experiment()` | Bare `ExperimentAtrRequest` only | **NOT INTEGRATED** |
| Unlock target status | `DRAFT` | `UNLOCKED` (undefined state) | **MISMATCH** |
| CGT HOD-only approval | `require_approver_role()` | No role check | **MISSING** |
| CGT e-sig on submit/approve | Password re-entry | No password check | **MISSING** |

### 4.3 Missing CGT Endpoints

- `GET /cgt-projects/hod-dashboard`
- `GET /cgt-notebooks` (global list)
- `GET /cgt-notebooks/tl-dashboard`
- `GET /cgt-notebooks/:id/template-snapshot`
- `GET /cgt-notebooks/:id/assigned-users`
- `GET /cgt-experiments` (global list)
- `GET /cgt-experiments/my-dashboard`
- `POST /cgt-experiments/:id/reject`
- `POST /cgt-experiments/:id/unlock`
- `DELETE /cgt-experiments/:id/unassign/:userId`

---

## 5. Cross-Cutting

### 5.1 Health Endpoint

- FastAPI: `GET /health` returns `{"status": "ok", "version": "...", "db": "connected"}`
- Node.js: **No health endpoint** — critical for load balancer / k8s liveness probes

### 5.2 Error Response Format

- FastAPI: `{"detail": "..."}` (string or list)
- Node.js: `{"success": false, "message": "...", "error": {...}}`
- Frontend code that checks `response.data.detail` will **break on Node.js errors**

### 5.3 JWT Configuration

- FastAPI reads: `SECRET_KEY` env var
- Node.js reads: `JWT_SECRET` env var
- Both must be set in env; tokens from one are **not valid in the other**

### 5.4 SSE (Server-Sent Events)

- FastAPI broadcasts `refresh` events after ATR/test/experiment state changes
- Node.js: **No SSE events emitted** from ARD transition endpoints (only generic SSE infrastructure exists)

---

## Priority Matrix

| Priority | Count | Examples |
|----------|-------|---------|
| P0 — Authentication bypass | 2 | Work order/gate pass routes have zero auth |
| P0 — Data corruption | 3 | Reconcile replaces qty; allocate doesn't deduct; batch numbering collision |
| P1 — Missing e-signatures | 8 | WO verify/approve, GP approve/dispatch, test submit/verify/accept, project close |
| P1 — State machine mismatches | 5 | WO approve→CLOSED, test IN_PROGRESS→STARTED, unlock→UNLOCKED |
| P2 — Missing business logic | 15 | Auto-advance ATR, schedule closure, asset status tracking, section signatures |
| P3 — Missing endpoints | 48 | ATR PDFs, CGT dashboards, history endpoints |
| P4 — Field/format divergence | 25 | Error format, JWT env var, doc number formats |
