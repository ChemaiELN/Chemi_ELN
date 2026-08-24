# Frontend Compatibility Notes

## Overview

The goal of this migration is that the existing frontend continues to work against the new Node.js backend **without changes**. This document lists any actual or potential differences.

---

## 1. Response Wrapper (⚠️ Review Required)

The new Node.js backend wraps all successful responses in:

```json
{
  "success": true,
  "message": "Resource retrieved successfully.",
  "data": { ... }
}
```

And list responses:

```json
{
  "success": true,
  "message": "Resources retrieved successfully.",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Action required:** Verify whether the existing FastAPI backend also returns wrapped responses in the same shape. If the frontend already reads `response.data.data` (axios style + wrapper), this is compatible. If FastAPI returned unwrapped data directly, the frontend will need updating.

---

## 2. PDF Endpoints (⚠️ Changed)

The following endpoints return `501 Not Implemented` in the Node.js backend:

- `GET /api/experiments/:id/report.pdf`
- `GET /api/cgt/experiments/:id/report.pdf`
- `GET /api/ard/experiments/:id/report.pdf`

**Reason:** PDF generation in the FastAPI backend uses RDKit (for molecule rendering) and xhtml2pdf (for PDF generation). Neither has a direct Node.js equivalent.

**Options to resolve:**
1. Keep the Python FastAPI service running as a separate PDF microservice, proxied through the Node.js backend at the same URL
2. Implement PDF generation using `puppeteer` (headless Chrome) in Node.js — this supports HTML→PDF but not mol structure rendering
3. Use RDKit.js (WebAssembly port) in a separate background service

**Frontend impact:** PDF download/preview buttons will not function until resolved.

---

## 3. Authentication Token Format

No change. Both backends use:
- HS256 JWT
- Same payload structure: `{sub, type, ver, exp}`
- Same `Authorization: Bearer <token>` header
- Same refresh token mechanism
- `bcrypt` hash format is identical between Python and Node.js `bcrypt` libraries

**Frontend tokens are fully compatible** — no re-login required after switching backends (provided the same `JWT_SECRET` is used).

---

## 4. SSE (Server-Sent Events)

No change to the client contract:
- URL: `GET /api/sse/events?token=<jwt>`
- Same event types: `refresh`, `atrs`, `experiments`
- Same keepalive every 30 seconds
- Same per-client queue behavior

---

## 5. File Upload

No change:
- Same multipart/form-data content type
- Same `file` field name
- Same 50 MB limit
- Same allowed extensions

---

## 6. Error Response Shape

The Node.js backend returns consistent error responses:

```json
{
  "success": false,
  "message": "User not found.",
  "error": {
    "code": "NOT_FOUND",
    "details": null
  }
}
```

For validation errors:

```json
{
  "success": false,
  "message": "Validation failed.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Invalid email address." }
    ]
  }
}
```

**If the frontend checks `error.detail` (FastAPI default) instead of `error.message` or `error.code`**, the frontend error handling code may need to be updated.

---

## 7. Inventory Module

The inventory module has a placeholder router. All inventory endpoints will return the module-not-ready response until the 30+ sub-routers are implemented. This will break inventory-dependent functionality.

**Recommendation:** Implement inventory routes before switching the frontend to the new backend.

---

## 8. CORS

The new backend uses the same `CORS_ORIGINS` environment variable. Set it to match the frontend URL (e.g., `http://localhost:5173` for development).

---

## 9. No Changes Required (Confirmed)

The following work identically in both backends:
- All auth endpoints (login, logout, refresh, verify-password, me, security questions)
- All user management endpoints
- All department/lab/role endpoints
- All admin settings endpoints
- All master data endpoints
- All ID sequence endpoints
- All workflow and calc template endpoints
- SSE events
- File uploads (non-PDF)
- Token format and validation
- bcrypt password hashes (cross-compatible)

---

## 10. Switching Between Backends

To switch the frontend from FastAPI to Node.js:

1. Set the frontend's API base URL to `http://localhost:8000` (or whatever port the Node.js backend runs on)
2. Ensure the same `JWT_SECRET` is configured in both backends (or users will need to re-login)
3. Verify the `CORS_ORIGINS` setting includes the frontend URL
4. Do NOT switch until the inventory module is implemented if inventory features are in active use

---

## 11. Recommendations Before Go-Live

- [ ] Run both backends against the same database simultaneously in a staging environment
- [ ] Test all frontend flows that are in active use
- [ ] Confirm PDF endpoints: either implement puppeteer PDF or proxy to Python service
- [ ] Implement inventory sub-routers
- [ ] Implement ARD reporting, dashboard, search, and QC-TRF
- [ ] Run automated API comparison (same input → compare output) for critical paths
