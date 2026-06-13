# Frontend ↔ Backend Sync Plan

All changes are confined to `src/utilities/chemiaApi.ts` and the components/pages that
consume the affected functions. No backend changes are required — the backend is the
source of truth.

---

## Phase 1 — Critical URL Fixes (broken right now, zero logic change)

These are simple string fixes. Every one of them returns a 404 or hits the wrong
endpoint today.

| # | File | Function | Old URL | New URL |
|---|------|----------|---------|---------|
| 1 | chemiaApi.ts | `getAuditLog()` | `/api/admin/audit` | `/api/admin/audit-logs` |
| 2 | chemiaApi.ts | `getRoles()` | `/api/admin/roles` | `/api/roles` |
| 3 | chemiaApi.ts | `getExperimentAttachments()` | `/api/experiments/{id}/attachments` | `/api/experiments/{id}/files` |
| 4 | chemiaApi.ts | `uploadExperimentAttachment()` | `/api/experiments/{id}/attachments` | `/api/experiments/{id}/files` |
| 5 | chemiaApi.ts | `deleteExperimentAttachment()` | `/api/experiments/{id}/attachments/{attId}` | `/api/experiments/{id}/files/{fileId}` |
| 6 | chemiaApi.ts | `exportExperimentPDF()` | `/api/experiments/{id}/export-pdf` | `/api/experiments/{id}/pdf` |
| 7 | chemiaApi.ts | `verifyExperiment()` | `POST /api/experiments/{id}/verify` | `POST /api/experiments/{id}/sign` |
| 8 | chemiaApi.ts | `newVersionExperiment()` | `POST /api/experiments/{id}/new-version` | `POST /api/experiments/{id}/versions` |
| 9 | chemiaApi.ts | `approveUnlockRequest()` + `rejectUnlockRequest()` | `/unlock-requests/{id}/approve` + `/reject` | `/unlock-requests/{id}/review` (single endpoint, pass `{ action: 'approve'/'reject', review_note }`) |

**Also remove the duplicate:**
- `getRolesList()` is a duplicate of the fixed `getRoles()` — delete `getRolesList()` and
  update any caller to use `getRoles()`.

**Files that need updating after Phase 1:**
- `src/utilities/chemiaApi.ts` (all URL strings above)
- Any component calling `getRolesList` → replace with `getRoles`
- Any component calling `approveUnlockRequest` / `rejectUnlockRequest` → replace with `reviewUnlockRequest`
- Any component calling `getExperimentAttachments` / `uploadExperimentAttachment` / `deleteExperimentAttachment` → rename calls

---

## Phase 2 — Experiment CRUD Location Fix

The FE creates and lists experiments at the wrong base URL. The backend requires
experiments to be scoped under their notebook.

### Changes in `chemiaApi.ts`

**`createExperiment(body)`**
- Old: `POST /api/experiments/`
- New: `POST /api/notebooks/{body.notebook_id}/experiments`
- The `notebook_id` must be passed in the body (it already is) — extract it to build the URL.

**`getExperiments(params)`**
- Old: `GET /api/experiments?notebook_id=...&...`
- New: Two variants:
  - When `notebook_id` is provided → `GET /api/notebooks/{notebook_id}/experiments`
  - When doing a global search (no notebook_id) → `GET /api/search/experiments` (already exists as `searchExperiments`)
- Remove the flat `GET /api/experiments` call; route through the correct endpoint.

### Files that need updating after Phase 2
- `src/utilities/chemiaApi.ts` — `createExperiment`, `getExperiments`
- All pages/components that call `createExperiment` — pass `notebook_id` in body (likely already do)
- All pages/components that call `getExperiments` — verify they pass `notebook_id` or switch to `searchExperiments`

---

## Phase 3 — Remove Dead Experiment Sub-Resource Endpoints

These endpoints were deleted from the backend in migration `b2c3d4e5f6a7`
(New Experiment System). The backend now stores all experiment content as a JSON
`data` blob on the experiment row — there are no sub-resource tables for inputs,
steps, parameters, equipment, TLC, or comments.

### Remove from `chemiaApi.ts`

**Inputs (3 functions)**
- `addExperimentInput(expId, body)`
- `updateExperimentInput(expId, inputId, body)`
- `deleteExperimentInput(expId, inputId)`

**Parameters (3 functions)**
- `addExperimentParameter(expId, body)`
- `updateExperimentParameter(expId, paramId, body)`
- `deleteExperimentParameter(expId, paramId)`

**Steps (4 functions)**
- `addExperimentStep(expId, body)`
- `updateExperimentStep(expId, stepId, body)`
- `deleteExperimentStep(expId, stepId)`
- `uploadExperimentStepAttachment(expId, stepId, file, password?)`

**Equipment (2 functions)**
- `addExperimentEquipment(expId, body)`
- `deleteExperimentEquipment(expId, equipId)`

**TLC (1 function)**
- `addExperimentTLC(expId, body)`

**Comments (2 functions)**
- `getExperimentComments(expId)`
- `addExperimentComment(expId, body)`

### Remove from `chemiaApi.ts` — workflow actions with no BE equivalent

- `reviseExperiment(id)` — no backend route exists
- `voidExperiment(id, password?)` — no backend route exists
- `unlockExperiment(id)` — no backend route exists

### Remove from `chemiaApi.ts` — other dead endpoints

- `searchExperimentsByParameter(params)` → `GET /api/search/experiments/by-parameters` does not exist in BE
- `uploadATRFinalReport(atrId, file)` → `POST /api/atr/{id}/final-reports` does not exist in BE
- `deleteATRFinalReport(atrId, reportId)` → `DELETE /api/atr/{id}/final-reports/{id}` does not exist in BE

### Component impact
Every page or component that called any of the above functions will need to either:
- Be updated to use `updateExperiment(id, { data: {...} })` — the new model stores
  all structured content inside the experiment's `data` JSON field via a single PATCH.
- Have the UI section removed if the feature is genuinely gone.

---

## Phase 4 — Add Missing New Endpoints

These backend endpoints exist and are fully functional but have no corresponding
function in `chemiaApi.ts`.

### Add to `chemiaApi.ts`

**Experiment Reviewers**
```
POST   /api/experiments/{id}/reviewers          addExperimentReviewer(id, body)
DELETE /api/experiments/{id}/reviewers/{rev_id} removeExperimentReviewer(id, reviewerId)
```

**Experiment — link preliminary**
```
PATCH  /api/experiments/{id}/link-preliminary   linkPreliminaryExperiment(id, body)
```

**Experiment Files (renamed from attachments — done in Phase 1, expose new names)**
```
GET    /api/experiments/{id}/files              getExperimentFiles(id)
POST   /api/experiments/{id}/files              uploadExperimentFile(id, file)
DELETE /api/experiments/{id}/files/{file_id}    deleteExperimentFile(id, fileId)
```

**Workflow Templates (read-only for most users, admin manages)**
```
GET    /api/workflow-templates                  getWorkflowTemplates()
GET    /api/workflow-templates/{id}             getWorkflowTemplate(id)
POST   /api/workflow-templates                  createWorkflowTemplate(body)
PATCH  /api/workflow-templates/{id}             updateWorkflowTemplate(id, body)
DELETE /api/workflow-templates/{id}             deleteWorkflowTemplate(id)
```

**Notification Settings (admin only)**
```
GET    /api/notification-settings               getNotificationSettings()
POST   /api/notification-settings               createNotificationSetting(body)
PATCH  /api/notification-settings/{id}          updateNotificationSetting(id, body)
POST   /api/notification-settings/{id}/toggle   toggleNotificationSetting(id)
```

**Excel Templates (admin only)**
```
GET    /api/excel-templates                     getExcelTemplates()
GET    /api/excel-templates/{id}                getExcelTemplate(id)
GET    /api/excel-templates/{id}/download       downloadExcelTemplate(id)
```

**Company Settings (read currently, add update)**
```
GET    /api/admin/settings/company              getCompanySettings()
PATCH  /api/admin/settings/company              updateCompanySettings(body)
```

**Role Privileges bulk**
```
POST   /api/role-privileges/bulk                bulkCreateRolePrivileges(body)
```

**Projects — close**
```
POST   /api/projects/{id}/close                 closeProject(id)
```

---

## Phase 5 — TypeScript Type Alignment

Update all TypeScript interfaces/types to match the new backend response shapes.
The experiment model changed significantly.

### Experiment type changes
- **Remove** fields: `inputs`, `parameters`, `steps`, `equipment`, `tlc`, `comments`, `attachments`
- **Add/keep** fields:
  - `data: Record<string, any>` — all structured content lives here (template-driven)
  - `scheme_mol: string | null` — Ketcher molecule drawing
  - `files: ExperimentFile[]` — replaces attachments
  - `reviews: ExperimentReview[]` — multi-reviewer gate
  - `root_experiment_id: string | null`
  - `linked_preliminary_id: string | null`
  - `parent_id: string | null`
  - `status` — now includes `UNLOCKED` and `VOID` values

### New types to add
```typescript
interface ExperimentFile {
  id: string
  filename: string
  file_path: string
  file_size: number
  uploaded_by: string
  uploaded_at: string
}

interface ExperimentReview {
  id: string
  experiment_id: string
  reviewer_id: string
  status: 'PENDING' | 'SIGNED' | 'REJECTED'
  signed_by?: string
  signed_at?: string
}

interface WorkflowTemplate {
  id: string
  slug: string
  name: string
  category: string
  description?: string
  definition: Record<string, any>
  is_active: boolean
  version: number
  created_by: string
}
```

### Experiment status enum — add new values
```typescript
type ExperimentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'UNLOCKED'   // ← new
  | 'VOID'       // ← new
```

### UnlockRequest — fix action shape
- Remove separate `approve` / `reject` calls
- Add `reviewUnlockRequest(id, body: { action: 'approve' | 'reject', review_note?: string })`

---

## Execution Order

```
Phase 1  →  Phase 2  →  Phase 3  →  Phase 4  →  Phase 5
  URL           Experiment     Remove          Add             Types
  fixes         CRUD           dead code       new             alignment
                location                       endpoints
```

Phases 1–3 fix broken things. Phases 4–5 complete the integration.
Each phase is self-contained and can be reviewed/tested independently.

---

## Files Changed Per Phase

| Phase | Primary file | Secondary files |
|-------|-------------|-----------------|
| 1 | `src/utilities/chemiaApi.ts` | Components using `getRolesList`, unlock request pages |
| 2 | `src/utilities/chemiaApi.ts` | Experiment list/create pages, notebook detail page |
| 3 | `src/utilities/chemiaApi.ts` | Experiment detail/edit pages (remove UI sections for dead sub-resources) |
| 4 | `src/utilities/chemiaApi.ts` | Admin pages (workflow templates, notification settings, excel templates) |
| 5 | `src/types/*.ts` or inline types in chemiaApi.ts | Experiment form, experiment detail, any typed component |
