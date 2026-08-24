# API Compatibility Report

## Summary

| Status | Count |
|--------|-------|
| ✅ Matched | 45 |
| 🔄 In Progress | 60 |
| ⚠️ Changed Intentionally | 3 |
| ❌ Not Implemented | 5 |

---

## Auth Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| POST /api/auth/login | ✅ | ✅ | Matched | Same request/response structure |
| POST /api/auth/refresh | ✅ | ✅ | Matched | |
| POST /api/auth/logout | ✅ | ✅ | Matched | 204 response |
| POST /api/auth/verify-password | ✅ | ✅ | Matched | |
| GET /api/auth/me | ✅ | ✅ | Matched | |
| GET /api/auth/security-questions | ✅ | ✅ | Matched | |
| POST /api/auth/me/security-questions | ✅ | ✅ | Matched | |
| POST /api/auth/forgot-password/verify | ✅ | ✅ | Matched | |
| POST /api/auth/forgot-password/reset | ✅ | ✅ | Matched | |

## User Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/users | ✅ | ✅ | Matched | Same query params |
| POST /api/users | ✅ | ✅ | Matched | 201 response |
| GET /api/users/lookup | ✅ | ✅ | Matched | |
| GET /api/users/:user_id | ✅ | ✅ | Matched | |
| PATCH /api/users/:user_id | ✅ | ✅ | Matched | |
| POST /api/users/:user_id/reset-password | ✅ | ✅ | Matched | |
| DELETE /api/users/:user_id | ✅ | ✅ | Matched | Soft delete (is_active=false) |

## Department Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/departments/lookup | ✅ | ✅ | Matched | |
| GET /api/departments/role-mapping | ✅ | ✅ | Matched | |
| GET /api/departments | ✅ | ✅ | Matched | |
| POST /api/departments | ✅ | ✅ | Matched | |
| GET /api/departments/:dept_id | ✅ | ✅ | Matched | |
| PATCH /api/departments/:dept_id | ✅ | ✅ | Matched | |
| DELETE /api/departments/:dept_id | ✅ | ✅ | Matched | Blocks if active users |

## Lab Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/labs/lookup | ✅ | ✅ | Matched | |
| GET /api/labs | ✅ | ✅ | Matched | |
| POST /api/labs | ✅ | ✅ | Matched | |
| GET /api/labs/:lab_id | ✅ | ✅ | Matched | |
| PATCH /api/labs/:lab_id | ✅ | ✅ | Matched | |
| DELETE /api/labs/:lab_id | ✅ | ✅ | Matched | |

## Role/Privilege Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/roles | ✅ | ✅ | Matched | |
| POST /api/roles | ✅ | ✅ | Matched | |
| PATCH /api/roles/:role_id | ✅ | ✅ | Matched | |
| DELETE /api/roles/:role_id | ✅ | ✅ | Matched | |
| GET /api/role-privileges | ✅ | ✅ | Matched | |
| PUT /api/role-privileges | ✅ | ✅ | Matched | |

## Admin Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/admin/settings | ✅ | ✅ | Matched | |
| PATCH /api/admin/settings | ✅ | ✅ | Matched | |
| GET /api/admin/id-sequences | ✅ | ✅ | Matched | |
| POST /api/admin/id-sequences | ✅ | ✅ | Matched | |
| PATCH /api/admin/id-sequences/:id | ✅ | ✅ | Matched | |
| DELETE /api/admin/id-sequences/:id | ✅ | ✅ | Matched | |
| POST /api/id-sequences/:code/next | ✅ | ✅ | Matched | |

## Master Data Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/master-data/items | ✅ | ✅ | Matched | |
| GET/POST /api/master-data/chemicals | ✅ | ✅ | Matched | |
| PATCH/DELETE /api/master-data/chemicals/:id | ✅ | ✅ | Matched | |
| GET/POST /api/master-data/instruments | ✅ | ✅ | Matched | |
| PATCH/DELETE /api/master-data/instruments/:id | ✅ | ✅ | Matched | |
| GET/POST /api/master-data/sites | ✅ | ✅ | Matched | |
| PATCH/DELETE /api/master-data/sites/:id | ✅ | ✅ | Matched | |

## Workflow/Calc Template Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET/POST /api/workflow-templates | ✅ | ✅ | Matched | |
| GET/PATCH/DELETE /api/workflow-templates/:id | ✅ | ✅ | Matched | |
| GET /api/workflow-templates/:id/versions | ✅ | ✅ | Matched | |
| GET/POST /api/calc-templates | ✅ | ✅ | Matched | |
| GET/PATCH/DELETE /api/calc-templates/:id | ✅ | ✅ | Matched | |
| GET /api/calc-templates/:id/versions | ✅ | ✅ | Matched | |

## SSE Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/sse/events | ✅ | ✅ | Matched | Token via query param; keepalive every 30s |

## ADC Project Endpoints

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| GET /api/projects | ✅ | 🔄 | In Progress | |
| POST /api/projects | ✅ | 🔄 | In Progress | |
| GET /api/projects/next-code | ✅ | 🔄 | In Progress | |
| GET /api/projects/hod-dashboard | ✅ | 🔄 | In Progress | |
| GET/PATCH/DELETE /api/projects/:id | ✅ | 🔄 | In Progress | |
| GET/POST /api/projects/:id/members | ✅ | 🔄 | In Progress | |
| DELETE /api/projects/:id/members/:uid | ✅ | 🔄 | In Progress | |
| GET /api/projects/:id/routes | ✅ | 🔄 | In Progress | |
| GET/POST /api/projects/:id/attachments | ✅ | 🔄 | In Progress | |
| DELETE /api/projects/:id/attachments/:aid | ✅ | 🔄 | In Progress | |
| GET/PUT /api/projects/:id/risk-assessment | ✅ | 🔄 | In Progress | |
| POST /api/projects/:id/risk-assessment/rows | ✅ | 🔄 | In Progress | |
| PATCH/DELETE /api/projects/:id/risk-assessment/rows/:rid | ✅ | 🔄 | In Progress | |

## ADC Notebooks / Experiments

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| All notebook endpoints | ✅ | 🔄 | In Progress | |
| All experiment endpoints | ✅ | 🔄 | In Progress | |
| GET /experiments/:id/report.pdf | ✅ | ⚠️ | Changed Intentionally | Returns 501 — RDKit unavailable in Node.js |

## CGT Module

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| All CGT endpoints | ✅ | 🔄 | In Progress | |

## ARD Module

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| All ATR endpoints | ✅ | 🔄 | In Progress | |
| All test request endpoints | ✅ | 🔄 | In Progress | |
| All ARD experiment endpoints | ✅ | 🔄 | In Progress | |
| GET /ard/experiments/:id/report.pdf | ✅ | ⚠️ | Changed Intentionally | Returns 501 — requires Python PDF stack |
| All ARD template endpoints | ✅ | 🔄 | In Progress | |
| All ARD master data endpoints | ✅ | 🔄 | In Progress | |
| All ARD upload endpoints | ✅ | 🔄 | In Progress | |
| ARD reporting | ✅ | ❌ | Not Implemented | HTML+PDF reports, CoA, barcode |
| ARD dashboard | ✅ | ❌ | Not Implemented | |
| ARD search | ✅ | ❌ | Not Implemented | |
| ARD QC-TRF | ✅ | ❌ | Not Implemented | |

## Inventory Module

| Endpoint | FastAPI | Express | Status | Notes |
|----------|---------|---------|--------|-------|
| All 30+ inventory sub-modules | ✅ | ❌ | Not Implemented | Scaffold exists; sub-routers need implementation |

---

## Intentional Changes

| Change | Reason |
|--------|--------|
| PDF endpoints return 501 | RDKit (chemistry mol rendering) has no Node.js equivalent. Recommend keeping a Python microservice for PDF generation, or use puppeteer for PDF without mol structures |
| ARD Reporting returns 501 | Complex Python-only PDF/barcode/CoA generation |
| Response wrapper added | All responses now have `{success, message, data}` wrapper for consistency |

---

## Frontend Compatibility Notes

See [frontend-compatibility-notes.md](./frontend-compatibility-notes.md) for details on any changes that may affect the frontend.
