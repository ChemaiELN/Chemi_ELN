# ARD Angular → ELN 3 Parity Matrix

> **Status:** IN PROGRESS — Phase 1 discovery running  
> **Last updated:** 2026-08-01  
> **Scale:** Every discovered legacy behavior gets one row

## Parity Status Codes
| Code | Meaning |
|------|---------|
| `PASS` | Equivalent and manually proven |
| `PARTIAL` | Exists but behavior differs or incomplete |
| `MISSING` | No equivalent found |
| `INCORRECT` | Implementation violates legacy contract |
| `SECURITY` | Permission or data isolation mismatch (P0) |
| `BLOCKED` | Missing environment/external dependency |
| `DECISION` | Deliberate retirement/redesign — needs product owner sign-off |

---

## Authentication & Session

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-AUTH-001 | Login | `login/LoginComponent` | `LoginPage.tsx`, `/auth/login` | PARTIAL | Single-tenancy; company selector removed (approved) |
| LEG-AUTH-002 | Disclaimer page | `login/disclaimer/DisclaimerComponent` | Not found | MISSING | |
| LEG-AUTH-003 | Force password change | `login/force-change-passwd/` | Not found | MISSING | |
| LEG-AUTH-004 | Security questions | `login/security-question/` | Not found | DECISION | May be out of scope for single-tenancy |
| LEG-AUTH-005 | Session timeout handler | `login/sessiontimeout/` | TBD | TBD | |
| LEG-AUTH-006 | Re-authentication / e-signature | `ReAuthenticationMgr`, `reauthentication-form-atr` | `verify-password`, e-sign modal | PARTIAL | Need to verify enforcement for all gated transitions |

---

## Dashboards

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-DASH-001 | HOD dashboard | `hod-dashboard/` | TBD | TBD | |
| LEG-DASH-002 | Team Lead dashboard | `tl-dashboard/` | TBD | TBD | |
| LEG-DASH-003 | Chemist/Analyst dashboard | `chemist-dashboard/` | TBD | TBD | |
| LEG-DASH-004 | Customer dashboard | `customer-dashboard/` | Not found | MISSING | Customer role not yet in ELN3 |

---

## Projects

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-PROJ-001 | Project creation | `AdProjectController.addNewProject` | TBD | TBD | |
| LEG-PROJ-002 | Project list (open) | `AdProjectController.getOpenProjects` | TBD | TBD | |
| LEG-PROJ-003 | Project list (closed) | `AdProjectController.getClosedProjects` | TBD | TBD | |
| LEG-PROJ-004 | Project editor | `project-editor`, multiple endpoints | TBD | TBD | |
| LEG-PROJ-005 | Project users management | `addProjUsers`, `removeProjUsers`, `loadProjectUsers` | TBD | TBD | |
| LEG-PROJ-006 | Project close/deactivate/reopen | `closeProject`, `deactivateProject`, `reopenProject` | TBD | TBD | |
| LEG-PROJ-007 | Project STP worksheets | `AdProjectSTPController` | TBD | TBD | |
| LEG-PROJ-008 | Project specifications | `AdProjectSpecificationsController` | TBD | TBD | |
| LEG-PROJ-009 | Project attachments | `persistAttachments`, `editAttachments`, `removeAttachments` | TBD | TBD | |
| LEG-PROJ-010 | Project audit trail | `loadProjAuditTrial` | TBD | TBD | |
| LEG-PROJ-011 | Non-member data isolation | Project membership scope enforcement | TBD | TBD | P0 security requirement |
| LEG-PROJ-012 | Notify project user | `AdProjectController.notifyProjectUser` | TBD | TBD | |

---

## ATR Forms

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-ATR-001 | ATR creation (raise) | `ATRFormController.raiseAtrForm` | `POST /api/ard/atr` | TBD | |
| LEG-ATR-002 | ATR save (draft) | `ATRFormController.saveAtrForm` | TBD | TBD | |
| LEG-ATR-003 | ATR submit | `ATRFormController.submitAtrForm` | TBD | TBD | |
| LEG-ATR-004 | ATR view | `viewAtrForm/{id}` | `GET /api/ard/atr/{id}` | TBD | |
| LEG-ATR-005 | ATR list by status | `listAtrForms/{userId}/{statusId}` | `GET /api/ard/atr` | TBD | |
| LEG-ATR-006 | ATR withdraw | `ATRFormController.withdrawAtrForm` | TBD | TBD | |
| LEG-ATR-007 | ATR clone | `ATRFormController.cloneAtrForm` | TBD | TBD | |
| LEG-ATR-008 | ATR samples management | `addSamples`, `manageSamples` | TBD | TBD | |
| LEG-ATR-009 | ATR test management | `addTestToAtr`, `removeTestFromAtr`, `modifyTestInAtr` | TBD | TBD | |
| LEG-ATR-010 | QA pre-approval | `ATRFormController.qaApprove` | TBD | TBD | |
| LEG-ATR-011 | QA pre-approval rework | `qaRework`, `PRE_APPROVAL_REWORK` state | TBD | TBD | |
| LEG-ATR-012 | Clarification request/resolve | `clarificationRequest`, `clarifyForm` | TBD | TBD | |
| LEG-ATR-013 | ATR approval (HOD) | `AtrFormController.approveAtrForm` | TBD | TBD | |
| LEG-ATR-014 | ATR verification | `VERIFIED` state transition | TBD | TBD | |
| LEG-ATR-015 | ATR certification | `ATRFormController.certifyAtrForm` | TBD | TBD | |
| LEG-ATR-016 | ATR certification rework | `CERTIFICATION_REWORK` state | TBD | TBD | |
| LEG-ATR-017 | ATR certification request | `ATRFormController.requestCertification` | TBD | TBD | |
| LEG-ATR-018 | ATR COA generation | `AtrFormController.generateCOA` | TBD | TBD | |
| LEG-ATR-019 | ATR details report / print | `generateDetailsReport`, `printForm` | TBD | TBD | |
| LEG-ATR-020 | ATR supporting documents | `addSupportingDoc`, `removeSupportingDoc` | TBD | TBD | |
| LEG-ATR-021 | ATR label generation | `ATRFormController.generateLabel` | TBD | TBD | |
| LEG-ATR-022 | ATR batch summary | `batchsummary` route, `getBatchSummary` | TBD | TBD | |
| LEG-ATR-023 | ATR comments | `atr-comments` Angular component | TBD | TBD | |
| LEG-ATR-024 | ATR analysis remarks | `analysis-remarks` Angular component | TBD | TBD | |
| LEG-ATR-025 | ATR form attributes | `form-attributes` Angular component | TBD | TBD | |
| LEG-ATR-026 | ATR experiment reference | `AtrFormExpReferenceController.*` | TBD | TBD | |
| LEG-ATR-027 | ATR reassignment | `reassignform`, `reassigntest` routes | TBD | TBD | |
| LEG-ATR-028 | ATR queues (all 12) | Routes: myAtr, teamatr, pendingApproval… | TBD | TBD | |
| LEG-ATR-029 | ATR events/audit | `ATRFormController.getAtrEvents` | TBD | TBD | |
| LEG-ATR-030 | ATR summary tab | `summary` Angular sub-component | TBD | TBD | |

---

## Tests

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-TEST-001 | Test queues (13 queues) | Routes: teamQueue, unassignedTest… | TBD | TBD | |
| LEG-TEST-002 | Self-assign test | `TestMenuController.selfAssign` | TBD | TBD | |
| LEG-TEST-003 | Assign test to TL | `TestMenuController.assignToTL` | TBD | TBD | |
| LEG-TEST-004 | Delegate test | `TestMenuController.delegateTest`, `delegatepopup` | TBD | TBD | |
| LEG-TEST-005 | Takeover test | `TestMenuController.takeoverTest`, `takeover-handover` | TBD | TBD | |
| LEG-TEST-006 | Handover test | `TestMenuController.handoverTest` | TBD | TBD | |
| LEG-TEST-007 | Pull for verification | `TestMenuController.pullForVerification` | TBD | TBD | |
| LEG-TEST-008 | Test execution (process window) | `test-process` module, all sub-components | TBD | TBD | KNOWN MISSING |
| LEG-TEST-009 | Test result entry | `atr-result`, `AtrTestController.saveTestResult` | TBD | TBD | |
| LEG-TEST-010 | Raw data attachment | `atr-rawdata`, `addRawDataAttachment` | TBD | TBD | |
| LEG-TEST-011 | Chromatography section | `chromatography-section`, Empower | TBD | BLOCKED | Empower integration |
| LEG-TEST-012 | Test version history | `test-version-history`, `getVersionHistory` | TBD | TBD | |
| LEG-TEST-013 | Test verification | `AtrTestController.verifyResult`, `atr-signature` | TBD | TBD | |
| LEG-TEST-014 | Test reject/rework | `AtrTestController.rejectResult` | TBD | TBD | |
| LEG-TEST-015 | Generate AR number | `AtrTestController.generateARNumber` | TBD | TBD | |
| LEG-TEST-016 | Notebook reference from test | `AtrTestController.addNotebookReference` | TBD | TBD | |
| LEG-TEST-017 | Create experiment from test | `AtrTestController.createExperimentFromTest` | TBD | TBD | |
| LEG-TEST-018 | Merge PDF | `AtrTestController.mergePDF` | TBD | TBD | |
| LEG-TEST-019 | Enhancement request | `enhancementReq` route, `getEnhancementTests` | TBD | TBD | |
| LEG-TEST-020 | Unsatisfactory test | `unsatisfactoryTest` route, `getUnsatisfactoryTests` | TBD | TBD | |

---

## QC-TRF Forms

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-TRF-001 | My TRF forms list | `qcTrfForms/my-trfforms` route | TBD | TBD | |
| LEG-TRF-002 | Received TRF forms list | `qcTrfForms/received-trf-forms` route | TBD | TBD | |
| LEG-TRF-003 | TRF form creation | `trfforms` component | TBD | TBD | |
| LEG-TRF-004 | TRF sampling details | `sampling-details` sub-component | TBD | TBD | |
| LEG-TRF-005 | TRF preparation details | `preparation-details` sub-component | TBD | TBD | |
| LEG-TRF-006 | TRF receiving details | `receiving-details` sub-component | TBD | TBD | |
| LEG-TRF-007 | TRF attributes | `attributes` sub-component | TBD | TBD | |
| LEG-TRF-008 | TRF test specification editor/viewer | `test-specification-editor/viewer` | TBD | TBD | |
| LEG-TRF-009 | TRF summary | `summary` sub-component (trfforms) | TBD | TBD | |
| LEG-TRF-010 | TRF events/audit | `trf-form-event` component | TBD | TBD | |

---

## Experiments

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-EXP-001 | Experiment creation/editor | `AdExperimentController.loadExperiment/saveExperiment`, `experiment-editor` | TBD | TBD | |
| LEG-EXP-002 | Experiment viewer (read-only) | `experiment-viewer`, `viewExperiment` route | TBD | TBD | |
| LEG-EXP-003 | Experiment submit for review | `AdExperimentController.submitExperiment` | TBD | TBD | |
| LEG-EXP-004 | Experiment approval | `AdExperimentController.approveExperiment` | TBD | TBD | |
| LEG-EXP-005 | Experiment clone | `AdExperimentController.cloneExperiment` | TBD | TBD | |
| LEG-EXP-006 | Experiment unlock request | `AdExperimentController.unlockExperiment`, `unlockrequests` route | TBD | TBD | |
| LEG-EXP-007 | Experiment review comments | `loadReviewComments`, `addReviewComment`, `reviewcomments` route | TBD | TBD | |
| LEG-EXP-008 | Experiment PDF generation | `AdExperimentController.generatePdf` | TBD | TBD | |
| LEG-EXP-009 | Equipment tracking | `AdExperimentController.trackEquipment` | TBD | TBD | |
| LEG-EXP-010 | Weighing details | `AdExperimentController.saveWeighingDetails` | TBD | TBD | |
| LEG-EXP-011 | pH details | `AdExperimentController.savePHDetails` | TBD | TBD | |
| LEG-EXP-012 | Section comments | `AdExperimentController.addSectionComment` | TBD | TBD | |
| LEG-EXP-013 | Version comparison | `AdExperimentController.compareVersions`, `experimentHistory` route | TBD | TBD | KNOWN MISSING |
| LEG-EXP-014 | Post-analytical data | `AdExperimentController.savePostAnalyticalData` | TBD | TBD | |
| LEG-EXP-015 | Experiment history/version list | `loadExperimentHistory`, `experimentHistory` route | TBD | TBD | |
| LEG-EXP-016 | Experiment report | `getExperimentReport`, `experimentReport` route | TBD | TBD | |
| LEG-EXP-017 | Experiment events tracking | `saveExperimentEvents`, `adExperimentEvents` route | TBD | TBD | |
| LEG-EXP-018 | Experiment review queues (8 queues) | Routes: reviewrequests, unlockrequests… | TBD | TBD | |
| LEG-EXP-019 | Delayed experiments report | `delayedapproval-exp`, `delayedsubmission-exp` | TBD | TBD | |
| LEG-EXP-020 | Inactive experiments report | `inactive-exp` | TBD | TBD | |

---

## Notebooks

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-NB-001 | Notebook creation | `AdProjectController.addNewNotebook`, `add-new-notebook` | TBD | TBD | |
| LEG-NB-002 | Notebook editor | `notebook-editor`, `AdNotebookController.loadNotebook` | TBD | TBD | |
| LEG-NB-003 | Notebook user management | `AdNotebookController.manageUsers` | TBD | TBD | |
| LEG-NB-004 | Notebook experiment list | `AdNotebookController.listExperiments` | TBD | TBD | |
| LEG-NB-005 | Notebook result parameters | `loadResultParameters`, `getUOM` | TBD | TBD | |
| LEG-NB-006 | Notebook events/audit | `AdNotebookController.recordEvents` | TBD | TBD | |
| LEG-NB-007 | Notebook STP templates | `AdNotebookController.loadSTPTemplates` | TBD | TBD | |
| LEG-NB-008 | Clone experiment to notebook | `AdNotebookController.cloneExperiment` | TBD | TBD | |

---

## Templates

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-TMPL-001 | Template creation | `ExpTemplatesController.createTemplate` | TBD | TBD | |
| LEG-TMPL-002 | Template edit | `loadEditTemplateDetails`, `saveEditedTemplateDetails` | TBD | TBD | |
| LEG-TMPL-003 | Template submit for approval | `submitForApproval` | TBD | TBD | |
| LEG-TMPL-004 | Template approve | `approveTemplate` | TBD | TBD | |
| LEG-TMPL-005 | Template rework | `reworkTemplate` | TBD | TBD | |
| LEG-TMPL-006 | Template new version | `saveNewVersionTemplateDetails` | TBD | TBD | |
| LEG-TMPL-007 | Template preview | `previewTemplateSections`, Angular preview | TBD | TBD | |
| LEG-TMPL-008 | Template section types (6+ types) | datatable, richtext, combined, std-prep, embedded-excel, params | TBD | TBD | |
| LEG-TMPL-009 | Template data items | `TemplateDataItemsController.*` | TBD | TBD | |
| LEG-TMPL-010 | Template pending approval queue | `template-pending-approval` | TBD | TBD | |
| LEG-TMPL-011 | Template events | `template-event`, `getTemplateSectionEvents` | TBD | TBD | |
| LEG-TMPL-012 | Template clone | `saveClonedTemplateDetails`, `getClonedTemplateDetails` | TBD | TBD | |

---

## Configuration / Masterdata

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-CFG-001 | Test configuration | `loadTestMasterdata`, `saveEditTest` | TBD | TBD | |
| LEG-CFG-002 | ATR attributes | `loadAtrAttributes`, `saveEditAttribute` | TBD | TBD | |
| LEG-CFG-003 | Test groups | `loadTestGroups`, `saveEditTestGroup` | TBD | TBD | |
| LEG-CFG-004 | Form types and attributes | `loadFormType`, `saveFormType`, `getFormTypeAttributesList` | TBD | TBD | |
| LEG-CFG-005 | ARD settings | `ardSetting` route | TBD | TBD | |
| LEG-CFG-006 | General lookup | `generalLookup` route | TBD | TBD | |
| LEG-CFG-007 | Test technique master | `loadTestTechnique`, `saveEditTestTechnique` | TBD | TBD | |
| LEG-CFG-008 | Analyst qualification | `loadAnalystQualification`, `saveAnalystQualification` | TBD | TBD | |
| LEG-CFG-009 | Qualification alert | `loadQualificationAlert` | TBD | TBD | |
| LEG-CFG-010 | Qualification matrix | `getUsersAndTechniques`, `qualificationMatrix` route | TBD | TBD | KNOWN MISSING |
| LEG-CFG-011 | Test result parameters | `saveEditResultparam`, `enableDisableResult` | TBD | TBD | |
| LEG-CFG-012 | Test specification | `saveTestspecification`, `editSaveTestSpecification` | TBD | TBD | |
| LEG-CFG-013 | Test groups/form types | `saveTestGroupFormType`, `removeTestgroup` | TBD | TBD | |
| LEG-CFG-014 | Import analyst qualification | `saveImportAnalystQualification` | TBD | TBD | |

---

## Reporting

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-RPT-001 | ATR dashboard report | `ReportingController.loadAtrDashboardDetails` | TBD | TBD | |
| LEG-RPT-002 | Project report | `generateProjectReport` | TBD | TBD | |
| LEG-RPT-003 | Sample management report | `generateSampleManagementReport` | TBD | TBD | |
| LEG-RPT-004 | Activity statistics report | `activityStaticsReport` | TBD | TBD | |
| LEG-RPT-005 | Chemist statistics report | `chemistStaticsReport` | TBD | TBD | |
| LEG-RPT-006 | Test tracking report | `testTrackingReport` | TBD | TBD | |
| LEG-RPT-007 | Test type statistics report | `testTypeStatsReport` | TBD | TBD | |
| LEG-RPT-008 | Comparison report | `getComparisonReport` | TBD | TBD | |
| LEG-RPT-009 | Project test statistics report | `projectTestStatisticsReport` | TBD | TBD | |
| LEG-RPT-010 | Overall statistics report | `overAllStatisticsReport` | TBD | TBD | |
| LEG-RPT-011 | ATR last-week team stats | `atrLastWeekTeamStatsReport` | TBD | TBD | |

---

## Search

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-SRCH-001 | Global search | `SearchController.getsearch`, `generalsearch` | TBD | TBD | |
| LEG-SRCH-002 | Experiment search | `SearchController.expsearch` | TBD | TBD | |
| LEG-SRCH-003 | Project search | `SearchController.projectsearch` | TBD | TBD | |
| LEG-SRCH-004 | Test form search | `SearchController.testformsearch` | TBD | TBD | |
| LEG-SRCH-005 | Load experiment params | `SearchController.loadExpparam` | TBD | TBD | |

---

## Teams

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-TEAM-001 | Team management | `AtrTeamController.addTeam`, `loadTeamList` | TBD | TBD | |
| LEG-TEAM-002 | Team member management | `addTeamMember`, `removeTeamMember`, `updateTeamMember` | TBD | TBD | |
| LEG-TEAM-003 | My ATR team | `AtrTeamController.loadMyATRTeam` | TBD | TBD | |
| LEG-TEAM-004 | QA events | `getQAEventType`, `showQAEvents` | TBD | TBD | |
| LEG-TEAM-005 | ATR by criteria | `loadTeamATRBasedOnCriteria` | TBD | TBD | |

---

## External Integrations

| ID | Feature | Legacy Evidence | ELN3 Location | Status | Notes |
|----|---------|----------------|---------------|--------|-------|
| LEG-EXT-001 | Empower chromatogram | `AtrTestController.convertChromatogram`, `AdEmpowerController.*` | Not implemented | BLOCKED | Waters Empower server required |
| LEG-EXT-002 | Stability module | `StabilityController` → `/Stability/` service | Not implemented | BLOCKED | External service required |

---

## Parity Summary (Running)

> Will be updated as TBD rows are resolved

| Status | Count |
|--------|-------|
| PASS | 0 |
| PARTIAL | ~3 |
| MISSING | ~5+ |
| INCORRECT | 0 |
| SECURITY | 0 |
| BLOCKED | 2 |
| DECISION | 1 |
| TBD | ~150+ |
| **Total discovered** | **~161** |
