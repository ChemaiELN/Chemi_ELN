# ARD Implementation Changelog

> **Status:** IN PROGRESS  
> **Last updated:** 2026-08-01  
> **Format:** Newest first

---

## 2026-08-01 — Phase 0: Audit Workspace Established

**Author:** Principal parity audit (Claude)

### Actions taken
- Created Phase 0 audit workspace at `docs/ard-parity/`
- Created all 7 required audit documents:
  1. `ARD_LEGACY_FUNCTIONAL_SPECIFICATION.md` — 165+ legacy features documented
  2. `ARD_ANGULAR_TO_ELN_PARITY_MATRIX.md` — parity rows for all domains
  3. `ARD_ROLE_PERMISSION_AND_DATA_SCOPE_MATRIX.md` — role × action matrix
  4. `ARD_WORKFLOW_STATE_MACHINE_CATALOG.md` — 8 state machines documented
  5. `ARD_INVENTORY_AND_EXTERNAL_INTEGRATION_MAPPING.md` — integration mapping
  6. `ARD_MANUAL_BROWSER_TEST_EXECUTION_REPORT.md` — 18 test scenarios scaffolded
  7. `ARD_OPEN_GAPS_RISKS_AND_PRODUCT_DECISIONS.md` — 4 bugs, 6 gaps, 2 decisions
  8. `ARD_IMPLEMENTATION_CHANGELOG.md` (this file)

### Discovery in progress
- Agent 1: Legacy Angular codebase exhaustive analysis (running)
- Agent 2: Legacy Java backend exhaustive analysis (running)
- Agent 3: ELN3 ARD module complete inventory (COMPLETED — full findings captured)

### Key ELN3 findings confirmed
- 15 FastAPI routers, 25 React pages — module is architecturally complete
- 3 confirmed runtime bugs (BUG-001, BUG-002, BUG-003)
- Email notifications defined but not implemented (GAP-001)
- 6+ settings flags defined but not enforced (BUG-004)
- Two external integration blockers (Empower, Stability)

### Next actions
- Wait for Phase 1 legacy discovery agents to complete
- Update parity matrix with full findings from all agents
- Execute Phase 7 implementation of all confirmed gaps
- Execute Phase 8 manual browser testing

---

## 2026-08-01 — Session 2: Phase 7 Implementations + Phase 8 Browser Verification (Partial)

**Author:** Principal parity audit (Claude)

### Security fixes (P0/P2)

| Item | File | Change |
|------|------|--------|
| **RISK-001 FIXED** — Project data isolation | `backend/app/modules/ard/projects.py` | Added `current_user` to `list_projects` + `get_project`. Non-HOD/QA/Admin users now only see projects where they are owner, creator, or in the `team` JSON array. Browser-verified: analyst 0 projects, HOD all projects. |
| **GAP-020 FIXED** — JWT token revocation | `backend/app/models/admin.py`, `backend/app/auth/utils.py`, `backend/app/auth/router.py`, `backend/app/dependencies.py`, migration `e3f4a5b6c7d8` | Added `token_version` column to users. Login and refresh embed `ver` claim. Logout increments version in DB. `get_current_user` rejects tokens with stale version. |
| **BUG-004 PARTIAL** — ATRQAPreApproval enforced | `backend/app/modules/ard/atr.py` | `setting_enabled(db, "ATRQAPreApproval")` now checked before NEW→PARTIAL/PENDING_APPROVAL transition. Blocks if enabled and no preapproval_note set. |

### Feature implementations

| Item | File | Change |
|------|------|--------|
| **GAP-003 FIXED** | `backend/app/modules/ard/qc_trf.py` | Added `"assignedTl": "assigned_tl"` to `_SCALAR_FIELDS` so PUT route writes the column |
| **GAP-007 FIXED** — Cancel test | `backend/app/modules/ard/tests.py` | Added `POST /ard/atrs/{atr_id}/{test_id}/cancel` — TL/HOD/Admin only, requires remarks, sets CANCELLED |
| **GAP-008 FIXED** — ATR change owner | `backend/app/modules/ard/atr.py` | Added `POST /ard/atrs/{atr_id}/change-owner` — HOD/Admin only, requires `newOwnerId` + remarks, updates `created_by`/`created_by_id` |
| **GAP-010 FIXED** — Batch AR generation | `backend/app/modules/ard/atr.py` | Added `POST /ard/atrs/{atr_id}/generate-ar` — generates AR numbers for all tests on an ATR in one call |
| **GAP-012 FIXED** — Mandate certification toggle | `backend/app/modules/ard/atr.py` | Added `POST /ard/atrs/{atr_id}/mandate-certification` — HOD/QA/Admin only, requires `mandateCertification` boolean |
| **GAP-013 FIXED** — Experiment edit lock | `backend/app/models/ard_experiment.py`, `backend/app/modules/ard/experiments.py`, migration `f4a5b6c7d8e9` | Added lock columns; `GET /check-lock`, `POST /acquire-lock`, `DELETE /lock` endpoints. 30-minute auto-expiry. Force-release by TL/HOD/Admin. |
| **GAP-016 FIXED** — Notebook reopen | `backend/app/modules/ard/notebooks.py` | Added `POST /ard/notebooks/{notebook_id}/reopen` — HOD/Admin only, requires remarks |
| **GAP-026 FIXED** — QC-TRF additional tests | `backend/app/modules/ard/qc_trf.py` | Added `POST /ard/qc-trf/{form_id}/add-tests` — appends to test_requests JSON array, DRAFT/SAVED/SUBMITTED/REGISTERED forms |

### Already-implemented items confirmed (not gaps)

- GAP-009: ATR clone (`POST /ard/atrs/{atr_id}/clone`) ✓
- GAP-011: Per-test withdraw (`POST /ard/atrs/{atr_id}/{test_id}/withdraw`) ✓
- GAP-014: Experiment clone (`POST /ard/experiments/{experiment_id}/clone`) ✓
- GAP-018: Project close/reopen (`POST /ard/projects/{project_id}/close|reopen`) ✓
- GAP-021: COA PDF (`GET /ard/atrs/{atr_id}/documents/coa.pdf`) ✓
- GAP-022: Test takeover (`POST /ard/atrs/{atr_id}/{test_id}/takeover`) ✓
- GAP-024: Project specifications CRUD ✓

### Product decisions clarified

- GAP-025 (reassign QA approver): `qa_reviewer_id` was deliberately dropped from model — product decision needed
- GAP-028 (dynamic left menu): Accepted difference — React sidebar is role-aware

### Phase 8 browser verification results

| Group | Test | Result |
|-------|------|--------|
| A — Role dashboards | Analyst sees only their tests/experiments in "My Work Dashboard" | PASS |
| A — ATR list scoping | Analyst sees only their own 3 ATRs; "My ATRs" is the only filter option | PASS |
| A — ATR list server enforcement | `scope=all` blocked with HTTP 403 for non-HOD users | PASS |
| A — ATR direct URL isolation | Analyst GET on superadmin ATR UUID → HTTP 403 | PASS |
| B — Project list isolation | FIXED: was P0 leak (backend returned all 120+ projects); fix enforces membership server-side | FIXED + VERIFIED |
| B — Notebook list isolation | Analyst sees 0 notebooks (none created by analyst); HOD sees 7 | PASS |
| C — External requester isolation | `list_atrs` forces `effective_scope="mine"` for ADC_PD/CGT users server-side | PASS (code verified) |

### Pending Phase 8 groups

- Group D: ATR workflow transitions (manual browser test needed with live ATR)
- Group E: Test workflow (assign, start, save results, submit, verify)
- Group F: Experiment workflow (create, edit, submit, verify)
- Group G: Configuration admin guard (settings page requires admin)
- Group H: Reports (insights, audit)

### Remaining open gaps (P2+)

| Gap | Status |
|-----|--------|
| GAP-001 | P1 OPEN — Email notifications (no SMTP code) |
| GAP-002 | P1 OPEN — Real-time push notifications |
| GAP-004 | P2 OPEN — Experiment section comments API |
| GAP-015 | P3 OPEN — Experiment takeover |
| GAP-017 | P3 OPEN — Notebook equipment tracking |
| GAP-023 | P3 OPEN — Project STP worksheets |
| GAP-025 | P2 PRODUCT DECISION — Reassign QA approver |
| GAP-027 | P2 OPEN — Post-analytical data endpoints |
| BUG-004 | P2 PARTIAL — IndividualTestAssignment / IndividualTestSubmission not enforced |

---

*Future entries will be added here as implementation work proceeds.*
