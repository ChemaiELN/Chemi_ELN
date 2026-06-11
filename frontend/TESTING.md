# Chemia ELN — End-to-End Testing Guide

> **Purpose** Structured test plan for manual QA of the Chemia ELN application.  
> **Stack** React 18 · TypeScript · Vite · Ant Design 5 (frontend) · FastAPI · PostgreSQL (backend)  
> **Base URLs** Frontend: `http://localhost:5173` · Backend API: `http://localhost:8002`  
> **Last updated** 2026-06-09

---

## Test Users Reference

| Username | Password | Role | What they can do |
|----------|----------|------|-----------------|
| `qa.admin` | `password` | **QA** | Full access — approve/reject experiments, manage unlock requests, view all audit logs |
| `john.doe` | `password` | **HOD** | Head of Department — view all, approve experiments |
| `alice.k` | `password` | **TL** | Team Lead — verify experiments, raise ATRs, see own data + team data |
| `dave.r` | `password` | **CHEM** | Chemist — create/edit/submit own experiments |
| `carol.p` | `password` | **CHEM** | Chemist — create/edit/submit own experiments |
| `bob.m` | `password` | **CHEM** | Chemist — create/edit/submit own experiments |

---

## Phases Overview

| # | Phase | Key Features |
|---|-------|-------------|
| 1 | [Authentication & Session](#phase-1--authentication--session-management) | Login, logout, token refresh, password change |
| 2 | [User & Role Management](#phase-2--user--role-management) | Create users, assign roles, activate/deactivate |
| 3 | [Department & Project Setup](#phase-3--department--project-setup) | Departments, projects, notebooks |
| 4 | [Experiment Lifecycle](#phase-4--experiment-lifecycle) | Full workflow: DRAFT → SUBMITTED → VERIFIED → APPROVED |
| 5 | [Rich Text Editor Fields](#phase-5--rich-text-editor-fields) | Quill editor in Aim, Objective, Procedure, Observations, Conclusion |
| 6 | [Ketcher Chemical Scheme](#phase-6--ketcher-chemical-scheme) | Draw, save and reload reaction schemes |
| 7 | [ATR Workflow](#phase-7--atr-analytical-test-request-workflow) | Create, assign, complete ATRs |
| 8 | [Unlock Request Workflow](#phase-8--unlock-request-workflow) | Request unlock, QA approve/reject |
| 9 | [Unlock Experiments Page](#phase-9--unlock-experiments-page-tabs) | All 5 tabs + experiment segregation |
| 10 | [Audit Log](#phase-10--audit-log) | Role-based access, search, filters |
| 11 | [Rich Text Diff API](#phase-11--rich-text-diff-api) | Backend diff endpoint, BeautifulSoup parsing |
| 12 | [Admin Panel](#phase-12--admin-panel) | User CRUD, role assignment |
| 13 | [Error Handling & Edge Cases](#phase-13--error-handling--edge-cases) | 422, 401, object-error display |

---

## Phase 1 — Authentication & Session Management

### P1-01 · Valid Login
- Navigate to `http://localhost:5173/login`
- Enter `qa.admin` / `password`
- **Expected:** Redirected to `/dashboard`. Header shows "Alice Kumar (TL)" or "qa.admin (QA)". `access_token` and `refresh_token` stored in `localStorage`.

### P1-02 · Invalid Login
- Enter `qa.admin` / `wrongpassword`
- **Expected:** Red error notification: "Invalid credentials" (or similar). User stays on login page. No tokens stored.

### P1-03 · Logout
- Log in as any user. Click user menu (top-right) → **Logout**.
- **Expected:** Redirected to `/login`. `localStorage` cleared of `access_token`, `refresh_token`, `chemia_user`.

### P1-04 · Session Expiry / Token Refresh
- Log in. Wait for access token to expire (or manually delete `access_token` from localStorage, keep `refresh_token`).
- Navigate to any page that calls the API.
- **Expected:** Silent token refresh happens. User stays on the page. No redirect to `/login`.

### P1-05 · Expired Refresh Token
- Log in. Delete **both** `access_token` and `refresh_token` from localStorage.
- Navigate to `/experiments`.
- **Expected:** Redirected to `/login`. No `[object Object]` or unreadable error shown.

### P1-06 · Change Password
- Log in as `dave.r`. Click **Password** in header.
- Enter correct current password, new password, confirm.
- **Expected:** Success toast "Password changed successfully". Log out and log back in with new password — succeeds.

### P1-07 · Change Password — Wrong Current
- Log in. Click **Password**. Enter wrong current password.
- **Expected:** Inline error on the Current Password field. Modal stays open.

---

## Phase 2 — User & Role Management

### P2-01 · List Users
- Log in as `qa.admin`. Navigate to **Admin → Master Data → Users**.
- **Expected:** Paginated table showing all users with role badges, department, status.

### P2-02 · Create New User
- Click **New User**.
- Fill: Employee No `EMP999`, username `test.user`, first name `Test`, last name `User`, email `test@chemia.com`, role `CHEM`, password `Pass1234!`.
- **Expected:** User appears in the list. Role shows as CHEM.

### P2-03 · Edit User Role
- Find `test.user`. Click edit. Change role to `TL`.
- **Expected:** Role badge updates. User can now access TL-level pages after next login.

### P2-04 · Deactivate / Activate User
- Deactivate `test.user`.
- **Expected:** Row shows "Inactive" badge. Attempting to log in as `test.user` should fail with "Account disabled".
- Re-activate. Login should succeed.

### P2-05 · Role-Based Sidebar Visibility
- Log in as `dave.r` (CHEM). Check sidebar.
- **Expected:** No "Admin" or "Master Data" links visible. Sees Experiments, ATR, Notebooks.
- Log in as `qa.admin`. Check sidebar.
- **Expected:** Sees Admin, Audit Trail, Unlock Requests.

---

## Phase 3 — Department & Project Setup

### P3-01 · Create Department
- Log in as `qa.admin`. Navigate to **Admin → Departments**.
- Create department: Code `RSCH`, Name `Research`.
- **Expected:** Appears in department list. Can be assigned to users.

### P3-02 · Create Project
- Navigate to **Projects → New Project**.
- Fill code, name, assign to a department.
- **Expected:** Project created. Appears in the Projects list.

### P3-03 · Create Notebook
- Navigate to **Notebooks → New Notebook**.
- Assign to an existing project.
- **Expected:** Notebook created with auto-generated code. Available when creating experiments.

### P3-04 · Notebook Permissions
- Log in as `qa.admin`. Open a notebook. Add permission for `dave.r` with `can_edit = true`, `can_submit = true`.
- Log in as `dave.r`. Navigate to that notebook's experiments.
- **Expected:** Dave can create and edit experiments in that notebook.

---

## Phase 4 — Experiment Lifecycle

> Full workflow: DRAFT → SUBMITTED → VERIFIED → APPROVED

### P4-01 · Create Experiment
- Log in as `dave.r`. Navigate to **Experiments → New Experiment**.
- Select a notebook. Enter title "Synthesis Run #1".
- **Expected:** Experiment created in `DRAFT` status. Full code generated (e.g. `OQ/R1/S1/E00001/001`). Editor opens.

### P4-02 · Edit Experiment Fields
- In the editor, fill in:
  - **Aim** (rich text): Add bold text, a bullet list.
  - **Objective** (rich text): Multi-paragraph text.
  - **Procedure** (rich text): Numbered list.
  - **Observations** (rich text): Table or highlighted text.
  - **Conclusion** (rich text): Italic summary.
  - **Starting Material**, **Target Product**, **Reaction Type**: Plain text fields.
- Click **Save**.
- **Expected:** Saved successfully. Reloading the page shows all content preserved, including rich text formatting.

### P4-03 · Submit Experiment
- From the experiment editor, click **Submit for Review**.
- **Expected:** Status changes to `SUBMITTED`. Blue status badge. Edit fields locked (read-only). Submit button hidden.

### P4-04 · Verify Experiment (TL)
- Log in as `alice.k` (TL). Navigate to **Experiments**. Find the submitted experiment.
- Open it. Click **Verify**.
- **Expected:** Status changes to `VERIFIED`. Teal status badge.

### P4-05 · Approve Experiment (QA/HOD)
- Log in as `qa.admin`. Find the verified experiment.
- Click **Approve**.
- **Expected:** Status changes to `APPROVED`. Green badge. All fields locked permanently.

### P4-06 · Reject Experiment
- Submit another experiment as `dave.r`.
- Log in as `alice.k`. Open it. Click **Reject** with reason "Missing yield data".
- **Expected:** Status changes to `REJECTED`. Red badge. Rejection reason saved.
- Log in as `dave.r`. Open the experiment. It should be editable again (back to `REJECTED` editable state).

### P4-07 · Experiment Version History
- Open an approved experiment. Click **History** tab.
- **Expected:** Timeline shows DRAFT → SUBMITTED → VERIFIED → APPROVED events with timestamps and user names.

### P4-08 · View Experiments by Status (Segregation)
- Navigate to **Experiments** list page.
- Use the **View** dropdown to switch between:
  - **All Experiments** — shows every status
  - **On-Going** — shows only `DRAFT`
  - **Submitted** — shows only `SUBMITTED`
  - **Pending for Review** — shows `SUBMITTED`
  - **Verified** — shows `VERIFIED` and `APPROVED`
  - **Review Comments** — shows `REJECTED`
- **Expected:** Each view filters correctly. Badge count updates.

---

## Phase 5 — Rich Text Editor Fields

### P5-01 · Basic Formatting
- Create/open a DRAFT experiment. In **Procedure** field:
  - Type text. Apply **Bold**, **Italic**, **Underline**.
  - **Expected:** Formatting visible in editor and persisted after Save.

### P5-02 · Lists
- In **Observations** field: Create an ordered list (1, 2, 3) and an unordered list.
- **Expected:** Lists render correctly. Saved and reloaded without corruption.

### P5-03 · Headings & Blockquote
- In **Aim** field: Add an H2 heading and a blockquote.
- **Expected:** Heading renders larger. Blockquote indented. Persists after save.

### P5-04 · Read-Only Mode
- Submit the experiment. Open it as TL before verifying.
- **Expected:** All 5 rich text fields show content but toolbar is hidden. Cursor is blocked. Text cannot be edited.

### P5-05 · Empty Field Save
- Create a new experiment. Leave **Procedure** blank. Save.
- **Expected:** No error. Field saves as null/empty. No broken rendering on reload.

### P5-06 · Large Content
- Paste 500+ words into **Procedure**. Save.
- **Expected:** Saved and loaded without truncation. Scrollable within the field.

---

## Phase 6 — Ketcher Chemical Scheme

### P6-01 · Scheme Tab Visible
- Open any DRAFT experiment in the editor.
- **Expected:** A **Scheme** tab is visible alongside Aim, Objective, Procedure, Observations, Conclusion.

### P6-02 · Draw a Reaction Scheme
- Click the **Scheme** tab. Ketcher editor loads.
- Draw a simple molecule (e.g. benzene ring using the ring tool).
- Click **Save** on the experiment.
- **Expected:** No errors. Scheme saved.

### P6-03 · Reload Persisted Scheme
- After saving with a drawn scheme, reload the page.
- **Expected:** Ketcher re-opens with the previously drawn molecule loaded. Canvas is not blank.

### P6-04 · Read-Only Scheme
- Submit the experiment. Open it as TL (or another viewer).
- Navigate to **Scheme** tab.
- **Expected:** Scheme tab shows the drawn molecule. A "View only" banner is visible. Canvas interactions are disabled.

### P6-05 · Empty Scheme
- Create a new experiment. Leave Scheme tab blank. Save.
- **Expected:** No error. `scheme_mol` field is null. Scheme tab shows empty Ketcher canvas on reload.

### P6-06 · Scheme Responsive Height
- Resize the browser window to different sizes (desktop, tablet, mobile).
- **Expected:** Ketcher canvas height adjusts responsively. Minimum 300px, maximum ~680px.

---

## Phase 7 — ATR (Analytical Test Request) Workflow

### P7-01 · Raise ATR
- Log in as `alice.k` (TL). Navigate to **ATR → My ATRs → New ATR**.
- Attach to an experiment. Set test type to `HPLC`. Fill objectives. Set due date.
- **Expected:** ATR created with `NEW` status and auto-generated ATR number (e.g. `ATR00000001`).

### P7-02 · Submit ATR
- Open the ATR. Click **Submit**.
- **Expected:** Status changes to `SUBMITTED`.

### P7-03 · Assign ATR (QA/TL/HOD)
- Log in as `qa.admin`. Find the submitted ATR.
- Click **Assign**. Select analyst `dave.r`. Set due date.
- **Expected:** Status changes to `VERIFIED`. Assigned to Dave.

### P7-04 · Complete ATR
- Log in as `dave.r`. Find assigned ATR.
- Click **Complete**. Enter result and observations.
- **Expected:** Status changes to `COMPLETED`.

### P7-05 · ATR Attachment Upload
- On a NEW ATR, upload a PDF file.
- **Expected:** File appears in attachment list with filename and size.

### P7-06 · ATR Role Restrictions
- Log in as `bob.m` (CHEM, not the assigned analyst).
- Try to complete the ATR assigned to `dave.r`.
- **Expected:** 403 error: "Only the assigned analyst or QA/HOD/TL can complete an ATR".

---

## Phase 8 — Unlock Request Workflow

### P8-01 · Raise Unlock Request (Chemist)
- Log in as `dave.r`. Open an **APPROVED** experiment.
- Click **Request Unlock**. Enter reason "Need to correct yield calculation".
- **Expected:** Unlock request created with `PENDING` status. Experiment remains APPROVED.

### P8-02 · Duplicate Request Blocked
- Try to raise another unlock request for the same experiment while one is PENDING.
- **Expected:** Error: "A pending unlock request already exists for this experiment".

### P8-03 · Approve Unlock Request (QA)
- Log in as `qa.admin`. Navigate to **Unlock Experiments → Unlock Requests** tab.
- Find the PENDING request. Click **Approve**. Add review note.
- **Expected:** Request status → `APPROVED`. Experiment status → `UNLOCKED`. Chemist can now edit.

### P8-04 · Reject Unlock Request (QA)
- Raise another unlock request (on a different APPROVED experiment).
- Log in as `qa.admin`. Click **Reject**. Enter rejection reason.
- **Expected:** Request status → `REJECTED`. Experiment remains `APPROVED`.

### P8-05 · Non-QA Cannot Approve
- Log in as `alice.k` (TL). Navigate to Unlock Requests. Find a PENDING request.
- **Expected:** Approve/Reject buttons are **not visible** (they only show for QA role).

### P8-06 · Resolved Fields in Table
- Open Unlock Requests tab.
- **Expected:** "Experiment" column shows full code (e.g. `OQ/R1/S1/E00001/001`), not a UUID. "Requested By" shows display name (e.g. "Dave Reynolds"), not a UUID.

---

## Phase 9 — Unlock Experiments Page (Tabs)

### P9-01 · Unlock Requests Tab Loads Without Error
- Log in as `alice.k`. Navigate to `/experiments/unlock`.
- **Expected:** Page loads. **No** `[object Object]` or `page_size` error notifications. Unlock Requests tab shows alice.k's own requests.

### P9-02 · Inactive Experiments Tab
- Click **Inactive Experiments** tab.
- **Expected:** Table loads. Shows experiments with `VOID` status. If none exist, shows "No inactive experiments found" empty state.

### P9-03 · Delayed Submission Tab
- Click **Delayed Submission** tab.
- **Expected:** Table loads. Shows experiments with `DRAFT` status (not yet submitted). Badge count matches.

### P9-04 · Delayed Approval Tab
- Click **Delayed Approval** tab.
- **Expected:** Table loads. Shows `SUBMITTED` experiments waiting for approval.

### P9-05 · Pending Review Tab
- Click **Pending Review** tab.
- **Expected:** Table loads. Shows `VERIFIED` experiments awaiting final HOD/QA approval.

### P9-06 · Tab Badge Pre-fetch
- Navigate to the Unlock Experiments page.
- **Expected:** Badge counts on all tabs populate **immediately** without switching tabs (pre-fetched on mount).

### P9-07 · Experiment Row Navigation
- On any experiment tab, click the 👁 button on a row.
- **Expected:** Navigates to `/experiments/{id}` (the experiment editor).

### P9-08 · Search Across Tabs
- On **Delayed Submission** tab, type a partial experiment code in the search box.
- **Expected:** Table filters in real-time. Matches on full code, title, or creator name.

### P9-09 · Status Filter on Unlock Requests
- On **Unlock Requests** tab, select `PENDING` from the status dropdown.
- **Expected:** Only PENDING requests shown. Clear filter → all requests return.

---

## Phase 10 — Audit Log

### P10-01 · QA Can See All Entries
- Log in as `qa.admin`. Navigate to **Audit Trail**.
- **Expected:** All audit log entries visible. Multiple modules (AUTH, EXPERIMENT, ATR, etc.).

### P10-02 · TL Sees Own Entries Only
- Log in as `alice.k` (TL). Navigate to **Audit Trail**.
- **Expected:** Only entries where `user_id = alice.k` are shown. No 403 error.

### P10-03 · CHEM Sees Own Entries Only
- Log in as `dave.r` (CHEM). Navigate to **Audit Trail**.
- **Expected:** Only dave.r's own actions shown.

### P10-04 · Search by Username
- Log in as `qa.admin`. Open filter panel. Search `alice.k`.
- **Expected:** Only entries with username matching "alice.k" shown.

### P10-05 · Filter by Module
- Open filter panel. Select Module = `EXPERIMENT`.
- **Expected:** Only experiment-related entries. Action tags show SUBMIT, UPDATE, etc.

### P10-06 · Filter by Action
- Select Action = `LOGIN`.
- **Expected:** Only login events. Module tag shows AUTH.

### P10-07 · Date Range Filter
- Set date range to today only.
- **Expected:** Only entries from today shown. Other dates excluded.

### P10-08 · Combined Filters
- Set Module = `ATR`, Action = `CREATED`, date = this week.
- **Expected:** Only ATR creation events this week.

### P10-09 · Collapsible Filter Panel
- Click **Filters** button.
- **Expected:** 3-column filter grid expands. "Filters applied" badge appears when any filter is active. Clicking **Clear** resets all and badge disappears.

### P10-10 · Quick Search in Card Header
- Without opening filter panel, type in the quick search box at the top-right of the table card.
- **Expected:** Results filter by username in real-time. Same as filter panel search.

### P10-11 · Pagination
- Set page size (default 20). Navigate to page 2.
- **Expected:** Row numbers continue from 21. Total count badge unchanged.

### P10-12 · Audit Log After Experiment Save
- Edit a DRAFT experiment (change Procedure rich text). Save.
- Check audit log.
- **Expected:** New entry: Module=EXPERIMENT, Action=UPDATE, Detail includes "Rich-text edits → procedure (XX% similar)".

---

## Phase 11 — Rich Text Diff API

### P11-01 · Diff Endpoint — HTML Format
```
GET /api/experiments/{exp_id}/diff/{other_id}?field=procedure&format=html
Authorization: Bearer <token>
```
- **Expected:** JSON response with:
  - `similarity`: float 0–1
  - `diff`: HTML string containing `<ins class="rt-ins">` and `<del class="rt-del">` tags
  - `plain_before`, `plain_after`: stripped plain text

### P11-02 · Diff Endpoint — Unified Format
```
GET /api/experiments/{exp_id}/diff/{other_id}?field=procedure&format=unified
```
- **Expected:** `diff` field contains a `--- before / +++ after` unified diff patch.

### P11-03 · Diff — Identical Content
- Compare two versions where `procedure` is unchanged.
- **Expected:** `similarity = 1.0`. `diff = ""` (empty string).

### P11-04 · Diff — Invalid Field Name
```
GET /api/experiments/{exp_id}/diff/{other_id}?field=title
```
- **Expected:** 400 error: `"'field' must be one of: aim, objective, procedure, observations, conclusion"`.

### P11-05 · strip_html Utility
- Verify `BeautifulSoup` correctly strips HTML:
  - `<p>Hello <strong>world</strong></p>` → `"Hello world"`
  - `<ul><li>Item 1</li><li>Item 2</li></ul>` → `"Item 1\nItem 2"`
  - `None` → `""`

### P11-06 · sanitise_html Utility
- Pass HTML with a `<script>` tag and `onclick` attribute.
- **Expected:** Script tag removed. `onclick` stripped. Safe content preserved.

### P11-07 · fields_changed — Rich Text Audit Trail
- Edit an experiment's `procedure` and `aim` fields. Save.
- Retrieve the audit log entry for that save.
- **Expected:** `detail` field contains something like:
  ```
  Rich-text edits → procedure (65% similar); aim (fully replaced)
  ```

---

## Phase 12 — Admin Panel

### P12-01 · Admin Page Access Control
- Log in as `dave.r` (CHEM). Navigate to `/admin`.
- **Expected:** Either redirect to dashboard or 403. Admin content not visible.

### P12-02 · View All Users (QA)
- Log in as `qa.admin`. Navigate to Admin → Users.
- **Expected:** All users listed. Columns: Name, Username, Role, Department, Status, Last Login.

### P12-03 · Create User — Duplicate Username
- Try to create a user with username `dave.r` (already exists).
- **Expected:** Error: "Username already exists" (or similar 400 response).

### P12-04 · Role List
- Navigate to Admin → Roles.
- **Expected:** Shows QA, HOD, TL, CHEM roles with descriptions.

---

## Phase 13 — Error Handling & Edge Cases

### P13-01 · No More `[object Object]` Notifications
- Navigate to `/experiments/unlock` as any user.
- **Expected:** Zero `[object Object]` notifications. Any API error shows a readable English message.

### P13-02 · FastAPI Validation Error Readable
- Trigger a validation error (e.g. send invalid data).
- **Expected:** Error toast shows field name + reason (e.g. `"page_size: Input should be ≤ 500"`), NOT `[object Object]`.

### P13-03 · 404 — Experiment Not Found
- Navigate to `/experiments/00000000-0000-0000-0000-000000000000`.
- **Expected:** Error state shown ("Experiment not found") or redirect. No blank screen.

### P13-04 · Backend Down
- Stop the backend server. Perform any action (load experiments list).
- **Expected:** Meaningful error toast ("Network Error" or timeout message). App does not crash.

### P13-05 · Concurrent Session
- Log in as `dave.r` in two tabs simultaneously.
- Perform an edit in tab 1. Reload tab 2.
- **Expected:** Both tabs reflect the same data. No conflicts or stale data errors.

### P13-06 · Large page_size — No More 422
- The backend now accepts `page_size` up to 500.
- Confirm `/api/unlock-requests/?page_size=200` returns 200/401 (not 422).
- Confirm `/api/experiments?page_size=200` similarly.

---

## Checklist Summary

Use this checklist to track test completion:

```
Phase 1 — Authentication
[ ] P1-01  Valid login
[ ] P1-02  Invalid login
[ ] P1-03  Logout
[ ] P1-04  Token refresh
[ ] P1-05  Expired refresh token
[ ] P1-06  Change password
[ ] P1-07  Change password wrong current

Phase 2 — User & Role Management
[ ] P2-01  List users
[ ] P2-02  Create user
[ ] P2-03  Edit role
[ ] P2-04  Deactivate / Activate
[ ] P2-05  Role-based sidebar

Phase 3 — Setup
[ ] P3-01  Create department
[ ] P3-02  Create project
[ ] P3-03  Create notebook
[ ] P3-04  Notebook permissions

Phase 4 — Experiment Lifecycle
[ ] P4-01  Create experiment
[ ] P4-02  Edit fields
[ ] P4-03  Submit
[ ] P4-04  Verify (TL)
[ ] P4-05  Approve (QA)
[ ] P4-06  Reject
[ ] P4-07  Version history
[ ] P4-08  View by status

Phase 5 — Rich Text Editor
[ ] P5-01  Basic formatting
[ ] P5-02  Lists
[ ] P5-03  Headings & blockquote
[ ] P5-04  Read-only mode
[ ] P5-05  Empty field
[ ] P5-06  Large content

Phase 6 — Ketcher Scheme
[ ] P6-01  Scheme tab visible
[ ] P6-02  Draw and save
[ ] P6-03  Reload persisted
[ ] P6-04  Read-only scheme
[ ] P6-05  Empty scheme
[ ] P6-06  Responsive height

Phase 7 — ATR
[ ] P7-01  Raise ATR
[ ] P7-02  Submit ATR
[ ] P7-03  Assign ATR
[ ] P7-04  Complete ATR
[ ] P7-05  Attachment upload
[ ] P7-06  Role restriction

Phase 8 — Unlock Request
[ ] P8-01  Raise request
[ ] P8-02  Duplicate blocked
[ ] P8-03  Approve
[ ] P8-04  Reject
[ ] P8-05  Non-QA cannot approve
[ ] P8-06  Resolved fields

Phase 9 — Unlock Experiments Page
[ ] P9-01  No [object Object] on load
[ ] P9-02  Inactive tab
[ ] P9-03  Delayed Submission tab
[ ] P9-04  Delayed Approval tab
[ ] P9-05  Pending Review tab
[ ] P9-06  Badge pre-fetch
[ ] P9-07  Row navigation
[ ] P9-08  Search
[ ] P9-09  Status filter

Phase 10 — Audit Log
[ ] P10-01  QA sees all
[ ] P10-02  TL sees own
[ ] P10-03  CHEM sees own
[ ] P10-04  Search by username
[ ] P10-05  Filter by module
[ ] P10-06  Filter by action
[ ] P10-07  Date range
[ ] P10-08  Combined filters
[ ] P10-09  Collapsible panel
[ ] P10-10  Quick search
[ ] P10-11  Pagination
[ ] P10-12  Audit after save

Phase 11 — Rich Text Diff API
[ ] P11-01  HTML diff format
[ ] P11-02  Unified diff format
[ ] P11-03  Identical content
[ ] P11-04  Invalid field name
[ ] P11-05  strip_html
[ ] P11-06  sanitise_html
[ ] P11-07  fields_changed audit trail

Phase 12 — Admin Panel
[ ] P12-01  Access control
[ ] P12-02  View users
[ ] P12-03  Duplicate username
[ ] P12-04  Role list

Phase 13 — Error Handling
[ ] P13-01  No [object Object]
[ ] P13-02  Validation error readable
[ ] P13-03  404 handling
[ ] P13-04  Backend down
[ ] P13-05  Concurrent sessions
[ ] P13-06  Large page_size accepted
```

---

## Environment Setup

### Start Backend
```bash
cd D:/sensor-proto/backend
venv/Scripts/activate        # Windows
# source venv/bin/activate   # Linux / macOS
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### Start Frontend
```bash
cd D:/sensor-proto
npm run dev
# Opens at http://localhost:5173
```

### Reset Test Data (optional)
```sql
-- Run in PostgreSQL chemia_eln database
TRUNCATE unlock_requests, audit_log RESTART IDENTITY CASCADE;
UPDATE experiments SET status = 'DRAFT' WHERE full_code = 'OQ/R1/S1/E00001/001';
```

### API Explorer
Swagger UI: `http://localhost:8002/api/docs`  
ReDoc:       `http://localhost:8002/api/redoc`
