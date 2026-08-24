# ARD Legacy Functional Specification

> **Status:** IN PROGRESS — Phase 1 discovery running  
> **Source of truth:** Angular ARD (`ARD CodeBase/ARD CodeBase/ard-angular`) + Java backends (`ard-java`, `ard-service-java`)  
> **Last updated:** 2026-08-01  
> **Maintainer:** Principal parity audit

This document captures the complete product specification for the legacy Angular+Java ARD system, extracted from source code. It is the authoritative reference for parity work against Laurus-ELN 3.

---

## ID Scheme

| Prefix | Domain |
|--------|--------|
| `LEG-AUTH-nnn` | Authentication & session |
| `LEG-DASH-nnn` | Dashboards |
| `LEG-PROJ-nnn` | Projects |
| `LEG-ATR-nnn` | ATR forms |
| `LEG-TEST-nnn` | Tests / test execution |
| `LEG-TRF-nnn` | QC-TRF forms |
| `LEG-EXP-nnn` | Experiments |
| `LEG-NB-nnn` | Notebooks |
| `LEG-TMPL-nnn` | Templates |
| `LEG-CFG-nnn` | Configuration / masterdata |
| `LEG-INV-nnn` | Inventory integrations |
| `LEG-RPT-nnn` | Reports & exports |
| `LEG-SRCH-nnn` | Search |
| `LEG-RBAC-nnn` | Roles, permissions, data scope |
| `LEG-NOTIF-nnn` | Notifications |
| `LEG-AUDIT-nnn` | Audit trails |
| `LEG-EXT-nnn` | External integrations (Empower, Stability) |

---

## System Architecture

### Three-tier URL architecture
| Base URL | Project | Purpose |
|----------|---------|---------|
| `/Chemia/users/` | Chemia auth app (separate) | Authentication, user mgmt, security questions |
| `/ARD/` | ard-java | Main business logic: projects, notebooks, experiments, tests, templates, masterdata, search, reports |
| `/ARD-Service/` | ard-service-java | ATR form lifecycle, QC-TRF forms, stability integration |
| `/token/` | ard-service-java | JWT refresh (public) |
| `/tenants/` | ard-service-java | Tenant list |

Every request carries `X-TenantID` and `locale` headers. Multitenant architecture — each tenant has its own database schema (confirmed retired for ELN3: single-tenancy only).

### Role IDs
| Role Name | Role ID |
|-----------|---------|
| CHEMIST / Analyst | 11301 |
| TEAM_LEAD | 11302 |
| HEAD_OF_DEPARTMENT | 11303 |
| QUALITY_ASSURANCE | 1061105 |
| SE (Senior Executive) | TBD |
| ARDQA | 1061307 |
| ARD_CUSTOMER | 11501 |

---

## Section 1 — Authentication & Session (LEG-AUTH)

> **Discovery status:** Partial — requires reading auth component files

### LEG-AUTH-001: Login
- **Evidence:** `ard-angular/src/app/login/` (LoginComponent), `/Chemia/users/login` endpoint
- **Roles:** All users
- **Behavior:** Username + password login. On success, JWT returned and stored. Redirects based on role.
- **ELN3 equivalent:** `/auth/login` FastAPI endpoint, LoginPage.tsx
- **Parity:** TBD

### LEG-AUTH-002: Disclaimer page
- **Evidence:** `ard-angular/src/app/login/disclaimer/` (DisclaimerComponent)
- **Roles:** All users (shown on first login or policy change)
- **Behavior:** Must accept disclaimer before proceeding
- **ELN3 equivalent:** Unknown
- **Parity:** TBD

### LEG-AUTH-003: Force password change
- **Evidence:** `ard-angular/src/app/login/force-change-passwd/`
- **Roles:** All users
- **Behavior:** Forced on first login or admin reset
- **ELN3 equivalent:** Unknown
- **Parity:** TBD

### LEG-AUTH-004: Security questions
- **Evidence:** `ard-angular/src/app/login/security-question/`
- **Roles:** All users
- **Behavior:** Security questions for password reset flow
- **ELN3 equivalent:** Unknown
- **Parity:** TBD

### LEG-AUTH-005: Session timeout
- **Evidence:** `ard-angular/src/app/login/sessiontimeout/`
- **Roles:** All users
- **Behavior:** Session expiry warning and redirect to login
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-AUTH-006: Re-authentication / e-signature
- **Evidence:** Java `ReAuthenticationMgr`, Angular `reauthentication-form-atr`, `reauthentication` components
- **Roles:** Required for sensitive state transitions
- **Behavior:** User must re-enter password to confirm critical actions (ATR approvals, verifications, test verifications, experiment approvals, etc.)
- **ELN3 equivalent:** `verify-password` endpoint, `ESignatureModal` or similar
- **Parity:** TBD

---

## Section 2 — Dashboards (LEG-DASH)

> **Discovery status:** In progress

### LEG-DASH-001: HOD Dashboard
- **Evidence:** `ard-angular/src/.../hod-dashboard/`
- **Roles:** HOD only
- **Behavior:** Shows team ATR queues, test queues, experiment queues, KPIs
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-DASH-002: Team Lead Dashboard
- **Evidence:** `ard-angular/src/.../tl-dashboard/`
- **Roles:** TL only
- **Behavior:** Shows my-team ATR/test/experiment queues
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-DASH-003: Chemist/Analyst Dashboard
- **Evidence:** `ard-angular/src/.../chemist-dashboard/`
- **Roles:** Analyst/Chemist
- **Behavior:** Shows own assigned tests, ATRs, experiments
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-DASH-004: Customer Dashboard
- **Evidence:** `ard-angular/src/.../customer-dashboard/`
- **Roles:** Customer/Requester roles
- **Behavior:** Shows submitted ATRs, pending clarifications, ongoing ATRs
- **Sub-components:** `on-going-atr-forms-cust`, `pending-clarifications-forms-cust`, `common-atr-forms-display-table-customer`, `common-atr-tests-display-table-customer`
- **ELN3 equivalent:** Missing
- **Parity:** MISSING

---

## Section 3 — Projects (LEG-PROJ)

> **Discovery status:** In progress

### LEG-PROJ-001: Project creation
- **Evidence:** `AdProjectController.addNewProject()` `/ARD/adproject/addNewProject`
- **Roles:** HOD, TL
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-002: Project list (open)
- **Evidence:** `AdProjectController.getOpenProjects()` `/ARD/adproject/getOpenProjects`
- **Roles:** Project members see their projects; HOD sees all
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-003: Project list (closed)
- **Evidence:** `AdProjectController.getClosedProjects()` `/ARD/adproject/getClosedProjects`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-004: Project editor (details, users, notebooks, specs, STP, attachments)
- **Evidence:** `project-editor` component, multiple `AdProjectController` endpoints
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-005: Project users management
- **Evidence:** `AdProjectController.addProjUsers()`, `.removeProjUsers()`, `.loadProjectUsers()`
- **Roles:** HOD/TL can add/remove members
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-006: Project close/deactivate/reopen
- **Evidence:** `AdProjectController.closeProject()`, `.deactivateProject()`, `.reopenProject()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-007: Project STP worksheets
- **Evidence:** `AdProjectSTPController` `/ARD/adProjectSTP/`
- **Operations:** create, load, edit, approve, new-version, delete
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-008: Project specifications
- **Evidence:** `AdProjectSpecificationsController` `/ARD/adProjectSpecifications/`
- **Operations:** load, save, edit, approve, submit, remove
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-009: Project attachments
- **Evidence:** `AdProjectController.persistAttachments()`, `.editAttachments()`, `.removeAttachments()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-PROJ-010: Project audit trail
- **Evidence:** `AdProjectController.loadProjAuditTrial()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 4 — ATR Forms (LEG-ATR)

> **Discovery status:** In progress

### LEG-ATR-001: ATR form creation (raise ATR)
- **Evidence:** `ATRFormController.raiseAtrForm()` `/ARD-Service/atrform/raiseAtrForm`
- **Roles:** Customer, Analyst with ATR creation rights
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-002: ATR save (draft)
- **Evidence:** `ATRFormController.saveAtrForm()` `/ARD-Service/atrform/saveAtrForm`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-003: ATR submit
- **Evidence:** `ATRFormController.submitAtrForm()` `/ARD-Service/atrform/submitAtrForm`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-004: ATR view
- **Evidence:** `ATRFormController.viewAtrForm({id})` `/ARD-Service/atrform/viewAtrForm/{id}`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-005: ATR list by status
- **Evidence:** `ATRFormController.listAtrForms({userId}/{statusId})` 
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-006: ATR withdraw
- **Evidence:** `ATRFormController.withdrawAtrForm()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-007: ATR clone
- **Evidence:** `ATRFormController.cloneAtrForm()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-008: ATR sample management (add/remove/manage samples)
- **Evidence:** `ATRFormController.addSamples()`, `.manageSamples()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-009: ATR test management (add/remove/modify tests on ATR)
- **Evidence:** `ATRFormController.addTestToAtr()`, `.removeTestFromAtr()`, `.modifyTestInAtr()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-010: QA pre-approval
- **Evidence:** `ATRFormController.qaApprove()`, Angular `qa-pre-approval` sub-component
- **Roles:** QA only
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-011: QA pre-approval rework
- **Evidence:** `qaRework` endpoint, `PRE_APPROVAL_REWORK` state
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-012: ATR clarification request
- **Evidence:** `ATRFormController.clarificationRequest()`, `ATRFormController.clarifyForm()`
- **Angular:** `atr-clarification-comment` sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-013: ATR approval (HOD/authorized)
- **Evidence:** `AtrFormController.approveAtrForm()` `/ARD/atrForm/approveAtrForm`
- **Roles:** HOD
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-014: ATR verification
- **Evidence:** state VERIFIED
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-015: ATR certification
- **Evidence:** `ATRFormController.certifyAtrForm()`, `AtrFormController.certifyAtrForm()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-016: ATR certification rework
- **Evidence:** `CERTIFICATION_REWORK` state
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-017: ATR certification request
- **Evidence:** `ATRFormController.requestCertification()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-018: ATR COA generation
- **Evidence:** `AtrFormController.generateCOA()` `/ARD/atrForm/generateCOA`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-019: ATR details report / print form
- **Evidence:** `AtrFormController.generateDetailsReport()`, `.printForm()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-020: ATR supporting documents (add/remove)
- **Evidence:** `ATRFormController.addSupportingDoc()`, `.removeSupportingDoc()`
- **Angular:** `certification-attachment` sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-021: ATR label generation
- **Evidence:** `ATRFormController.generateLabel()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-022: ATR batch summary
- **Evidence:** Angular route `batchsummary`, `LandingPageController.getBatchSummary()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-023: ATR comments
- **Evidence:** `atr-comments` Angular sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-024: ATR analysis remarks
- **Evidence:** `analysis-remarks` Angular sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-025: ATR form attributes tab
- **Evidence:** `form-attributes` Angular sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-026: ATR experiment reference
- **Evidence:** `app-exp-reference` Angular sub-component, `AtrFormExpReferenceController.saveExpReferenceToForm()`, `.createExpFromSummary()`, `.getNotebookReferences()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-027: ATR reassignment (form and test)
- **Evidence:** Angular routes `reassignform`, `reassigntest`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-028: ATR queues
- **Evidence:** Angular routes: `myAtr`, `teamatr`, `pendingApproval`, `pendingClarification`, `clarificationRequest`, `clarifiedForm`, `methodDevelopmentAtrs`, `certificationAtrs`, `certificationRework`, `unsatisfactoryTest`, `queuedAtr`, `onGoingAtr`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-029: ATR events (audit trail)
- **Evidence:** `ATRFormController.getAtrEvents({id})`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-ATR-030: ATR summary tab
- **Evidence:** `summary` Angular sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 5 — Tests (LEG-TEST)

> **Discovery status:** In progress

### LEG-TEST-001: Test queues
- **Evidence:** Angular routes: `teamQueue`, `unassignedTest`, `assignedTest`, `inprogressTest`, `pendingVerification`, `testsverificationqueue`, `reworkTest`, `verifiedTest`, `enhancementReq`, `delegatedTest`, `unlockedTest`, `verificationQueue`, `atrAudit`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-002: Self-assign test
- **Evidence:** `TestMenuController.selfAssign()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-003: Assign test to TL
- **Evidence:** `TestMenuController.assignToTL()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-004: Delegate test
- **Evidence:** `TestMenuController.delegateTest()`, Angular `delegatepopup` component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-005: Takeover test
- **Evidence:** `TestMenuController.takeoverTest()`, Angular `takeover-handover` component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-006: Handover test
- **Evidence:** `TestMenuController.handoverTest()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-007: Pull for verification
- **Evidence:** `TestMenuController.pullForVerification()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-008: Test execution (process window)
- **Evidence:** Angular `process-window`, `test-process` module; sub-components: `atr-result`, `atr-rawdata`, `chromatography-section`, `test-result`, `test-version-history`, `result-summary`, `result-comments`, `result-remarks`, `atr-signature`, `atr-comments`
- **Java:** `AtrTestController.saveTestResult()` `/ARD/atrTest/saveTestResult`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-009: Test result entry
- **Evidence:** `atr-result` sub-component, `AtrTestController.saveTestResult()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-010: Raw data attachment
- **Evidence:** `atr-rawdata` sub-component, `TestMenuController.addRawDataAttachment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-011: Chromatography section
- **Evidence:** `chromatography-section` sub-component, `AtrTestController.convertChromatogram()` (Empower integration)
- **ELN3 equivalent:** TBD
- **Parity:** TBD (Empower dependency)

### LEG-TEST-012: Test version history
- **Evidence:** `test-version-history` sub-component, `AtrTestController.getVersionHistory()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-013: Test verification
- **Evidence:** `AtrTestController.verifyResult()`, angular `atr-signature` component
- **Roles:** TL or HOD
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-014: Test reject/rework
- **Evidence:** `AtrTestController.rejectResult()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-015: Generate AR number
- **Evidence:** `AtrTestController.generateARNumber()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-016: Notebook reference from test
- **Evidence:** `AtrTestController.addNotebookReference()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-017: Create experiment from test
- **Evidence:** `AtrTestController.createExperimentFromTest()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-018: Merge PDF
- **Evidence:** `AtrTestController.mergePDF()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-019: Enhancement request
- **Evidence:** Angular route `enhancementReq`, `LandingPageController.getEnhancementTests()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEST-020: Unsatisfactory test
- **Evidence:** Angular route `unsatisfactoryTest`, `LandingPageController.getUnsatisfactoryTests()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 6 — QC-TRF Forms (LEG-TRF)

> **Discovery status:** In progress

### LEG-TRF-001: My TRF forms list
- **Evidence:** Angular route `qcTrfForms/my-trfforms`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-002: Received TRF forms list
- **Evidence:** Angular route `qcTrfForms/received-trf-forms`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-003: TRF form creation
- **Evidence:** Angular `trfforms` component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-004: TRF sampling details tab
- **Evidence:** Angular `sampling-details` sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-005: TRF preparation details tab
- **Evidence:** Angular `preparation-details` sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-006: TRF receiving details tab
- **Evidence:** Angular `receiving-details` sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-007: TRF attributes tab
- **Evidence:** Angular `attributes` sub-component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-008: TRF test specification editor/viewer
- **Evidence:** Angular `test-specification-editor`, `test-specification-viewer` sub-components
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-009: TRF summary
- **Evidence:** Angular `summary` sub-component (in trfforms)
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TRF-010: TRF form events (audit)
- **Evidence:** Angular `trf-form-event` component
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 7 — Experiments (LEG-EXP)

> **Discovery status:** In progress

### LEG-EXP-001: Experiment creation/editor
- **Evidence:** `AdExperimentController.loadExperiment()`, `.saveExperiment()`, Angular `experiment-editor`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-002: Experiment viewer (read-only)
- **Evidence:** Angular `experiment-viewer`, `viewExperiment` route
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-003: Experiment submit for review
- **Evidence:** `AdExperimentController.submitExperiment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-004: Experiment approval
- **Evidence:** `AdExperimentController.approveExperiment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-005: Experiment clone
- **Evidence:** `AdExperimentController.cloneExperiment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-006: Experiment unlock request
- **Evidence:** `AdExperimentController.unlockExperiment()`; Angular route `unlockrequests`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-007: Experiment review comments
- **Evidence:** `AdExperimentController.loadReviewComments()`, `.addReviewComment()`, Angular route `reviewcomments`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-008: Experiment PDF generation
- **Evidence:** `AdExperimentController.generatePdf()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-009: Equipment tracking in experiment
- **Evidence:** `AdExperimentController.trackEquipment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-010: Weighing details in experiment
- **Evidence:** `AdExperimentController.saveWeighingDetails()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-011: pH details in experiment
- **Evidence:** `AdExperimentController.savePHDetails()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-012: Section comments
- **Evidence:** `AdExperimentController.addSectionComment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-013: Version comparison
- **Evidence:** `AdExperimentController.compareVersions()`, Angular route `experimentHistory`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-014: Post-analytical data
- **Evidence:** `AdExperimentController.savePostAnalyticalData()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-015: Experiment history / version list
- **Evidence:** `AdExperimentController.loadExperimentHistory()`, Angular route `experimentHistory`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-016: Experiment report
- **Evidence:** `AdExperimentController.getExperimentReport()`, Angular route `experimentReport`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-017: Experiment events tracking
- **Evidence:** `AdExperimentController.saveExperimentEvents()`, Angular route `adExperimentEvents`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-018: Experiment review queues
- **Evidence:** Angular routes: `reviewrequests`, `unlockrequests`, `reassignrequests`, `ongoingexp`, `reviewcomments`, `unlockedexp`, `pendingreview`, `submittedexp`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-019: Delayed experiments report
- **Evidence:** Angular `delayedapproval-exp`, `delayedsubmission-exp` (exp-report module)
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-EXP-020: Inactive experiments report
- **Evidence:** Angular `inactive-exp`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 8 — Notebooks (LEG-NB)

> **Discovery status:** In progress

### LEG-NB-001: Notebook creation
- **Evidence:** `AdProjectController.addNewNotebook()`, Angular `add-new-notebook`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-002: Notebook editor
- **Evidence:** Angular `notebook-editor`, `AdNotebookController.loadNotebook()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-003: Notebook user management
- **Evidence:** `AdNotebookController.manageUsers()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-004: Notebook experiment list
- **Evidence:** `AdNotebookController.listExperiments()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-005: Notebook result parameters
- **Evidence:** `AdNotebookController.loadResultParameters()`, `.getUOM()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-006: Notebook events/audit
- **Evidence:** `AdNotebookController.recordEvents()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-007: Notebook STP templates
- **Evidence:** `AdNotebookController.loadSTPTemplates()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-NB-008: Clone experiment to notebook
- **Evidence:** `AdNotebookController.cloneExperiment()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 9 — Templates (LEG-TMPL)

> **Discovery status:** In progress

### LEG-TMPL-001: Template creation
- **Evidence:** `ExpTemplatesController.createTemplate()` `/ARD/templates/createTemplate`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-002: Template edit
- **Evidence:** `ExpTemplatesController.loadEditTemplateDetails()`, `.saveEditedTemplateDetails()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-003: Template submit for approval
- **Evidence:** `ExpTemplatesController.submitForApproval()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-004: Template approve
- **Evidence:** `ExpTemplatesController.approveTemplate()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-005: Template rework
- **Evidence:** `ExpTemplatesController.reworkTemplate()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-006: Template new version
- **Evidence:** `ExpTemplatesController.saveNewVersionTemplateDetails()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-007: Template preview
- **Evidence:** `ExpTemplatesController.previewTemplateSections()`, Angular `template-section > experiment-template > preview`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-008: Template section types
- **Evidence:** Angular components: `datatable-section`, `richtext-section`, `combined-section`, `standard-preparation`, `embedded-excel`, `params`; Java `TemplateDataItemsController`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-009: Template data items
- **Evidence:** `TemplateDataItemsController` endpoints: `loadlovTypesOptionsList`, `saveDataItems`, `editDataItems`, `removeDataItems`, `getDataItemsList`, `saveSectionDetails`, `removeTemplateSection`, `getTemplateSections`, `addNewSection`, etc.
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-010: Template pending approval queue
- **Evidence:** Angular `template-pending-approval`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-011: Template events
- **Evidence:** Angular `template-event`, `TemplateDataItemsController.getTemplateSectionEvents()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TMPL-012: Clone template
- **Evidence:** `ExpTemplatesController.saveClonedTemplateDetails()`, `.getClonedTemplateDetails()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 10 — Configuration / Masterdata (LEG-CFG)

> **Discovery status:** In progress

### LEG-CFG-001: Test configuration
- **Evidence:** `TestMasterDataController.loadTestMasterdata()`, `.saveEditTest()`, `.enableDisableTest()`
- **Angular route:** `configuration/testConfiguration`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-002: ATR attributes
- **Evidence:** `TestMasterDataController.loadAtrAttributes()`, `.saveEditAttribute()`, `.enableDisableAttribute()`
- **Angular route:** `configuration/atrAttributes`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-003: Test groups
- **Evidence:** `TestMasterDataController.loadTestGroups()`, `.saveEditTestGroup()`, `.deleteTestGroup()`
- **Angular route:** `configuration/testGroups`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-004: Form types and attributes
- **Evidence:** `TestMasterDataController.loadFormType()`, `.saveFormType()`, `.getFormTypeAttributesList()`, `.saveAttributesForType()`, etc.
- **Angular route:** `configuration/formType`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-005: ARD settings
- **Evidence:** Angular route `configuration/ardSetting`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-006: General lookup
- **Evidence:** Angular route `configuration/generalLookup`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-007: Test technique master
- **Evidence:** `TestMasterDataController.loadTestTechnique()`, `.saveEditTestTechnique()`, `.enableDisableTestTechnique()`
- **Angular route:** `configuration/testTechniqueMaster`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-008: Analyst qualification
- **Evidence:** `TestMasterDataController.loadAnalystQualification()`, `.saveAnalystQualification()`, `.getAnalystUser()`
- **Angular route:** `configuration/analystQualification`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-009: Qualification alert
- **Evidence:** Angular route `configuration/qualificationAlert`, `TestMasterDataController.loadQualificationAlert()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-010: Qualification matrix
- **Evidence:** Angular route `configuration/qualificationMatrix`, `TestMasterDataController.getUsersAndTechniques()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-011: Test result parameters
- **Evidence:** `TestMasterDataController.saveEditResultparam()`, `.enableDisableResult()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-012: Test specification
- **Evidence:** `TestMasterDataController.saveTestspecification()`, `.editSaveTestSpecification()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-013: Test groups and form types
- **Evidence:** `TestMasterDataController.saveTestGroupFormType()`, `.removeTestgroup()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-CFG-014: Import analyst qualification
- **Evidence:** `TestMasterDataController.saveImportAnalystQualification()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 11 — Reporting (LEG-RPT)

> **Discovery status:** In progress

### LEG-RPT-001: ATR dashboard report
- **Evidence:** `ReportingController.loadAtrDashboardDetails()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-002: Project report
- **Evidence:** `ReportingController.generateProjectReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-003: Sample management report
- **Evidence:** `ReportingController.generateSampleManagementReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-004: Activity statistics report
- **Evidence:** `ReportingController.activityStaticsReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-005: Chemist statistics report
- **Evidence:** `ReportingController.chemistStaticsReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-006: Test tracking report
- **Evidence:** `ReportingController.testTrackingReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-007: Test type statistics report
- **Evidence:** `ReportingController.testTypeStatsReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-008: Comparison report
- **Evidence:** `ReportingController.getComparisonReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-009: Project test statistics report
- **Evidence:** `ReportingController.projectTestStatisticsReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-010: Overall statistics report
- **Evidence:** `ReportingController.overAllStatisticsReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-RPT-011: ATR last-week team stats report
- **Evidence:** `ReportingController.atrLastWeekTeamStatsReport()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 12 — Search (LEG-SRCH)

> **Discovery status:** In progress

### LEG-SRCH-001: Global search
- **Evidence:** `SearchController.getsearch()`, `.generalsearch()` `/ARD/search/`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-SRCH-002: Experiment search
- **Evidence:** `SearchController.expsearch()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-SRCH-003: Project search
- **Evidence:** `SearchController.projectsearch()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-SRCH-004: Test form search
- **Evidence:** `SearchController.testformsearch()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-SRCH-005: Load experiment params for search
- **Evidence:** `SearchController.loadExpparam()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 13 — Teams (LEG-TEAM)

> **Discovery status:** In progress

### LEG-TEAM-001: Team management
- **Evidence:** `AtrTeamController.addTeam()`, `.teamEnableDiable()`, `.loadTeamList()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEAM-002: Team member management
- **Evidence:** `AtrTeamController.addTeamMember()`, `.removeTeamMember()`, `.updateTeamMember()`, `.loadTeamMembersList()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEAM-003: My ATR team
- **Evidence:** `AtrTeamController.loadMyATRTeam()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEAM-004: QA events and types
- **Evidence:** `AtrTeamController.getQAEventType()`, `.showQAEvents()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

### LEG-TEAM-005: Load ATR by criteria
- **Evidence:** `AtrTeamController.loadTeamATRBasedOnCriteria()`
- **ELN3 equivalent:** TBD
- **Parity:** TBD

---

## Section 14 — External Integrations (LEG-EXT)

### LEG-EXT-001: Empower chromatogram integration
- **Evidence:** `AtrTestController.convertChromatogram()` `/ARD/atrTest/convertChromatogram`, `AdEmpowerController` `/ARD/adEmpowerController/`
- **Operations:** loadEmpowerMetaData, updateEmpowerMetaData, empowerProjectData CRUD, empowerServerConnections
- **ELN3 equivalent:** Not implemented
- **Parity:** BLOCKED — requires Waters Empower server/credentials

### LEG-EXT-002: Stability module integration
- **Evidence:** `StabilityController` in ard-service-java; calls `/Stability/` external service
- **ELN3 equivalent:** Not implemented
- **Parity:** BLOCKED — requires external Stability service

---

*This document will be completed after Phase 1 agent discovery returns full findings.*
