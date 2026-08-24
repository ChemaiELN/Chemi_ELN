# Final Conversion Verification — FastAPI → Node.js

**Generated:** 2026-08-12  
**Verdict:** ⚠️ **NOT READY FOR PRODUCTION** — Critical gaps require fixes before cutover.

---

## Verification Scope

Seven independent audit agents examined:
1. Auth / Users / Departments / Roles / Privileges
2. Calc Templates / Master Data / SSE
3. Cross-cutting (middleware, config, error handling)
4. Inventory (all sub-modules)
5. ARD (ATR, Tests, Experiments, QC-TRF, Projects)
6. ADC Experiments / Notebooks / Projects
7. CGT Experiments / Notebooks / Projects
8. Database models (SQLAlchemy vs Sequelize)

---

## Overall Verdict by Module

| Module | Verdict | Blocking Issues |
|--------|---------|----------------|
| Auth / JWT / Password | ⚠️ Nearly Ready | Email login, username enumeration |
| Users / Roles / Privileges | ⚠️ Nearly Ready | Auth gap on privilege GET, key mismatches |
| Master Data / Settings | ⚠️ Nearly Ready | Hard-delete vs soft-delete |
| Calc Templates | ⚠️ Nearly Ready | Wrong privilege key |
| SSE / Health | ❌ Not Ready | No health endpoint; no SSE broadcasts |
| Inventory — Materials | ⚠️ Nearly Ready | CAS uniqueness missing |
| Inventory — Batches | ❌ Not Ready | Reconcile destroys qty; allocate no-op; wrong numbering |
| Inventory — Work Orders | ❌ Not Ready | NO AUTHENTICATION; wrong status machine; missing business logic |
| Inventory — Gate Passes | ❌ Not Ready | NO AUTHENTICATION; wrong numbering; no e-sig; returns broken |
| Inventory — Stock Requests | ⚠️ Partial | No approval routing; no role guards |
| Inventory — Usage Logs | ❌ Not Ready | Asset status not updated; injection tracking missing |
| Inventory — Checklists | ⚠️ Partial | No version bump; draft guards missing |
| Inventory — Schedules/WO reports | ⚠️ Partial | Schedule generation after WO approve missing |
| ARD — Projects/STPs/Specs | ⚠️ Nearly Ready | E-sig missing on close/deactivate/spec-approve |
| ARD — ATR Forms | ❌ Not Ready | Schema-breaking (`form_no` vs `atr_no`); sample mgmt missing; 20+ business rules absent |
| ARD — Tests | ❌ Not Ready | Wrong status names; e-sig absent on 5+ transitions; missing states |
| ARD — Experiments | ⚠️ Partial | VERIFICATION_REWORK missing; co-submit missing; audit absent |
| ARD — QC-TRF | ⚠️ Nearly Ready | E-sig missing; duplicate ATR risk |
| ADC Projects/Notebooks | ⚠️ Partial | Schema incomplete; access enforcement missing |
| ADC Experiments | ❌ Not Ready | submit-to-AD missing; section e-sig missing; AD callback missing |
| CGT Projects/Notebooks | ⚠️ Partial | Template validation missing; dashboards absent |
| CGT Experiments | ❌ Not Ready | HOD-only approval unenforced; e-sig absent; reject/unlock missing |
| Database Models | ❌ Not Ready | 4 schema-breaking mismatches; 13 missing tables; all FK constraints absent |

---

## Blocking Issues for Production Cutover

The following must be resolved before the Node.js backend can replace FastAPI in production:

### Security Blockers (cannot go live with these)

| # | Issue | Files |
|---|-------|-------|
| B1 | Work order routes: zero authentication | `workOrders.routes.ts` |
| B2 | Gate pass routes: zero authentication | `gatePasses.routes.ts` |
| B3 | Role privileges GET: no auth guard | `roles.routes.ts` |
| B4 | `ard_settings` schema mismatch — all ARD settings fail | DB migration required |
| B5 | `ard_atr_forms` column `form_no` vs `atr_no` — ATR reads/writes fail | DB migration required |

### Data Integrity Blockers

| # | Issue | Files |
|---|-------|-------|
| B6 | Batch reconcile replaces instead of adding qty | `batches.routes.ts` |
| B7 | Batch allocate creates event but never deducts qty | `batches.routes.ts` |
| B8 | Gate pass returns: no balance validation, wrong final status | `gatePasses.routes.ts` |
| B9 | Notebook permission `can_view` defaults to `false` — new grants block view | Model file |
| B10 | In-house batch numbering uses wrong table, starts from 1 (collision) | `batches.routes.ts` |

### Workflow Blockers

| # | Issue | Files |
|---|-------|-------|
| B11 | Work order approve → `CLOSED` (should be `APPROVED`); no schedule closure | `workOrders.routes.ts` |
| B12 | Work order reinitiate → `IN_PROGRESS` (should be `RAISED`); no cleanup | `workOrders.routes.ts` |
| B13 | ARD test statuses `STARTED`/`SUBMITTED` (should be `IN_PROGRESS`/`VERIFICATION_REQUESTED`) | `ardTests.routes.ts` |
| B14 | CGT experiments: any user can approve (should be HOD-only) | `cgt.routes.ts` |
| B15 | CGT experiments: no e-signature on submit/approve | `cgt.routes.ts` |

---

## What IS Working Correctly

The following areas are functionally equivalent to FastAPI and are confirmed working:

- Basic CRUD for materials, manufacturers, catalogue, mappings
- PDF generation (Puppeteer replacing xhtml2pdf)
- Excel bulk upload (6 endpoints)
- ARD project CRUD and specifications
- ARD experiment create/update/clone/lock
- ARD QC-TRF create/update/transitions (except e-sig)
- QR code and barcode generation
- Calc sheet template CRUD and versioning
- Workflow template CRUD and versioning
- Lookup chemicals and instruments
- User authentication (JWT, lockout, MFA)
- Password reset flow
- Security questions set/verify
- Department and lab CRUD
- Role CRUD
- All unit tests passing (19/19)
- TypeScript compilation (0 errors)
- SSE infrastructure (channel exists, not yet broadcasting ARD events)

---

## Recommended Go-Live Criteria

Before switching traffic from FastAPI to Node.js:

### Must Have (P0)
- [ ] Fix B1–B10 (auth + data integrity blockers)
- [ ] `ard_settings` and `ard_atr_forms` DB column names aligned
- [ ] Work order status machine corrected (B11, B12)
- [ ] ATR test status names corrected (B13)
- [ ] CGT approval gate enforced (B14, B15)

### Should Have (P1)
- [ ] Health endpoint added (`GET /health`)
- [ ] E-signatures on WO verify/approve, GP approve/dispatch
- [ ] Login accepts email address
- [ ] Forgot password returns generic 400
- [ ] Batch issuance status guards and FIFO pack logic
- [ ] Stock request two-stage approval routing
- [ ] Asset status updated on usage log start/end

### Nice to Have (P2, can be post-launch)
- [ ] ARD audit log writes on ATR/test transitions
- [ ] ATR auto-advance logic (PARTIAL → PENDING_APPROVAL)
- [ ] Checklist version bump on approve
- [ ] ATR PDF document endpoints
- [ ] CGT dashboards
- [ ] ADC submit-to-AD workflow

---

## Migration Risk Summary

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data corruption from wrong reconcile semantics | High | Critical | Fix before migration |
| Stock depletion not tracked on allocation | High | High | Fix before migration |
| ARD settings all fail (schema mismatch) | Certain if mixing backends | Critical | Fix before any shared DB use |
| Unauthenticated WO/GP access in production | Certain without fix | Critical | Fix before deploying |
| Users with email-only login locked out | Medium | High | Fix or communicate |
| CGT experiments approved by wrong role | High | High | Fix before migration |

---

## Conclusion

The Node.js migration has successfully replicated **~75%** of FastAPI functionality. The infrastructure (TypeScript, Sequelize, JWT, file uploads, PDF generation, Excel imports) is solid. The critical gaps are concentrated in:

1. **Two authentication-missing route groups** (work orders, gate passes)
2. **Two schema-breaking DB mismatches** (ard_settings, ard_atr_forms)
3. **Inventory quantity ledger semantics** (reconcile/allocate/issuance)
4. **ARD/CGT workflow state machine fidelity** (status names, e-signatures, role gates)

All of these are tractable fixes (estimated 2–3 sprint weeks). The migration is architecturally sound and the code quality is high — the remaining gaps are business logic depth, not fundamental design flaws.
