# Backend Testing Plan — Consolidated
## Chemi ELN · Node.js / Express / TypeScript · Jest + Supertest

> **Total endpoints: ~696 across 60 route files**
> **Stack: Jest · ts-jest · Supertest — all free, MIT licensed**
> **Test DB: Separate PostgreSQL test database — never run against production**

---

## One-Time Setup (Before Any Phase)

### 1. Create test database
```bash
createdb chemi_eln_test
```

### 2. Add `.env.test` in `backend-node/`
```env
NODE_ENV=test
DB_NAME=chemi_eln_test
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=test-secret-key
```

### 3. Update `jest.config.ts`
```ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__integration__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }] },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/src/jest.setup.ts'],
  globalSetup: '<rootDir>/src/jest.globalSetup.ts',
}

export default config
```

### 4. Create `src/jest.globalSetup.ts`
```ts
export default async function globalSetup() {
  process.env.NODE_ENV = 'test'
}
```

### 5. Create `src/jest.setup.ts`
```ts
import { sequelize } from './database/connection'

beforeAll(async () => {
  await sequelize.authenticate()
})

afterAll(async () => {
  await sequelize.close()
})
```

### 6. Integration test folder structure
```
src/
  __tests__/                    ← existing unit tests, keep as-is
  __integration__/
    helpers/
      auth.helper.ts            ← shared JWT helper (built in Phase 0)
      seed.helper.ts            ← shared DB seed utilities
    phase0-auth/
      auth.test.ts
    phase1-admin/
      users.test.ts
      roles.test.ts
      departments.test.ts
      labs.test.ts
      masterData.test.ts
      adminSettings.test.ts
      adminAuditTrail.test.ts
      adminDashboard.test.ts
      loginIssues.test.ts
    phase2-adc/
      projects.test.ts
      notebooks.test.ts
      experiments.test.ts
      adc.test.ts
      workflowTemplates.test.ts
      adc-lifecycle.test.ts     ← end-to-end flow test
    phase3-ard/
      ardMasterData.test.ts     ← MUST run before all other ARD tests
      ardProjects.test.ts
      ardNotebooks.test.ts
      ardExperiments.test.ts
      ardSections.test.ts
      ardDataItems.test.ts
      ardTemplates.test.ts
      ardTests.test.ts
      atrs.test.ts
      ardQcTrf.test.ts
      ardTeam.test.ts
      ardUploads.test.ts
      ardAudit.test.ts
      ardNotifications.test.ts
      ardDashboard.test.ts
      ardSearch.test.ts
      ard-lifecycle.test.ts     ← end-to-end ATR flow test
    phase4-cgt/
      cgt.test.ts
      templateSettings.test.ts
      cgt-lifecycle.test.ts     ← end-to-end flow test
    phase5-inventory/
      masterDataLookup.test.ts  ← MUST run before other inventory tests
      uom.test.ts
      storageConditions.test.ts
      storageLocations.test.ts
      manufacturers.test.ts
      catalogue.test.ts
      materials.test.ts
      batches.test.ts
      stockRequests.test.ts
      workOrders.test.ts
      gatePasses.test.ts
      checklists.test.ts
      testMaster.test.ts
      schedules.test.ts
      usageLogs.test.ts
      mappings.test.ts
      instrumentSpec.test.ts
      reports.test.ts
      dashboard.test.ts
      auditTrail.test.ts
      inventory-lifecycle.test.ts  ← end-to-end flow test
```

---

## Execution Order (Critical)

Run phases **in this exact order** — each phase seeds data that the next phase depends on:

```
Phase 0  →  Phase 1  →  Phase 3A (ARD Master Data)
                      →  Phase 3B-onwards (ARD)
                      →  Phase 2 (ADC)
                      →  Phase 4 (CGT)
                      →  Phase 5A (Inventory Master Data)
                      →  Phase 5B-onwards (Inventory)
```

**Why ARD Master Data (3A) comes before ADC (2):**
You cannot create ATRs, ARD experiments, or tests without chemicals, instruments, and methods seeded first. The master data phase seeds all reference data that downstream ARD tests depend on.

**Why Inventory Master Data (5A) comes before batches/materials:**
UOM, storage conditions, storage locations, and manufacturers must exist before you can create materials or batches.

---

## Phase 0 — Auth Foundation
**Purpose:** Build the shared auth helper used by every other phase. Nothing else works without this.
**Route file:** `auth.routes.ts` — **9 endpoints**

| Method | Endpoint | Test cases |
|--------|----------|-----------|
| POST | `/api/auth/login` | Valid credentials → 200 + token |
| POST | `/api/auth/login` | Wrong password → 401 |
| POST | `/api/auth/login` | Missing username → 400 |
| POST | `/api/auth/login` | Missing password → 400 |
| POST | `/api/auth/login` | Non-existent user → 401 |
| GET  | `/api/auth/me` | Valid token → 200 + user object |
| GET  | `/api/auth/me` | No token → 401 |
| GET  | `/api/auth/me` | Malformed token → 401 |
| POST | `/api/auth/logout` | Valid token → 200 |
| POST | `/api/auth/refresh` | Valid refresh token → 200 + new token |
| POST | `/api/auth/refresh` | Expired refresh token → 401 |
| POST | `/api/auth/verify-password` | Correct password → 200 |
| POST | `/api/auth/verify-password` | Wrong password → 400 |
| GET  | `/api/auth/security-questions` | Returns list → 200 |
| POST | `/api/auth/me/security-questions` | Set questions → 200 |
| POST | `/api/auth/forgot-password/verify` | Valid answer → 200 |
| POST | `/api/auth/forgot-password/verify` | Wrong answer → 400 |
| POST | `/api/auth/forgot-password/reset` | Valid new password → 200 |

**Output of this phase — `helpers/auth.helper.ts`:**
```ts
export async function getAdminToken(): Promise<string>
export async function getUserToken(role: string): Promise<string>
export async function getTokenForUser(username: string, password: string): Promise<string>
```
All later tests import and call these — never hardcode tokens.

**Estimated effort: 1 day**

---

## Phase 1 — Administration
**Depends on:** Phase 0
**Route files:** 11 files — **76 endpoints**

### 1A — Users (`users.routes.ts`) — 10 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/users` | Admin → 200 + list |
| GET | `/api/users` | No privilege → 403 |
| GET | `/api/users` | No token → 401 |
| GET | `/api/users/lookup` | Returns id+name array → 200 |
| GET | `/api/users/:userId` | Existing user → 200 |
| GET | `/api/users/:userId` | Non-existent → 404 |
| POST | `/api/users` | Valid body → 201 |
| POST | `/api/users` | Duplicate username → 409 |
| POST | `/api/users` | Missing required fields → 422 |
| PATCH | `/api/users/:userId` | Update name/email → 200 |
| GET | `/api/users/:userId/job-description` | Returns file → 200 |
| POST | `/api/users/:userId/reset-password` | Admin resets → 204 |
| POST | `/api/users/:userId/reset-to-default` | Reset to default → 204 |
| POST | `/api/users/:userId/unlock` | Unlock locked account → 204 |
| DELETE | `/api/users/:userId` | Soft-delete → 204 |
| DELETE | `/api/users/:userId` | Non-existent → 404 |

### 1B — Roles (`roles.routes.ts`) — 6 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/roles` | List → 200 |
| POST | `/api/roles` | Create → 201 |
| POST | `/api/roles` | Duplicate code → 409 |
| POST | `/api/roles` | Missing name → 422 |
| PATCH | `/api/roles/:roleId` | Rename → 200 |
| PATCH | `/api/roles/:roleId` | Non-existent → 404 |
| DELETE | `/api/roles/:roleId` | Soft-delete → 204 |

### 1C — Departments (`departments.routes.ts`) — 7 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/departments` | List → 200 |
| GET | `/api/departments/lookup` | Lookup array → 200 |
| GET | `/api/departments/role-mapping` | Role mapping → 200 |
| POST | `/api/departments` | Create → 201 |
| POST | `/api/departments` | Duplicate code → 409 |
| GET | `/api/departments/:deptId` | Get one → 200 |
| PATCH | `/api/departments/:deptId` | Update → 200 |
| DELETE | `/api/departments/:deptId` | Soft-delete → 204 |

### 1D — Labs (`labs.routes.ts`) — 6 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/labs` | List → 200 |
| GET | `/api/labs/lookup` | Lookup → 200 |
| POST | `/api/labs` | Create → 201 |
| POST | `/api/labs` | Duplicate code → 409 |
| GET | `/api/labs/:labId` | Get → 200 |
| PATCH | `/api/labs/:labId` | Update → 200 |
| DELETE | `/api/labs/:labId` | Soft-delete → 204 |

### 1E — Role Privileges (`deptRolePrivileges.routes.ts`) — 3 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/department-role-privileges/catalog` | Returns privilege catalog → 200 |
| GET | `/api/department-role-privileges` | Get privileges for dept/role → 200 |
| PUT | `/api/department-role-privileges` | Bulk update → 200 |
| PUT | `/api/department-role-privileges` | No privilege → 403 |

### 1F — Admin Settings (`admin.routes.ts`) — 7 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/admin/settings` | Get settings → 200 |
| GET | `/api/admin/settings` | No privilege → 403 |
| PATCH | `/api/admin/settings` | Update → 200 (restore in teardown) |
| GET | `/api/admin/id-sequences` | List → 200 |
| POST | `/api/admin/id-sequences` | Create sequence → 201 |
| PATCH | `/api/admin/id-sequences/:configId` | Update → 200 |
| DELETE | `/api/admin/id-sequences/:configId` | Delete → 204 |
| POST | `/api/admin/id-sequences-next/:code` | Get next code → 200 |

### 1G — Admin Audit Trail (`adminAuditTrail.routes.ts`) — 3 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/admin/audit-trail` | List with filters → 200 |
| GET | `/api/admin/audit-trail/event-types` | Event types → 200 |
| GET | `/api/admin/audit-trail/entity-types` | Entity types → 200 |

### 1H — Admin Dashboard (`adminDashboard.routes.ts`) — 2 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/admin/dashboard/department-user-counts` | Returns counts → 200 |
| GET | `/api/admin/dashboard/locked-accounts` | Returns locked users → 200 |

### 1I — Login Issues (`loginIssues.routes.ts`) — 3 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| POST | `/api/login-issues` | Submit issue (no auth) → 201 |
| GET | `/api/login-issues` | Admin list → 200 |
| GET | `/api/login-issues` | No privilege → 403 |
| POST | `/api/login-issues/:id/resolve` | Resolve issue → 200 |

### 1J — Master Data (`masterData.routes.ts`) — 9 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/master-data/items` | List all items → 200 |
| GET | `/api/master-data/chemicals` | List chemicals → 200 |
| POST | `/api/master-data/chemicals` | Create → 201 |
| POST | `/api/master-data/chemicals` | No privilege → 403 |
| PATCH | `/api/master-data/chemicals/:id` | Update → 200 |
| DELETE | `/api/master-data/chemicals/:id` | Delete → 204 |
| GET | `/api/master-data/instruments` | List → 200 |
| POST | `/api/master-data/instruments` | Create → 201 |
| PATCH | `/api/master-data/instruments/:id` | Update → 200 |
| DELETE | `/api/master-data/instruments/:id` | Delete → 204 |

### 1K — Master Templates (`masterTemplates.routes.ts` under inventory) — 2 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/master-templates` | List templates → 200 |
| GET | `/api/inventory/master-templates/:key/download` | Download → 200 |

**Estimated effort: 4–5 days**

---

## Phase 2 — ADC Module
**Depends on:** Phase 0, Phase 1 (users + departments must exist)
**Route files:** 5 files — **98 endpoints**

> **Path note:** ADC project/notebook/experiment routes mount at `/api/projects`, `/api/notebooks`, `/api/experiments` (not `/api/adc/...`). Only ADC-specific actions use `/api/adc/*`.

### 2A — Projects (`projects.routes.ts`) — 21 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/projects` | List → 200 |
| GET | `/api/projects` | Without view privilege → 403 |
| GET | `/api/projects/next-code` | Returns code → 200 |
| GET | `/api/projects/hod-stats` | HOD stats → 200 |
| POST | `/api/projects` | Create → 201 |
| POST | `/api/projects` | Missing required fields → 422 |
| GET | `/api/projects/:projectId` | Get → 200 |
| GET | `/api/projects/:projectId` | Non-existent → 404 |
| PATCH | `/api/projects/:projectId` | Update → 200 |
| POST | `/api/projects/:projectId/close` | Close open project → 200 (password required) |
| POST | `/api/projects/:projectId/reopen` | Reopen closed → 200 (password required) |
| POST | `/api/projects/:projectId/deactivate` | Deactivate → 200 (password; irreversible) |
| GET | `/api/projects/:projectId/members` | List members → 200 |
| POST | `/api/projects/:projectId/members` | Add member → 201/200 |
| DELETE | `/api/projects/:projectId/members/:userId` | Remove member → 204 |
| GET | `/api/projects/:projectId/attachments` | List attachments → 200 |
| POST | `/api/projects/:projectId/attachments` | Upload → 201 (soft-test / skip disk in CI) |
| DELETE | `/api/projects/:projectId/attachments/:attachId` | Delete → 204 |
| GET | `/api/projects/:projectId/risk-assessment` | Get → 200 |
| PUT | `/api/projects/:projectId/risk-assessment` | Update → 200 |
| POST | `/api/projects/:projectId/risk-assessment/rows` | Add row → 201 |
| PATCH | `/api/projects/:projectId/risk-assessment/rows/:rowId` | Update row → 200 |
| DELETE | `/api/projects/:projectId/risk-assessment/rows/:rowId` | Delete row → 200 |

### 2B — Notebooks (`notebooks.routes.ts`) — 14 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/notebooks` | List → 200 |
| GET | `/api/notebooks` | Without privilege → 403 |
| GET | `/api/notebooks/tl-stats` | TL stats → 200 |
| GET | `/api/notebooks/tl-experiment-summary` | Summary → 200 |
| GET | `/api/projects/:projectId/notebooks` | List in project → 200 |
| POST | `/api/projects/:projectId/notebooks` | Create → 201 |
| GET | `/api/notebooks/:notebookId` | Get → 200 |
| PATCH | `/api/notebooks/:notebookId` | Update → 200 |
| POST | `/api/notebooks/:notebookId/close` | Close → 200 |
| POST | `/api/notebooks/:notebookId/reopen` | Reopen → 200 |
| POST | `/api/notebooks/:notebookId/deactivate` | Deactivate → 200 |
| GET | `/api/notebooks/:notebookId/template-snapshot` | Get snapshot → 200 |
| GET | `/api/notebooks/:notebookId/assigned-users` | List assigned → 200 |
| POST | `/api/notebooks/:notebookId/assign-user` | Assign → 200 |
| DELETE | `/api/notebooks/:notebookId/unassign/:userId` | Unassign → 200 |

### 2C — Experiments (`experiments.routes.ts`) — 34 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/experiments` | List → 200 |
| GET | `/api/experiments/my-stats` | My stats → 200 |
| GET | `/api/notebooks/:notebookId/experiments` | In notebook → 200 |
| POST | `/api/notebooks/:notebookId/experiments` | Create → 201 |
| GET | `/api/experiments/:expId` | Get → 200 |
| PATCH | `/api/experiments/:expId` | Update → 200 |
| GET | `/api/experiments/:expId/assigned-users` | List → 200 |
| POST | `/api/experiments/:expId/assign-user` | Assign → 200 |
| DELETE | `/api/experiments/:expId/unassign/:userId` | Unassign → 200 |
| POST | `/api/experiments/:expId/submit` | Submit → 200 |
| POST | `/api/experiments/:expId/submit` | Already submitted → 400 |
| POST | `/api/experiments/:expId/approve` | Approve → 200 |
| POST | `/api/experiments/:expId/reject` | Reject with reason → 200 |
| POST | `/api/experiments/:expId/reject` | Missing reason → 422 |
| POST | `/api/experiments/:expId/unlock` | Unlock → 200 |
| POST | `/api/experiments/:expId/void` | Void → 200 |
| POST | `/api/experiments/:expId/clone` | Clone → 201 |
| POST | `/api/experiments/:expId/scientist-sign` | Sign → 200 |
| GET | `/api/experiments/:expId/files` | List files → 200 |
| POST | `/api/experiments/:expId/files` | Upload → 201 |
| DELETE | `/api/experiments/:expId/files/:fileId` | Delete → 200 |
| GET | `/api/experiments/:expId/reviews` | Get reviews → 200 |
| POST | `/api/experiments/:expId/reviews` | Add review → 201 |
| POST | `/api/experiments/:expId/reviews/:reviewerId/sign` | Sign → 200 |
| GET | `/api/experiments/:expId/atr-requests` | List → 200 |
| POST | `/api/experiments/:expId/atr-requests` | Create → 201 |
| POST | `/api/atr/:atrNo/complete` | Complete ATR → 200 |
| GET | `/api/experiments/:expId/history` | Audit → 200 |
| GET | `/api/experiments/:expId/atr` | Get ATR → 200 |
| POST | `/api/experiments/:expId/atr` | Create ATR → 201 |
| GET | `/api/atr` | List ATRs → 200 |
| GET | `/api/atr/:atrId` | Get ATR → 200 |
| GET | `/api/experiments/:expId/report.pdf` | PDF → 200 |
| GET | `/api/experiments/:expId/report/docx` | DOCX → 200 |

### 2D — ADC Specific Routes (`adc.routes.ts`) — 14 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | (each endpoint) | 200 response + correct shape |
| POST | (each endpoint) | 201/200 + negative cases |

### 2E — Workflow Templates (`workflowTemplates.routes.ts`)
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/workflow-templates` | List → 200 |
| POST | `/api/workflow-templates` | Create → 201 |
| POST | `/api/workflow-templates` | Duplicate slug → 409 |
| POST | `/api/workflow-templates` | Missing name → 422 |
| GET | `/api/workflow-templates/:id` | Get → 200 |
| PATCH | `/api/workflow-templates/:id` | Update → 200 |
| DELETE | `/api/workflow-templates/:id` | Soft-delete → 204 |
| — | `publish` / `clone` | **Not in routes** — do not invent |

### 2F — ADC Lifecycle Integration Test
```
Create Project → Create Notebook → Create Experiment
→ Assign Scientist → Submit → Approve
→ Verify status = APPROVED
→ Clone Experiment → Verify clone exists
```

**Estimated effort: 6–7 days**

---

## Phase 3 — ARD Module
**Depends on:** Phase 0, Phase 1
**Route files:** 17 files — **227 endpoints**
**⚠️ Run 3A (Master Data) before all other ARD tests**

### 3A — ARD Master Data (`ardMasterData.routes.ts`) — 59 endpoints ⚠️ Seed first
This is the largest single route file. All ARD test creation depends on this data existing.
Covers: chemicals, solvents, reagents, methods, instruments, equipment, columns, personnel qualifications, test parameters.

| Method | Pattern | Test cases |
|--------|---------|-----------|
| GET | `/api/ard/master-data/<entity>` | List each entity → 200 |
| POST | `/api/ard/master-data/<entity>` | Create → 201 |
| POST | `/api/ard/master-data/<entity>` | Duplicate → 409 |
| PATCH | `/api/ard/master-data/<entity>/:id` | Update → 200 |
| DELETE | `/api/ard/master-data/<entity>/:id` | Delete → 200 |
| DELETE | `/api/ard/master-data/<entity>/:id` | Non-existent → 404 |

Apply the above pattern to each entity: chemicals, solvents, reagents, instruments, columns, methods, test-parameters, personnel, equipment-types, storage-conditions.

### 3B — ARD Projects (`ardProjects.routes.ts`) — 17 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/projects` | List → 200 |
| GET | `/api/ard/projects/:projectId` | Get → 200 |
| GET | `/api/ard/projects/:projectId` | Non-existent → 404 |
| POST | `/api/ard/projects` | Create → 201 |
| PUT | `/api/ard/projects/:projectId` | Update → 200 |
| POST | `/api/ard/projects/:projectId/close` | Close → 200 |
| POST | `/api/ard/projects/:projectId/deactivate` | Deactivate → 200 |
| POST | `/api/ard/projects/:projectId/reopen` | Reopen → 200 |
| DELETE | `/api/ard/projects/:projectId` | Delete → 200 |
| GET | `/api/ard/projects/:projectId/specifications` | List specs → 200 |
| POST | `/api/ard/projects/:projectId/specifications` | Create spec → 201 |
| PUT | `/api/ard/projects/:projectId/specifications/:specId` | Update → 200 |
| POST | `/api/ard/projects/:projectId/specifications/:specId/submit` | Submit → 200 |
| POST | `/api/ard/projects/:projectId/specifications/:specId/approve` | Approve → 200 |
| DELETE | `/api/ard/projects/:projectId/specifications/:specId` | Delete → 200 |
| POST | `/api/ard/projects/:projectId/stps/:stpId/submit` | Submit STP → 200 |
| POST | `/api/ard/projects/:projectId/stps/:stpId/approve` | Approve STP → 200 |
| POST | `/api/ard/projects/:projectId/stps/:stpId/return` | Return STP → 200 |

### 3C — ARD Notebooks (`ardNotebooks.routes.ts`) — 11 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/notebooks` | List → 200 |
| GET | `/api/ard/notebooks/:notebookId` | Get → 200 |
| POST | `/api/ard/notebooks` | Create → 201 |
| PATCH | `/api/ard/notebooks/:notebookId` | Update → 200 |
| DELETE | `/api/ard/notebooks/:notebookId` | Delete → 200 |
| POST | `/api/ard/notebooks/:notebookId/reopen` | Reopen → 200 |
| GET | `/api/ard/notebooks/:notebookId/experiments` | List experiments → 200 |
| GET | `/api/ard/notebooks/:notebookId/equipment` | List equipment → 200 |
| POST | `/api/ard/notebooks/:notebookId/equipment` | Link equipment → 201 |
| DELETE | `/api/ard/notebooks/:notebookId/equipment/:linkId` | Unlink → 200 |
| GET | `/api/ard/notebooks/:notebookId/documents/report.pdf` | PDF → 200 |

### 3D — ARD Experiments (`ardExperiments.routes.ts`) — 29 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/experiments` | List → 200 |
| POST | `/api/ard/experiments` | Create → 201 |
| GET | `/api/ard/experiments/:expId` | Get → 200 |
| PATCH | `/api/ard/experiments/:expId` | Update → 200 |
| POST | `/api/ard/experiments/:expId/submit` | Submit → 200 |
| POST | `/api/ard/experiments/:expId/approve` | Approve → 200 |
| POST | `/api/ard/experiments/:expId/reject` | Reject → 200 |
| POST | `/api/ard/experiments/:expId/reject` | Missing reason → 400 |
| POST | `/api/ard/experiments/:expId/unlock` | Unlock → 200 |
| POST | `/api/ard/experiments/:expId/void` | Void → 200 |
| (remaining endpoints) | File upload, clone, history, sections | 200 / 201 |

### 3E — ARD Sections (`ardSections.routes.ts`) — 8 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/experiments/:expId/sections` | List → 200 |
| GET | `/api/ard/sections/:sectionId` | Get → 200 |
| PATCH | `/api/ard/sections/:sectionId` | Update field data → 200 |
| POST | `/api/ard/sections/:sectionId/rows` | Add row → 201 |
| DELETE | `/api/ard/sections/:sectionId/rows/:rowId` | Delete row → 200 |
| POST | `/api/ard/sections/:sectionId/lock` | Lock → 200 |
| POST | `/api/ard/sections/:sectionId/unlock` | Unlock → 200 |
| GET | `/api/ard/sections/:sectionId/history` | History → 200 |

### 3F — ARD Data Items (`ardDataItems.routes.ts`) — 6 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/sections/:sectionId/data-items` | List → 200 |
| POST | `/api/ard/sections/:sectionId/data-items` | Create → 201 |
| GET | `/api/ard/data-items/:itemId` | Get → 200 |
| PATCH | `/api/ard/data-items/:itemId` | Update value → 200 |
| DELETE | `/api/ard/data-items/:itemId` | Delete → 200 |
| POST | `/api/ard/data-items/:itemId/approve` | Approve → 200 |

### 3G — ARD Templates (`ardTemplates.routes.ts`) — 13 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/templates` | List → 200 |
| POST | `/api/ard/templates` | Create → 201 |
| GET | `/api/ard/templates/:id` | Get → 200 |
| PATCH | `/api/ard/templates/:id` | Update → 200 |
| POST | `/api/ard/templates/:id/publish` | Publish → 200 |
| POST | `/api/ard/templates/:id/publish` | Already published → 409 |
| POST | `/api/ard/templates/:id/clone` | Clone → 201 |
| DELETE | `/api/ard/templates/:id` | Delete → 200 |
| DELETE | `/api/ard/templates/:id` | Published template → 400 |
| (remaining) | Sections, version history | 200 |

### 3H — ATRs (`atrs.routes.ts`) — 24 endpoints (Most Critical)
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/atrs` | List → 200 |
| POST | `/api/ard/atrs` | Create → 201 |
| GET | `/api/ard/atrs/:atrNo` | Get → 200 |
| PATCH | `/api/ard/atrs/:atrNo` | Update → 200 |
| POST | `/api/ard/atrs/:atrNo/submit` | Submit → 200 |
| POST | `/api/ard/atrs/:atrNo/submit` | No tests assigned → 400 |
| POST | `/api/ard/atrs/:atrNo/approve` | QA pre-approve → 200 |
| POST | `/api/ard/atrs/:atrNo/certify` | Certify → 200 |
| POST | `/api/ard/atrs/:atrNo/certify` | Incomplete tests → 400 |
| POST | `/api/ard/atrs/:atrNo/withdraw` | Withdraw → 200 |
| POST | `/api/ard/atrs/:atrNo/cancel` | Cancel → 200 |
| (remaining) | QA assignments, documents, history | 200 |

### 3I — ARD Tests (`ardTests.routes.ts`) — 24 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/atrs/:atrNo/tests` | List tests → 200 |
| POST | `/api/ard/atrs/:atrNo/tests` | Assign test → 201 |
| GET | `/api/ard/tests/:testId` | Get → 200 |
| PATCH | `/api/ard/tests/:testId` | Update → 200 |
| POST | `/api/ard/tests/:testId/start` | Start → ATR moves to PARTIAL |
| POST | `/api/ard/tests/:testId/complete` | Complete → 200 |
| POST | `/api/ard/tests/:testId/verify` | Verify → 200 |
| POST | `/api/ard/tests/:testId/accept` | Accept → 200 |
| POST | `/api/ard/tests/:testId/reject` | Reject → 200 |
| POST | `/api/ard/tests/:testId/withdraw` | Withdraw → 200 |
| (remaining) | Result data, file attachments | 200 |

### 3J — QC TRF (`ardQcTrf.routes.ts`) — 9 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/qc-trf` | List → 200 |
| GET | `/api/ard/qc-trf/:formId` | Get → 200 |
| POST | `/api/ard/qc-trf` | Create → 201 |
| PUT | `/api/ard/qc-trf/:formId` | Update → 200 |
| POST | `/api/ard/qc-trf/:formId/transition` | Transition status → 200 |
| POST | `/api/ard/qc-trf/:formId/add-tests` | Add tests → 200 |
| DELETE | `/api/ard/qc-trf/:formId` | Delete → 200 |
| GET | `/api/ard/qc-trf/:formId/events` | Events → 200 |
| GET | `/api/ard/qc-trf/:formId/documents/summary.pdf` | PDF → 200 |

### 3K — ARD Team (`ardTeam.routes.ts`) — 7 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/ard/users` | ARD user list → 200 |
| GET | `/api/ard/directory` | Directory → 200 |
| POST | `/api/ard/teams` | Create team → 201 |
| PUT | `/api/ard/teams/:teamId` | Update team → 200 |
| DELETE | `/api/ard/teams/:teamId` | Delete team → 200 |
| GET | `/api/ard/workload` | Workload → 200 |
| GET | `/api/ard/events` | Events → 200 |

### 3L — ARD Uploads (`ardUploads.routes.ts`) — 6 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| POST | `/api/ard/uploads` | Upload file → 201 |
| GET | `/api/ard/uploads/:fileId` | Download → 200 |
| DELETE | `/api/ard/uploads/:fileId` | Delete → 200 |
| (remaining) | Metadata, list | 200 |

### 3M — ARD Supporting Routes
| File | Endpoints | Test focus |
|------|-----------|-----------|
| `ardAudit.routes.ts` | 3 | List audit, entity-specific, XLSX export |
| `ardNotifications.routes.ts` | 3 | List, mark-read, mark-all-read |
| `ardDashboard.routes.ts` | 6 | Ping, TL list, QA list, menu, metrics, my-metrics |
| `ardSearch.routes.ts` | 1 | Search returns results → 200 |

### 3N — ARD Lifecycle Integration Test
```
Seed ARD Master Data (chemicals, instruments, methods)
→ Create ARD Project → Add Specification
→ Create ARD Notebook → Link Equipment
→ Create ARD Experiment → Fill Sections
→ Submit Experiment → Approve
→ Create ATR → Assign Tests
→ Start Tests → Complete Tests → Verify Tests
→ Submit ATR → QA Pre-Approve → Certify
→ Assert ATR status = CERTIFIED
→ Assert all test statuses = ACCEPTED/VERIFIED
```

**Estimated effort: 10–12 days**

---

## Phase 4 — CGT Module
**Depends on:** Phase 0, Phase 1
**Route files:** 2 files — **50 endpoints**

> **Path note:** CGT mounts as `/api/cgt-projects`, `/api/cgt-notebooks`, `/api/cgt-experiments` (not `/api/cgt/projects`). Project submit/approve/clone/sections from older plans **do not exist** — experiment workflow is DRAFT→SUBMITTED→APPROVED.

### 4A — CGT Projects / Notebooks / Experiments (`cgt.routes.ts`)
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/cgt-projects` | List → 200 + items |
| GET | `/api/cgt-projects` | Without privilege → 403 |
| POST | `/api/cgt-projects` | Create → 201 (`name` + `manager_id`) |
| POST | `/api/cgt-projects` | Missing manager → **422** |
| GET | `/api/cgt-projects/:id` | Get → 200 / missing → 404 |
| PATCH | `/api/cgt-projects/:id` | Update (`title` → name) → 200 |
| POST | `/api/cgt-projects/:id/close` | Close → 200 (password) |
| POST | `/api/cgt-projects/:id/reopen` | Reopen → 200 (password) |
| GET/POST | `/api/cgt-projects/:id/notebooks` | List / create → 200 / 201 |
| GET | `/api/cgt-notebooks` | List → 200; nopriv → 403 |
| POST | `/api/cgt-experiments/:id/submit` | DRAFT → SUBMITTED → 200 |
| POST | `/api/cgt-experiments/:id/approve` | SUBMITTED → APPROVED → 200 (HOD/SUPER_ADMIN) |
| POST | `/api/cgt-experiments/:id/reject` | reason required → 400 if missing |
| POST | `/api/cgt-experiments/:id/unlock` | → DRAFT → 200 |
| — | report.pdf / atr / deactivate | Soft-skip (side effects) |

### 4B — Template Settings (`templateSettings.routes.ts`)
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET/POST | `/api/template-settings/cgt/processes` | List / create → 200 / 201 |
| PATCH | `/api/template-settings/cgt/processes/:id` | Update → 200 |
| DELETE | `/api/template-settings/cgt/processes/:id` | Soft-delete → **204** |
| GET/PUT | `/api/template-settings/cgt/processes/:id/templates` | List / set → 200 |
| GET | `/api/template-settings/cgt/process-templates` | `?process=` → 200 |
| GET/PUT | `/api/template-settings/adc/templates` | List / update → 200 |
| GET | `/api/template-settings/adc/enabled` | → 200 |

### 4C — CGT Lifecycle Integration Test
```
Create Process → Create CGT Project → Notebook → Experiment
→ Submit → Approve → Assert status = APPROVED
```

**Estimated effort: 3–4 days**

---

## Phase 5 — Inventory Module
**Depends on:** Phase 0, Phase 1
**Route files:** 27 files — **255 endpoints**
**⚠️ Run 5A (Master Data Lookup) before all other Inventory tests**

### 5A — Inventory Master Data Lookup (`masterDataLookup.routes.ts`) — 37 endpoints ⚠️ Seed first
Covers: equipment-types, instrument-types, column-types, consumable-types, storage-conditions, measurement-master, spare-parts.

For each entity:
| Method | Pattern | Test cases |
|--------|---------|-----------|
| GET | `/api/inventory/master/<entity>` | List → 200 |
| POST | `/api/inventory/master/<entity>` | Create → 201 |
| GET | `/api/inventory/master/<entity>/:id` | Get → 200 |
| PATCH | `/api/inventory/master/<entity>/:id` | Update → 200 |
| PATCH | `/api/inventory/master/<entity>/:id/toggle` | Toggle active → 200 |
| DELETE | `/api/inventory/master/<entity>/:id` | Delete/deactivate → 200 |

### 5B — Units of Measure (`uom.routes.ts`) — 8 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/uom` | List → 200 |
| POST | `/api/inventory/uom` | Create → 201 |
| POST | `/api/inventory/uom` | Duplicate → 409 |
| GET | `/api/inventory/uom/:id` | Get → 200 |
| PATCH | `/api/inventory/uom/:id` | Update → 200 |
| DELETE | `/api/inventory/uom/:id` | Delete → 200 |
| (remaining) | Conversions | 200 |

### 5C — Storage Locations (`storageLocations.routes.ts`) — 6 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/storage-locations` | List → 200 |
| POST | `/api/inventory/storage-locations` | Create → 201 |
| GET | `/api/inventory/storage-locations/:id` | Get → 200 |
| PATCH | `/api/inventory/storage-locations/:id` | Update → 200 |
| DELETE | `/api/inventory/storage-locations/:id` | Delete → 200 |

### 5D — Manufacturers (`manufacturers.routes.ts`) — 10 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/manufacturers` | List → 200 |
| POST | `/api/inventory/manufacturers` | Create → 201 |
| POST | `/api/inventory/manufacturers` | Duplicate → 409 |
| GET | `/api/inventory/manufacturers/:id` | Get → 200 |
| PATCH | `/api/inventory/manufacturers/:id` | Update → 200 |
| DELETE | `/api/inventory/manufacturers/:id` | Delete → 200 |
| (remaining) | Search, contacts | 200 |

### 5E — Catalogue (`catalogue.routes.ts`) — 19 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/catalogue` | List → 200 |
| POST | `/api/inventory/catalogue` | Create → 201 |
| POST | `/api/inventory/catalogue` | Duplicate code → 409 |
| GET | `/api/inventory/catalogue/:id` | Get → 200 |
| PATCH | `/api/inventory/catalogue/:id` | Update → 200 |
| DELETE | `/api/inventory/catalogue/:id` | Delete → 200 |
| (remaining) | Search, filters, export | 200 |

### 5F — Materials (`materials.routes.ts`) — 13 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/materials` | List → 200 |
| POST | `/api/inventory/materials` | Create → 201 |
| GET | `/api/inventory/materials/:id` | Get → 200 |
| PATCH | `/api/inventory/materials/:id` | Update → 200 |
| DELETE | `/api/inventory/materials/:id` | Delete → 200 |
| (remaining) | Search, barcode, export | 200 |

### 5G — Batches (`batches.routes.ts`) — 20 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/batches` | List → 200 |
| GET | `/api/inventory/batches/next-batch-no` | Returns next code → 200 |
| GET | `/api/inventory/batches/next-pack-seq` | Returns next seq → 200 |
| POST | `/api/inventory/batches` | Receive batch → 201 |
| GET | `/api/inventory/batches/:id` | Get → 200 |
| PATCH | `/api/inventory/batches/:id` | Update → 200 |
| POST | `/api/inventory/batches/:id/consume` | Consume qty → 200 |
| POST | `/api/inventory/batches/:id/consume` | Over-consume → 400 |
| POST | `/api/inventory/batches/:id/adjust` | Adjust qty → 200 |
| POST | `/api/inventory/batches/:id/dispose` | Dispose → 200 |
| (remaining) | QR/barcode, packs, export | 200 |

### 5H — Stock Requests (`stockRequests.routes.ts`) — 10 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/stock-requests` | List → 200 |
| POST | `/api/inventory/stock-requests` | Create → 201 |
| GET | `/api/inventory/stock-requests/:id` | Get → 200 |
| POST | `/api/inventory/stock-requests/:id/approve` | Approve → 200 |
| POST | `/api/inventory/stock-requests/:id/reject` | Reject → 200 |
| POST | `/api/inventory/stock-requests/:id/fulfill` | Fulfill → 200 |
| POST | `/api/inventory/stock-requests/:id/cancel` | Cancel → 200 |
| (remaining) | History | 200 |

### 5I — Work Orders (`workOrders.routes.ts`) — 13 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/work-orders` | List → 200 |
| POST | `/api/inventory/work-orders` | Create → 201 |
| GET | `/api/inventory/work-orders/:id` | Get → 200 |
| PATCH | `/api/inventory/work-orders/:id` | Update → 200 |
| POST | `/api/inventory/work-orders/:id/assign` | Assign → 200 |
| POST | `/api/inventory/work-orders/:id/complete` | Complete → 200 |
| POST | `/api/inventory/work-orders/:id/close` | Close → 200 |
| (remaining) | Parts used, history | 200 |

### 5J — Gate Passes (`gatePasses.routes.ts`) — 15 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/gate-passes` | List → 200 |
| POST | `/api/inventory/gate-passes` | Create → 201 |
| GET | `/api/inventory/gate-passes/:id` | Get → 200 |
| PATCH | `/api/inventory/gate-passes/:id` | Update → 200 |
| POST | `/api/inventory/gate-passes/:id/approve` | Approve → 200 |
| POST | `/api/inventory/gate-passes/:id/reject` | Reject → 200 |
| POST | `/api/inventory/gate-passes/:id/dispatch` | Dispatch → 200 |
| POST | `/api/inventory/gate-passes/:id/receive` | Receive back → 200 |
| (remaining) | Cancel, history, barcode | 200 |

### 5K — Checklists (`checklists.routes.ts`) — 13 endpoints
| Method | Endpoint | Test cases |
|--------|----------|-----------|
| GET | `/api/inventory/checklists` | List → 200 |
| POST | `/api/inventory/checklists` | Create template → 201 |
| GET | `/api/inventory/checklists/:id` | Get → 200 |
| PATCH | `/api/inventory/checklists/:id` | Update → 200 |
| POST | `/api/inventory/checklists/:id/submit` | Submit filled checklist → 200 |
| (remaining) | Items, history | 200 |

### 5L — Remaining Inventory Routes
| File | Endpoints | Test focus |
|------|-----------|-----------|
| `testMaster.routes.ts` | 13 | Test master CRUD + toggle active |
| `schedules.routes.ts` | 6 | Maintenance schedule CRUD + trigger |
| `usageLogs.routes.ts` | 5 | Usage log create + list |
| `mappings.routes.ts` | 9 | Item-to-location mapping CRUD |
| `instrumentSpec.routes.ts` | 8 | Instrument spec CRUD |
| `reports.routes.ts` | 7 | Report generation → 200 (smoke only) |
| `dashboard.routes.ts` | 8 | Dashboard metrics → 200 |
| `auditTrail.routes.ts` | 3 | Inventory audit list → 200 |
| `lookup.routes.ts` | 6 | Lookup endpoints → 200 |
| `logMappings.routes.ts` | 4 | Log mapping CRUD |

### 5M — Inventory Lifecycle Integration Test
```
Seed: UOM → Storage Conditions → Storage Locations → Manufacturers
→ Create Catalogue Item
→ Create Material (links to catalogue)
→ Receive Batch (creates quantity)
→ Create Stock Request → Approve → Fulfill
→ Consume from Batch
→ Assert remaining quantity correct
→ Create Work Order → Complete
→ Create Gate Pass → Approve → Dispatch
```

**Estimated effort: 11–12 days**

---

## What Is Intentionally NOT Tested

| Item | Reason |
|------|--------|
| `sse.routes.ts` | Server-Sent Events require persistent connection — not suited for Supertest |
| PDF/XLSX download endpoints | Binary response — test status = 200 only, not content |
| File upload endpoints | Tested with a dedicated multipart fixture per module |
| `ardReporting.routes.ts` | Report generation is slow — smoke test only (status 200) |
| `adminDashboard` aggregation accuracy | Depends on seeded data volume — test shape, not exact values |

---

## Complete Summary

| Phase | Module | Route Files | Endpoints | Est. Days |
|-------|--------|------------|-----------|-----------|
| 0 | Auth | 1 | 9 | 1 |
| 1 | Administration | 11 | 76 | 4–5 |
| 2 | ADC | 5 | 98 | 6–7 |
| 3 | ARD | 17 | 227 | 10–12 |
| 4 | CGT | 2 | 50 | 3–4 |
| 5 | Inventory | 27 | 255 | 11–12 |
| **Total** | | **63 files** | **~696** | **35–41 days** |

---

## Universal Rules (Apply to Every Phase)

1. **Test DB only** — `NODE_ENV=test`, separate `chemi_eln_test` database. Never point at production.
2. **Seed → test → teardown** — each suite seeds its own data in `beforeAll`, cleans up in `afterAll`.
3. **Always test the negative** — for every endpoint, test: no token (401), wrong privilege (403), bad ID (404), bad body (400).
4. **No DB mocking** — tests must hit real Sequelize + PostgreSQL. Mocking hides migration and constraint bugs.
5. **Reuse the auth helper** — never hardcode tokens. Always use `getAdminToken()` / `getUserToken()` from Phase 0.
6. **One lifecycle integration test per module** — individual endpoint tests + one full status-flow test per phase.
7. **Master data before dependents** — always run 3A (ARD Master Data) before ATRs, and 5A (Inventory Lookup) before batches/materials.
8. **Smoke-test report/export endpoints** — assert status 200 only, not binary content.
