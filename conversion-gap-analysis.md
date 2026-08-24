# Conversion Gap Analysis — FastAPI → Node.js

**Generated:** 2026-08-12  
**Purpose:** Actionable list of gaps, ordered by severity and fix effort.

---

## Tier 0 — Security Vulnerabilities (Fix Immediately)

### GAP-001: Work Order Routes Have No Authentication
- **File:** `backend-node/src/routes/inventory/workOrders.routes.ts`
- **Problem:** Zero `authenticate` middleware calls. All work order operations (create, start, end, verify, approve) are publicly accessible.
- **Fix:** Add `authenticate` as middleware on all routes.
- **Effort:** 30 minutes

### GAP-002: Gate Pass Routes Have No Authentication
- **File:** `backend-node/src/routes/inventory/gatePasses.routes.ts`
- **Problem:** Same — zero `authenticate` calls.
- **Fix:** Add `authenticate` as middleware on all routes.
- **Effort:** 30 minutes

### GAP-003: Batch Reconcile Replaces Qty (Data Destruction)
- **File:** `backend-node/src/routes/inventory/batches.routes.ts` — `POST /:id/reconcile`
- **Problem:** FastAPI does `qty_available += body.qty` (additive). Node.js sets `qty_available = body.adjustedQty` (replacement). Calling reconcile destroys existing stock quantity.
- **Fix:** Change to additive semantics; update request body field name from `adjustedQty` to `qty`.
- **Effort:** 1 hour

### GAP-004: Batch Allocate Does Not Deduct Quantity
- **File:** `backend-node/src/routes/inventory/batches.routes.ts` — `POST /:id/allocate`
- **Problem:** Creates an ALLOCATED event but never decrements `qty_available`. Stock level never decreases on allocation.
- **Fix:** Subtract `qty` from `qty_available` with status guard before event creation.
- **Effort:** 1 hour

### GAP-005: Role Privileges GET Has No Auth Guard
- **File:** `backend-node/src/routes/roles.routes.ts`
- **Problem:** `GET /roles/:id/privileges` has no `authenticate` middleware.
- **Fix:** Add `authenticate` middleware.
- **Effort:** 15 minutes

### GAP-006: Forgot Password Leaks Username Existence
- **File:** `backend-node/src/routes/auth.routes.ts`
- **Problem:** Returns `404` when username not found, leaking valid usernames.
- **Fix:** Return generic `400` regardless of whether username exists.
- **Effort:** 15 minutes

---

## Tier 1 — Business Logic Failures (Fix Before Go-Live)

### GAP-007: Login Does Not Accept Email Address
- **File:** `backend-node/src/routes/auth.routes.ts`
- **Problem:** FastAPI accepts either `username` or `email` in the login field. Node.js only accepts `username`. Users who log in via email will fail authentication.
- **Fix:** Before querying by username, also query by email: `WHERE username = :val OR email = :val`.
- **Effort:** 1 hour

### GAP-008: JWT Environment Variable Mismatch
- **File:** `backend-node/src/config.ts` (or wherever `JWT_SECRET` is read)
- **Problem:** FastAPI reads `SECRET_KEY`; Node.js reads `JWT_SECRET`. Tokens from one are invalid in the other. Deployment must set both.
- **Fix:** Document that both env vars must be set to the same value during migration. Long-term: standardize on one name.
- **Effort:** Config update only

### GAP-009: Missing Health Endpoint
- **File:** `backend-node/src/app.ts` or a new route file
- **Problem:** No `GET /health` endpoint. Load balancers and k8s liveness probes will receive 404.
- **Fix:** Add a simple health route returning `{status: 'ok', version: pkg.version}`.
- **Effort:** 30 minutes

### GAP-010: Privilege Response Key Mismatch
- **File:** `backend-node/src/routes/roles.routes.ts`
- **Problem:** FastAPI returns `{"privileges": [...]}`. Node.js returns `{"grants": [...]}`.
- **Fix:** Change response key from `grants` to `privileges`, OR update frontend (coordinate with frontend team).
- **Effort:** 30 minutes

### GAP-011: Privilege Bulk Save Request Key Mismatch
- **File:** `backend-node/src/routes/roles.routes.ts`
- **Problem:** FastAPI expects `{"grants": [...]}`. Node.js expects `{"rows": [...]}`.
- **Fix:** Change Node.js to read `req.body.grants` (with fallback to `req.body.rows` for compatibility).
- **Effort:** 30 minutes

### GAP-012: Work Order Approve — Wrong Status and Missing Logic
- **File:** `backend-node/src/routes/inventory/workOrders.routes.ts`
- **Problem:** Sets status to `CLOSED` (FastAPI: `APPROVED`). Missing: SOD check, deviation acknowledgment gate, schedule closure, next schedule generation, asset date stamping.
- **Fix:** Change target status. Add SOD check. Call schedule closure + `stampAssetDates()`. Add asset date update.
- **Effort:** 4 hours

### GAP-013: Work Order Reinitiate — Wrong Status and No Cleanup
- **File:** `backend-node/src/routes/inventory/workOrders.routes.ts`
- **Problem:** Sets status to `IN_PROGRESS` (FastAPI: `RAISED`). Does not delete existing results, signatures, or calibration references.
- **Fix:** Change to `RAISED`. Add deletion of WO results, signatures, calibration refs.
- **Effort:** 2 hours

### GAP-014: Gate Pass Returns — No Balance Validation or Concurrency Guard
- **File:** `backend-node/src/routes/inventory/gatePasses.routes.ts`
- **Problem:** No SELECT FOR UPDATE on gate pass rows; no per-item balance validation; wrong final status (always `RETURNED` vs `CLOSED`/`PARTIALLY_RETURNED`).
- **Fix:** Add transaction with row lock; validate returned qty ≤ issued qty per item; set status based on whether all items fully returned.
- **Effort:** 3 hours

### GAP-015: Batch Issuance Missing Status Guards and FIFO Pack Logic
- **File:** `backend-node/src/routes/inventory/batches.routes.ts`
- **Problem:** Does not block issuance from CONSUMED/EXPIRED/QUARANTINE batches. Does not do FIFO pack deduction. Does not auto-transition status to CONSUMED/PARTIALLY_CONSUMED.
- **Fix:** Add status check; add pack deduction logic; add status machine transition.
- **Effort:** 4 hours

### GAP-016: `ard_settings` Column Name Mismatch (Schema-Breaking)
- **File:** `backend-node/src/models/ArdModels.model.ts` — `ArdSetting` class
- **Problem:** FastAPI DB columns are `setting_key`, `setting_label`, `setting_value`, `setting_category`. Node.js model maps `key`, `label`, `value`. All ARD setting reads/writes will fail against the FastAPI-created DB.
- **Fix:** Add `field:` overrides in Sequelize model: `key: {field: 'setting_key'}`, `label: {field: 'setting_label'}`, `value: {field: 'setting_value'}`.
- **Effort:** 1 hour

### GAP-017: ATR Form Column Name Mismatch (Schema-Breaking)
- **File:** `backend-node/src/models/ArdModels.model.ts` — `ArdAtrForm` class
- **Problem:** FastAPI primary reference field is `form_no`. Node.js uses `atr_no`. Queries from Node.js will not find ATR forms created by FastAPI.
- **Fix:** Coordinate schema alignment. Either migrate DB column name or add `field: 'form_no'` mapping in Sequelize.
- **Effort:** DB migration + 2 hours

### GAP-018: Test Status Names Mismatch
- **File:** `backend-node/src/routes/ard/ardTests.routes.ts`
- **Problem:** `start` → `STARTED` (FastAPI: `IN_PROGRESS`); `submit` → `SUBMITTED` (FastAPI: `VERIFICATION_REQUESTED`). Frontend status-based UI will break.
- **Fix:** Change status strings to match FastAPI values.
- **Effort:** 2 hours (plus frontend update)

### GAP-019: Work Order Toggle — Wrong Target Status
- **File:** Batch toggle route
- **Problem:** `AVAILABLE ↔ INACTIVE` (FastAPI: `AVAILABLE ↔ QUARANTINE`).
- **Fix:** Change `INACTIVE` to `QUARANTINE`.
- **Effort:** 15 minutes

### GAP-020: Notebook Permission Default `can_view: false`
- **File:** `backend-node/src/models/` — notebook permission model
- **Problem:** FastAPI default is `True`. Node.js default is `false`. New permission rows created by Node.js will block view access.
- **Fix:** Change default to `true`.
- **Effort:** 15 minutes

---

## Tier 2 — Missing Features (Fix Within 2–4 Weeks)

### GAP-021: E-Signature Not Enforced on Work Order Verify and Approve
- **Files:** `workOrders.routes.ts`
- **Fix:** Add password re-auth using existing `enforceEsignature()` helper at verify and approve.

### GAP-022: E-Signature Not Enforced on Gate Pass Approve and Dispatch
- **Files:** `gatePasses.routes.ts`
- **Fix:** Add `enforceEsignature()` at both transitions.

### GAP-023: Usage Log Start/End Do Not Update Asset Status
- **Files:** `usageLogs.routes.ts`
- **Fix:** On start, set equipment/instrument `status = 'IN_USE'`. On end, set `status = 'AVAILABLE'`. On end with column: increment `cumulativeInjections`; set column `status = 'EXHAUSTED'` if limit reached.

### GAP-024: Stock Request Two-Stage Approval Routing Missing
- **Files:** `stockRequests.routes.ts`
- **Fix:** On create, if user has BENCH role, route to TL stage. If non-bench, auto-approve. On approve, check stage and role authority.

### GAP-025: CGT Experiment Reject and Unlock Endpoints Missing
- **Files:** `backend-node/src/routes/cgt.routes.ts`
- **Fix:** Add `POST /cgt/experiments/:id/reject` and `POST /cgt/experiments/:id/unlock` handlers.

### GAP-026: ARD Experiment `VERIFICATION_REWORK` Transition Missing
- **Files:** `ardExperiments.routes.ts`
- **Fix:** Add `VERIFICATION_REWORK` to the transition table; add handler logic for rework transition.

### GAP-027: ARD ATR Audit Log Writes Missing
- **Files:** `atrs.routes.ts`, `ardTests.routes.ts`
- **Fix:** After each state-changing operation, write a row to `ArdAuditLog` with entity type, action, actor, before/after state.

### GAP-028: CGT HOD-Only Approval Gate Missing
- **Files:** `cgt.routes.ts` — experiment approve handler
- **Fix:** Check that `req.user.role.code === 'HOD'` or role has HOD-level privilege before allowing approval.

### GAP-029: ATR Auto-Advance Logic (PARTIAL → PENDING_APPROVAL) Missing
- **Files:** `ardTests.routes.ts`
- **Fix:** After each test state transition, check if all tests in the ATR have reached terminal states. If yes, advance ATR status to `PENDING_APPROVAL` (or `APPROVED` if auto-approve setting is on).

### GAP-030: Checklist Version Bump on Approve Missing
- **Files:** `checklists.routes.ts`
- **Fix:** On approve, increment checklist version from `1.x` to next minor version.

---

## Tier 3 — Missing Endpoints (Track in Backlog)

### ARD ATR
- `PATCH /ard/atrs/:id/tests/:tid` — test result update
- `POST /ard/atrs/:id/generate-ar` — batch AR number generation
- `POST /ard/atrs/:id/clone`
- `POST /ard/atrs/:id/raise-enhancement`
- `GET /ard/atrs/:id/documents/summary.pdf`
- `GET /ard/atrs/:id/documents/coa.pdf`
- `GET /ard/atrs/:id/documents/detailed.pdf`
- `GET /ard/atrs/:id/documents/labels.pdf`
- `GET /ard/atrs/:id/samples/:sid/label.png`
- `GET /POST/DELETE /ard/atrs/:id/supporting-docs`
- `GET /ard/users/tl-list`
- `GET /ard/users/qa-list`

### ARD Tests
- `POST /ard/tests/:atrId/:testId/generate-ar`
- `POST /ard/tests/:atrId/:testId/takeover`
- `DELETE /ard/tests/:atrId/:testId/final-report/:id`
- `POST /ard/tests/:atrId/:testId/enhancement-requests`
- `POST /ard/tests/:atrId/:testId/publish-tentative`

### ADC
- `POST /experiments/:id/submit-to-ad`
- `POST /experiments/:id/ad-results`
- `POST /experiments/:id/sections/:sectionId/signature`
- `GET /atr` + `GET /atr/:id`
- `GET /experiments/:id/history`

### CGT
- `GET /cgt-projects/hod-dashboard`
- `GET /cgt-notebooks` (global list)
- `GET /cgt-notebooks/tl-dashboard`
- `GET /cgt-notebooks/:id/template-snapshot`
- `GET /cgt-notebooks/:id/assigned-users`
- `GET /cgt-experiments` (global list)
- `GET /cgt-experiments/my-dashboard`
- `DELETE /cgt-experiments/:id/unassign/:userId`

---

## Fix Order Summary

| Phase | GAPs | Estimated Effort |
|-------|------|-----------------|
| Phase 1 (this PR) | GAP-001–006 (security) | 1 day |
| Phase 2 | GAP-007–020 (data integrity) | 3–4 days |
| Phase 3 | GAP-021–030 (missing features) | 5–7 days |
| Phase 4 | Tier 3 endpoints | 3–4 weeks |
