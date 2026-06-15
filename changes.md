# Changes

## 2026-06-15 — ADC Synthesis: backend support + seed template

### New: `experiment_materials` table + endpoints
Added `ExperimentMaterial` model (`experiment_materials` table) to formally track which
inventory batches are reserved / issued for each reagent role in a synthesis experiment.

New endpoints on `router` (mounted under `/api/experiments`):
- `GET  /{id}/materials` — list reserved batches for an experiment
- `POST /{id}/materials` — reserve a batch (validates AVAILABLE status + sufficient qty)
- `PATCH /{id}/materials/{mat_id}` — update qty_issued / status (RESERVED → ISSUED → RETURNED)

### New: `GET /{id}/preliminary-data` endpoint
Returns the linked preliminary experiment's full `data` JSON so the synthesis frontend
can pre-fill read-only fields (antibody lot, concentration, LP purity, dispositions, etc.)
without loading the entire preliminary experiment response.

### Fix: Synthesis submit gate — preliminary disposition check
`submit_experiment` now blocks submission if the linked preliminary experiment's
`disposition` or `lp_disposition` fields are not `"Release for conjugation"`,
preventing synthesis from proceeding before materials are characterised and released.

### New: `seed_adc_synthesis.py`
Seed script for the ADC Synthesis workflow template (slug `adc-synthesis`).
2 sections, 13 screens, 136 user-entered fields. Preliminary + inventory data
are resolved at runtime via `linked_preliminary_id` and `inv_batches`; only
user-entered and auto-stamped fields are in the template definition.

**Files changed:**
- `backend/app/models/experiment_material.py` — new model
- `backend/app/models/__init__.py` — registered `ExperimentMaterial`
- `backend/app/schemas/experiment.py` — `ExperimentMaterialCreate/Update/Response`, `PreliminaryDataResponse`
- `backend/app/modules/experiments/router.py` — 3 new material endpoints, preliminary-data endpoint, submit gate
- `backend/seed_adc_synthesis.py` — new synthesis template seed

---



## 2026-06-13 — Fix: Verify/Save/Submit race condition with CRD settings

**Bug:** Clicking Verify (or Save / Submit for Verification) immediately after the experiment editor page loads could trigger a 422 error from the backend. The root cause was a race condition: `triggerWithESign` evaluates `crdSettings?.reauth_verification ?? false` — when `crdSettings` is still `null` (fetch in flight), this falls through to `false` and calls `fn()` directly without a password, which the sign endpoint rejects with 422.

**Fix:**
- Added `useCRDSettingsLoading()` hook to `CRDSettingsContext.tsx` that exposes the existing `loading` boolean.
- The experiment editor (`editor/components/index.tsx`) now calls this hook and sets `disabled={crdLoading}` on the Save, Submit for Verification, Re-submit, and Verify buttons — preventing them from being clicked before CRD settings have finished loading.

**Files changed:**
- `frontend/src/common/CRDSettingsContext.tsx` — exported new `useCRDSettingsLoading()` hook
- `frontend/src/pages/experiments/editor/components/index.tsx` — imported hook, added `disabled={crdLoading}` to action buttons

---

## 2026-06-13 — Fix: Unlock button status check + Void experiment feature

### Fix: Unlock button shown on wrong status
**Bug:** The "Request Unlock" button checked `exp.status === 'APPROVED'` but the backend sets the status to `'LOCKED'` after approval, so the button never appeared.

**Fix:** Changed the condition to `exp.status === 'LOCKED'` in `editor/components/index.tsx`.

### Feature: Void experiment
**Backend:** Added `POST /api/experiments/{exp_id}/void` endpoint gated on the `experiments.void` privilege (QA role). Sets status to `VOID`, records `rejected_by`, `rejected_at`, and `rejection_reason`, and logs a `VOID` audit event.

**Frontend:** Added a "Void" button visible to users with `canApprove` permission on any non-void experiment. Clicking opens a modal that requires a reason, then calls the new void endpoint.

**Files changed:**
- `backend/app/modules/experiments/router.py` — added `void_experiment` endpoint
- `frontend/src/pages/experiments/editor/components/index.tsx` — fixed unlock condition, added Void button + modal + handler
- `frontend/src/utilities/chemiaApi.ts` — added `voidExperiment()` API call

---

## 2026-06-15 — Fix: ATR list 422 (two causes) + Audit log 404

### Fix: ATR list always returned 422
**Bug 1:** Frontend called `GET /api/atr/?page_size=200&latest_only=true`. The backend had no `latest_only` parameter → FastAPI rejected the unknown field with 422.  
**Bug 2:** Backend enforced `page_size: le=100` but the frontend requested 200 to support client-side filtering → second 422 cause.

**Fix:** Added `latest_only: bool = Query(False)` to `list_atr` and raised `page_size` limit to `le=500`. When `latest_only=True`, filter applies `ATR.is_latest_version == True`.

### Fix: Audit log dashboard widget always showed 404
**Bug:** `getAuditLog()` in `chemiaApi.ts` called `/api/admin/audit-logs` but the backend route is `/api/admin/audit` → 404.

**Fix:** Corrected the URL in `chemiaApi.ts`.

**Files changed:**
- `backend/app/modules/atr/router.py` — added `latest_only` param, raised `page_size` limit to 500
- `frontend/src/utilities/chemiaApi.ts` — fixed audit log URL (`/audit-logs` → `/audit`)

---

## 2026-06-15 — Fix: Notifications "My Recent Activity" stuck loading + "Approved by" shows UUID

### Fix: Notifications page spun forever
**Bug:** `/api/dashboard/my-activity` returned experiment summaries (`id`, `full_code`, `title`, `status`, `updated_at`) but the frontend `MyActivityItem` interface expected history entries (`experiment_id`, `action`, `action_by`, `action_at`). The missing fields caused an infinite loading state.

**Fix:** Rewrote the endpoint to query `ExperimentHistory` filtered by `actor_id == actor.id`, returning the correct field names.

### Fix: Experiment editor "Approved by" showed raw UUID
**Bug:** `ExperimentResponse` schema only had `approved_by: Optional[str]` (UUID); the `approver` SQLAlchemy relationship existed but wasn't exposed.

**Fix:** Added `approver: Optional[_UserShort]` to `ExperimentResponse` schema, added matching field to the TS type, and updated the display component to use `exp.approver?.display_name ?? exp.approved_by`.

**Files changed:**
- `backend/app/modules/dashboard/router.py` — rewrote `my_activity` to query `ExperimentHistory`
- `backend/app/schemas/experiment.py` — added `approver: Optional[_UserShort]`
- `frontend/src/utilities/chemiaApi.ts` — added `approver` field to `ExperimentResponse`
- `frontend/src/pages/experiments/editor/components/index.tsx` — display `approver.display_name`

---

## 2026-06-15 — Fix: Experiment History tab "by UUID" showed raw UUID

**Bug:** The History tab in the experiment editor showed `by <UUID>` (e.g. `by 05ac0012-4730-...`) because `ExperimentHistoryResponse` only had `actor_id` and the history endpoint returned raw ORM objects without resolving the actor's display name.

**Fix:** Added `actor_name: Optional[str]` to `ExperimentHistoryResponse` schema. Updated the `get_history` endpoint to loop over results, look up each `actor_id` in the Users table, and populate `actor_name`. Updated the TS `HistoryResponse` interface and the editor component to display `actor_name ?? actor_id`.

**Files changed:**
- `backend/app/schemas/experiment.py` — added `actor_name: Optional[str]` to `ExperimentHistoryResponse`
- `backend/app/modules/experiments/router.py` — resolve actor display name in `get_history`
- `frontend/src/utilities/chemiaApi.ts` — added `actor_name` to `HistoryResponse` interface
- `frontend/src/pages/experiments/editor/components/index.tsx` — display `actor_name ?? actor_id`

---

## 2026-06-15 — Merge backend_1 improvements + backend hardening

### Fix: Notebook creator role not exposed
**Bug:** `UserShort` schema had no `role` field, so API consumers (e.g. frontend permission checks) could not read the creator's role code.

**Fix:** Added `role: Optional[str]` to `UserShort` in `schemas/notebook.py`. All notebook list/get queries now chain `selectinload(Notebook.creator).selectinload(User.role)` and all notebook permission queries chain `selectinload(NotebookPermission.user).selectinload(User.role)`.

### Fix: Notebook PATCH ignored template_id change
**Bug:** `update_notebook` set `template_id` on the notebook but never refreshed `template_snapshot`, leaving a stale definition in the DB.

**Fix:** Added `template_id` to `NotebookUpdate` schema. When `template_id` changes, the endpoint now looks up the template, validates it is active, and updates `template_snapshot` from `template.definition`.

### Fix: Experiment list `creator_name` was None
**Bug:** `list_experiments` returned raw ORM rows without eagerly loading the creator relationship, so `creator_name` was always null.

**Fix:** Added `selectinload(Experiment.creator)` to the list query and use the existing `experiment_summary_from_orm()` helper to build enriched responses.

### Fix: Workflow template `is_active` missing from list response
**Bug:** `WorkflowTemplateSummary` schema did not include `is_active`, so clients could not distinguish active from inactive templates without fetching the full detail.

**Fix:** Added `is_active: bool` to `WorkflowTemplateSummary`.

### Fix: Workflow template `is_active` query param rejected with 422
**Bug:** `list_templates` declared `is_active: Optional[bool]` — FastAPI's automatic bool coercion rejected common values like `"true"` / `"1"`.

**Fix:** Changed to `Optional[str]` with explicit string parsing (`"true"/"1"` → filter active, `"false"/"0"` → filter inactive, omitted → default to active only, `""` → return all).

### Refactor: `require_privilege` eliminates duplicated logic
`require_privilege()` now delegates to the existing `user_has_privilege()` helper instead of re-implementing the DB lookup + DEFAULT_GRANTS fallback inline.

### Fix: smoke_test_full.py wrong field names
Corrected two field name mismatches in the smoke test: `"uom"` → `"unit"` (material creation) and `"quantity"` → `"qty"` (batch issue), matching the actual `IssueRequest` schema.

### Update: seed_adc_preliminary.py — new sections format
Rewrote the ADC Preliminary seed to use the `sections → screens` structure with `has_signature` and `has_files` flags, aligned with `ADCWorkflow.tsx`. Replaced the old flat `workflow_groups/screens` format. Added `_print_summary()` helper and improved the update path to refresh `name`, `description`, `category`, and `is_active`.

**Files changed:**
- `backend/app/schemas/notebook.py` — `role` on `UserShort`; `template_id` on `NotebookUpdate`
- `backend/app/modules/notebooks/router.py` — `selectinload(User.role)` chains; `update_notebook` handles `template_id` + `template_snapshot`
- `backend/app/modules/experiments/router.py` — `selectinload(Experiment.creator)`; `experiment_summary_from_orm` in list
- `backend/app/schemas/experiment.py` — `url` computed field on `ExperimentFileResponse`
- `backend/app/schemas/workflow_template.py` — `is_active` on `WorkflowTemplateSummary`
- `backend/app/modules/workflow_templates/router.py` — `is_active` string query param
- `backend/app/utils/privileges.py` — `require_privilege` delegates to `user_has_privilege`
- `backend/app/modules/atr/router.py` — minor cleanup (from merge)
- `backend/app/modules/dashboard/router.py` — minor cleanup (from merge)
- `backend/smoke_test_full.py` — fixed `unit`/`qty` field names
- `backend/seed_adc_preliminary.py` — new sections-based ADC template definition

---

## 2026-06-15 — Fix: ATR list "Raised By" showed raw UUID

**Bug:** `ATRSummary` only had `raised_by: str` (UUID); the `raised_user` SQLAlchemy relationship existed on the model but was not exposed in the schema.

**Fix:** Added `_UserShort` helper and `raised_user: Optional[_UserShort]` to `ATRSummary` schema. Also added missing `objectives` field to `ATRSummary`. Updated frontend `ATRSummary` interface and `mapATR()` to use `raised_user?.display_name ?? raised_by`.

**Files changed:**
- `backend/app/schemas/atr.py` — added `_UserShort`, `raised_user`, `objectives` to `ATRSummary`
- `frontend/src/utilities/chemiaApi.ts` — added `raised_user` field to `ATRSummary`
- `frontend/src/pages/atr/list/components/index.tsx` — use `raised_user.display_name` in table
