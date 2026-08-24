# Inventory Module — Functional & Architectural Audit

_Laurus ELN · read-only review · based on complete source analysis of the backend
(`app/models/inventory.py`, `app/schemas/inventory.py`, ~30 routers under
`app/modules/inventory/`) and frontend (`src/api/inventory.ts`, 21 pages under
`src/pages/inventory/`). The application was not run; all findings are traced to
source with `file:line` evidence. No code was modified._

---

## 1. Executive Summary

The Inventory module is **broad and feature-rich** — it covers materials, batches/lots,
packs, stock requests, an append-only movement ledger, a generic audit trail, dashboards,
reports, extensive master data, and a genuinely sophisticated **equipment maintenance &
calibration workflow** (work orders with e-signatures and a state machine). Roughly
**35–40 endpoints/features actually exist and function**.

However, it has **three systemic, high-severity defects that undermine inventory integrity
and compliance**:

1. **Zero role-based access control across the entire module.** Every endpoint is gated
   only by "is the user logged in?" The RBAC system exists and is used by ADC/Notebooks,
   but Inventory opted out entirely. Any authenticated user can create materials,
   issue/adjust stock, and **approve their own stock requests** — no maker-checker
   separation.
2. **No concurrency control on stock deduction.** `deduct_qty` does an unlocked
   read-check-write on `qty_available` (`_qty_ledger.py:72,78-87`) — concurrent issues can
   over-deduct and drive stock **negative**, with no DB CHECK constraint as backstop.
   Ironically, the codebase *does* use `with_for_update` for code-number counters, proving
   the team knows the pattern but didn't apply it where it matters most.
3. **The stock-request workflow is decoupled from actual inventory.** Fulfilling a request
   (`stock_requests.py:200-223`) just flips status to `FULFILLED` — it selects no batch,
   decrements no stock, reserves nothing, and never validates requested qty against
   availability. Requests and physical stock are two disconnected systems.

Combined with pervasive **swallowed errors** in the frontend (nearly every list/report load
lacks a `.catch`, so a backend failure silently shows an empty table) and **weak input
validation** (quantities accept 0/negative, dates uncross-validated), the module is **not
production-ready for a GxP/regulated lab** in its current state, though the scaffolding is
solid and the gaps are well-defined and fixable.

**Estimated completeness: ~60%. Compliance readiness (21 CFR Part 11): low. Overall
quality: 6/10 (breadth) but ~4/10 on core stock-integrity guarantees.**

---

## 2. Existing Inventory Features

**Materials & procurement**
- Material master CRUD with auto-generated `MAT/YY/NNNNN` codes via **locked counter**
  (`materials.py:48-62`); soft-delete (`/deactivate`); chemical-property and
  formulation-property sub-records.
- Manufacturers CRUD (+soft-delete); material↔manufacturer **mappings** with SDS/DSD file
  upload/download/delete and extension validation (`mappings.py:108`).

**Stock, batches, lots, packs**
- Batch creation with auto batch-number and in-house-number generation (both **locked
  counters**, `batches.py:56-101`); pack-level sub-quantities; CoA / other-document
  upload/download/delete.
- **Append-only movement ledger** (`InvBatchEvent`) recording every
  RECEIVED / ISSUED / ALLOCATION / ADJUSTMENT with qty, actor, timestamp, purpose,
  project code.
- Stock **issue** and **allocate** endpoints; FIFO pack cascade; automatic status
  transitions (AVAILABLE → PARTIALLY_CONSUMED → CONSUMED); AVAILABLE↔QUARANTINE toggle.
- Expiry / retest / mfg / GR dates captured per batch.

**Stock requests**
- Request lifecycle PENDING → APPROVED → FULFILLED, plus REJECTED / CANCELLED; criticality
  field; per-request event history; auto `SR-YY-NNNN` numbering.

**Dashboards & reports**
- Dashboard: 11 KPIs, expiry timeline chart, equipment/instrument status pies,
  expiring-soon / pending-approvals / maintenance-due tables. Low-stock =
  `qty_available < qty_received × 0.10` (hardcoded 10%, `dashboard.py:41`).
- 7 report feeds (stock, expiry, transactions, etc.); generic **audit-trail** browse UI
  with event/entity/user/date filters.

**Master data**: UOM (dimensions+units), consumable types, storage conditions, test master
(3-level), measurement master, spare parts, lookup store, equipment/instrument/column types.

**Equipment & maintenance/calibration** (the strongest area):
- Equipment / instrument / column catalogues with lifecycle status changes; instrument
  parameters & spec details; usage-log sessions.
- **Checklists**: versioned maker-checker
  (DRAFT→PENDING_VERIFICATION→PENDING_APPROVAL→APPROVED), item management, version cloning,
  per-transition audit + approval records.
- **Schedules/Planner**: due-date records, bulk Excel upload, completion with auto-next
  generation.
- **Work orders**: full state machine
  (RAISED→IN_PROGRESS→PENDING_VERIFICATION→PENDING_APPROVAL→APPROVED), **e-signature with
  password re-auth on verify/approve** (`work_orders.py:333`), breakdown details,
  calibration references with variance calc, auto-generation of the next schedule on
  approval.
- Master Excel templates for downloads.

---

## 3. Frontend Review

**Systemic (nearly every page):**
- **Swallowed load errors** — the single most pervasive defect. Almost every
  `load()`/`run()` wraps only `setLoading(false)` in `finally` and never `.catch`es the
  rejection, so a failed fetch yields a **silent empty table** indistinguishable from
  "no data." Confirmed in Materials (`MaterialsPage.tsx:30`), Batches (`:121`),
  StockRequests (`:35`), UsageLogs (all three tabs), Reports (all `run()`),
  AuditTrail (`:61`), Equipment, WorkOrdersQueue, Mappings, Manufacturers, LogMapping,
  ChecklistBuilder. Only the **Dashboard** surfaces load errors.
- **No role/permission gating in the UI at all.** Grep for
  `role|privilege|hasPrivilege|department_code` across `src/pages/inventory` = **zero
  matches**. `/admin` is wrapped in `AdminProtectedRoute` (QA/QC only), but the entire
  `/inventory` tree is plain auth-only `ProtectedRoute` (`router.tsx:115-145`). Every
  action button — approve/reject/fulfill, change status, verify/approve — renders for
  every user.
- **Weak numeric validation**: quantities allow `0` (`BatchesPage qty_received min={0}`
  `:497`), have no upper bound, and are never checked against available stock (Stock
  Requests `qty_required` has no `max`, `:225`). Free-text `unit` not tied to material UOM.
- **Dates never cross-validated**: expiry vs mfg vs retest (`BatchesPage:520-528`), ended
  vs started (`UsageLogsPage:102`), plan/due dates allow past values.
- **Searches not debounced** (Equipment, WorkOrders) — refire on every keystroke.
- **Client-side-only filtering over a single fetched page** in Batches (`:125-142`), Stock
  Requests, Mappings, Audit — records beyond the first page are invisible to search;
  dropdown pickers load entire tables unpaginated (`MappingsPage:54-55`).
- **Accessibility**: clickable non-button `div`s / `<a onClick>` without `href`,
  `tabIndex`, or keyboard handlers (Dashboard cards, Equipment code cells); icon-only
  actions without `aria-label`.

**Inconsistent destructive-action confirmation** — good in RequestsPage (`Modal.confirm` on
raise) and MasterData deletes; **absent** for Stock Request reject/cancel and Usage-log End
(irreversible, no "are you sure?", no required justification).

**Robustness bugs:**
- `ReportsPage` `(v as number).toFixed(2)` throws if API returns null qty (`:52`).
- `WorkOrderExecutionPage` `wo.spares_used.length` (`:331`) can crash the page if backend
  omits the array; no error boundary.
- Dead code left in: Batches issue modal (trigger commented, `:422`), QR features
  (Equipment `:152`), SDS delete (Mappings `:178`), back buttons (detail pages `:92`).

**Bright spots:** AuditTrailPage (explicit "click Load" empty-state, JSON tooltips),
RequestsPage (confirm + required overdue remarks + duplicate-raise disable),
WorkOrderExecutionPage (status-gated actions, e-sign modal), and the react-query
master-data tabs (`onError → message.error`).

---

## 4. Backend Review

- **Authorization**: none. No global auth middleware (`main.py` has only CORS); auth is
  per-endpoint and every inventory endpoint uses only `Depends(get_current_user)` (183
  occurrences / 24 files). No `require_privilege`/`require_creator_role` anywhere in the
  module, and there is **no `inventory.*` privilege in the catalog** (`privileges.py:22-34`).
- **Transactions/concurrency**: code-number counters use `with_for_update` locking, but
  **stock quantity deduction does not** (`_qty_ledger.py:72`). No DB CHECK preventing
  `qty_available < 0` (`models:191`). Request-number generation uses a **non-atomic max+1
  scan** with naive retry (`stock_requests.py:26-42,85`).
- **Validation**: Pydantic schemas have **no field constraints** — no `gt=0` on quantities
  (`schemas:910,1012,1049`), no `Literal`/enum for status/criticality/unit; negative/zero
  quantities and arbitrary status strings pass. Model `status`/`category` are free-text, no
  DB enum.
- **Audit logging is inconsistent**: present in batches, catalogue, uom, lookup, checklists,
  work-orders, schedules (partial), stock-requests; **absent** in materials CRUD
  (`materials.py:113,141,158`), consumable_types, storage_conditions, manufacturers,
  mappings (incl. file ops), test_master, measurement_master, spare_parts, instrument_spec,
  log_mapping. High-value mutations like `BATCH_UPDATED` and `*_UPDATED` write **no
  before/after values** (`batches.py:269`).
- **Data integrity**: `inhouse_batch_no` and pack `pack_no` are indexed but **not unique**
  (`models:201,253`); hard deletes without dependency checks in many master-data routers can
  orphan references; `update_batch` blind-`setattr`s any field including
  `status`/`expiry_date`, bypassing the ledger and letting a user revive a CONSUMED batch
  (`batches.py:267`).
- **Missing duplicate guard**: `measurement_master POST` (`:33`).

---

## 5. Workflow Analysis

**Receiving** → modeled as batch `create`. Works, uses locked counters, writes audit. Gap:
no `qty_received > 0` enforcement; no supplier/PO linkage; no QC-hold gate before AVAILABLE.

**Issue / Allocate (consumption)** → decrements `qty_available` via `deduct_qty`.
**Incomplete/unsafe**: no row lock (race → negative stock), reservation and consumption are
the same operation (only the event label differs), no link back to a stock request or
experiment.

**Stock Request** → **Broken end-to-end.** create → approve → fulfill are pure status flips.
No validation of qty vs stock, no reservation on approval, no batch selection or stock
decrement on fulfillment, no partial fulfillment, no expiration, no duplicate detection.
`requested_by/at` and `approved_by/at` columns exist but are **never populated**
(`stock_requests.py:88-94,160`) — the request row itself can't say who requested or
approved. Single-step approval, no role gate → **requester can approve and fulfill their
own request**.

**Maintenance / Calibration (work orders)** → **The most complete workflow**: real state
machine, e-signature on verify/approve, audit at each step, auto-next-schedule on approval.
Gaps: role-free (same user can start→verify→approve — no segregation of duties,
`work_orders.py:338,365`); start/results/end/breakdown are unsigned.

**Checklists** → versioned maker-checker, but explicitly **role-free** (`checklists.py:5`)
and **no password re-auth on approve** — the maker-checker intent is not actually enforced.

**Usage logs** → open/close sessions with duplicate-open guards and audit. Gap: no
`ended_at > started_at` validation.

---

## 6. Business Logic Analysis

Against good lab-inventory practice, the **stock-request controls are almost entirely
absent**:

| Control | Present? |
|---|---|
| Request qty ≤ available stock | ❌ never checked |
| Approval workflow | ⚠️ single-step status flip only |
| Role-based approval | ❌ any user |
| Segregation of duties (requester ≠ approver) | ❌ |
| Stock reservation on approval | ❌ |
| Fulfillment decrements stock | ❌ status flip only |
| Partial fulfillment | ❌ |
| Duplicate-request prevention | ❌ |
| Request expiration | ❌ |
| Cancellation | ✅ (status flip) |
| Status tracking / history | ✅ (event rows) |
| Department / project / budget / location restrictions | ❌ |

Other business-rule gaps: no per-material **reorder level** (low-stock is a global 10%
heuristic); no automatic EXPIRED status transition (expiry is query-time only); no lot
**genealogy / parent-batch** linkage; reservation vs consumption not modeled.

---

## 7. Validation Gaps

- Quantities accept 0 and negative at schema layer (`schemas:910,1012,1049`); only some
  caught later in `deduct_qty`.
- No enums for status/criticality/unit (backend or DB).
- Frontend: qty no upper bound / not vs-stock; dates not cross-validated; storage
  `temperature_min`/`max` not validated as min ≤ max (`InventoryMasterDataPage:808`);
  checklist/parameter `lower > upper` accepted (`InstrumentSpecTab:139`,
  `ChecklistBuilderPage:94`).
- Excel `EXPECTED_HEADERS` defined but never enforced (`schedules.py:230`); schedule PATCH
  re-runs no validation (`:159`).
- `inhouse_batch_no`/`pack_no` not unique.

---

## 8. Permission & Security Gaps

- **No RBAC in the entire module** — the flagship gap. Approve/reject/fulfill stock
  requests, issue/adjust stock, deactivate assets, and **read the full audit trail** are
  open to any authenticated user (`audit_trail.py`, `stock_requests.py:148-223`,
  `batches.py:307-370`).
- **No segregation of duties** on any approval flow (stock requests, checklists, work
  orders).
- **E-signature gaps**: only work-order verify/approve re-auth password; checklist approve
  has none; work-order start/results/end unsigned.
- **`performed_by` is self-asserted** — the audit trail faithfully records
  unauthorized-but-authenticated actions; attribution ≠ authorization.
- **UI shows all privileged actions to everyone** — no defense-in-depth on inventory
  (unlike `/admin`).

---

## 9. Missing ELN / LIMS Inventory Features

_(None of these currently exist unless noted.)_
- **Barcode / QR** (QR is dead-coded, never wired).
- **Lot genealogy / material traceability** (no parent-batch linkage).
- **Chain of custody** beyond the flat event log.
- **Sample / experiment linkage** — inventory isn't connected to ADC/CGT experiment
  consumption.
- **Chemical compatibility / hazard labeling** (hazard_class is free text), **SDS
  integration** into workflows (SDS files exist on mappings but aren't surfaced at
  point-of-use).
- **Per-material reorder thresholds, replenishment suggestions, forecasting.**
- **Purchase-order / vendor management integration.**
- **True material reservation** (reserved vs available vs consumed).
- **Cold-storage / temperature monitoring**, **near-expiry dashboard** as a first-class
  status.
- **Waste tracking, cycle counting, physical-inventory reconciliation.**
- **Electronic signatures on stock movements/approvals**; **full CFR Part 11** across
  inventory.

---

## 10. Drawbacks

- **Risk of inventory inaccuracy**: unlocked deduction → negative/over-issued stock;
  `update_batch` can silently alter qty-adjacent fields and revive consumed batches;
  requests don't move stock, so "fulfilled" ≠ "issued."
- **Compliance risk**: no segregation of duties, incomplete e-signatures,
  inconsistent/before-after-less audit — fails GxP/Part 11 expectations.
- **Security**: authorization collapses to a single boolean; no stock-controller/warehouse
  role.
- **UX**: silent failures erode trust; missing confirmations on irreversible actions;
  pagination-blind search misleads users.
- **Scalability**: unpaginated `.all()` list endpoints and full-table dropdown loads;
  client-side filtering won't survive real data volumes.
- **Maintainability**: dead/commented code scattered across pages; inconsistent patterns.

---

## 11. Recommendations

### High Priority (correctness / security / compliance)
1. **Add row-level locking to stock deduction** — `with_for_update` on the batch in
   `deduct_qty` + a DB CHECK `qty_available >= 0`.
2. **Introduce inventory RBAC + segregation of duties** — inventory privileges; gate
   approve/fulfill/issue by role; forbid approver == requester; mirror in UI.
3. **Connect stock requests to real inventory** — validate qty ≤ available at approval;
   reserve on approve; on fulfill select batch(es) and call `deduct_qty`; partial
   fulfillment; populate `requested_by/approved_by`.
4. **Model reservation vs consumption distinctly** (`qty_reserved`, `qty_consumed`) with
   release-on-cancel and reservation expiry.
5. **Backend input validation** — `gt=0` on quantities, `Literal` enums; enforce
   `qty_received > 0`; make `inhouse_batch_no`/`pack_no` unique.
6. **Guard `update_batch`** behind a state machine; route all qty changes through the
   ledger; block reviving CONSUMED batches.
7. **Frontend: catch and surface load/report errors everywhere**; add confirmations +
   required justification to reject/cancel/end.

### Medium Priority (usability / operational)
8. Consistent, complete **audit logging** (all master-data writes + file ops) with
   **before/after values**.
9. Complete **e-signatures** on checklist approve and all work-order transitions.
10. **Per-material reorder levels** + low-stock/near-expiry alerts & notifications.
11. **Server-side filtering + pagination** on all lists/search/pickers; debounce searches.
12. **Cross-field validation** (date ordering, min≤max); report **CSV/Excel export**; show
    material *names* not IDs; fix null-qty `.toFixed` crash.
13. **Auto EXPIRED status transition**; dependency checks before hard deletes.

### Low Priority (enhancements)
14. Barcode/QR (wire existing dead code), SDS-at-point-of-use, lot genealogy, cold-storage
    monitoring, cycle counting / reconciliation, PO/vendor integration, waste tracking,
    accessibility pass.

---

## 12. Final Assessment

- **Completeness: ~60%.** Feature breadth is high; the maintenance/calibration sub-module is
  near-complete. Core stock control, requests, RBAC, and validation are materially
  incomplete.
- **Production readiness: Not ready** for regulated/GxP use. Usable for low-stakes internal
  tracking with trusted users; unsafe where concurrent stock movements, approval integrity,
  or compliance matter.
- **Strengths**: comprehensive data model; append-only movement ledger; locked counters for
  ID generation; a real work-order state machine with e-signatures; a generic audit table +
  browse UI; well-structured, consistent code.
- **Weaknesses**: no RBAC; unlocked stock math; requests decoupled from stock; inconsistent
  audit; pervasive silent frontend failures; weak validation.
- **Risks**: inaccurate inventory counts, unauthorized/self-approved movements,
  non-reconstructable change history — all real today.
- **Compliance readiness (21 CFR Part 11): Low** — segregation of duties, universal
  e-signatures, and complete before/after audit are the blocking gaps.
- **Overall quality rating: 6/10** on breadth and code hygiene; **~4/10** on stock-integrity
  and access-control guarantees.

---

## Appendix A — Questions for Management (business / policy / compliance decisions)

These need a **decision from the business** (policy, roles, compliance scope, priority) —
they are not purely technical, so raise them with your manager before implementation.

**Access control & segregation of duties**
1. Should Inventory enforce **role-based permissions** (like the ADC/Admin modules already
   do), or is "any logged-in user can do anything" acceptable for now?
2. For stock requests, should we **prevent the same person from raising and approving** their
   own request (segregation of duties)? If yes, **who is authorised to approve** — by role,
   by department, or by a named approver list?
3. Do we need **multi-level approval** for stock requests (e.g. above a certain quantity or
   criticality), or is single-step approval sufficient?

**Stock request → physical stock coupling**
4. When a request is **approved**, should the system **reserve** that quantity so it can't be
   issued to someone else? Should reservations **expire** if not fulfilled?
5. Should a request be **blocked if the requested quantity exceeds available stock**, or
   allowed as a back-order?
6. Should **partial fulfillment** be supported (issue what's available, keep the rest open)?
7. On fulfillment, should the system **automatically deduct** the linked batch stock (today
   it only changes a status and touches no stock)?

**Compliance / 21 CFR Part 11**
8. Which inventory actions must carry an **electronic signature** (password re-auth)? Today
   only work-order verify/approve do; checklist approval and stock movements do not.
9. Is **full audit trail with before/after values** on every change a compliance requirement
   for this deployment (GxP), or is basic attribution enough?
10. Who is permitted to **view the full audit trail** — currently any logged-in user can.

**Inventory policy**
11. Should each material have its own **reorder threshold**, and who should receive
    **low-stock / near-expiry alerts** (and via what channel — in-app, email)?
12. Should batches **auto-transition to EXPIRED** and be blocked from issue once past expiry,
    and who may override with a QA exception?
13. Priority call: which of the High-Priority items should be scheduled **first** given
    release timelines?

---

## Appendix B — Items the team can action directly (no management decision needed)

These are **correctness / hardening / UX fixes** — implementation details that don't change
business policy, so they can be planned and executed by the engineering team without a
manager sign-off (still worth code review + QA).

**Backend correctness (high impact)**
- Add `with_for_update` row locking in `deduct_qty` / `deduct_pack_qty` / `restore_qty`
  (`_qty_ledger.py`) and a DB CHECK constraint `qty_available >= 0`.
- Add schema validation: `gt=0` on all quantity fields, `Literal` enums for
  status/criticality/unit; enforce `qty_received > 0`.
- Add unique constraints on `inhouse_batch_no` and pack `pack_no`.
- Replace the non-atomic stock-request-number `max+1` scan with a **locked counter** (reuse
  the batch/material counter pattern).
- Guard `update_batch` so it can't blind-`setattr` `status`/qty fields or revive a CONSUMED
  batch; route quantity changes only through the ledger.
- Add the missing duplicate-code guard on `measurement_master POST`.
- Populate `requested_by/at` and `approved_by/at` on stock requests (columns already exist).

**Audit consistency**
- Add `write_inv_audit` to the currently-unaudited writers (materials CRUD, consumable
  types, storage conditions, manufacturers, mappings incl. file ops, test/measurement
  master, spare parts, instrument spec, log mapping) and to schedule create/update/delete.
- Record **before/after values** on `BATCH_UPDATED` and the `*_UPDATED` catalogue events.

**Frontend robustness / UX**
- Add `.catch` → visible error state to **every** `load()`/`run()` across all inventory
  pages (systemic — the biggest single UX fix).
- Fix the null-qty crash in `ReportsPage` (`.toFixed` without guard) and the
  `spares_used.length` crash in `WorkOrderExecutionPage`.
- Add confirmation dialogs (with required justification) to Stock Request reject/cancel and
  Usage-log End.
- Cross-field validation: expiry ≥ mfg date, ended > started, storage min ≤ max,
  parameter/checklist lower ≤ upper; disallow qty 0 and cap qty at available.
- Move search/filter to **server-side + pagination**; debounce search inputs; paginate the
  material/manufacturer dropdown pickers.
- Add CSV/Excel **export** to reports; display material **names** instead of raw IDs.
- Remove dead/commented code (QR buttons, disabled issue modal, commented back/SDS-delete
  buttons) or finish wiring it.
- Accessibility: make clickable cards/cells real buttons (or add `tabIndex` + keyboard
  handlers) and add `aria-label` to icon-only actions.

_Note: a few items blur the line — e.g. "auto-EXPIRED transition" and "who can override"
have a policy question (Appendix A #12) but the mechanics are engineering. Implement the
mechanics once the policy is confirmed._
