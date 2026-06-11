# Frontend Migration Phases — v1.0.0 → v2.0.0

> **Rule**: Only modify files inside `src/` (the React/TypeScript frontend).  
> Do **not** touch `backend/`, `backend-new/`, or `ui/`.  
> Each phase builds on the previous — complete them in order.

---

## Overview Table

| Phase | Area | Type | Status |
|-------|------|------|--------|
| 1  | API Client — types & functions | Update | ✅ Done |
| 2  | Dashboard — real backend data | Update | ✅ Done |
| 3  | Experiment Editor — v2 core fields + Precautions | Update | ✅ Done |
| 4  | Experiment Steps & Equipment tabs | New | ✅ Done |
| 5  | Experiment Inputs — v2 enhanced model | Update | ✅ Done |
| 6  | Experiment Parameters — formula engine | Update | ✅ Done |
| 7  | PDF Export button | New | ✅ Done |
| 8  | E-Signature modal (re-auth) | New | ✅ Done |
| 9  | ATR — versioning + final reports | Update | ✅ Done |
| 10 | User Management — v2 user fields | Update | ✅ Done |
| 11 | Settings page — CRD / Global settings v2 | Update | ✅ Done |
| 12 | Master Data admin pages | New | ✅ Done |
| 13 | Role Privileges admin page | New | ✅ Done |
| 14 | Search page | New | ✅ Done |
| 15 | Router + Sidebar — wire all new pages | Update | ✅ Done |

---

## Phase 1 — API Client: Types & Functions ✅ Done
**File**: `src/utilities/chemiaApi.ts`

### New interfaces to add
- `DashboardCounts` — counts response from `GET /api/dashboard/counts`
- `VerificationQueueItem` — from `GET /api/dashboard/verification-queue`
- `ApprovalQueueItem` — from `GET /api/dashboard/approval-queue`
- `ReworkInboxItem` — from `GET /api/dashboard/rework-inbox`
- `SLAAlertItem` — from `GET /api/dashboard/sla-alerts`
- `MyActivityItem` — from `GET /api/dashboard/my-activity`
- `SearchExperimentResult` — from `GET /api/search/experiments`
- `SearchATRResult` — from `GET /api/search/atrs`
- `SearchNotebookResult` — from `GET /api/search/notebooks`
- `SearchProjectResult` — from `GET /api/search/projects`
- `LookupChemical`, `LookupChemicalCreate`, `LookupChemicalUpdate`
- `LookupInstrument`, `LookupInstrumentCreate`, `LookupInstrumentUpdate`
- `Site`, `SiteCreate`, `SiteUpdate`
- `RolePrivilege`, `RolePrivilegeCreate`, `RolePrivilegeUpdate`
- `RoleShort`

### Updated interfaces
- `MeResponse` → add: `middle_initials`, `contact_no`, `site`, `dashboard_reference`, `allow_settings_update`, `must_reset_password`
- `ExperimentResponse` → add: `precautions`, `is_highlighted`, `highlight_comments`, `submitted_to`, `submitted_to_at`, `post_verification_remarks`, `improvement_suggestions`, `save_comments`, `reference_exp_code`, `tlc_drawing_path`, `steps: ExperimentStepResponse[]`, `equipment: ExperimentEquipmentResponse[]`; remove: `scheme_mol`
- `ExperimentUpdate` → same additions/removals as above
- `ExperimentCreate` → add `precautions`, `reference_exp_code`
- `ExperimentInputResponse` → add: `formula`, `batch_lot_no`, `vendor_name`, `batch_no`, `available_qty`, `required_qty`, `required_qty_unit`, `density`, `strength`, `ww_ratio`, `molarity`, `remarks`
- `ExperimentInputCreate` → same new fields
- `ExperimentParameterResponse` → add: `code`, `input_output`, `user_entered_or_formula`, `param_type`, `formula_expression`, `parameter_value`, `uom`, `remarks`; rename `name` → keep for backward compat
- `ExperimentParameterCreate` → add same new fields
- `ATRSummary` / `ATRResponse` → add: `submitted_to`, `submitted_at`, `assigned_at`, `version`, `is_latest_version`, `final_reports: ATRFinalReportResponse[]`
- New: `ATRFinalReportResponse`, `ExperimentStepResponse`, `ExperimentStepCreate`, `ExperimentEquipmentResponse`, `ExperimentEquipmentCreate`
- New: `ExperimentHistoryResponse` → add `improvement_suggestions`, `submitted_to_user_id`, `save_comments`

### New API functions to add
```
// Dashboard
getDashboardCounts()           GET /api/dashboard/counts
getVerificationQueue()         GET /api/dashboard/verification-queue
getApprovalQueue()             GET /api/dashboard/approval-queue
getReworkInbox()               GET /api/dashboard/rework-inbox
getSLAAlerts()                 GET /api/dashboard/sla-alerts
getMyActivity()                GET /api/dashboard/my-activity

// Search
searchExperiments(params)      GET /api/search/experiments
searchExperimentsByParams()    GET /api/search/experiments/by-parameters
searchATRs(params)             GET /api/search/atrs
searchNotebooks(params)        GET /api/search/notebooks
searchProjects(params)         GET /api/search/projects

// Master Data — Chemicals
getChemicals(params)           GET /api/master-data/chemicals
getChemical(id)                GET /api/master-data/chemicals/{id}
createChemical(body)           POST /api/master-data/chemicals
updateChemical(id, body)       PATCH /api/master-data/chemicals/{id}
deleteChemical(id)             DELETE /api/master-data/chemicals/{id}

// Master Data — Instruments
getInstruments(params)         GET /api/master-data/instruments
getInstrument(id)              GET /api/master-data/instruments/{id}
createInstrument(body)         POST /api/master-data/instruments
updateInstrument(id, body)     PATCH /api/master-data/instruments/{id}
deleteInstrument(id)           DELETE /api/master-data/instruments/{id}

// Master Data — Sites
getSites(params)               GET /api/master-data/sites
createSite(body)               POST /api/master-data/sites
updateSite(id, body)           PATCH /api/master-data/sites/{id}
deleteSite(id)                 DELETE /api/master-data/sites/{id}

// Role Privileges
getRoles()                     GET /api/roles/
getRolePrivileges(params)      GET /api/role-privileges/
getRolePrivilege(id)           GET /api/role-privileges/{id}
createRolePrivilege(body)      POST /api/role-privileges/
updateRolePrivilege(id, body)  PATCH /api/role-privileges/{id}
deleteRolePrivilege(id)        DELETE /api/role-privileges/{id}

// Experiment Steps
addExperimentStep(expId, body)       POST /api/experiments/{id}/steps
updateExperimentStep(expId, stepId)  PATCH /api/experiments/{id}/steps/{stepId}
deleteExperimentStep(expId, stepId)  DELETE /api/experiments/{id}/steps/{stepId}

// Experiment Equipment
addExperimentEquipment(expId, body)  POST /api/experiments/{id}/equipment
deleteExperimentEquipment(expId, id) DELETE /api/experiments/{id}/equipment/{id}

// ATR Final Reports
uploadATRFinalReport(atrId, file)    POST /api/atr/{id}/final-reports
deleteATRFinalReport(atrId, id)      DELETE /api/atr/{id}/final-reports/{id}

// PDF Export
exportExperimentPDF(id, params)      GET /api/experiments/{id}/export-pdf
```

---

## Phase 2 — Dashboard: Real Backend Data ✅ Done
**File**: `src/pages/dashboard/components/index.tsx`

### Changes
- Replace any placeholder/mock data with real API calls
- Add stat cards: **Total Experiments**, **Pending Verification**, **Pending Approval**, **Rework Required**, using `getDashboardCounts()`
- Add **Verification Queue** table: columns — Experiment Code, Title, Notebook, Submitted By, Submitted At; source: `getVerificationQueue()`
- Add **Approval Queue** table: columns — Experiment Code, Status, Verified By, Verified At; source: `getApprovalQueue()`
- Add **Rework / Rejected Inbox** table: columns — Code, Reason, Rejected By; source: `getReworkInbox()`
- Add **SLA Alerts** section: highlight experiments overdue for submission/approval; source: `getSLAAlerts()`
- Add **My Recent Activity** feed: source: `getMyActivity()`
- Role-based visibility: QA/HOD see all queues; CHEM only sees personal activity + rework inbox

---

## Phase 3 — Experiment Editor: v2 Core Fields ✅ Done
**File**: `src/pages/experiments/editor/components/index.tsx`

### Changes
- **Remove** `scheme_mol` field and `SchemeVisualization` / KetcherEditor usage (the field is dropped in v2)
- **Add** `precautions` field (rich text, below `objective`)
- **Add** `save_comments` field (plain text, shown when saving draft — "reason for save")
- **Add** `reference_exp_code` field (plain text, shows reference to a cloned/related experiment)
- **Add** `post_verification_remarks` field (read-only after verification, shown if present)
- **Add** `improvement_suggestions` field (read-only, shown after rejection/review)
- **Add** `is_highlighted` indicator badge + `highlight_comments` tooltip (read-only display, set by QA)
- **Add** `submitted_to` display (shows the user the experiment is submitted to, if `verification_request_flow` CRD setting is on)
- **Update** `ExperimentCreate` and `ExperimentUpdate` calls to pass the new fields
- Update history tab: show new `improvement_suggestions`, `save_comments` fields per history entry

---

## Phase 4 — Experiment Steps & Equipment Tabs
**File**: `src/pages/experiments/editor/components/index.tsx`

### Steps Tab (new)
- New tab: **"Procedure Steps"** inside the experiment editor
- Table with columns: Step No, Procedure Text (rich text), Observation Text (rich text), Qty, Temperature, Attachment
- **Add step** button → inline row form
- Drag-to-reorder support (step_no auto-updates)
- Attachment per step: file upload stored in `attachment_path`, display filename
- CRUD calls: `addExperimentStep`, `updateExperimentStep`, `deleteExperimentStep`

### Equipment Tab (new)
- New tab: **"Equipment Used"** inside the experiment editor
- Table with columns: Instrument Code, Instrument Type, Name, Maintenance Status, Calibration Status, Start Time, End Time, Remarks
- **Add equipment** button → opens a modal (optionally searchable from master instruments via `getInstruments()`)
- CRUD calls: `addExperimentEquipment`, `deleteExperimentEquipment`

---

## Phase 5 — Experiment Inputs: Enhanced v2 Model
**File**: `src/pages/experiments/editor/components/index.tsx` (inputs section)

### Changes
The inputs table needs new columns and the create/edit form needs new fields:

**New columns to show** (can be hidden by default, toggled):
| Field | Display Label |
|-------|---------------|
| `formula` | Formula |
| `batch_lot_no` | Batch/Lot No. |
| `vendor_name` | Vendor |
| `batch_no` | Batch No. |
| `available_qty` | Available Qty |
| `required_qty` | Required Qty |
| `required_qty_unit` | Req. Qty Unit |
| `density` | Density |
| `strength` | Strength |
| `ww_ratio` | W/W Ratio |
| `molarity` | Molarity |
| `remarks` | Remarks |

- **Auto-lookup**: When user types a `material_name`, optionally search `getChemicals()` for auto-fill of CAS, formula, mol_wt, density, etc.
- Update `ExperimentInputCreate` calls to include new fields

---

## Phase 6 — Experiment Parameters: Formula Engine
**File**: `src/pages/experiments/editor/components/index.tsx` (parameters section)

### Changes
Parameters are now formula-capable. The table/form needs rework:

| Field | UI Element |
|-------|------------|
| `code` | Short text input (e.g. "MW", "YIELD") |
| `input_output` | Dropdown — INPUT / OUTPUT |
| `user_entered_or_formula` | Toggle — "User Entered" / "Formula" |
| `param_type` | Dropdown — NUMBER / TEXT / DATE |
| `formula_expression` | Text input (shown only when `user_entered_or_formula = Formula`) |
| `parameter_value` | Numeric display (auto-calculated for OUTPUT/formula params; editable for INPUT/user-entered) |
| `uom` | Unit of measure text input |
| `remarks` | Text input |

- OUTPUT formula parameters should be **read-only** (value recalculated by backend)
- Show formula expression as a badge/tooltip when hovering calculated outputs
- Update `ExperimentParameterCreate` calls to include new fields

---

## Phase 7 — PDF Export Button ✅ Done
**File**: `src/pages/experiments/editor/components/index.tsx`

### Changes
- Added **"Export Report"** button/dropdown in the experiment editor toolbar (visible for all statuses)
- Dropdown panel: checkboxes for `include_steps`, `include_inputs`, `include_parameters`, `include_equipment`, `include_tlc`, `include_comments` (all checked by default except comments)
- "Download PDF" button calls `exportExperimentPDF(id, pdfOptions)` → blob → `<a download>` pattern
- File saved as `{full_code}_report.pdf`; success/error messages via `message.success/error`

---

## Phase 8 — E-Signature Modal ✅ Done
**File**: `src/common/ESignatureModal/index.tsx` *(new component)*

### New shared component
```
src/common/ESignatureModal/
  index.tsx       — Modal with password input, action label, submit
  styles.module.less
```

### Behaviour
- Triggered before: **Save** (if `reauth_save` CRD setting is on), **Submit for Verification** (`reauth_submit_for_verification`), **Verify** (`reauth_verification`), **Deactivate** (`reauth_deactivate`), **Attachment Upload** (`reauth_attachment_upload`)
- Modal title: *"E-Signature Required"*; body: *"Please re-enter your password to confirm this action."*
- On confirm: send `{ password }` as part of the action request body; backend verifies via bcrypt
- On 403 response from backend: show *"Incorrect password"* inline error
- Fetch CRD settings on app start; store in Redux / context to avoid repeated fetches

---

## Phase 9 — ATR: Versioning + Final Reports
**File**: `src/pages/atr/form/components/index.tsx`

### Changes

**Versioning display**:
- Show `version` badge (e.g., "v2") and `is_latest_version` indicator in the ATR header
- If not the latest version, show a banner: *"This is an older version. View latest →"*

**Submitted-to field**:
- If `submitted_to` is set, show the assigned reviewer in the ATR info section

**Final Reports tab (new)**:
- New tab: **"Final Reports"**
- File upload section: drag-and-drop or browse, calls `uploadATRFinalReport(atrId, file)`
- List of uploaded files with filename, size, upload date, uploader; delete button
- CRUD calls: `uploadATRFinalReport`, `deleteATRFinalReport`

**ATR List page** (`src/pages/atr/list/components/index.tsx`):
- Add `version` column
- Filter by `is_latest_version` (default: show only latest)

---

## Phase 10 — User Management: v2 User Fields
**File**: `src/pages/admin/users/components/index.tsx`

### Changes

**User create / edit form — new fields**:
| Field | Type | Notes |
|-------|------|-------|
| `middle_initials` | Text input | Optional |
| `contact_no` | Text input | Optional |
| `site` | Text / select | Optionally driven by `getSites()` |
| `dashboard_reference` | Text input | Optional — URL or code |
| `allow_settings_update` | Toggle | Whether user can edit CRD settings |
| `must_reset_password` | Toggle | Force password reset on next login |

**User list**:
- Add `site` and `contact_no` columns (optional / hidden by default)

**My Profile / Me page** (if `src/pages/settings` handles it):
- Update profile view to show `middle_initials`, `contact_no`, `site`

---

## Phase 11 — Settings Page: CRD / Global Settings v2
**File**: `src/pages/settings/components/index.tsx`

### Changes

The settings page needs to be restructured into tabs:

**Tab 1 — Global Settings** (`GET/PATCH /api/admin/settings/global`)
Fields: auth_type, use_random_password_through_mail, default_password, lock_user_after_x_attempts, password_expiry_days, image_file_size_kb, attachment_size_kb, qa_privilege_role, email_notification_enabled, experiment_per_limit, notebook_experiment_limit, experiment_search_result_limit, company_logo_path

**Tab 2 — CRD Settings** (`GET/PATCH /api/admin/settings/crd`) — add new v2 fields:
| New Field | UI |
|-----------|-----|
| `sample_notebook_code` | Text input |
| `mandate_tl_approval_atr` | Toggle |
| `verification_request_flow` | Toggle |
| `route_and_stage` | Toggle |
| `clone_procedure_without_numerical_data` | Toggle |
| `closing_stage` | Text input |
| `experiment_report_stage` | Text input |
| `scheme_type` | Dropdown |
| `procedure_display` | Dropdown |
| `include_observation_start_end_time` | Toggle |
| `tlc_type` | Dropdown |
| `tlc_row_count` | Number input |
| `reference_experiment_link_code` | Text input |
| `include_reference_for_cloned_experiments` | Toggle |
| `sla_experiments_days` | Number input |
| `sla_delayed_submission_days` | Number input |
| `sla_delayed_approval_days` | Number input |
| **E-Signature section** | |
| `reauth_save` | Toggle |
| `reauth_submit_for_verification` | Toggle |
| `reauth_verification` | Toggle |
| `reauth_deactivate` | Toggle |
| `reauth_attachment_upload` | Toggle |
| **Input Defaults section** | |
| `input_default_mol_weight` | Numeric input |
| `input_default_quantity` | Numeric input |
| `input_auto_calc_moles` | Toggle |
| `input_default_mole_ratio` | Numeric input |

**Tab 3 — SMTP Settings** (existing, keep as-is)

---

## Phase 12 — Master Data Admin Pages (New)
**New files**:
```
src/pages/admin/master-data/
  chemicals/
    index.ts
    components/index.tsx
    components/styles.module.less
  instruments/
    index.ts
    components/index.tsx
    components/styles.module.less
  sites/
    index.ts
    components/index.tsx
    components/styles.module.less
```

### Chemicals page (`/admin/master-data/chemicals`)
- Table: Chemical Name, CAS No., Formula, Mol. Wt, Vendor, Density, Purity %, Active
- **Add** / **Edit** modal with all fields
- **Delete** (soft delete via `is_active`)
- Search by chemical name or CAS no.
- Calls: `getChemicals`, `createChemical`, `updateChemical`, `deleteChemical`

### Instruments page (`/admin/master-data/instruments`)
- Table: Code, Type, Name, Maintenance Status, Calibration Status, Active
- **Add** / **Edit** modal
- Calls: `getInstruments`, `createInstrument`, `updateInstrument`, `deleteInstrument`

### Sites page (`/admin/master-data/sites`)
- Table: Code, Name, Active, Created At
- **Add** / **Edit** inline form
- Calls: `getSites`, `createSite`, `updateSite`, `deleteSite`

---

## Phase 13 — Role Privileges Admin Page (New)
**New files**:
```
src/pages/admin/role-privileges/
  index.ts
  components/index.tsx
  components/styles.module.less
```

### Role Privileges page (`/admin/role-privileges`)
- Table: Role, Department, Privilege Key, Granted (Yes/No), Updated By, Updated At
- **Add** privilege: select Role (from `getRoles()`), optional Department, Privilege Key, Granted toggle
- **Edit** (toggle `is_granted` inline or via modal)
- **Delete** privilege row
- Filter by: Role, Department, Privilege Key
- Calls: `getRoles`, `getRolePrivileges`, `createRolePrivilege`, `updateRolePrivilege`, `deleteRolePrivilege`

---

## Phase 14 — Search Page (New)
**New files**:
```
src/pages/search/
  index.ts
  components/index.tsx
  components/styles.module.less
```

### Search page (`/search`)
- **Tabbed interface**: Experiments | Experiments by Parameter | ATRs | Notebooks | Projects
- **Experiments tab**: fields — title keyword, full_code, status (multi-select), notebook_id, date range; calls `searchExperiments()`
- **By Parameter tab**: search by parameter code + value range; calls `searchExperimentsByParams()`
- **ATRs tab**: fields — atr_no keyword, status, test_type; calls `searchATRs()`
- **Notebooks tab**: fields — code/title keyword, project; calls `searchNotebooks()`
- **Projects tab**: fields — code/title keyword; calls `searchProjects()`
- Results displayed in a compact table with click-through links to the relevant record
- Respects `experiment_search_result_limit` from Global Settings

---

## Phase 15 — Router + Sidebar: Wire All New Pages
**Files**: `src/router/index.tsx`, `src/common/Sidebar/index.tsx`

### New routes to add
```
/search                             → SearchPage
/admin/master-data/chemicals        → AdminChemicalsPage
/admin/master-data/instruments      → AdminInstrumentsPage
/admin/master-data/sites            → AdminSitesPage
/admin/role-privileges              → AdminRolePrivilegesPage
```

### Sidebar additions
- Top-level: **🔍 Search** (visible to all roles)
- Admin section: expand with
  - **Master Data** (sub-menu: Chemicals, Instruments, Sites) — visible to QA/HOD
  - **Role Privileges** — visible to QA only

### Admin Dashboard (`/admin`)
- Add quick-link cards for Master Data and Role Privileges

---

## Dependency Graph

```
Phase 1 (API client)
  ├── Phase 2 (Dashboard)
  ├── Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 (Experiment flow)
  ├── Phase 9 (ATR)
  ├── Phase 10 (Users)
  ├── Phase 11 (Settings)
  ├── Phase 12 (Master Data pages)
  ├── Phase 13 (Role Privileges page)
  └── Phase 14 (Search page)
        └── Phase 15 (Router + Sidebar) — depends on ALL above
```

Phase 1 must be completed first. Phases 2–14 can be worked on in parallel after Phase 1. Phase 15 is last.

---

## Files Modified per Phase

| Phase | Files Modified / Created |
|-------|--------------------------|
| 1 | `src/utilities/chemiaApi.ts` |
| 2 | `src/pages/dashboard/components/index.tsx` |
| 3 | `src/pages/experiments/editor/components/index.tsx` |
| 4 | `src/pages/experiments/editor/components/index.tsx` |
| 5 | `src/pages/experiments/editor/components/index.tsx` |
| 6 | `src/pages/experiments/editor/components/index.tsx` |
| 7 | `src/pages/experiments/editor/components/index.tsx` |
| 8 | `src/common/ESignatureModal/index.tsx` *(new)*, `src/common/ESignatureModal/styles.module.less` *(new)* |
| 9 | `src/pages/atr/form/components/index.tsx`, `src/pages/atr/list/components/index.tsx` |
| 10 | `src/pages/admin/users/components/index.tsx` |
| 11 | `src/pages/settings/components/index.tsx` |
| 12 | `src/pages/admin/master-data/**` *(3 new page folders)* |
| 13 | `src/pages/admin/role-privileges/**` *(new page folder)* |
| 14 | `src/pages/search/**` *(new page folder)* |
| 15 | `src/router/index.tsx`, `src/common/Sidebar/index.tsx`, `src/pages/admin/dashboard/components/index.tsx` |
