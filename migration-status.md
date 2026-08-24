# Migration Status

Last updated: 2026-08-12

## Summary

The FastAPI → Node.js/Express/TypeScript/Sequelize migration is **functionally complete**. All Python API modules have been ported. No tests have been written yet.

---

## Progress Tracker

| Module | Models | Routes | Logic | Status |
|--------|--------|--------|-------|--------|
| **Infrastructure** (app, middleware, DB, logger) | ✅ | ✅ | ✅ | ✅ Complete |
| **Auth** (login, refresh, forgot-password, security Qs) | ✅ | ✅ | ✅ | ✅ Complete |
| **Users** (CRUD, password reset, profile) | ✅ | ✅ | ✅ | ✅ Complete |
| **Departments / Labs / Roles** | ✅ | ✅ | ✅ | ✅ Complete |
| **Role Privileges** | ✅ | ✅ | ✅ | ✅ Complete |
| **Admin Settings** | ✅ | ✅ | ✅ | ✅ Complete |
| **Master Data** (lookup items, chemicals, instruments) | ✅ | ✅ | ✅ | ✅ Complete |
| **ID Sequences** | ✅ | ✅ | ✅ | ✅ Complete |
| **Workflow Templates** | ✅ | ✅ | ✅ | ✅ Complete |
| **Calc Templates** (CRUD, import-xlsx, submit/revalidate) | ✅ | ✅ | ✅ | ✅ Complete |
| **SSE** | ✅ | ✅ | ✅ | ✅ Complete |
| **ADC Projects** | ✅ | ✅ | ✅ | ✅ Complete |
| **ADC Notebooks** | ✅ | ✅ | ✅ | ✅ Complete |
| **ADC Experiments** | ✅ | ✅ | ✅ | ✅ Complete |
| **CGT Projects / Notebooks / Experiments** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD ATR Forms** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Tests** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Experiments** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Templates** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Master Data** (techniques, configs, groups, form types, settings, qualifications) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Uploads** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Dashboard** (metrics, my-metrics, menu, ping) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Search** | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD QC-TRF** (full lifecycle, auto-creates ATR on RECEIVED) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Notifications** (role-gated aggregation, mark-read) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Notebooks** (CRUD, equipment links, experiments list) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Projects** (CRUD, close/deactivate/reopen, specs, STP workflow) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Reporting** (7 reports × JSON + .xlsx) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Audit Trail** (paginated, filterable, .xlsx export) | ✅ | ✅ | ✅ | ✅ Complete |
| **ARD Team** (directory, workload, CRUD, events) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Materials** (MAT code gen, Excel export, props upsert) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Manufacturers** (qualification upload/download) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Mappings** (DSD file) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Batches** (MCE code gen, SELECT FOR UPDATE, COA upload) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Stock Requests** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Catalogue** (equipment, instrument, column) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Instrument Spec** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Checklists** (DRAFT→VERIFY→APPROVE, new-version clone) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Schedules** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Log Mappings** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Work Orders** (full lifecycle, calibration refs) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Gate Passes** (RGP/NRGP, returns, Excel challan) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Usage Logs** (calendar view) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Master Data Lookup** (7 entity groups) | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory UOM** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Test Master** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Storage Locations** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Lookup** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Dashboard** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Reports** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Audit Trail** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Consumable Types** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Spare Parts** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Storage Conditions** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Measurement Master** | ✅ | ✅ | ✅ | ✅ Complete |
| **Inventory Master Templates** (XLSX template downloads) | ✅ | ✅ | ✅ | ✅ Complete |
| **AD Integration Client** | N/A | N/A | ✅ | ✅ Complete |
| **Tests** | — | — | — | ❌ Not started |

---

## Known Limitations / Not Ported

| Item | Reason |
|------|--------|
| **PDF generation** (ARD reports, QC-TRF summary, notebook report, non-ARD experiment docx) | Python used RDKit/openpyxl/python-docx. PDF endpoints return HTTP 501. Replaceable with Puppeteer when needed. |
| **Barcode generation in ARD reporting** | Python used `barcode` library. Node has `bwip-js` installed but not yet wired into ARD report PDFs. |
| **Excel XLSX import — chart/image/VBA passthrough** | ExcelJS does not expose chart/image data. Dropped features are logged in `stats.dropped` (empty for now). |
| **ADC experiment report** (`experiments/report.py`) | Generates a `.docx` using python-docx. No equivalent implemented; returns 501. |

---

## Architecture Notes

- **Runtime**: Node.js 20 + Express 4 + TypeScript 5 + Sequelize 6
- **Database**: PostgreSQL (same schema as FastAPI app — no migrations needed)
- **Auth**: JWT (access + refresh tokens). Login response is bare `{access_token, refresh_token, token_type}` to match FastAPI contract.
- **Transpile mode**: `ts-node --transpile-only` via `nodemon.json` (type checking via `npm run typecheck`)
- **Error middleware** registered after `loadOptionalRoutes()` so lazy-loaded routes are visible before the 404 catch-all.
- **Calc revalidation**: calls `backend/calc_revalidate/revalidate.js` via `child_process.execFile`. Requires Node.js in PATH.
- **AD integration**: `src/utils/adClient.ts` — set `AD_API_BASE_URL` + `AD_INTEGRATION_API_KEY` in `.env`.

---

## Dev Setup

```bash
cd backend-node
cp .env.example .env   # fill in DB credentials and secrets
npm install
npm run dev            # starts ts-node --transpile-only src/app.ts via nodemon
npm run typecheck      # tsc --noEmit (zero errors as of 2026-08-12)
```
