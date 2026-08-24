# Migration Feature Matrix

**Generated:** 2026-08-12  
**Legend:** ✅ Complete | ⚠️ Partial | ❌ Missing | 🔴 Critical Gap

---

## Module 1: Authentication & Authorization

| Feature | Status | Notes |
|---------|--------|-------|
| Login with username | ✅ | Works |
| Login with email | ❌ | Node.js does not accept email as username |
| Password hashing / verification | ✅ | bcrypt |
| JWT issue + validation | ✅ | Works (different env var names) |
| Account lockout | ✅ | |
| Token version (invalidate sessions) | ✅ | |
| Security questions — set | ✅ | |
| Security questions — verify | ⚠️ | Field name mismatch: `question_index` vs `questionIndex` |
| Forgot password | ⚠️ | Returns 404 for unknown user (enumeration risk) |
| Password reset | ✅ | |
| MFA / TOTP | ✅ | |
| AD (Active Directory) login | ✅ | |

---

## Module 2: Roles, Privileges, Departments

| Feature | Status | Notes |
|---------|--------|-------|
| CRUD roles | ✅ | |
| Delete role guard (SUPER_ADMIN) | ❌ | Missing |
| List privileges (auth guard) | 🔴 | No authentication on GET endpoint |
| Get role privileges | ⚠️ | Response key mismatch (`grants` vs `privileges`) |
| Bulk save privileges | ⚠️ | Request body key mismatch (`rows` vs `grants`) |
| Department-scoped privileges | ⚠️ | Missing `department_id IS NULL` filter |
| Default privilege grants fallback | ❌ | |
| CRUD departments | ✅ | |
| CRUD labs | ✅ | |

---

## Module 3: Users

| Feature | Status | Notes |
|---------|--------|-------|
| List users | ✅ | |
| Create user | ⚠️ | Missing email uniqueness check, emp_no auto-generation, role-dept validation |
| Update user | ✅ | |
| Deactivate user | ⚠️ | Missing self-deactivation guard |
| GET /me (current user) | ⚠️ | Response shape differs; `permissions` array missing |
| User-role assignment | ✅ | |

---

## Module 4: Master Data

| Feature | Status | Notes |
|---------|--------|-------|
| CRUD master data items | ⚠️ | Hard delete instead of soft delete (FastAPI uses `is_active=false`) |
| ID sequence configs | ✅ | |
| ID sequence claim | ⚠️ | Missing `requirePrivilege('master_data.manage')` guard |
| Global settings | ✅ | |
| Sites | ✅ | |

---

## Module 5: Calc Sheet Templates

| Feature | Status | Notes |
|---------|--------|-------|
| List templates | ✅ | |
| Create template | ⚠️ | Wrong privilege key checked (`admin.settings` vs `calc_templates.manage`) |
| Update template | ⚠️ | Same privilege key issue |
| Delete template | ⚠️ | Hard delete (FastAPI: soft delete) |
| Template versioning | ✅ | |

---

## Module 6: Workflow Templates

| Feature | Status | Notes |
|---------|--------|-------|
| CRUD workflow templates | ✅ | |
| Template versioning | ✅ | |
| Publish template | ✅ | |

---

## Module 7: Health / Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| `GET /health` | 🔴 | Missing — needed for load balancers / k8s |
| SSE endpoint | ✅ | Exists |
| SSE broadcasts from ARD transitions | ❌ | No broadcasts emitted |
| SSE broadcasts from ADC/CGT | ❌ | No broadcasts emitted |

---

## Module 8: Inventory — Materials

| Feature | Status | Notes |
|---------|--------|-------|
| List materials | ⚠️ | Search fields limited; no sort_by/sort_dir support |
| Create material | ⚠️ | Missing CAS uniqueness check; weaker counter atomicity |
| Update material | ⚠️ | Missing CAS uniqueness check on update |
| Export XLSX | ⚠️ | Different column set (no Department column) |
| Bulk upload XLSX | ⚠️ | Column index-based (fragile); per-row transaction |
| Material types | ✅ | |
| Chemical / formulation props | ✅ | |

---

## Module 9: Inventory — Batches

| Feature | Status | Notes |
|---------|--------|-------|
| List batches | ⚠️ | No pack expansion mode; no manufacturer search |
| Create batch | 🔴 | No pack creation; no SR transition; wrong in-house number table |
| Get batch | ✅ | |
| Update batch | ⚠️ | No audit log |
| Reconcile batch | 🔴 | Replaces qty instead of adding (opposite semantics) |
| Issue from batch | 🔴 | No status guards; no FIFO pack deduction |
| Allocate from batch | 🔴 | No qty deduction at all |
| Toggle batch | ⚠️ | Wrong target status (INACTIVE vs QUARANTINE) |
| Batch events | ✅ | |
| CoA / other-docs | ✅ | |

---

## Module 10: Inventory — Work Orders

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | 🔴 | Zero auth middleware on all WO routes |
| Create work order | 🔴 | No validation; wrong status; no checklist snapshot |
| List work orders | ⚠️ | No UNPLANNED/BREAKDOWN handling |
| Start work order | ⚠️ | No status guard; no audit |
| Save results | ⚠️ | No ownership validation |
| End work order | 🔴 | No checklist completion check; no deviation flag |
| Verify | 🔴 | No password re-auth |
| Approve | 🔴 | Wrong status (CLOSED vs APPROVED); no SOD; no schedule closure; no asset date stamp |
| Reinitiate | 🔴 | Wrong status (IN_PROGRESS vs RAISED); no cleanup |
| Calibration references | ⚠️ | No tolerance computation; accepts pre-computed values |

---

## Module 11: Inventory — Gate Passes

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | 🔴 | Zero auth middleware on all GP routes |
| Create gate pass | 🔴 | Wrong document numbering format |
| Update gate pass | ⚠️ | Destroys+recreates items on every update |
| Approve | 🔴 | No password re-auth |
| Dispatch | 🔴 | No password re-auth |
| Returns | 🔴 | No SELECT FOR UPDATE; no balance validation; wrong status |
| From work order | 🔴 | Wrong doc_type; no validation |
| Reports | ⚠️ | Wrong response shape; limited export modes |

---

## Module 12: Inventory — Stock Requests

| Feature | Status | Notes |
|---------|--------|-------|
| Create SR | ⚠️ | No approval routing; wrong number format |
| Approve SR | ⚠️ | Single-stage only; no role check |
| Fulfill SR | ⚠️ | No store incharge role guard |
| Reject SR | ⚠️ | No role check |

---

## Module 13: Inventory — Usage Logs / Checklists / Schedules

| Feature | Status | Notes |
|---------|--------|-------|
| Start usage log | 🔴 | No asset status update; no validation |
| End usage log | 🔴 | No asset status reset; no injection tracking |
| Status history | 🔴 | No WO merge; no gap filling |
| Calendar | ⚠️ | Ignores month param |
| Checklist CRUD | ⚠️ | No DRAFT guard on item edits |
| Checklist approve | ⚠️ | No version bump |
| Schedule CRUD | ✅ | |
| Schedule bulk upload | ✅ | |

---

## Module 14: ARD — Projects / Notebooks / STPs

| Feature | Status | Notes |
|---------|--------|-------|
| Project CRUD | ✅ | |
| Project close (e-sig) | ⚠️ | Missing e-signature enforcement |
| Project deactivate (e-sig) | ⚠️ | Missing e-signature |
| Project reopen (cascade) | ⚠️ | Missing experiment cascade |
| Specifications CRUD | ✅ | |
| Spec approve (e-sig) | ⚠️ | Missing `QACertifyAuthentication` check |
| STPs submit/approve/return | ✅ | |

---

## Module 15: ARD — ATR Forms

| Feature | Status | Notes |
|---------|--------|-------|
| Create ATR | ⚠️ | No origin validation; no audit log; no default TL assignment |
| Update ATR (samples) | 🔴 | Only updates scalar fields; no sample upsert/delete |
| ATR transitions | 🔴 | Missing 20+ business rules per status |
| E-signatures on transitions | 🔴 | Only 1 of 10+ e-sig points enforced |
| Audit log | 🔴 | No audit log writes on any ATR/test transition |
| Inventory deduction at submit | 🔴 | Not implemented |
| Auto-advance (PARTIAL→PENDING) | 🔴 | Not implemented |
| ATR counts (scoped) | ⚠️ | No role-based scoping |
| PDF documents (4 types) | ❌ | All missing |
| Supporting docs | ❌ | Endpoints missing |
| AR generation | ❌ | Endpoint missing |
| Clone | ❌ | Endpoint missing |
| Raise enhancement | ❌ | Endpoint missing |
| Barcode label | ❌ | Endpoint missing |
| TL/QA user lists | ❌ | Endpoints missing |

---

## Module 16: ARD — Tests

| Feature | Status | Notes |
|---------|--------|-------|
| Assign test | ⚠️ | No settings check; no e-sig; no ownership history |
| Bulk assign | ⚠️ | No settings check |
| Claim test | ⚠️ | No qualification check |
| Delegate test | 🔴 | Reassigns instead of delegating; no DELEGATED status |
| Start test | ⚠️ | Status `STARTED` vs `IN_PROGRESS`; no ATR auto-advance |
| Save results | ⚠️ | Only `results` field; no attachment/instrument fields |
| Submit test | 🔴 | Status `SUBMITTED` vs `VERIFICATION_REQUESTED`; no e-sig; no versioning |
| Verify test | 🔴 | No self-verify block; no e-sig; no auto-advance |
| Rework | ⚠️ | Wrong status (ASSIGNED vs VERIFICATION_REWORK) |
| Publish | ⚠️ | No settings check |
| Accept test | ⚠️ | No e-sig; no auto-advance |
| Unsatisfactory | ⚠️ | No auto-advance |
| Unlock | ⚠️ | Status STARTED vs UNLOCKED |
| Takeover | ❌ | Endpoint missing |
| Enhancement requests | ❌ | Endpoints missing |
| Publish tentative | ❌ | Endpoint missing |
| AR generation (individual) | ❌ | Endpoint missing |

---

## Module 17: ARD — Experiments

| Feature | Status | Notes |
|---------|--------|-------|
| Create experiment | ⚠️ | No STP linking; no project status check |
| Update experiment | ⚠️ | No contributor tracking; no per-section version SHA |
| Transitions (submit/approve) | ⚠️ | Missing calibration interlock; missing co-submit ATR link |
| VERIFICATION_REWORK state | 🔴 | State missing from transition table entirely |
| Audit log on transitions | 🔴 | Not implemented |
| Lock acquire/release | ✅ | |
| Clone / clone-blank | ✅ | |
| Version compare | ⚠️ | Different comparison basis (hash vs integer) |
| Section comments | ⚠️ | Field name differences |
| Clarifications | ✅ | |
| Post-analytical | ✅ | |
| Takeover | ⚠️ | No role check on target |
| STP sample weights | ⚠️ | Different storage key |
| STP push results | ⚠️ | Requires explicit test_request_id |
| PDF report | ✅ | |

---

## Module 18: ARD — QC-TRF

| Feature | Status | Notes |
|---------|--------|-------|
| Create QC-TRF | ✅ | |
| Update QC-TRF | ✅ | |
| Transitions | ⚠️ | Missing e-sig on all transitions; missing role-based checks; duplicate ATR risk |
| Auto-ATR on RECEIVED | ⚠️ | Created with wrong `created_by`; no duplicate check |
| PDF summary | ✅ | |

---

## Module 19: ADC Experiments / Notebooks / Projects

| Feature | Status | Notes |
|---------|--------|-------|
| ADC Project CRUD | ⚠️ | Only title/description/status; all ADC-specific fields dropped |
| ADC Notebook CRUD | ⚠️ | Code scheme different; no template active check |
| ADC Experiment CRUD | ⚠️ | section_key missing; QA view-only gate missing |
| Notebook access enforcement | 🔴 | `assert_notebook_access()` never called |
| Submit-to-AD workflow | 🔴 | Missing entirely |
| AD results callback | 🔴 | Missing entirely |
| Section e-signature | 🔴 | Missing entirely |
| ATR global list/detail | 🔴 | Missing endpoints |
| Experiment history | 🔴 | Missing endpoint |
| Risk assessment | ⚠️ | Completely different field schema |

---

## Module 20: CGT Experiments / Notebooks / Projects

| Feature | Status | Notes |
|---------|--------|-------|
| CGT Project CRUD | ⚠️ | Schema limited; no QA enforcement; no HOD dashboard |
| CGT Notebook CRUD | ⚠️ | No template-process validation; code scheme different |
| CGT Experiment CRUD | ⚠️ | No access enforcement |
| CGT HOD-only approval | 🔴 | Anyone can approve CGT experiments |
| CGT e-signature (submit/approve) | 🔴 | No password re-entry |
| CGT reject / unlock | 🔴 | Endpoints missing |
| Global CGT lists | 🔴 | Endpoints missing |
| CGT dashboards | 🔴 | All missing |

---

## Summary Counts by Status

| Status | Count |
|--------|-------|
| ✅ Complete | ~145 features |
| ⚠️ Partial / Divergent | ~115 features |
| ❌ Missing | ~48 features |
| 🔴 Critical Gap | ~35 features |
