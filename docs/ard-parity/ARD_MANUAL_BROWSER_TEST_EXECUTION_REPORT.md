# ARD Manual Browser Test Execution Report

> **Status:** NOT STARTED — awaiting implementation of gaps found in Phase 5  
> **Last updated:** 2026-08-01  
> **Convention:** Test IDs use format `MANUAL-TEST-NNN`

## Test Environment

| Item | Value |
|------|-------|
| Frontend URL | http://localhost:5173 |
| Backend URL | http://localhost:8000 |
| Database | laurus_eln_new (test) |
| Record prefix | `CLAUDE-ARD-YYYYMMDD-HHMM-NNN` |

---

## Test User Accounts

> To be configured before testing

| Persona | Username | Role | Notes |
|---------|----------|------|-------|
| HOD | TBD | HOD | Department head |
| Team Lead | TBD | TL | Manages analysts |
| Analyst A | TBD | CHEM | Primary analyst |
| Analyst B | TBD | CHEM | Secondary analyst (for cross-role tests) |
| QA | TBD | QA | Quality assurance |
| Non-member | TBD | CHEM | Not member of any test project |
| Admin | TBD | SUPER_ADMIN | System administrator |

---

## Group A — Access and Hiding

### MANUAL-TEST-A001: ARD menu visibility by role

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Login as HOD | ARD menu visible | — | — |
| 2 | Login as TL | ARD menu visible | — | — |
| 3 | Login as Analyst | ARD menu visible | — | — |
| 4 | Login as QA | ARD menu visible | — | — |
| 5 | Login as non-ARD user | ARD menu NOT visible | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

### MANUAL-TEST-A002: Direct URL access without permission

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Login as non-ARD user | — | — | — |
| 2 | Navigate directly to `/ard/dashboard` | Redirect to login or 403 | — | — |
| 3 | Navigate directly to `/ard/atr` | Redirect to login or 403 | — | — |
| 4 | Navigate directly to `/ard/atr/[valid-id]` | Redirect to login or 403 | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group B — Project and Notebook Membership

### MANUAL-TEST-B001: Project membership data isolation

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Login as HOD | — | — | — |
| 2 | Create project `CLAUDE-PROJ-20260801-0001` | Project created | — | — |
| 3 | Add only Analyst A as member | Analyst A is member | — | — |
| 4 | Login as Analyst A | — | — | — |
| 5 | Navigate to projects list | Project visible | — | — |
| 6 | Open the project | Project accessible | — | — |
| 7 | Login as Analyst B (non-member) | — | — | — |
| 8 | Navigate to projects list | Project NOT visible | — | — |
| 9 | Navigate directly to project URL | 403 or redirect | — | — |
| 10 | Search for project | NOT in search results | — | — |
| 11 | Login as HOD, remove Analyst A from project | — | — | — |
| 12 | Login as Analyst A | — | — | — |
| 13 | Navigate to projects list | Project NOT visible | — | — |
| 14 | Navigate directly to project URL | 403 or redirect | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group C — ATR Lifecycle

### MANUAL-TEST-C001: Full ATR lifecycle — happy path

**Record:** `CLAUDE-ATR-20260801-0001`

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Create new ATR | Analyst/Customer | ATR created, status=DRAFT | — | — |
| 2 | Fill required fields | — | Validation passes | — | — |
| 3 | Save draft | — | Status=SAVED | — | — |
| 4 | Submit ATR | — | Status=NEW | — | — |
| 5 | QA pre-approve | QA | Status=QA_PRE_APPROVAL | — | — |
| 6 | HOD approves | HOD | Status=APPROVED, e-sig required | — | — |
| 7 | Tests assigned and completed | Analyst | All tests VERIFIED | — | — |
| 8 | ATR verified | TL/HOD | Status=VERIFIED | — | — |
| 9 | Request certification | — | Status=CERT_REQUESTED | — | — |
| 10 | Certify ATR | Authorized | Status=CERTIFIED, COA generated | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-C002: ATR clarification flow

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Submit ATR | Analyst | Status=NEW | — | — |
| 2 | QA requests clarification | QA | Status=PENDING_CLARIFICATION | — | — |
| 3 | Creator adds clarification | Creator | Status=CLARIFIED | — | — |
| 4 | ATR proceeds to approval | HOD | Status=PENDING_APPROVAL | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-C003: ATR rejection

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Submit ATR | Analyst | Status=NEW | — | — |
| 2 | QA pre-approves | QA | — | — | — |
| 3 | HOD rejects with reason | HOD | Status=REJECTED | — | — |
| 4 | Creator cannot re-submit rejected ATR | Analyst | Action blocked | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-C004: ATR withdrawal

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Submit ATR | Creator | Status=NEW | — | — |
| 2 | Creator withdraws | Creator | Status=WITHDRAWN | — | — |
| 3 | Cannot transition from WITHDRAWN | Any | Action blocked | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-C005: E-signature validation

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | HOD clicks Approve ATR | E-signature dialog shown | — | — |
| 2 | Enter wrong password | Error shown, not approved | — | — |
| 3 | Leave password empty | Error shown, not approved | — | — |
| 4 | Enter correct password | ATR approved | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group D — Test Lifecycle

### MANUAL-TEST-D001: Test assignment and execution

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | View unassigned test queue | HOD/TL | Test visible | — | — |
| 2 | Self-assign test | Analyst | Status=ASSIGNED | — | — |
| 3 | Enter test results | Analyst | Results saved | — | — |
| 4 | Submit results | Analyst | Status=PENDING_VERIFICATION | — | — |
| 5 | TL verifies (e-sign) | TL | Status=VERIFIED | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-D002: Test delegation

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | TL assigns test to Analyst A | TL | Status=ASSIGNED | — | — |
| 2 | Analyst A delegates to Analyst B | Analyst A | Status=DELEGATED | — | — |
| 3 | Analyst B sees delegated test | Analyst B | Test in delegated queue | — | — |
| 4 | Analyst A no longer sees as assigned | Analyst A | Not in my queue | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-D003: Takeover test

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Analyst A has test assigned | — | — | — | — |
| 2 | TL takes over test | TL | Test reassigned to TL/new analyst | — | — |
| 3 | Analyst A no longer sees test as assigned | Analyst A | Not in queue | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group E — QC-TRF

### MANUAL-TEST-E001: TRF form lifecycle

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Create TRF form | Analyst | Form created | — | — |
| 2 | Fill sampling, preparation, receiving | — | Fields saved | — | — |
| 3 | Submit TRF | Analyst | Status=SUBMITTED | — | — |
| 4 | QC registers TRF | QC | Status=REGISTERED | — | — |
| 5 | TRF completed | QC | Status=COMPLETED | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group F — Templates and Experiments

### MANUAL-TEST-F001: Template creation and publication

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Create template with richtext section | Section added | — | — |
| 2 | Add datatable section | Section added | — | — |
| 3 | Add parameters section | Section added | — | — |
| 4 | Submit for approval | Status=SUBMITTED | — | — |
| 5 | HOD approves | Status=APPROVED | — | — |
| 6 | Create experiment from template | Experiment created | — | — |
| 7 | All sections render correctly | All sections visible | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-F002: Experiment full lifecycle

| Step | Action | Role | Expected | Actual | Pass? |
|------|--------|------|----------|--------|-------|
| 1 | Create experiment in notebook | Analyst | Experiment created | — | — |
| 2 | Fill all sections | — | Data saved | — | — |
| 3 | Submit for review | Analyst | Status=SUBMITTED | — | — |
| 4 | Reviewer adds comments | TL/HOD | Comments saved | — | — |
| 5 | Approve experiment (e-sign) | TL/HOD | Status=APPROVED | — | — |
| 6 | PDF generated | — | PDF downloadable | — | — |
| 7 | Analyst requests unlock | Analyst | Status=UNLOCK_REQUESTED | — | — |
| 8 | HOD approves unlock (e-sign) | HOD | Status=UNLOCKED | — | — |
| 9 | Analyst makes changes and resubmits | Analyst | New version created | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group G — Reports, Audit, Notifications, Search

### MANUAL-TEST-G001: Audit trail accuracy

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Perform ATR state transition | — | — | — |
| 2 | View ATR events/audit | Event recorded with actor, timestamp, action | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-G002: Search data isolation

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Login as non-project member | — | — | — |
| 2 | Search for project-specific experiment | NOT in results | — | — |
| 3 | Search for project name | NOT in results | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

## Group H — Inventory Interlocks

### MANUAL-TEST-H001: Expired instrument blocked

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Mark an instrument as calibration-expired | — | — | — |
| 2 | Attempt to select instrument in experiment | Instrument not available or blocked | — | — |
| 3 | Attempt API call with expired instrument ID | 422 or 400 error | — | — |

**Status:** NOT RUN  
**Evidence:** —

### MANUAL-TEST-H002: Active instrument accepted

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Select active, calibrated instrument | Instrument selectable | — | — |
| 2 | Save experiment with instrument | Instrument ID persisted | — | — |
| 3 | View saved experiment | Correct instrument shown | — | — |

**Status:** NOT RUN  
**Evidence:** —

---

*All tests to be executed after implementation gaps are resolved in Phase 7.*
