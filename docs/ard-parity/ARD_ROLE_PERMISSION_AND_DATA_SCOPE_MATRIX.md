# ARD Role, Permission & Data Scope Matrix

> **Status:** IN PROGRESS — Phase 1 discovery running  
> **Last updated:** 2026-08-01

## Personas

| Persona ID | Legacy Role Name | Legacy Role ID | ELN3 Role Code | Notes |
|-----------|-----------------|---------------|---------------|-------|
| P01 | CHEMIST / Analyst | 11301 | `CHEM` | Standard lab analyst |
| P02 | TEAM_LEAD | 11302 | `TL` | Manages team of analysts |
| P03 | HEAD_OF_DEPARTMENT | 11303 | `HOD` | Department head, approvals |
| P04 | QUALITY_ASSURANCE | 1061105 | `QA` | Pre-approval, verification |
| P05 | ARDQA | 1061307 | TBD | ARD-specific QA role |
| P06 | ARD_CUSTOMER | 11501 | Not in ELN3 | Requester/customer role |
| P07 | SE (Senior Executive) | TBD | TBD | TBD |
| P08 | SUPER_ADMIN | N/A | `SUPER_ADMIN` | System administrator |
| P09 | Project Member | N/A | membership flag | Member of specific project |
| P10 | Non-Project Member | N/A | no membership | No project access |
| P11 | Notebook Member | N/A | membership flag | Member of specific notebook |
| P12 | Non-Notebook Member | N/A | no membership | No notebook access |
| P13 | ATR Assigned Analyst | N/A | assignment | Assigned to specific test |
| P14 | Delegated Analyst | N/A | delegation | Test delegated to them |

---

## Route-Level Access Matrix

> Legend: ✅ = can access | ❌ = denied | 👁 = read-only | 🔒 = own-only | TBD = not yet verified

### Projects

| Route / Action | HOD | TL | Analyst | QA | Customer | Admin |
|---------------|-----|----|---------|----|----------|-------|
| List open projects | ✅ all | ✅ own team | 🔒 member | TBD | TBD | ✅ |
| List closed projects | ✅ all | ✅ own team | 🔒 member | TBD | TBD | ✅ |
| Create project | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| View project details | ✅ | ✅ member | ✅ member | TBD | TBD | ✅ |
| Edit project details | ✅ | ✅ own | ❌ | TBD | ❌ | ✅ |
| Close project | ✅ | TBD | ❌ | TBD | ❌ | ✅ |
| Reopen project | ✅ | TBD | ❌ | TBD | ❌ | ✅ |
| Add project users | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| Remove project users | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| View project attachments | ✅ | ✅ member | ✅ member | TBD | TBD | ✅ |
| Manage STP worksheets | ✅ | ✅ | TBD | TBD | ❌ | ✅ |
| Manage specifications | ✅ | ✅ | TBD | TBD | ❌ | ✅ |
| Direct URL access (non-member) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### ATR Forms

| Route / Action | HOD | TL | Analyst | QA | Customer | Admin |
|---------------|-----|----|---------|----|----------|-------|
| Create ATR | TBD | TBD | TBD | TBD | ✅ | ✅ |
| View own ATR | ✅ | ✅ | 🔒 own | ✅ | 🔒 own | ✅ |
| View team ATR | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| Submit ATR | TBD | TBD | TBD | TBD | ✅ own | ✅ |
| QA pre-approve | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| QA rework ATR | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve ATR (HOD) | ✅ | ❌ | ❌ | TBD | ❌ | ✅ |
| Verify ATR | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| Request certification | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| Certify ATR | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| Certification rework | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| Request clarification | TBD | TBD | ✅ | TBD | TBD | ✅ |
| Clarify ATR | TBD | TBD | ❌ | TBD | ✅ own | ✅ |
| Withdraw ATR | TBD | TBD | 🔒 own | TBD | 🔒 own | ✅ |
| Clone ATR | TBD | TBD | TBD | TBD | TBD | ✅ |
| View clarification queue | TBD | TBD | ❌ | ✅ | ❌ | ✅ |
| View pending approval queue | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| Generate COA | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| Generate label | TBD | TBD | TBD | TBD | TBD | ✅ |

### Tests

| Route / Action | HOD | TL | Analyst | QA | Customer | Admin |
|---------------|-----|----|---------|----|----------|-------|
| View team test queue | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| View unassigned tests | ✅ | ✅ | TBD | TBD | ❌ | ✅ |
| Self-assign test | ❌ | TBD | ✅ | TBD | ❌ | ✅ |
| Assign test to TL | TBD | TBD | TBD | TBD | ❌ | ✅ |
| Delegate test | TBD | ✅ | TBD | TBD | ❌ | ✅ |
| Takeover test | TBD | ✅ | TBD | TBD | ❌ | ✅ |
| Handover test | TBD | TBD | ✅ assigned | TBD | ❌ | ✅ |
| Execute test (enter results) | TBD | TBD | ✅ assigned | TBD | ❌ | ✅ |
| Add raw data | TBD | TBD | ✅ assigned | TBD | ❌ | ✅ |
| Verify test result | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| Reject/rework test | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| View verification queue | TBD | TBD | ❌ | TBD | ❌ | ✅ |
| View delegated tests | TBD | TBD | 🔒 delegated-to | TBD | ❌ | ✅ |

### Experiments

| Route / Action | HOD | TL | Analyst | QA | Customer | Admin |
|---------------|-----|----|---------|----|----------|-------|
| Create experiment | ✅ member | ✅ member | ✅ member | TBD | ❌ | ✅ |
| Edit experiment | TBD | ✅ | ✅ assigned | TBD | ❌ | ✅ |
| View experiment | ✅ member | ✅ member | ✅ member | TBD | TBD | ✅ |
| Submit experiment | TBD | TBD | ✅ | TBD | ❌ | ✅ |
| Approve experiment | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| Add review comment | TBD | TBD | ❌ | ✅ | ❌ | ✅ |
| Request unlock | TBD | TBD | ✅ | TBD | ❌ | ✅ |
| Approve unlock | ✅ | ✅ | ❌ | TBD | ❌ | ✅ |
| Non-member direct URL | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Data Isolation Requirements (P0)

| Requirement | Enforcement point | ELN3 status |
|------------|-------------------|-------------|
| Non-project-member cannot list/see project | Server-side filter on project list | TBD |
| Non-project-member cannot access via direct URL | Server-side membership check | TBD |
| Non-project-member cannot appear in search results | Search query filter | TBD |
| Non-project-member cannot access child notebooks | Inherited membership check | TBD |
| Non-notebook-member cannot list/see notebook | Server-side filter | TBD |
| Non-notebook-member cannot access via direct URL | Server-side membership check | TBD |
| Non-notebook-member cannot access experiments | Inherited membership check | TBD |
| Removing project member removes access immediately | Re-auth or next-request check | TBD |
| ATR visibility scoped by role and status | Status + role filter on list | TBD |
| Test visibility scoped by assignment | Assignment filter on list | TBD |
| Customer sees only own ATRs | Created-by filter | TBD |
| Experiment PDF/report respects membership | Report query membership check | TBD |

---

## E-Signature Gated Transitions

> These transitions MUST require re-authentication in ELN3

| Transition | Legacy Evidence | ELN3 status |
|-----------|----------------|-------------|
| Approve ATR | `AtrFormController.reauthenticate()`, `ESIGN_GATED_TRANSITIONS` | TBD |
| Verify ATR | `AtrTestController.reauthenticate()` | TBD |
| Certify ATR | `certifyAtrForm` + re-auth | TBD |
| Test result verification | `atr-signature` component | TBD |
| Experiment approval | e-sign in approval flow | TBD |
| Template approval | TBD | TBD |

---

*This document will be completed with manual verification evidence in Phase 8.*
