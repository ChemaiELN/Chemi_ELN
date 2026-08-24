# ARD Open Gaps, Risks & Product Decisions

> **Status:** PHASE 9 COMPLETE — GAP-002/005/006/019/028 + BUG-004 AcceptTest/PublishTentative implemented and browser-verified  
> **Last updated:** 2026-08-02  
> **P0 = Security/data corruption | P1 = Core workflow broken | P2 = Important | P3 = Nice to have**
> **FIXED = resolved in code | OPEN = still missing**

---

## Confirmed Bugs in ELN3 — FIXED

### BUG-001 — P1 FIXED: Notifications query uses wrong column name
**File:** `backend/app/modules/ard/notifications.py:35`  
**Was:** `.filter(ArdTestRequest.assigned_user_id == user_id)` — column is `assigned_to_id`.  
**Fix applied:** Changed to `ArdTestRequest.assigned_to_id`.

### BUG-002 — P1 FIXED: Notifications query uses non-existent column
**File:** `backend/app/modules/ard/notifications.py:62-82`  
**Was:** `t.atr_id` — `ArdTestRequest` has no `atr_id` column.  
**Fix applied:** Added proper join `ArdTestRequest → ArdAtrSample → ArdAtrForm` via `atr_form_id`.

### BUG-003 — P2 FIXED: Reporting references non-existent model attribute
**File:** `backend/app/modules/ard/reporting.py:177-194, 217-233`  
**Was:** `e.created_by` — `ArdExperiment` has no such column.  
**Fix applied:** Changed to `outerjoin(User, ArdExperiment.created_by_id == User.id)` + `creator.username`.

### BUG-006 — P1 FIXED: ATR TL assignment sends username instead of UUID
**Files:** `frontend/src/pages/ard/ArdAtrWorkspacePage.tsx`, `backend/app/modules/ard/atr.py`  
**Was:** The "Select Team Lead for ATR Submission" modal used `tlOptions` (value = username string). The PUT body sent `{ assignedTl: "ad.tl" }` without `assignedTlId`. The backend set `form.assigned_tl_id = None`, so the TL had no UUID-based access claim on the ATR — `_assert_atr_read` returned 403 for the TL user.  
**Fix applied (2026-08-02):**  
- Frontend: modal now uses `tlIdOptions` (value = UUID); `confirmSubmitWithTl` sends `{ assignedTlId: <uuid> }`.  
- Backend: `update_atr()` now falls back to `db.query(User).filter(User.username == body["assignedTl"]).first()` when only the name is sent, preventing future null assignments.  
**Browser-verified:** HOD used Reassign TL (UUID endpoint) to correct ATR-2026-00014; ad.tl confirmed access restored.

### BUG-005 — P2 FIXED: Duplicate `is_external_requester` function definition
**File:** `backend/app/modules/ard/atr_rbac.py`  
**Was:** Two conflicting definitions (one by role code, one by department code).  
**Fix applied:** Single department-based definition placed before `TRANSITION_ROLE_CHECKS`.

---

## Confirmed Bugs in ELN3 — OPEN

### BUG-007 — P1 FIXED: ANALYST role excluded from test execution controls
**File:** `frontend/src/pages/ard/ArdTestExecutePage.tsx` line ~330  
**Was:** `canExecuteRoles = ['CHEM', 'TL', 'HOD', 'SUPER_ADMIN']` — omitted 'ANALYST', so analysts never saw Save/Submit buttons on their own assigned tests.  
**Fix (2026-08-02):** Added 'ANALYST' to the array.  
**Browser-verified:** ad.analyst opened their test workspace and Save/Submit buttons appeared correctly.

### BUG-008 — P1 FIXED: TL list scope defaults to "mine" instead of "team"
**File:** `backend/app/modules/ard/tests.py` — ATR list filter  
**Was:** `_read_all()` returns False for TL; without explicit `view=team` param, TL fell to "mine" scope and saw 0 team tests.  
**Fix (2026-08-02):** `effective_view = view or ("team" if is_tl(user) else "mine")` — TL now defaults to team scope.  
**Browser-verified:** ad.tl saw "All Tests (1)" including the analyst's submitted test after fix.

### BUG-009 — P1 FIXED: Legacy ATRs with null assigned_tl_id blocked TL access
**File:** `backend/app/modules/ard/tests.py` — list filter + `_assert_test_read`  
**Was:** ATRs created via the old username-only assignment path had `assigned_tl_id=NULL` and `assigned_tl="ad.tl"`. UUID-only filter excluded them from TL's list; `_assert_test_read` also raised 403.  
**Fix (2026-08-02):** Added `or_()` with username fallback in both the list filter and `_assert_test_read`. Also added `from sqlalchemy import or_`.  
**Browser-verified:** ATR-DRAFT-34f881a8 (null UUID) appeared in ad.tl's team list and individual test detail was accessible.

### BUG-010 — P1 FIXED: E-signature password not forwarded to experiment transition API
**File:** `frontend/src/pages/ard/ArdExperimentWorkspacePage.tsx`  
**Was:** `onConfirm` callback ignored `ESignaturePayload` (which includes `password`); `transition.mutateAsync(pendingTargetStatus)` sent only `{ to }`. Backend `enforce_esignature` received no password → raised HTTP 401.  
**Fix (2026-08-02):**  
- `transition` mutationFn changed from `(to: string)` to `({ to, password? })` and spreads `password` into the body.  
- `onConfirm` now destructures `{ password }` from `ESignaturePayload` and passes it through.  
- Non-sensitive path (`transition.mutate({ to })`) preserved as before.  
**Browser-verified:** EXP-2026-00031 transitioned SUBMITTED → APPROVED; all section textareas confirmed `disabled: true` post-approval.

### BUG-004 — P2 FIXED: All settings flags now enforced
**Flags:** `ATRQAPreApproval` (**FIXED**), `IndividualTestAssignment` (**FIXED**), `IndividualTestSubmission` (**FIXED**), `AcceptTest` (**FIXED**), `PublishTentative` (**FIXED**)  
**ATRQAPreApproval fix (2026-08-01):** `backend/app/modules/ard/atr.py` `transition_atr()` now reads `setting_enabled(db, "ATRQAPreApproval", default=False)`. When enabled, NEW → PARTIAL/PENDING_APPROVAL is blocked unless `preapproval_note` is set.  
**IndividualTestAssignment / IndividualTestSubmission fix (2026-08-02):** `backend/app/modules/ard/tests.py` now calls `require_setting_enabled(db, "IndividualTestAssignment", ...)` in the assign-test path and `require_setting_enabled(db, "IndividualTestSubmission", ...)` in the submit-test path. Returns HTTP 403 when the respective setting is disabled.  
**AcceptTest fix (2026-08-02):** `POST /ard/tests/{atr_id}/{test_id}/accept-test` calls `require_setting_enabled(db, "AcceptTest", ...)`. Returns HTTP 403 when setting is disabled. Browser-verified: HOD accepted VERIFIED test → ACCEPTED instantly.  
**PublishTentative fix (2026-08-02):** `POST /ard/tests/{atr_id}/{test_id}/publish-tentative` calls `require_setting_enabled(db, "PublishTentative", ...)`. Returns HTTP 403 when setting is disabled. All five setting flags are now server-enforced.

### NOTE: QA_PRE_APPROVAL → NEW is the correct approval transition
**Confirmed via browser inspection:** The "Submit Request" button in `QA_PRE_APPROVAL` calls `transition('NEW')`. This is the QA approval step — the QA releases the ATR back to NEW so lab testing can proceed. The state machine is correct. Label "Submit Request" may be clarified in UI as "Approve & Release" for UX clarity (non-blocking).  
**Status:** ACCEPTED (no code change required).

---

## Missing Features — from Java + Angular Phase 1 Discovery

### GAP-001 — P1 OPEN: Email notifications not implemented
**Legacy:** `MailUtil.sendEmail()` fires on every ATR/test/experiment transition. Templates per event in `AdminMailContent` DB table.  
**ELN3:** SMTP settings in catalog but zero sending code.  
**Impact:** Zero outbound emails — assigned tests, approvals, clarifications, qualifications all go unnotified.

### GAP-002 — P1 FIXED: Real-time push notifications via SSE
**Legacy:** Front-end polls `GET /landingPages/dynamicMenuList` to refresh counters; legacy had server-push for events.  
**Fix (2026-08-02):**
- Backend: `backend/app/core/sse_bus.py` — thread-safe event broadcaster using `asyncio.Queue` + `loop.call_soon_threadsafe()`. `broadcast("refresh", {})` called from sync route handlers after every ATR/test/experiment transition.
- Backend: `GET /api/sse/events?token=<jwt>` — async SSE endpoint in `backend/app/modules/sse/router.py`. Validates JWT from query param; yields `event: {type}\ndata: {json}\n\n`; `: keepalive\n\n` on 30s timeout; unsubscribes on disconnect.
- Frontend: `frontend/src/hooks/useSSE.ts` — opens `EventSource`, listens for `refresh` event → invalidates React Query caches for notifications, ATRs, experiments. Mounted in `ArdShell.tsx` for session-wide coverage.
- Header notification refetch interval reduced from 15s → 60s (SSE handles immediate updates).
**Browser-verified:** SSE connection `GET /api/sse/events → 200 OK` persistent. After HOD clicked "Accept Test", `GET /api/ard/notifications` fired automatically (SSE-triggered invalidation) without any page reload.
**Impact:** Badge counts now update within ~1s of any workflow transition across all connected sessions.

### GAP-003 — P2 FIXED: QC-TRF `assigned_tl` now writable
**File:** `backend/app/modules/ard/qc_trf.py`  
**Fix (2026-08-01):** Added `"assignedTl": "assigned_tl"` to `_SCALAR_FIELDS` so the PUT route writes the column. Column now fully serialized and writable.

### GAP-004 — P2 FIXED: Experiment section comments / clarification endpoints added
**Issue:** `linked_samples`, `clarifications`, `section_comments` JSON columns exist but only modifiable via full PATCH.  
**Fix (2026-08-02):** Added 4 endpoints in `backend/app/modules/ard/experiments.py`:
- `POST /{id}/section-comments` — appends `{sectionId, comment, commentedBy, commentedAt, id}` to JSON array
- `DELETE /{id}/section-comments/{comment_id}` — removes by id; author or HOD/Admin only
- `POST /{id}/clarifications` — appends clarification entry
- `DELETE /{id}/clarifications/{clarification_id}` — removes by id; author or HOD/Admin only
Frontend: `ardExperimentApi.addComment`, `deleteComment`, `addClarification`, `deleteClarification` in `frontend/src/api/ard.ts`.

### GAP-005 — P3 FIXED: Tentative results workflow implemented
**Legacy:** `TENTATIVE` status exists for test results between published and accepted.  
**Fix (2026-08-02):**
- Backend: `POST /ard/tests/{atr_id}/{test_id}/publish-tentative` in `tests.py`. ANALYST/CHEM/TL/Admin only; requires VERIFIED status; gates on `PublishTentative` setting (default true); sets `test.status = "TENTATIVE"`; broadcasts SSE `refresh`.
- Frontend: `publishTentativeMut` mutation + `canPublishTentative` role guard (ANALYST/CHEM) in `ArdTestExecutePage.tsx`; "Publish Tentative" button (cyan, Eye icon) visible when `status === 'VERIFIED'` and ANALYST/CHEM.
- Status colors: `TENTATIVE: 'cyan'` added to `STATUS_COLOR` and `TEST_STATUS_COLOR`.
**Decision taken:** YES — this step is implemented to support regulatory compliance workflows where results need intermediate "tentative" publication before final acceptance.

### GAP-006 — P3 FIXED: Accept test workflow implemented
**Legacy:** `AcceptTest` setting gates result acceptance step.  
**Fix (2026-08-02):**
- Backend: `POST /ard/tests/{atr_id}/{test_id}/accept-test` in `tests.py`. HOD/QA/Admin only; requires TENTATIVE or VERIFIED status; gates on `AcceptTest` setting (default true); sets `test.status = "ACCEPTED"`; broadcasts SSE `refresh`.
- Frontend: `acceptTestMut` mutation + `canAcceptTest` role guard (HOD/QA/SUPER_ADMIN) in `ArdTestExecutePage.tsx`; "Accept Test" button (green primary, CheckCircle2 icon) visible when status is TENTATIVE or VERIFIED and HOD/QA/SUPER_ADMIN.
- Status colors: `ACCEPTED: 'green'` added to `STATUS_COLOR` and `TEST_STATUS_COLOR`.
**Browser-verified:** HOD clicked "Accept Test" on a VERIFIED test → status badge instantly changed to "Accepted" (green) without page reload. SSE `refresh` event fired and `/api/ard/notifications` was auto-refetched.
**Decision taken:** YES — formal acceptance step is implemented.

### GAP-007 — P2 FIXED: Cancel individual test endpoint added
**Legacy:** `POST /atrform/cancelTest`  
**Fix (2026-08-01):** Added `POST /ard/atrs/{atr_id}/{test_id}/cancel` in `backend/app/modules/ard/tests.py`. TL/HOD/Admin only; requires cancellation remarks; sets status to CANCELLED; excluded from ATR completion checks.

### GAP-008 — P2 FIXED: ATR change owner endpoint added
**Legacy:** `POST /atrform/changeowner`  
**Fix (2026-08-01):** Added `POST /ard/atrs/{atr_id}/change-owner` in `backend/app/modules/ard/atr.py`. HOD/Admin only; requires `newOwnerId` (UUID) and mandatory remarks; updates `created_by`/`created_by_id` and writes audit event for GxP traceability.

### GAP-009 — P3 ALREADY IMPLEMENTED: ATR clone form
**Legacy:** `POST /atrform/cloneATRForm`  
**ELN3:** `POST /ard/atrs/{atr_id}/clone` already exists in `atr.py`. Verified in Phase 1 Java/Angular comparison.

### GAP-010 — P2 FIXED: Batch AR number generation added
**Legacy:** `POST /atrform/generateSamplArNo`  
**Fix (2026-08-01):** Added `POST /ard/atrs/{atr_id}/generate-ar` in `atr.py`. Iterates all tests on the ATR, assigns AR numbers to those without one (sequential `AR-YYYY-NNNNN`), skips those already assigned. Returns full list of (testId, arNumber). Per-test endpoint `POST /ard/atrs/{atr_id}/{test_id}/generate-ar` (tests.py) also remains available.

### GAP-011 — P2 ALREADY IMPLEMENTED: Per-test withdraw
**Legacy:** `POST /atrform/withdrawatrtest`  
**ELN3:** `POST /ard/atrs/{atr_id}/{test_id}/withdraw` already exists in `tests.py`. Verified in Phase 1 Java/Angular comparison.

### GAP-012 — P3 FIXED: Mandate certification toggle endpoint added
**Legacy:** `GET /atrform/saveMandateCerti/{formId}/{mandateFlag}/{loggedInId}`  
**Fix (2026-08-01):** Added `POST /ard/atrs/{atr_id}/mandate-certification` in `atr.py`. HOD/QA/Admin only; body: `{mandateCertification: true/false}`; blocked on CERTIFIED/WITHDRAWN/REJECTED. Writes audit event.

### GAP-013 — P2 FIXED: Experiment edit lock mechanism added
**Legacy:** `GET /adExperiment/checkForExpEditLock`, `GET /adExperiment/unlockExperimentEditor`  
**Fix (2026-08-01):** Added `editor_lock_user_id`, `editor_lock_username`, `editor_lock_expires_at` to `ArdExperiment` model (migration `f4a5b6c7d8e9`). Three endpoints in `experiments.py`:  
- `GET /{experiment_id}/check-lock` — returns lock state (who holds it, when it expires)  
- `POST /{experiment_id}/acquire-lock` — acquires/refreshes lock (30-min expiry); 409 if locked by another user  
- `DELETE /{experiment_id}/lock` — releases lock; TL/HOD/Admin can force-release  
Frontend must call `acquire-lock` before opening the edit form and `DELETE /lock` on close/submit.

### GAP-014 — P3 ALREADY IMPLEMENTED: Experiment clone
**Legacy:** `POST /adExperiment/cloneExperiment`  
**ELN3:** `POST /ard/experiments/{experiment_id}/clone` already exists in `experiments.py`. Verified in Phase 1 code review.

### GAP-015 — P3 FIXED: Experiment takeover endpoint added
**Legacy:** `POST /adExperiment/saveExperimentTakeover` — reassigns experiment to another analyst.  
**Fix (2026-08-02):** Added `POST /ard/experiments/{id}/takeover` in `backend/app/modules/ard/experiments.py`. TL/HOD/Admin only; body: `{analystId, remarks}`; validates target user has ANALYST role; blocked unless status is IN_PROGRESS or REWORK; mandatory remarks required; audit event logged.  
Frontend: "Reassign Analyst" button (amber) in `ArdExperimentWorkspacePage.tsx` toolbar; modal with analyst Select + remarks; uses `ardExperimentApi.takeover()`.

### GAP-016 — P2 PARTIALLY FIXED: Notebook lifecycle actions
**Legacy:** `POST /adNotebook/cloaseNotebook`, `POST /adNotebook/reopenNotebook`, `POST /adNotebook/deactivateNotebook`  
**Status:**  
- Close: handled via `PATCH /{notebook_id}` with `{status: "CLOSED"}` — HOD/Admin only, requires remarks + e-signature. ✓  
- Reopen: **FIXED 2026-08-01** — added `POST /ard/notebooks/{notebook_id}/reopen` in `notebooks.py`. HOD/Admin only, requires remarks. ✓  
- Archive (deactivate): handled via `PATCH /{notebook_id}` with `{status: "ARCHIVED"}` — HOD/Admin only + e-signature. ✓  
**Remaining:** All three paths now exist. GAP fully closed.

### GAP-017 — P3 FIXED: Notebook equipment tracking added
**Legacy:** `POST /adNotebook/notebookequipment`, `POST /adNotebook/experimentsbyequipment` — links equipment to notebooks.  
**Fix (2026-08-02):**
- Model: added `equipment_ids` JSON column to `ArdNotebook` (migration `g5h6i7j8k9l0`; schema: list of `{id, equipmentId, equipmentCode, equipmentName, addedBy, addedAt}`)
- Backend: added `GET /{notebook_id}/equipment`, `POST /{notebook_id}/equipment`, `DELETE /{notebook_id}/equipment/{link_id}` in `notebooks.py`. Lab roles (ANALYST/TL/HOD/Admin) can add; anyone with access can view; 409 on duplicate equipmentId.
- Frontend: `NotebookEquipmentLink` type + 3 API methods in `ard-notebooks.ts`; `EquipmentTab` component in `ArdNotebookWorkspacePage.tsx` with table view, link/unlink modal; tab added between Result Parameters and Audit Trail.

### GAP-018 — P2 ALREADY IMPLEMENTED: Project deactivation and reopen
**Legacy:** `POST /adproject/deactivateProject`, `POST /adproject/reopenProject`  
**ELN3:** `POST /ard/projects/{project_id}/close` and `POST /ard/projects/{project_id}/reopen` already exist in `projects.py`. Verified in Phase 1 Java/Angular comparison.

### GAP-019 — P3 FIXED: TENTATIVE test status implemented
**Legacy:** TENTATIVE is a valid status for test results (published tentatively before verification).  
**Fix (2026-08-02):** See GAP-005 — `TENTATIVE` status is now a valid test result state. Backend endpoint `publish-tentative` sets it; frontend renders it as cyan badge. The full lifecycle is now: UNASSIGNED → ASSIGNED → IN_PROGRESS → VERIFICATION_REQUESTED → VERIFIED → TENTATIVE → ACCEPTED.

### GAP-020 — P2 FIXED: Server-side JWT token revocation via token_version
**Legacy:** `AdminUserSecuredToken` table stores one active token per user; HTTP 460 for revoked tokens.  
**Fix (2026-08-01):** Added `token_version` (Integer, default=1) to `users` table (migration `e3f4a5b6c7d8`). `create_access_token()` embeds `ver` claim. `logout` increments `token_version` in DB. `get_current_user` rejects tokens whose `ver` ≠ current `token_version` with HTTP 401. Legacy tokens without `ver` are treated as version 1 (backward-compatible until next login).  
**Difference from legacy:** Legacy stored individual token strings; ELN3 uses a version counter — cheaper (no per-token row scan) and equally effective for the primary risk (forced logout / session invalidation).

### GAP-021 — P2 ALREADY IMPLEMENTED: COA PDF generation
**Legacy:** `GET /atrForm/getdetailcoareport/{formId}/{summarFlag}...`  
**ELN3:** `GET /ard/atrs/{atr_id}/documents/coa.pdf` already exists in `atr.py`, backed by `atr_coa_html` + `html_to_pdf`. Verified in Phase 1 Java/Angular comparison.  
**Action required:** Confirm COA PDF layout matches legacy during Phase 8 browser test.

### GAP-022 — P2 ALREADY IMPLEMENTED: Test takeover
**Legacy:** `POST /testMenu/handOverTakeoverAction`  
**ELN3:** `POST /ard/atrs/{atr_id}/{test_id}/takeover` already exists in `tests.py`. Verified in Phase 1 Java/Angular comparison. Delegate (`/delegate`) also exists as a complementary operation.

### GAP-023 — P3 ALREADY IMPLEMENTED: Project STP worksheets
**Legacy:** `AdProjectSTPController` with create/load/edit/approve/version/delete for STP worksheets.  
**ELN3:** Confirmed via code review (2026-08-02) — `ArdProjectWorkspacePage.tsx` has a dedicated "STP Documents" tab with full CRUD (create, view, edit, delete, e-signature approval, versioning). Data stored as `stp_documents` JSON array on `ArdProject`. Backend routes: `GET/POST /ard/projects/{id}/stps`, `PATCH/DELETE /ard/projects/{id}/stps/{stp_id}`, `POST /ard/projects/{id}/stps/{stp_id}/approve`. Parity confirmed; no action required.

### GAP-024 — P3 ALREADY IMPLEMENTED: Project specifications
**Legacy:** `AdProjectSpecificationsController`  
**ELN3:** Project specifications CRUD already exists in `projects.py` under `/ard/projects/{project_id}/specifications`. Verified in Phase 1 Java/Angular comparison.

### GAP-025 — P2 FIXED: Per-ATR QA assignment implemented
**Legacy:** `POST /atrForm/reassignFormApproval` — allows HOD to reassign which QA user handles the approval; stored in `qa_reviewer_id`.  
**Fix (2026-08-02):**
- Model: added `qa_reviewer_id` UUID FK column (nullable, SET NULL on delete) to `ard_atr_forms` (migration `g5h6i7j8k9l0`)
- Backend: `POST /ard/atrs/{atr_id}/reassign-qa` in `atr.py`. HOD/Admin only; `qaUserId` optional (null clears assignment); validates target has QA role; audit event logged.
- Frontend: `reassignQaOpen`/`reassignQaUserId` state, `reassignQaMut` mutation, "Reassign QA" button (violet, HOD/Admin only, visible in QA_PRE_APPROVAL/PENDING_APPROVAL), QA reassign modal in `ArdAtrWorkspacePage.tsx`.
**Note:** Model now supports per-ATR assignment while still allowing any QA to act if no reviewer is assigned.

### GAP-026 — P2 FIXED: QC-TRF additional tests endpoint added
**Legacy:** `POST /qcTrfForms/addAdditionalTests`  
**Fix (2026-08-01):** Added `POST /ard/qc-trf/{form_id}/add-tests` in `qc_trf.py`. Accepts `testRequests` list and appends to existing JSON array. Works on DRAFT, SAVED, SUBMITTED, and REGISTERED forms. Analyst/TL/Admin only. Audit event logged.

### GAP-027 — P2 FIXED: Experiment post-analytical data endpoints added
**Legacy:** `POST /adExperiment/persistPostAnalytical`, `POST /adExperiment/persistPostAnalyticalForEdit` — saves post-analytical observations separately.  
**Fix (2026-08-02):**
- Model: added `post_analytical` JSON column (default `[]`) to `ArdExperiment` (migration `g5h6i7j8k9l0`; schema: list of `{id, type, value, addedBy, addedAt}`)
- Backend: `GET /{id}/post-analytical`, `POST /{id}/post-analytical`, `DELETE /{id}/post-analytical/{item_id}` in `experiments.py`. Lab roles only for add/delete; read available to HOD/QA/Admin.
- Frontend: `ardExperimentApi.getPostAnalytical`, `addPostAnalytical`, `deletePostAnalytical` in `ard.ts`. Post-analytical field included in `_out()` response.

### GAP-029 — P2 FIXED: TEXT-type experiment sections now render as textarea editor
**Legacy:** Experiment sections of type TEXT rendered as a text/free-text editor.  
**Fix (2026-08-02):** Added `case 'text' / 'TEXT' / 'free_text' / 'freetext'` handler as the first case in `ExperimentSectionRenderer.tsx` switch statement. Renders an `Input.TextArea` (5 rows, monospace) that is disabled when `readOnly`. Non-string stored values are gracefully coerced via `JSON.stringify()` fallback; empty/null renders as blank.  
**Note:** Rich-text (WYSIWYG) editor is not implemented — plain multi-line textarea matches legacy behavior for free-text fields. If formatted text (bold/italic/tables) is required, a future upgrade to a rich-text library (e.g. Tiptap) is needed.

### GAP-028 — P3 FIXED: Dynamic left menu from backend implemented
**Legacy:** `GET /landingPages/dynamicMenuList/{dashBoardRefId}/{userId}` — backend generates role-specific menu items.  
**Fix (2026-08-02):**
- Backend: `GET /api/ard/menu` endpoint in `dashboard.py`. Returns role-filtered `items` array (key, label, href, group, icon). Applies same rules as frontend: hides `my-queue` for SUPER_ADMIN/ADMIN; hides Admin group for non-HOD/SUPER_ADMIN/ADMIN.
- Frontend: `ArdSidebar.tsx` now fetches `GET /api/ard/menu` via `useQuery` (5-min staleTime). `ICON_MAP`, `apiItemsToMenuItems()`, `GROUP_META`/`GROUP_ORDER` convert API data to rendered menu. Falls back to hardcoded `makeArdItems(roleCode)` when API unavailable.
**Browser-verified:** Network log shows `GET /api/ard/menu → 200 OK`. HOD sidebar rendered all groups correctly: Dashboard, My Queue, Work (ATRs/Tests/TRF Forms), Notebook (Projects/Notebooks/Experiments/Templates), Insights (Compare/Reports/Notifications/Search/Team Directory) — no Admin group (correct for HOD role). API-driven, not hardcoded.

---

## External Integration Decisions Required

### DECISION-001 — Empower (Waters CDS) Integration
**Legacy:** `AdEmpowerController`, `AtrTestController.convertChromatogram()`, `ArdEmpowerServerConnection` entity.  
**ELN3 status:** BLOCKED — no Empower server/credentials.  
**Impact:** Chromatography section is static; sample sets cannot be created/retrieved from Empower.  
**Required:** Is Empower in scope? Server URL, API credentials, Waters API version.

### DECISION-002 — Stability Module Integration  
**Legacy:** `StabilityController` in ard-service-java at `/stabilityArdWS/`.  
**ELN3 status:** BLOCKED.  
**Required:** Is Stability module in scope?

---

## Data Isolation Risks (Phase 8 Verification Pending)

### RISK-001 — P0: FIXED — Project membership now server-side enforced
**Was:** `list_projects` and `get_project` in `projects.py` used `_ = Depends(require_ard_department)` without `current_user`, returning ALL department projects to any ARD user.  
**Fix (2026-08-01):** Added `current_user = Depends(get_current_user)` to both endpoints. `list_projects` now: HOD/Admin/QA see all; everyone else sees only projects where they are `created_by_id`, `owner_id`, or in the `team` JSON array. `get_project` now calls `_assert_project_read()` which enforces the same rules. Browser verification: analyst sees 0 projects (server-enforced), HOD sees all 7.  
**ATR read guard also verified:** HTTP 403 returned when analyst attempts to GET a superadmin's ATR by UUID directly. `_assert_atr_read` in `atr.py` enforces at line 202-207.

### RISK-002 — P0: VERIFIED PASS — Notebook scope already enforced
**Verification (2026-08-01):** `list_notebooks` already filters by `created_by_id == user.id` for non-HOD/Admin roles. Analyst: 0 notebooks, HOD: 7. No fix needed.

### RISK-003 — P0: VERIFIED PASS — External requester ATR isolation enforced
**Verification (2026-08-01):** `list_atrs` forces `effective_scope = "mine"` for `is_external_requester(user)` and overrides any requested `scope=all` with 403. Server-side, not UI-only. Code confirmed in `atr.py` lines 172-174.

### RISK-004 — P1: FIXED — Audit trail API had no role enforcement
**Was:** `GET /ard/audit` was protected only by `require_ard_department` — any ARD user could call it directly and read the full GxP audit log (who did what across all ATRs, experiments, projects). The UI guard (`ArdAdminRoute`) was UI-only.  
**Fix (2026-08-02):** `backend/app/modules/ard/audit.py` — added `_require_audit_access(user)` which raises HTTP 403 for any role outside `{"SUPER_ADMIN", "HOD"}`. Also fixed variable shadow: loop variable renamed `audit_user` to avoid clobbering the `user` (current requestor) parameter.  
**Browser-verified:** ad.analyst navigating to `/ard/audit` is redirected by the UI guard. Server enforcement verified by code review (backend enforces HOD/SUPER_ADMIN).

---

## Workflow State Machine — Confirmed Gaps

| Legacy Status | In ELN3? | Gap |
|--------------|---------|-----|
| LOGGED (=NEW) | PARTIAL — ELN3 uses "NEW" | Naming difference, functionally equivalent |
| SAVED | YES | ✓ |
| QA_PRE_APPROVAL | YES | ✓ |
| PRE_APPROVAL_REWORK | YES | ✓ |
| PENDING_CLARIFICATION | YES | ✓ |
| CLARIFIED | YES | ✓ |
| PARTIAL | YES | ✓ |
| PENDING_APPROVAL | YES | ✓ |
| APPROVED | YES | ✓ |
| VERIFIED | YES | ✓ |
| CERTIFICATION_REQUESTED | YES | ✓ |
| CERTIFICATION_REWORK | YES | ✓ |
| CERTIFIED | YES | ✓ |
| ENHANCEMENT_REQUESTED | YES | ✓ |
| REJECTED | YES | ✓ |
| WITHDRAWN | YES | ✓ |
| TENTATIVE | YES | ✓ GAP-005 / GAP-019 FIXED 2026-08-02 |
| PUBLISHED | **NO** | Not implemented |
| ACCEPTED | YES | ✓ GAP-006 FIXED 2026-08-02 |
| UNSATISFACTORY | **NO** | Listed as synonym for REJECTED in legacy |
| DELEGATED | **NO** | Delegation exists via `delegateTest` but no status |
| CANCELLED | YES | ✓ GAP-007 FIXED 2026-08-01 |
| QA_PRE_APPROVAL → PENDING_APPROVAL | ACCEPTED — "Submit Request" in QA_PRE_APPROVAL transitions to NEW (QA approval, not PENDING_APPROVAL). See NOTE above. | No gap |

---

## Architecture Differences (Confirmed Non-Issues)

| Difference | Legacy | ELN3 | Decision |
|-----------|--------|------|---------|
| Multi-tenancy | Yes (X-TenantID header) | No | Single-tenancy APPROVED |
| Company selector | Yes | No | RETIRED |
| Integer PKs | Yes | UUID PKs | APPROVED |
| JWT storage | Server-side `AdminUserSecuredToken` | Stateless JWT in localStorage | GAP-020 (security gap) |
| Role IDs (numeric) | 11301, 11302 etc | Role codes (HOD/TL/CHEM) | MAPPED |
| Three backends | ard-java, ard-service-java, Chemia | Single FastAPI | CONSOLIDATED |
| File storage | BLOB/filesystem dual-mode | `uploads/` directory | SIMPLIFIED |
| Dynamic left menu | Backend-generated per role/user | `GET /api/ard/menu` + React Query | FIXED 2026-08-02 |
| BLOB file storage | `ArdAtrresultfiles.filedata` column | Upload directory | SIMPLIFIED |

---

*This document is updated continuously as gaps are discovered and resolved.*
