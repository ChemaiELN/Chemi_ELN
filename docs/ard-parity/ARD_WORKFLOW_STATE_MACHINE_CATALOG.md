# ARD Workflow & State Machine Catalog

> **Status:** IN PROGRESS — Phase 1 discovery running  
> **Last updated:** 2026-08-01

---

## 1. ATR Form Lifecycle

### States
```
DRAFT → SAVED → NEW (submitted)
NEW → QA_PRE_APPROVAL
QA_PRE_APPROVAL → PRE_APPROVAL_REWORK (QA rejects)
PRE_APPROVAL_REWORK → QA_PRE_APPROVAL (resubmit after rework)
QA_PRE_APPROVAL → PENDING_CLARIFICATION
PENDING_CLARIFICATION → CLARIFIED
CLARIFIED → PARTIAL (some tests done)
CLARIFIED / PARTIAL → PENDING_APPROVAL
PENDING_APPROVAL → APPROVED (HOD approves)
APPROVED → VERIFIED
VERIFIED → CERTIFICATION_REQUESTED
CERTIFICATION_REQUESTED → CERTIFICATION_REWORK
CERTIFICATION_REWORK → CERTIFICATION_REQUESTED (resubmit)
CERTIFICATION_REQUESTED → CERTIFIED
Any active state → WITHDRAWN (by creator)
PENDING_APPROVAL → REJECTED (HOD rejects)
```

### State Transition Table

| From State | Action | To State | Required Role | E-Sign | Required Fields | Side Effects |
|-----------|--------|----------|--------------|--------|----------------|--------------|
| (none) | Raise/Create | DRAFT | Customer, Analyst | No | Project, Form type, samples | Audit: ATR created |
| DRAFT | Save | SAVED | Creator | No | — | Audit: Saved |
| DRAFT/SAVED | Submit | NEW | Creator | No | All required fields | Notification to QA/TL |
| NEW | QA Pre-approve → proceed | QA_PRE_APPROVAL | QA | TBD | QA notes | Notification |
| QA_PRE_APPROVAL | QA sends for clarification | PENDING_CLARIFICATION | QA | No | Clarification reason | Notification to creator |
| PENDING_CLARIFICATION | Creator clarifies | CLARIFIED | ATR creator/customer | No | Clarification response | Notification to QA |
| CLARIFIED | HOD submits for approval | PENDING_APPROVAL | HOD/TL | TBD | — | Notification |
| PENDING_APPROVAL | HOD approves | APPROVED | HOD | Yes | Approval remarks | Notification, tests assigned |
| PENDING_APPROVAL | HOD rejects | REJECTED | HOD | Yes | Rejection reason | Notification |
| APPROVED | Tests complete → verify | VERIFIED | TL/HOD | Yes | All tests VERIFIED | Notification |
| VERIFIED | Request certification | CERTIFICATION_REQUESTED | TL/HOD | No | — | Notification |
| CERTIFICATION_REQUESTED | Certify | CERTIFIED | Authorized user | Yes | Certificate details | COA generated, notification |
| CERTIFICATION_REQUESTED | Rework | CERTIFICATION_REWORK | Certifier | No | Rework reason | Notification |
| CERTIFICATION_REWORK | Resubmit | CERTIFICATION_REQUESTED | Creator | No | Updated data | Notification |
| Any active | Withdraw | WITHDRAWN | Creator/HOD | No | Withdrawal reason | Notification |

### Legacy Evidence
- States: `ard-service-java/src/.../ATRFormStatus.java` (enum)
- Transitions: `ATRFormController.*` + `ATRFormService.*`
- ELN3: `atr_rbac.py: ATR_TRANSITIONS, ESIGN_GATED_TRANSITIONS`

---

## 2. Test Lifecycle

### States
```
UNASSIGNED → ASSIGNED (to TL or analyst)
ASSIGNED → DELEGATED (TL delegates to analyst)
ASSIGNED/DELEGATED → IN_PROGRESS (analyst starts)
IN_PROGRESS → PENDING_VERIFICATION (analyst submits results)
PENDING_VERIFICATION → VERIFIED (TL/HOD verifies)
PENDING_VERIFICATION → REWORK (TL/HOD rejects)
REWORK → IN_PROGRESS (analyst resubmits)
VERIFIED → UNLOCKED (unlock request approved)
UNLOCKED → IN_PROGRESS (re-enter results)
ENHANCEMENT_REQUESTED → (special queue)
UNSATISFACTORY → (special queue)
```

### State Transition Table

| From State | Action | To State | Required Role | E-Sign | Constraints | Side Effects |
|-----------|--------|----------|--------------|--------|------------|--------------|
| UNASSIGNED | Self-assign | ASSIGNED | Analyst (qualified) | No | Analyst must be qualified for technique | Audit |
| UNASSIGNED | Assign to TL | ASSIGNED (TL) | HOD/TL | No | — | Notification |
| ASSIGNED | Delegate | DELEGATED | TL | No | Delegate must be qualified | Notification to delegate |
| ASSIGNED/DELEGATED | Start | IN_PROGRESS | Assigned/delegated | No | — | Audit |
| IN_PROGRESS | Submit results | PENDING_VERIFICATION | Assigned | No | Results entered | Notification to TL/HOD |
| PENDING_VERIFICATION | Verify | VERIFIED | TL/HOD | Yes | E-signature required | ATR updated |
| PENDING_VERIFICATION | Reject | REWORK | TL/HOD | No | Rejection remarks | Notification |
| REWORK | Re-enter | IN_PROGRESS | Assigned | No | — | Version incremented |
| VERIFIED | Takeover | ASSIGNED (new) | TL/HOD | No | — | Original analyst unassigned |
| VERIFIED | Handover | ASSIGNED (new) | Current analyst | No | — | — |
| ANY | Unlock request | — | Analyst | No | Remarks | TL/HOD must approve |
| — | Approve unlock | UNLOCKED | TL/HOD | Yes | — | New version created |

---

## 3. Experiment Lifecycle

### States
```
DRAFT → SUBMITTED (for review)
SUBMITTED → APPROVED
SUBMITTED → REWORK (reviewer sends back)
REWORK → SUBMITTED (re-submission)
APPROVED → (locked for editing)
APPROVED → UNLOCK_REQUESTED
UNLOCK_REQUESTED → UNLOCKED (TL/HOD approves)
UNLOCKED → SUBMITTED (new version)
APPROVED → DEACTIVATED
```

### State Transition Table

| From State | Action | To State | Required Role | E-Sign | Constraints | Side Effects |
|-----------|--------|----------|--------------|--------|------------|--------------|
| DRAFT | Submit | SUBMITTED | Experiment owner | TBD | All sections complete | Notification to reviewer |
| SUBMITTED | Approve | APPROVED | TL/HOD | Yes | — | Version finalized, PDF generated |
| SUBMITTED | Send to rework | REWORK | TL/HOD | No | Rework reason | Notification |
| REWORK | Resubmit | SUBMITTED | Owner | No | Changes made | New version |
| APPROVED | Request unlock | UNLOCK_REQUESTED | Owner | No | Reason | Notification to TL/HOD |
| UNLOCK_REQUESTED | Approve unlock | UNLOCKED | TL/HOD | Yes | — | Notification |
| UNLOCK_REQUESTED | Reject unlock | APPROVED | TL/HOD | No | Rejection reason | Notification |
| UNLOCKED | Save/submit | SUBMITTED | Owner | No | — | Version incremented |
| APPROVED | Deactivate | DEACTIVATED | HOD/Admin | No | — | — |

---

## 4. Template Lifecycle

### States
```
DRAFT → SUBMITTED_FOR_APPROVAL
SUBMITTED_FOR_APPROVAL → APPROVED (published)
SUBMITTED_FOR_APPROVAL → REWORK
REWORK → SUBMITTED_FOR_APPROVAL (resubmit)
APPROVED → NEW_VERSION (creates new draft)
```

### State Transition Table

| From State | Action | To State | Required Role | E-Sign | Constraints | Side Effects |
|-----------|--------|----------|--------------|--------|------------|--------------|
| DRAFT | Submit | SUBMITTED | Template creator | No | Sections defined | Notification to approver |
| SUBMITTED | Approve | APPROVED | HOD/Admin | TBD | — | Template becomes available |
| SUBMITTED | Rework | REWORK | HOD/Admin | No | Rework reason | Notification |
| REWORK | Resubmit | SUBMITTED | Creator | No | Changes made | — |
| APPROVED | New version | DRAFT (v+1) | Creator | No | — | Old version archived |

---

## 5. QC-TRF Lifecycle

> **Discovery status:** To be completed from legacy code

### States (preliminary from memory)
```
DRAFT → SUBMITTED
SUBMITTED → REGISTERED (lab receives)
REGISTERED → IN_PROGRESS
IN_PROGRESS → COMPLETED
COMPLETED → REJECTED (quality rejection)
REJECTED → REWORK
REWORK → SUBMITTED
```

---

## 6. Project Lifecycle

### States
```
ACTIVE → CLOSED
CLOSED → ACTIVE (reopen)
ACTIVE → DEACTIVATED
```

| From | Action | To | Role | Constraints |
|------|--------|----|------|-------------|
| (none) | Create | ACTIVE | HOD/TL | — |
| ACTIVE | Close | CLOSED | HOD | No active experiments |
| CLOSED | Reopen | ACTIVE | HOD | Admin approval |
| ACTIVE | Deactivate | DEACTIVATED | HOD/Admin | — |

---

## 7. STP Worksheet Lifecycle

| From | Action | To | Role |
|------|--------|----|------|
| (none) | Create | DRAFT | TL/HOD |
| DRAFT | Edit | DRAFT | Creator |
| DRAFT | Approve | APPROVED | HOD |
| APPROVED | New version | DRAFT (v+1) | Creator |
| DRAFT | Delete | (deleted) | Creator |

---

## 8. Project Specification Lifecycle

| From | Action | To | Role |
|------|--------|----|------|
| (none) | Save | DRAFT | TL/HOD |
| DRAFT | Submit | SUBMITTED | Creator |
| SUBMITTED | Approve | APPROVED | HOD |
| SUBMITTED | Edit | DRAFT | Creator |
| APPROVED | Remove | (deleted) | HOD |

---

*Full state machine details to be completed after Phase 1 Java analysis returns.*
