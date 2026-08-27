# ARD HOD tabs: Re-assign Forms & Unsatisfactory Tests

## Context

Two new tabs, both HOD-only (`user.role_code === 'HOD'`), both living on the existing ATR list screen at `/ard/atrs` ([ArdAtrsPage.tsx](../../../frontend/src/pages/ard/ArdAtrsPage.tsx)), which already renders a `Tabs` bar (All ATRs / My Raised / QA Pre-Approval / Active In Lab / …). These are appended to that same array, gated by role.

Both features port over screens from the legacy Chemia@ ELN (screenshots supplied by the user), adapted to this app's existing data model and component conventions rather than copied pixel-for-pixel — colors/spacing follow this app's own Tailwind + AntD conventions, not the legacy blue theme.

## Feature 1: Re-assign Test — add e-signature to the existing tool

### Discovery that changed this section

While starting the implementation, `git status`/`git diff` turned up a **complete, already-working "Re-assign Test" feature** sitting uncommitted in the working tree (migration `20260827000000-add-ard-test-request-reassigned-tl.js`, model fields, backend routes, and a full frontend tab) — evidently built earlier in this same session, before context was summarized. Confirmed with the user: this existing tool **is** what they meant by "Re-assign Forms." It already covers everything originally spec'd here except one thing: e-signature.

**What already exists (verified by reading the code, not assumed):**
- `ArdTestRequest` gained `reassignedTlId` / `reassignedTlName` columns — a per-test team override that supersedes the parent ATR's own `assignedTlId` everywhere a test's team is checked (`testOut()`, `canViewTest()`, the test list's visibility clause) — [ardTests.routes.ts](../../../backend-node/src/routes/ard/ardTests.routes.ts).
- `POST /api/ard/tests/bulk-reassign-team` — HOD/SUPER_ADMIN/ADMIN only, body `{ testIds, tlId, remarks }`, updates every selected test's `reassignedTlId`/`reassignedTlName`/`testReassignRemarks` and writes an audit log entry per test.
- `GET /api/ard/tests?tlId=...` — new team filter, matches a test's *current* team (its own override if set, else its parent ATR's `assignedTlId`).
- Frontend: a `Re-assign Test` tab on `ArdAtrsPage.tsx` (HOD-only via `isHodUser`), with the "Choose Team (Team Lead)" dropdown already correctly scoped to `t.hodId === user.id` (`myLedTeams`/`myTeamTlOptions`), a "Go" button, a checkbox-selectable test table, and a "Re-assign Test" modal (destination TL from *any* team + required Remarks) calling `ardAtrApi.bulkReassignTeam()`.

**Remaining gap:** the modal calls `bulkReassignTeamMut.mutate()` directly off Remarks with no password step — this feature needs full e-signature (remarks + password), matching the user's confirmed requirement, and matching how every other significant ARD action (STP submit/approve, spec submit/approve) already re-authenticates via the shared `frontend/src/components/common/ESignatureModal.tsx` (payload `{ reason, password }`) and backend `verifyPassword(password, user.passwordHash)` from `backend-node/src/utils/auth.utils.ts`.

### Frontend change

In `ArdAtrsPage.tsx`'s Re-assign Test modal: replace the direct `onOk={() => bulkReassignTeamMut.mutate()}` with opening `ESignatureModal` first (reusing `reassignTargetTl` + `reassignRemarks` already collected), then calling `bulkReassignTeamMut.mutate({ ..., password })` from its `onConfirm`. No other UI changes — the team-scoped dropdown, table, and column set are already correct as built.

### Backend change

`POST /api/ard/tests/bulk-reassign-team`:
- Body schema gains `password: z.string()`.
- Before the update loop: `const ok = await verifyPassword(body.password, user.passwordHash); if (!ok) throw new BadRequestError('Electronic signature failed. Incorrect password.', 'ESIGNATURE_FAILED')` — same shape as `ardProjects.routes.ts`'s spec submit/approve routes.
- `ardAtrApi.bulkReassignTeam()` (frontend) gains `password` in its body type.

### Error handling

- Wrong password → 400 `ESIGNATURE_FAILED`, e-sign modal surfaces it inline, selection/remarks are preserved so the HOD doesn't have to redo the pick.
- Everything else (empty team, zero tests, zero selection, not-found test ids) is already handled by the existing implementation — unchanged.

### Testing

- Curl-verify: `bulk-reassign-team` now rejects a wrong password with `ESIGNATURE_FAILED` and performs zero updates.
- Curl-verify: correct password still reassigns exactly the selected tests, unchanged from today's behavior otherwise.
- Click-through: e-sign modal appears between "Re-assign Test" submit and the actual mutation; success/failure messaging unchanged.

## Feature 2: Unsatisfactory Tests

### Purpose

Read-only report for an HOD: every test across all of their teams currently sitting in `UNSATISFACTORY` status, so they can review what's been rejected without digging through individual ATRs.

### Bug found and required fix

`POST /api/ard/tests/:atrId/:testId/unsatisfactory` ([ardTests.routes.ts:1028](../../../backend-node/src/routes/ard/ardTests.routes.ts)) is already called by the frontend's "Mark Unsatisfactory" action with `{ remarks }` in the body ([ArdTestsPage.tsx:515](../../../frontend/src/pages/ard/ArdTestsPage.tsx)) — but the route never reads `req.body` at all. The remark the user types today is silently discarded. This must be fixed for the new tab's "Unsatisfactory Remarks" column to ever show real data:

- New migration: add `unsatisfactory_remarks TEXT` to `ard_test_requests`, matching this model's existing one-column-per-action convention (`assignRemarks`, `verifyRemarks`, `withdrawRemarks`, etc. — [ArdModels.model.ts:459-508](../../../backend-node/src/models/ArdModels.model.ts)).
- Model: add `unsatisfactoryRemarks: CreationOptional<string | null>` to `ArdTestRequest`.
- Route: read `remarks` from `req.body`, save it as `unsatisfactoryRemarks` alongside the status change.

### Frontend

New tab `Unsatisfactory Tests` in `ArdAtrsPage.tsx`, HOD-only. Content:

1. **From / To** date pickers, plus an **"Include Date"** checkbox — unchecked by default, meaning the date range is ignored and every unsatisfactory test across the HOD's teams is shown; checking it applies the From/To filter. (This is my read of that checkbox from the screenshot — flag it if the intent was different.)
2. **Table**: Project Code, Product Name, **Department** (new column — same value as the ATR list's existing "Source" column: `ADC` / `CGT` / `ARD`, i.e. `originModule`), Sample Code, Batch No., Test/SubType, Test No. (the test's AR Number), Unsatisfactory Remarks.
3. **Export CSV** button, matching the existing one on the main ATR tab (`exportCsv` pattern already in `ArdAtrsPage.tsx`).
4. No team picker (confirmed with user) — pools every team the HOD owns automatically.

Explicitly **not** replicating the "Select Project" bar visible in the user's screenshots — that's the legacy app's persistent header chrome present on every one of its pages, not a control specific to this tab, and this app has no equivalent global project-switcher to hook into.

### Backend

New `GET /api/ard/tests/unsatisfactory-report` — query params `from?`, `to?`, `applyDate?` (boolean, mirrors "Include Date").

- Auth: `HOD` or `SUPER_ADMIN` only.
- Resolve every `ArdTeam` where `hodId = user.id`, collect the union of their `tlIds`.
- Query `ArdTestRequest` where `status = 'UNSATISFACTORY'`, joined through `ArdAtrSample` → `ArdAtrForm`, filtering `ArdAtrForm.assignedTlId IN (that tlIds set)`.
- If `applyDate` is true, additionally filter `ArdTestRequest.updatedAt BETWEEN from AND to` — `UNSATISFACTORY` is already a terminal status (confirmed at [ardTests.routes.ts:939](../../../backend-node/src/routes/ard/ardTests.routes.ts)), so `updatedAt` reliably reflects "when it was marked unsatisfactory."
- Response includes each `ArdAtrForm`'s `originModule` (for the Department column), `projectCode`, `productName`; each `ArdAtrSample`'s `sampleCode`, `batchNo`; and the test's `testType`/`testSubtype`, `arNumber`, `unsatisfactoryRemarks`.

### Error handling

- No teams owned by this HOD → empty table, no error.
- `from` after `to` with `applyDate` checked → 400 with a clear message.

### Testing

- Curl-verify the migration + model field round-trip (mark a test unsatisfactory with remarks, confirm it's persisted, not just echoed back in the response).
- Curl-verify an HOD only ever sees tests from their own teams, never another HOD's.
- Curl-verify the date filter is truly bypassed when `applyDate=false`, and correctly bounds results when `true`.

## Out of scope

- No changes to the existing single-ATR "Reassign Team Lead" button/endpoint (`assign-tl`) at all — it's a separate, unrelated flow from the "Re-assign Test" tool this spec touches.
- No changes to how a test gets marked unsatisfactory in the first place (workflow/permissions there are untouched — only the remarks-persistence bug is fixed).
- No new permission model — both tabs reuse the existing plain role-code check pattern (`role_code === 'HOD'`) already used throughout ARD, not the privilege-table system ADC/CGT use.
