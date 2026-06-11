# Inventory Master — Implementation Phases

> **Project:** D:\sensor-proto  
> **Frontend Stack:** React 18 · TypeScript · Ant Design v5 · Redux Toolkit · React Router v6 · Less CSS Modules  
> **Backend:** FastAPI · PostgreSQL (chemia_eln) · SQLAlchemy · Alembic (existing at `backend-new/`)  
> **Entry point:** Dashboard → Inventory card → `/inventory` (currently path: null — to be wired)  
> **Rule:** All frontend files go inside `src/`. Design must match existing Ant Design + Less CSS modules. NEVER touch `backend/`, `ui/`.

---

## Overview Table

| Phase | Area | Type | Status |
|-------|------|------|--------|
| 1  | DB models (21 tables) + Alembic migration | Backend | ✅ Done |
| 2  | Seed data — materials, manufacturers, batches, equipment | Backend | ✅ Done |
| 3  | API — Inv Master Data (Materials · Manufacturers · Mapping · Audit Trail) | Backend | ✅ Done |
| 4  | API — Inventory Batches (Available · Non-Available · Historic · Events) | Backend | ✅ Done |
| 5  | API — Batch Verification · Stock Requests · Approve Requests | Backend | ✅ Done |
| 6  | API — Equipment Master Data (Equip Type · Instr Type · Column Type) | Backend | ✅ Done |
| 7  | API — Equipment Catalogue · Instrument Catalogue · Column Catalogue | Backend | ✅ Done |
| 8  | API — Maintenance · Calibration Schedules · Verification Requests | Backend | ✅ Done |
| 9  | API — Reporting (4 reports) + Dashboard KPIs | Backend | ✅ Done |
| 10 | Frontend — Inventory module structure + API layer (axios + hooks) | Frontend | ✅ Done |
| 11 | Frontend — Inv Master Data views (Materials · Manufacturers · Mapping · Audit) | Frontend | ✅ Done |
| 12 | Frontend — Inventory Batches views (Available · Non-Available · Historic · Events) | Frontend | ✅ Done |
| 13 | Frontend — Verification · Stock Requests · Approve Requests views | Frontend | ✅ Done |
| 14 | Frontend — Equipment Master Data + Equipment Catalogue views | Frontend | ✅ Done |
| 15 | Frontend — Maintenance · Calibration · Verifications views | Frontend | ✅ Done |
| 16 | Frontend — Reporting views + Dashboard KPIs | Frontend | ✅ Done |
| 17 | Router + Sidebar wiring (wire Inventory card, add nav items) | Frontend | ✅ Done |

---

## Phase 1 — DB Models + Alembic Migration

**Goal:** Add all 21 Inventory Master tables to the existing `chemia_eln` database.

### Files to create inside `backend-new/`
```
backend-new/app/models/
├── inventory_materials.py      — materials, chemical_props, formulation_props
├── inventory_manufacturers.py  — manufacturers, manufacturer_mapping
├── inventory_batches.py        — inventory_batches, batch_events, batch_verification_requests
├── inventory_stock.py          — stock_requests, stock_request_events
└── inventory_equipment.py      — equipment_types, instrument_types, column_types,
                                   equipment_catalogue, instrument_catalogue, column_catalogue,
                                   maintenance_schedules, calibration_schedules,
                                   equipment_verification_requests, instrument_verification_requests,
                                   inventory_audit_trail
```

### Update `backend-new/app/models/__init__.py`
- Import all 5 new model files so Alembic detects them

### Tables (21 total)
| # | Table | Key Columns |
|---|-------|-------------|
| 1 | `inv_materials` | id, code, name, material_type, cas_no, molecular_formula, mol_weight, storage_condition, hazard_class, description, is_active |
| 2 | `inv_material_chemical_props` | id, material_id(FK), purity_pct, grade, appearance, solubility, boiling_pt, melting_pt, flash_pt, density, ph_range |
| 3 | `inv_material_formulation_props` | id, material_id(FK), role, concentration, units, function, compatibility_notes |
| 4 | `inv_manufacturers` | id, code, name, country, contact_person, email, phone, website, address, is_active |
| 5 | `inv_manufacturer_mapping` | id, material_id(FK), manufacturer_id(FK), catalogue_no, technical_grade, lead_time_days, min_order_qty |
| 6 | `inv_batches` | id, batch_no, material_id(FK), manufacturer_id(FK), qty_received, qty_available, unit, location, mfg_date, expiry_date, retest_date, invoice_no, po_no, remarks, status, category, is_active |
| 7 | `inv_batch_events` | id, batch_id(FK), event_type, qty, ref_no, module, issued_to, purpose, project_code, performed_by, performed_at, remarks |
| 8 | `inv_batch_verification_requests` | id, request_no, batch_id(FK), requested_by, requested_at, verified_by, verified_at, status, remarks |
| 9 | `inv_stock_requests` | id, request_no, material_id(FK), qty_required, unit, required_by_date, criticality, purpose, requested_by, requested_at, approved_by, approved_at, status, remarks |
| 10 | `inv_stock_request_events` | id, request_id(FK), event_type, performed_by, performed_at, remarks |
| 11 | `inv_equipment_types` | id, code, name, description, is_active |
| 12 | `inv_instrument_types` | id, code, name, description, is_active |
| 13 | `inv_column_types` | id, code, name, description, length_mm, particle_size_um, pore_size_angstrom, is_active |
| 14 | `inv_equipment_catalogue` | id, asset_id, name, equipment_type_id(FK), serial_no, manufacturer, model, location, purchase_date, last_maintenance_date, maintenance_due_date, maintenance_status, status, is_active |
| 15 | `inv_instrument_catalogue` | id, asset_id, name, instrument_type_id(FK), serial_no, manufacturer, model, location, purchase_date, last_calibration_date, calibration_due_date, calibration_status, status, is_active |
| 16 | `inv_column_catalogue` | id, column_id, name, column_type_id(FK), serial_no, manufacturer, part_no, purchased_date, max_injections, cumulative_injections, status, is_active |
| 17 | `inv_maintenance_schedules` | id, equipment_id(FK), maintenance_type, scheduled_date, completed_date, technician, status, notes |
| 18 | `inv_calibration_schedules` | id, instrument_id(FK), calibration_type, scheduled_date, completed_date, technician, status, certificate_no, notes |
| 19 | `inv_equipment_verifications` | id, request_no, equipment_id(FK), requested_by, requested_at, verified_by, verified_at, status, remarks |
| 20 | `inv_instrument_verifications` | id, request_no, instrument_id(FK), requested_by, requested_at, verified_by, verified_at, status, remarks |
| 21 | `inv_audit_trail` | id, event_type, entity_type, entity_id, entity_ref, performed_by, performed_at, old_value, new_value, details |

### Done when
- `alembic upgrade head` runs with no errors
- All 21 `inv_*` tables visible in `chemia_eln`
- Existing 40 tables untouched

---

## Phase 2 — Seed Data

**File:** `backend-new/seed_inventory.py`  
Inserts all prototype data from `D:\CGT_MOD\src\screens\Inventory_Master.jsx` into the 21 tables.

---

## Phase 3 — API: Inv Master Data

**Files to create in `backend-new/app/`:**
- `models/` — already done in Phase 1
- `schemas/inventory_materials.py`
- `schemas/inventory_manufacturers.py`
- `routers/inventory_materials.py` — `/api/inventory/materials`
- `routers/inventory_manufacturers.py` — `/api/inventory/manufacturers`
- `routers/inventory_mappings.py` — `/api/inventory/mappings`
- `routers/inventory_audit.py` — `/api/inventory/audit-trail`
- `services/inventory_materials.py`
- `services/inventory_manufacturers.py`
- Wire all into `main.py`

---

## Phase 4 — API: Inventory Batches

**Files:**
- `schemas/inventory_batches.py`
- `routers/inventory_batches.py` — `/api/inventory/batches`
- `services/inventory_batches.py`

---

## Phase 5 — API: Batch Verification + Stock Requests

**Files:**
- `schemas/inventory_stock.py`
- `routers/inventory_batch_verification.py` — `/api/inventory/batch-verifications`
- `routers/inventory_stock_requests.py` — `/api/inventory/stock-requests`
- `services/inventory_stock.py`

---

## Phase 6 — API: Equipment Master Data

**Files:**
- `schemas/inventory_equip_master.py`
- `routers/inventory_equip_master.py` — `/api/inventory/equipment-types`, `/api/inventory/instrument-types`, `/api/inventory/column-types`
- `services/inventory_equip_master.py`

---

## Phase 7 — API: Equipment / Instrument / Column Catalogue

**Files:**
- `schemas/inventory_catalogue.py`
- `routers/inventory_catalogue.py` — `/api/inventory/equipment-catalogue`, `/api/inventory/instrument-catalogue`, `/api/inventory/column-catalogue`
- `services/inventory_catalogue.py`

---

## Phase 8 — API: Maintenance + Calibration + Verifications

**Files:**
- `schemas/inventory_schedules.py`
- `routers/inventory_schedules.py` — `/api/inventory/maintenance-schedules`, `/api/inventory/calibration-schedules`, `/api/inventory/equipment-verifications`, `/api/inventory/instrument-verifications`
- `services/inventory_schedules.py`

---

## Phase 9 — API: Reporting + Dashboard KPIs

**Files:**
- `routers/inventory_dashboard.py` — `/api/inventory/dashboard/kpis`, `/api/inventory/dashboard/available-stock`
- `routers/inventory_reports.py` — `/api/inventory/reports/*`

---

## Phase 10 — Frontend: Module Structure + API Layer

**Files to create in `src/`:**
```
src/pages/inventory/
├── index.tsx                     — main shell (internal sidebar + view switcher)
├── components/
│   ├── InventorySidebar/
│   │   ├── index.tsx
│   │   └── styles.module.less
│   └── shared/                   — StatusTag, SectionHeader, etc.
├── views/                        — one file per view (24 views)
├── hooks/                        — useInventoryApi.ts (axios + React state hooks)
└── types.ts                      — all TypeScript interfaces for inventory
```

**`src/api/inventory.ts`** — all axios calls (one function per endpoint)

---

## Phases 11–16 — Frontend Views (per section)

Each phase wires one section's views to the API.  
Design pattern: matches existing pages — `Table`, `Modal`, `Form`, `Tag`, `Button` from Ant Design v5, `styles.module.less` for layout.

---

## Phase 17 — Router + Sidebar Wiring

**`src/router/index.tsx`** — add `{ path: '/inventory', element: <InventoryPage /> }`  
**`src/pages/dashboard/components/index.tsx`** — set `path: '/inventory'` on the Inventory card  
**`src/common/Sidebar/index.tsx`** — add Inventory item to `ADC_ITEMS`
