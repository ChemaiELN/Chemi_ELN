# ARD HOD Tabs (Re-assign Test e-sign + Unsatisfactory Tests) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add e-signature to the already-built "Re-assign Test" tool, and add a new "Unsatisfactory Tests" report tab — both HOD-only tabs on the ATR list screen (`/ard/atrs`).

**Architecture:** Two independent slices sharing one frontend file (`ArdAtrsPage.tsx`) and one backend routes file (`ardTests.routes.ts`). Feature 1 touches one existing route + one existing modal. Feature 2 adds one migration, one model field, fixes one existing route's persistence bug, adds one new backend endpoint, and adds one new frontend tab. No new files are created except the migration.

**Tech Stack:** Express + Sequelize + Zod (backend), React + AntD + TanStack Query (frontend), Jest (backend unit tests — this codebase has none for Express routes; route-level changes here are verified via curl against the running dev server, matching how every other ARD route change in this project has been verified, not via a Jest/supertest suite that doesn't exist for this router).

## Global Constraints

- E-signature password checks use `verifyPassword(password, user.passwordHash)` from `backend-node/src/utils/auth.utils.ts`, thrown as `BadRequestError('Electronic signature failed. Incorrect password.', 'ESIGNATURE_FAILED')` on mismatch — the same unconditional (not admin-toggle-gated) pattern already used by `ardProjects.routes.ts`'s spec submit/approve routes. This file's OTHER e-signed actions use the toggle-based `enforceEsignature`/`ESIGN_FLAGS` helper (off by default, admin-configurable) — deliberately NOT used here, since the user requires e-signature unconditionally for this action, not as an opt-in setting.
- Both new/changed tabs are gated by the existing `isHodUser` flag already defined in `ArdAtrsPage.tsx` (`['HOD', 'HEAD_OF_DEPT', 'MANAGER'].includes(user?.role_code ?? '')`) for the frontend, and role-code array checks (no privilege-table lookups) on the backend, matching the whole ARD module's existing convention.
- Migrations run via `npx sequelize-cli db:migrate` from `backend-node/`.
- After every backend change: `cd backend-node && npx tsc --noEmit`. After every frontend change: `cd frontend && npx tsc --noEmit`. Both must be clean before moving to the next task.

---

### Task 1: Migration + model field for `unsatisfactory_remarks`

**Files:**
- Create: `backend-node/src/database/migrations/20260827010000-add-unsatisfactory-remarks.js`
- Modify: `backend-node/src/models/ArdModels.model.ts:501` (add field declaration + init entry, right next to the existing `testReassignRemarks`)

**Interfaces:**
- Produces: `ArdTestRequest.unsatisfactoryRemarks: string | null` — consumed by Task 2 (route persists it) and Task 3 (report reads it via the existing `testOut()` spread, no extra wiring needed there).

- [ ] **Step 1: Write the migration**

```js
'use strict'

// The "Mark Unsatisfactory" action already lets the user type a remark
// (ArdTestsPage.tsx sends { remarks } to POST /:atrId/:testId/unsatisfactory)
// but the route has never had a column to persist it into — see Task 2.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_test_requests', 'unsatisfactory_remarks', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_test_requests', 'unsatisfactory_remarks')
  },
}
```

- [ ] **Step 2: Run the migration**

Run: `cd backend-node && npx sequelize-cli db:migrate`
Expected: output includes `== 20260827010000-add-unsatisfactory-remarks: migrated`

- [ ] **Step 3: Add the model field**

In `backend-node/src/models/ArdModels.model.ts`, inside the `ArdTestRequest` class declaration, right after the existing line:

```ts
  declare testReassignRemarks: CreationOptional<string | null>
```

add:

```ts
  declare unsatisfactoryRemarks: CreationOptional<string | null>
```

And inside `ArdTestRequest.init({...})`, right after the existing line:

```ts
  testReassignRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'test_reassign_remarks' },
```

add:

```ts
  unsatisfactoryRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'unsatisfactory_remarks' },
```

- [ ] **Step 4: Typecheck**

Run: `cd backend-node && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend-node/src/database/migrations/20260827010000-add-unsatisfactory-remarks.js backend-node/src/models/ArdModels.model.ts
git commit -m "Add unsatisfactory_remarks column to ard_test_requests"
```

---

### Task 2: Persist remarks when a test is marked unsatisfactory

**Files:**
- Modify: `backend-node/src/routes/ard/ardTests.routes.ts:1028-1046` (the `POST /:atrId/:testId/unsatisfactory` route)

**Interfaces:**
- Consumes: `ArdTestRequest.unsatisfactoryRemarks` (Task 1).
- Produces: nothing new consumed elsewhere in this plan — this is a standalone bug fix. `ArdTestsPage.tsx` already sends `{ remarks }` in its request body (line 515) and needs no frontend change.

- [ ] **Step 1: Confirm the current (broken) behavior with curl**

With the backend dev server running and a valid bearer token for a user who can mark a `VERIFIED` test unsatisfactory, pick any test currently in `VERIFIED` or `PUBLISHED` status and run:

```bash
curl -s -X POST http://localhost:8000/api/ard/tests/<atrId>/<testId>/unsatisfactory \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"remarks":"Out of spec — retest required"}' | jq
```

Then fetch the test back and confirm `unsatisfactoryRemarks` is absent/`null` even though a remark was sent — that's the bug this task fixes. (Skip this confirmation step if you don't have a test in the right status handy; Step 4 below re-verifies the fixed behavior either way.)

- [ ] **Step 2: Fix the route**

In `backend-node/src/routes/ard/ardTests.routes.ts`, replace:

```ts
      await recordTestHistory((test as any).id, 'UNSATISFACTORY', user.id, user.username)
      await test.update({ status: 'UNSATISFACTORY' })
      return res.json(successResponse('Test marked unsatisfactory', test))
```

with:

```ts
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks : null
      await recordTestHistory((test as any).id, 'UNSATISFACTORY', user.id, user.username, remarks ?? undefined)
      await test.update({ status: 'UNSATISFACTORY', unsatisfactoryRemarks: remarks })
      return res.json(successResponse('Test marked unsatisfactory', test))
```

(`recordTestHistory`'s optional 5th param already exists — passing the remark through means it also shows up in the test's audit trail, not just the new column.)

- [ ] **Step 3: Typecheck**

Run: `cd backend-node && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the fix with curl**

Repeat the Step 1 curl call against a different `VERIFIED`/`PUBLISHED` test, then:

```bash
curl -s http://localhost:8000/api/ard/tests/<atrId>/<testId> -H "Authorization: Bearer <token>" | jq '.unsatisfactoryRemarks'
```

Expected: `"Out of spec — retest required"` (or whatever remark you sent) — not `null`.

- [ ] **Step 5: Commit**

```bash
git add backend-node/src/routes/ard/ardTests.routes.ts
git commit -m "Persist remarks when a test is marked unsatisfactory"
```

---

### Task 3: `GET /api/ard/tests/unsatisfactory-report` endpoint

**Files:**
- Modify: `backend-node/src/routes/ard/ardTests.routes.ts` (add a new route; place it right after the `bulk-reassign-team` route at line 376, before the `GET /:atrId/:testId` route)

**Interfaces:**
- Consumes: `TEST_CONTEXT_INCLUDE` and `testOut()` (both already defined earlier in this same file, lines 120-165) — reused as-is, no changes needed to either.
- Produces: `GET /api/ard/tests/unsatisfactory-report?applyDate=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD` → JSON array of test objects (same shape `testOut()` already produces everywhere else — `formNo`, `projectCode`, `productName`, `sampleCode`, `batchNo`, `sourceDept`, `testType`, `testSubtype`, `arNumber`, `unsatisfactoryRemarks`, etc.). Consumed by Task 6 (frontend tab).

- [ ] **Step 1: Add the route**

In `backend-node/src/routes/ard/ardTests.routes.ts`, immediately after the closing `})` of the `bulk-reassign-team` route (line 376), insert:

```ts
// GET /unsatisfactory-report — HOD's cross-team view of every test currently
// UNSATISFACTORY across every team they lead (not just one team at a time,
// unlike the tlId filter above — this pools all of them). Optionally bounded
// by a date range on updatedAt: UNSATISFACTORY is a terminal status (see the
// `terminal` list further down in this file), so nothing updates a test's
// row after it lands in this status — updatedAt reliably means "when it was
// marked unsatisfactory."
ardTestRouter.get('/unsatisfactory-report', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRole(req, ['HOD', 'SUPER_ADMIN'])
    const user = (req as any).user

    const myTeams = await ArdTeam.findAll({ where: { hodId: user.id }, attributes: ['tlIds'] })
    const tlIds = Array.from(new Set(myTeams.flatMap((t: any) => (t.tlIds ?? []) as string[])))

    const and: any[] = [{ status: 'UNSATISFACTORY' }]
    if (tlIds.length > 0) {
      and.push({
        [Op.or]: [
          { reassignedTlId: { [Op.in]: tlIds } },
          { reassignedTlId: { [Op.is]: null }, '$sample.atrForm.assigned_tl_id$': { [Op.in]: tlIds } },
        ],
      })
    } else {
      // This HOD leads no teams — never fall through to "no team filter at
      // all" (which would leak every other HOD's tests); force zero rows.
      and.push({ id: null })
    }

    if (req.query.applyDate === 'true') {
      const from = req.query.from ? new Date(req.query.from as string) : null
      const to = req.query.to ? new Date(req.query.to as string) : null
      if (from && to && from.getTime() > to.getTime()) {
        throw new BadRequestError('"From" date must be before "To" date')
      }
      const dateWhere: any = {}
      if (from) dateWhere[Op.gte] = from
      if (to) dateWhere[Op.lte] = to
      if (from || to) and.push({ updatedAt: dateWhere })
    }

    const tests = await ArdTestRequest.findAll({
      where: { [Op.and]: and },
      include: TEST_CONTEXT_INCLUDE as any,
      order: [['updatedAt', 'DESC']],
      subQuery: false,
    })

    return res.json(successResponse('Unsatisfactory tests', tests.map(testOut)))
  } catch (err) {
    next(err)
  }
})
```

**Route-ordering note:** this MUST be registered before `ardTestRouter.get('/:atrId/:testId', ...)` further down in the file — Express matches routes in registration order, and `/:atrId/:testId` would otherwise swallow `/unsatisfactory-report` as if `unsatisfactory-report` were an `:atrId` value. Since you're inserting it right after `bulk-reassign-team` (which is already above the `/:atrId/:testId` route), this is already correctly ordered — just don't move it below that route later.

- [ ] **Step 2: Typecheck**

Run: `cd backend-node && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify with curl, scoped correctly**

As an HOD user who leads at least one team with at least one UNSATISFACTORY test in it:

```bash
curl -s "http://localhost:8000/api/ard/tests/unsatisfactory-report" -H "Authorization: Bearer <hod-token>" | jq 'length, .[0]'
```

Expected: a count ≥ 1, and the first object has non-null `projectCode`, `sourceDept`, `testType`, and (if you completed Task 2 against one of these specific tests) `unsatisfactoryRemarks`.

Then as an HOD who leads a *different* team (or the same HOD, but check the returned rows' `assignedTlId`/`assignedTl` values), confirm no row belongs to a team this HOD doesn't lead.

- [ ] **Step 4: Verify date filtering**

```bash
curl -s "http://localhost:8000/api/ard/tests/unsatisfactory-report?applyDate=true&from=2099-01-01&to=2099-01-02" -H "Authorization: Bearer <hod-token>" | jq 'length'
```

Expected: `0` (a date range far in the future excludes everything). Then re-run with `applyDate=false` (or omit it) and confirm the earlier non-zero count comes back.

- [ ] **Step 5: Verify role gate**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/api/ard/tests/unsatisfactory-report" -H "Authorization: Bearer <analyst-token>"
```

Expected: `403`.

- [ ] **Step 6: Commit**

```bash
git add backend-node/src/routes/ard/ardTests.routes.ts
git commit -m "Add GET /api/ard/tests/unsatisfactory-report endpoint"
```

---

### Task 4: E-signature on the backend `bulk-reassign-team` endpoint

**Files:**
- Modify: `backend-node/src/routes/ard/ardTests.routes.ts:1` (import) and `:340-376` (the route body)

**Interfaces:**
- Produces: `POST /api/ard/tests/bulk-reassign-team` now requires `password` in its body — consumed by Task 5 (frontend).

- [ ] **Step 1: Add the import**

In `backend-node/src/routes/ard/ardTests.routes.ts`, add to the top-level imports (near the other `../../utils/*` imports, e.g. right after the `errors` import on line 7):

```ts
import { verifyPassword } from '../../utils/auth.utils'
```

- [ ] **Step 2: Require and verify the password**

Replace:

```ts
    const body = z.object({
      testIds: z.array(z.string()).min(1),
      tlId: z.string(),
      remarks: z.string().min(1),
    }).parse(req.body)

    const targetTl = await User.findByPk(body.tlId)
```

with:

```ts
    const body = z.object({
      testIds: z.array(z.string()).min(1),
      tlId: z.string(),
      remarks: z.string().min(1),
      password: z.string().min(1),
    }).parse(req.body)

    // This bulk, cross-team ownership change always requires e-signature —
    // unlike this file's other ESIGN_FLAGS-gated actions (which are
    // admin-toggle, off by default), this one is unconditional, matching
    // ardProjects.routes.ts's spec submit/approve routes.
    const passwordValid = await verifyPassword(body.password, user.passwordHash)
    if (!passwordValid) {
      throw new BadRequestError('Electronic signature failed. Incorrect password.', 'ESIGNATURE_FAILED')
    }

    const targetTl = await User.findByPk(body.tlId)
```

- [ ] **Step 3: Typecheck**

Run: `cd backend-node && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify with curl — wrong password rejected, no side effects**

Pick a test currently NOT reassigned (no `reassignedTlId` set) and try to reassign it with a deliberately wrong password:

```bash
curl -s -X POST http://localhost:8000/api/ard/tests/bulk-reassign-team \
  -H "Authorization: Bearer <hod-token>" -H "Content-Type: application/json" \
  -d '{"testIds":["<testId>"],"tlId":"<some-tl-user-id>","remarks":"test","password":"definitely-wrong"}' | jq
```

Expected: `400` with `error.code: "ESIGNATURE_FAILED"`. Then fetch that test back (`GET /api/ard/tests/<atrId>/<testId>`) and confirm `reassignedTlId` is still `null` — the rejected request made no changes.

- [ ] **Step 5: Verify with curl — correct password still works**

Same call with the HOD's real password:

```bash
curl -s -X POST http://localhost:8000/api/ard/tests/bulk-reassign-team \
  -H "Authorization: Bearer <hod-token>" -H "Content-Type: application/json" \
  -d '{"testIds":["<testId>"],"tlId":"<some-tl-user-id>","remarks":"test","password":"<hod-real-password>"}' | jq
```

Expected: `200` with `{"updatedCount":1}`, and the test now has `reassignedTlId` set to the target TL's id.

- [ ] **Step 6: Commit**

```bash
git add backend-node/src/routes/ard/ardTests.routes.ts
git commit -m "Require e-signature on bulk test team reassignment"
```

---

### Task 5: Frontend — wire e-signature into the Re-assign Test modal

**Files:**
- Modify: `frontend/src/api/ard.ts` (the `bulkReassignTeam` method's body type)
- Modify: `frontend/src/pages/ard/ArdAtrsPage.tsx` (imports, the `bulkReassignTeamMut` mutation, add e-sign modal state, the "Re-assign Test" `Modal`'s `onOk`, and a new `ESignatureModal`)

**Interfaces:**
- Consumes: `POST /api/ard/tests/bulk-reassign-team` now requiring `password` (Task 4); `ESignatureModal` from `frontend/src/components/common/ESignatureModal.tsx` (existing component, props: `{ open, title?, description?, userName, requireReason?, loading?, onCancel, onConfirm: (payload: {userName, password, reason?}) => void|Promise<void> }`).

- [ ] **Step 1: Add `password` to the API client method**

In `frontend/src/api/ard.ts`, replace:

```ts
  bulkReassignTeam: (body: { testIds: string[]; tlId: string; remarks: string }) =>
    apiPost<{ updatedCount: number }>('/api/ard/tests/bulk-reassign-team', body),
```

with:

```ts
  bulkReassignTeam: (body: { testIds: string[]; tlId: string; remarks: string; password: string }) =>
    apiPost<{ updatedCount: number }>('/api/ard/tests/bulk-reassign-team', body),
```

- [ ] **Step 2: Typecheck (expect a break — that's the point)**

Run: `cd frontend && npx tsc --noEmit`
Expected: an error at the current `bulkReassignTeamMut.mutationFn` call site in `ArdAtrsPage.tsx` — it's missing the now-required `password` field. This confirms the type change took effect; Step 3 fixes the call site.

- [ ] **Step 3: Add the import and e-sign modal state**

In `frontend/src/pages/ard/ArdAtrsPage.tsx`, add to the imports:

```ts
import { ESignatureModal } from '../../components/common/ESignatureModal'
```

Add one new piece of state next to the existing Re-assign Test state (`reassignModalOpen`, `reassignTargetTl`, `reassignRemarks`):

```ts
  const [reassignEsignOpen, setReassignEsignOpen] = useState(false)
```

- [ ] **Step 4: Update the mutation to accept a password and reset the e-sign modal too**

Replace:

```ts
  const bulkReassignTeamMut = useMutation({
    mutationFn: () => ardAtrApi.bulkReassignTeam({ testIds: reassignSelectedIds, tlId: reassignTargetTl!, remarks: reassignRemarks }),
    onSuccess: (res) => {
      msg.success(`Reassigned ${res.updatedCount} test${res.updatedCount !== 1 ? 's' : ''}.`)
      setReassignModalOpen(false)
      setReassignTargetTl(undefined)
      setReassignRemarks('')
      setReassignSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-reassign-tests'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to reassign tests.'),
  })
```

with:

```ts
  const bulkReassignTeamMut = useMutation({
    mutationFn: (password: string) =>
      ardAtrApi.bulkReassignTeam({ testIds: reassignSelectedIds, tlId: reassignTargetTl!, remarks: reassignRemarks, password }),
    onSuccess: (res) => {
      msg.success(`Reassigned ${res.updatedCount} test${res.updatedCount !== 1 ? 's' : ''}.`)
      setReassignModalOpen(false)
      setReassignEsignOpen(false)
      setReassignTargetTl(undefined)
      setReassignRemarks('')
      setReassignSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-reassign-tests'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to reassign tests.'),
  })
```

- [ ] **Step 5: Make the Re-assign Test modal open the e-sign step instead of mutating directly**

Replace:

```tsx
      {/* Re-assign Test modal — pick the destination team + mandatory remarks */}
      <Modal
        {...glassModalProps}
        title="Re-assign Test"
        open={reassignModalOpen}
        onCancel={() => setReassignModalOpen(false)}
        onOk={() => bulkReassignTeamMut.mutate()}
        confirmLoading={bulkReassignTeamMut.isPending}
        okText="Save"
        okButtonProps={{ disabled: !reassignTargetTl || !reassignRemarks.trim() }}
      >
```

with:

```tsx
      {/* Re-assign Test modal — pick the destination team + mandatory remarks,
          then a required e-signature step (password) before the mutation fires */}
      <Modal
        {...glassModalProps}
        title="Re-assign Test"
        open={reassignModalOpen}
        onCancel={() => setReassignModalOpen(false)}
        onOk={() => setReassignEsignOpen(true)}
        okText="Continue"
        okButtonProps={{ disabled: !reassignTargetTl || !reassignRemarks.trim() }}
      >
```

(The `confirmLoading` prop is dropped from this first modal — loading now shows on the e-sign modal instead, added in Step 6.)

- [ ] **Step 6: Add the e-signature modal**

Immediately after the closing `</Modal>` of the Re-assign Test modal (from Step 5), add:

```tsx
      <ESignatureModal
        open={reassignEsignOpen}
        title="Re-assign Test (E-Signature)"
        description="Re-authenticate with your password to confirm this team reassignment."
        userName={user?.username || 'Current User'}
        requireReason={false}
        loading={bulkReassignTeamMut.isPending}
        onCancel={() => setReassignEsignOpen(false)}
        onConfirm={async (payload) => {
          await bulkReassignTeamMut.mutateAsync(payload.password)
        }}
      />
```

(`requireReason={false}` because Remarks were already collected in the modal from Step 5 — the e-sign step here is password-only, matching this component's existing support for that combination.)

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (the Step 2 error is now resolved).

- [ ] **Step 8: Click-through verification**

With the frontend dev server running and logged in as an HOD:
1. Go to `/ard/atrs` → "Re-assign Test" tab → pick a team → "Go".
2. Select a test, click "Re-assign", fill in TL + Remarks, click "Continue".
3. Confirm the "Re-assign Test (E-Signature)" modal appears with a password field (and no separate reason field, since remarks were already collected).
4. Enter the wrong password → confirm an error message appears and the modal stays open.
5. Enter the correct password → confirm success message, both modals close, and the reassigned test drops out of the team's list (since it moved to a different team).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api/ard.ts frontend/src/pages/ard/ArdAtrsPage.tsx
git commit -m "Require e-signature in the Re-assign Test UI"
```

---

### Task 6: Frontend — "Unsatisfactory Tests" tab

**Files:**
- Modify: `frontend/src/api/ard.ts` (extend `ArdTestRow`, add `unsatisfactoryReport` method)
- Modify: `frontend/src/pages/ard/ArdAtrsPage.tsx` (imports, tab registration, a new `UnsatisfactoryTestsPanel` component, CSV export)

**Interfaces:**
- Consumes: `GET /api/ard/tests/unsatisfactory-report` (Task 3).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Extend `ArdTestRow` and add the API method**

In `frontend/src/api/ard.ts`, replace the existing `ArdTestRow` interface:

```ts
export interface ArdTestRow {
  id: string
  atrId: string
  formNo: string
  projectCode: string | null
  productName: string | null
  sampleCode: string | null
  batchNo: string | null
  testType: string
  testSubtype: string | null
  status: string
  assignedTlId: string | null
  assignedTl: string | null
  requestedBy: string | null
  requestedOn: string | null
  remarks: string | null
}
```

with (adding the three fields the Unsatisfactory Tests report needs — `testOut()` already returns all of these on every test row, this interface just didn't declare them yet):

```ts
export interface ArdTestRow {
  id: string
  atrId: string
  formNo: string
  projectCode: string | null
  productName: string | null
  sampleCode: string | null
  batchNo: string | null
  testType: string
  testSubtype: string | null
  status: string
  assignedTlId: string | null
  assignedTl: string | null
  requestedBy: string | null
  requestedOn: string | null
  remarks: string | null
  arNumber: string | null
  sourceDept: string | null
  unsatisfactoryRemarks: string | null
}
```

Then add this method to `ardAtrApi`, right after `bulkReassignTeam`:

```ts
  unsatisfactoryReport: (params?: { applyDate?: boolean; from?: string; to?: string }) =>
    apiGet<ArdTestRow[]>('/api/ard/tests/unsatisfactory-report', params),
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Add imports and tab registration**

In `frontend/src/pages/ard/ArdAtrsPage.tsx`:

Extend the antd import line — replace:

```ts
import { Table, Tag, Input, Select, Button, Tabs, Card, Modal, message, Popconfirm, Space } from 'antd'
```

with:

```ts
import { Table, Tag, Input, Select, Button, Tabs, Card, Modal, message, Popconfirm, Space, DatePicker, Checkbox } from 'antd'
```

Add the new tab to `tabItems`, right after the existing `re_assign` entry:

```ts
    ...(isHodUser ? [{ key: 're_assign', label: 'Re-assign Test' }] : []),
    ...(isHodUser ? [{ key: 'unsatisfactory', label: 'Unsatisfactory Tests' }] : []),
```

Add a derived flag next to `isReassignTab`:

```ts
  const isUnsatisfactoryTab = activeTab === 'unsatisfactory'
```

And extend the condition that hides the search/filter bar for the Re-assign Test tab — replace:

```tsx
          {!isReassignTab && (
```

with:

```tsx
          {!isReassignTab && !isUnsatisfactoryTab && (
```

- [ ] **Step 4: Render the new panel**

Replace:

```tsx
        {isReassignTab ? (
          <ReassignTestPanel
            myTeamTlOptions={myTeamTlOptions}
            allTlOptions={allTlOptions}
            reassignTeamTlId={reassignTeamTlId}
            setReassignTeamTlId={setReassignTeamTlId}
            onGo={() => { setActiveReassignTlId(reassignTeamTlId); setReassignSelectedIds([]) }}
            reassignSearch={reassignSearch}
            setReassignSearch={setReassignSearch}
            tests={reassignTests}
            loading={reassignTestsLoading}
            activeReassignTlId={activeReassignTlId}
            selectedIds={reassignSelectedIds}
            setSelectedIds={setReassignSelectedIds}
            onReassignClick={() => setReassignModalOpen(true)}
          />
        ) : (
```

with:

```tsx
        {isReassignTab ? (
          <ReassignTestPanel
            myTeamTlOptions={myTeamTlOptions}
            allTlOptions={allTlOptions}
            reassignTeamTlId={reassignTeamTlId}
            setReassignTeamTlId={setReassignTeamTlId}
            onGo={() => { setActiveReassignTlId(reassignTeamTlId); setReassignSelectedIds([]) }}
            reassignSearch={reassignSearch}
            setReassignSearch={setReassignSearch}
            tests={reassignTests}
            loading={reassignTestsLoading}
            activeReassignTlId={activeReassignTlId}
            selectedIds={reassignSelectedIds}
            setSelectedIds={setReassignSelectedIds}
            onReassignClick={() => setReassignModalOpen(true)}
          />
        ) : isUnsatisfactoryTab ? (
          <UnsatisfactoryTestsPanel />
        ) : (
```

- [ ] **Step 5: Write the `UnsatisfactoryTestsPanel` component**

Add this new function at the bottom of `frontend/src/pages/ard/ArdAtrsPage.tsx`, right after the existing `ReassignTestPanel` function's closing `}`:

```tsx
function UnsatisfactoryTestsPanel() {
  const [applyDate, setApplyDate] = useState(false)
  const [from, setFrom] = useState<Dayjs | null>(dayjs().subtract(1, 'month'))
  const [to, setTo] = useState<Dayjs | null>(dayjs())

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ard-unsatisfactory-report', applyDate, from?.format('YYYY-MM-DD'), to?.format('YYYY-MM-DD')],
    queryFn: () => ardAtrApi.unsatisfactoryReport({
      applyDate,
      from: from ? from.format('YYYY-MM-DD') : undefined,
      to: to ? to.format('YYYY-MM-DD') : undefined,
    }),
  })
  const rows = data ?? []

  const exportUnsatCsv = () => {
    const csvRows = [
      ['Project Code', 'Product Name', 'Department', 'Sample Code', 'Batch No.', 'Test/SubType', 'Test No.', 'Unsatisfactory Remarks'],
      ...rows.map(r => [
        r.projectCode || '', `"${r.productName || ''}"`, r.sourceDept || '', r.sampleCode || '',
        r.batchNo || '', `${r.testType}${r.testSubtype ? ` / ${r.testSubtype}` : ''}`,
        r.arNumber || '', `"${(r.unsatisfactoryRemarks || '').replace(/"/g, '""')}"`,
      ]),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `unsatisfactory_tests_${dayjs().format('YYYYMMDD')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Checkbox checked={applyDate} onChange={(e) => setApplyDate(e.target.checked)}>
          Include Date
        </Checkbox>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">From</label>
          <DatePicker value={from} onChange={setFrom} disabled={!applyDate} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">To</label>
          <DatePicker value={to} onChange={setTo} disabled={!applyDate} />
        </div>
        <Button type="primary" onClick={() => refetch()} loading={isFetching} className="bg-emerald-600 hover:bg-emerald-700 border-none">
          Search
        </Button>
        <Button icon={<Download size={14} />} onClick={exportUnsatCsv} className="text-slate-600 ml-auto">
          Export CSV
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `${t} tests` }}
        columns={[
          { title: 'Project Code', dataIndex: 'projectCode', render: (v) => v || '—' },
          { title: 'Product Name', dataIndex: 'productName', render: (v) => v || '—' },
          { title: 'Department', dataIndex: 'sourceDept', render: (v) => <Tag className="text-xs">{v || 'ARD'}</Tag> },
          { title: 'Sample Code', dataIndex: 'sampleCode', render: (v) => v || '—' },
          { title: 'Batch No.', dataIndex: 'batchNo', render: (v) => v || '—' },
          { title: 'Test/SubType', render: (_, r) => <span>{r.testType}{r.testSubtype ? ` / ${r.testSubtype}` : ''}</span> },
          { title: 'Test No.', dataIndex: 'arNumber', render: (v) => v || '—' },
          { title: 'Unsatisfactory Remarks', dataIndex: 'unsatisfactoryRemarks', render: (v) => v || '—' },
        ]}
      />
    </div>
  )
}
```

This needs one more import — `Dayjs` as a type, for the `useState<Dayjs | null>` calls. Add it to the existing `dayjs` import line — replace:

```ts
import dayjs from 'dayjs'
```

with:

```ts
import dayjs, { type Dayjs } from 'dayjs'
```

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Click-through verification**

As an HOD with at least one unsatisfactory test on one of their teams:
1. Go to `/ard/atrs` → "Unsatisfactory Tests" tab.
2. Confirm the table loads with rows immediately (no date filter applied by default — "Include Date" starts unchecked).
3. Confirm the Department column shows the correct source module tag, and Unsatisfactory Remarks shows real text for any test you fixed via Task 2 (not "—").
4. Check "Include Date", narrow the From/To range to exclude all known unsatisfactory tests, click "Search" — confirm the table goes empty.
5. Widen the range back, click "Search" — confirm rows return.
6. Click "Export CSV" — confirm a file downloads with the 8 expected columns and correct data.
7. Log in as a *different* HOD (or a non-HOD role) — confirm the "Unsatisfactory Tests" tab either doesn't appear (non-HOD) or only shows that HOD's own teams' tests (different HOD).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/ard.ts frontend/src/pages/ard/ArdAtrsPage.tsx
git commit -m "Add Unsatisfactory Tests report tab"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 (Discovery/Frontend/Backend/Error handling/Testing sections) → Tasks 4-5. Feature 2 (Bug fix/Frontend/Backend/Error handling/Testing sections) → Tasks 1-3, 6. All spec sections have a corresponding task.
- **Type consistency:** `ArdTestRow` (Task 6) is the same interface both `listTests` (existing) and `unsatisfactoryReport` (new) return — extended, not duplicated. `bulkReassignTeam`'s body type (Task 5, Step 1) matches exactly what Task 4's backend schema now requires (`testIds`, `tlId`, `remarks`, `password`). `ESignatureModal`'s `onConfirm` payload shape (`{ userName, password, reason? }`) matches how Task 5 Step 6 destructures `payload.password`.
- **Out of scope confirmed:** no changes to the single-ATR `assign-tl` endpoint, no changes to test-marking workflow/permissions beyond the remarks bug, no privilege-table integration.
