# Frontend Compatibility Report — FastAPI → Node.js Migration

**Generated:** 2026-08-12  
**Audience:** Frontend developers integrating with the Node.js backend

---

## Overview

This report documents every API contract difference between the FastAPI backend (the frontend currently integrates with) and the Node.js backend (the migration target). Items are grouped by how likely they are to break existing frontend code.

---

## 1. Breaking Changes (Will Cause Runtime Errors)

### 1.1 Error Response Format

**FastAPI:**
```json
{"detail": "Invalid credentials"}
```
or for validation errors:
```json
{"detail": [{"loc": ["body", "username"], "msg": "field required", "type": "value_error.missing"}]}
```

**Node.js:**
```json
{"success": false, "message": "Invalid credentials", "error": {"code": "UNAUTHORIZED"}}
```

**Impact:** Any frontend code that reads `response.data.detail` (Axios interceptors, error parsers, toast notification handlers) will receive `undefined` and silently fail to show the error message.

**Action required:** Update all error-handling code in the frontend to read `response.data.message` instead of `response.data.detail`.

---

### 1.2 Login — Email Field Not Accepted

**FastAPI:** `POST /auth/login` accepts either `username` or `email` in the `username` field.

**Node.js:** Only accepts `username`. Sending an email address as `username` returns a 401.

**Impact:** Any login flow that allows users to type their email address will fail silently (looks like wrong password).

---

### 1.3 Pagination Response Shape

**FastAPI:**
```json
{
  "total": 100,
  "items": [...]
}
```

**Node.js:**
```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 100,
    "totalPages": 5
  }
}
```

**Impact:** Frontend code reading `.items`, `.total`, or doing `response.data.items.map(...)` will receive `undefined`.

**Pagination query params also differ:**
| Parameter | FastAPI | Node.js |
|-----------|---------|---------|
| Page size | `page_size` | `limit` |
| Offset | `skip` | `offset` or `page` |

---

### 1.4 GET /me (Current User) Response Shape

**FastAPI:**
```json
{
  "id": "uuid",
  "username": "john",
  "email": "john@example.com",
  "emp_no": "EMP001",
  "role": {"code": "ANALYST", "name": "Analyst"},
  "department": {"code": "ARD", "name": "Analytical R&D"},
  "permissions": ["ard.view", "ard.submit"],
  "is_active": true
}
```

**Node.js:** Returns full Sequelize model JSON with nested associations rather than the flat structure above. The `permissions` array is not included.

**Impact:** Role-based UI rendering (hide/show buttons based on role or permissions) will break if it accesses `user.role.code` and the shape has changed.

---

### 1.5 Privileges Endpoint

**FastAPI `GET /roles/:id/privileges`:**
```json
{"privileges": [{"key": "ard.view", "is_granted": true}]}
```

**Node.js:**
```json
{"grants": [...]}
```

**Impact:** Frontend code reading `.privileges` will receive `undefined`.

---

### 1.6 Role-Privileges Bulk Save

**FastAPI `POST /roles/:id/privileges`:** Expects `{"grants": [...]}`

**Node.js:** Expects `{"rows": [...]}` — **inverted key name**.

---

## 2. Silent Data Loss (No Error, Wrong Behaviour)

### 2.1 ATR Form Transitions

The Node.js ATR transition endpoint accepts fewer statuses and skips most business rules. Frontend submitting a valid transition may receive a 200 OK but the backend-side audit trail, inventory deduction, and e-signature enforcement will not occur.

### 2.2 Test Status Names Mismatch

| User Action | FastAPI status saved | Node.js status saved |
|-------------|---------------------|---------------------|
| Analyst starts test | `IN_PROGRESS` | `STARTED` |
| Analyst submits results | `VERIFICATION_REQUESTED` | `SUBMITTED` |
| TL unlocks for rework | `VERIFICATION_REWORK` | `ASSIGNED` (wrong) |

Any frontend code that checks `test.status === 'IN_PROGRESS'` will fail to match `STARTED`. Status-based UI gates (show/hide action buttons) will be wrong.

### 2.3 Work Order Status Names

| Action | FastAPI status | Node.js status |
|--------|---------------|---------------|
| Approve | `APPROVED` | `CLOSED` |
| Reinitiate | `RAISED` | `IN_PROGRESS` |

### 2.4 Gate Pass Document Types

FastAPI uses `RETURNABLE` / `NON_RETURNABLE` for doc_type. Node.js uses `RGP` / `NRGP`. If the frontend filters or displays based on doc_type, the values will not match.

### 2.5 Batch Status Toggle

FastAPI toggles between `AVAILABLE` and `QUARANTINE`. Node.js toggles between `AVAILABLE` and `INACTIVE`. A batch that should go into quarantine will show as `INACTIVE` in Node.js.

---

## 3. Missing Endpoints (HTTP 404)

### 3.1 Auth
- `POST /auth/forgot-password` — behaviour changed: FastAPI returns `400` for unknown user; Node.js returns `404`, leaking username existence.

### 3.2 Inventory
- Work order verify/approve e-signature: endpoint exists but skips password re-auth
- Gate pass approve/dispatch e-signature: endpoint exists but skips password re-auth

### 3.3 ARD
- `GET /ard/atrs/:id/documents/summary.pdf`
- `GET /ard/atrs/:id/documents/coa.pdf`
- `GET /ard/atrs/:id/documents/detailed.pdf`
- `GET /ard/atrs/:id/documents/labels.pdf`
- `GET /ard/atrs/:id/samples/:sid/label.png`
- `GET/POST/DELETE /ard/atrs/:id/supporting-docs`
- `POST /ard/atrs/:id/generate-ar`
- `POST /ard/atrs/:id/clone`
- `PATCH /ard/tests/:atrId/:testId` (result update)
- `POST /ard/tests/:atrId/:testId/enhancement-requests`
- `POST /ard/tests/:atrId/:testId/publish-tentative`

### 3.4 ADC / CGT
- `POST /experiments/:id/submit-to-ad`
- `POST /experiments/:id/ad-results`
- `GET /atr` (global ATR list)
- `GET /atr/:id`
- `GET /experiments/:id/history`
- `GET /cgt-projects/hod-dashboard`
- `GET /cgt-notebooks` (global list)
- `GET /cgt-notebooks/tl-dashboard`
- `GET /cgt-experiments` (global list)
- `GET /cgt-experiments/my-dashboard`
- `POST /cgt-experiments/:id/reject`
- `POST /cgt-experiments/:id/unlock`

---

## 4. Changed Query Parameters

| Endpoint | FastAPI param | Node.js param | Notes |
|----------|--------------|--------------|-------|
| All list endpoints | `page_size` | `limit` | |
| All list endpoints | `skip` | `offset` | |
| ATR list | `tab` | `tab` (partially supported) | Tab filtering logic is incomplete |
| Material search | `sort_by`, `sort_dir` | Not supported | Always sorts by code ASC |
| Batch export | `expand_packs` | Not supported | |
| Experiment list | `view=delayed` | Not supported | |

---

## 5. Changed URL Paths

| FastAPI path | Node.js path | Notes |
|-------------|-------------|-------|
| `POST /experiments/:id/atr` | `POST /experiments/:id/atr-requests` | |
| `GET /experiments/:id/atr` | `GET /experiments/:id/atr-requests` | |
| `POST /cgt-experiments/:id/assign-user` | `POST /cgt/experiments/:id/assign-user` | Prefix added |
| `DELETE /cgt-notebooks/:id/unassign/:userId` | `DELETE /cgt/notebooks/:id/assign-user` (body) | Pattern changed |

---

## 6. Authentication / Security

### 6.1 JWT Secret

Both backends use separate environment variables (`SECRET_KEY` vs `JWT_SECRET`). Tokens issued by FastAPI are **not valid** in Node.js and vice versa. If you switch the backend mid-session, all existing user sessions will be invalidated and users must re-login.

### 6.2 Unauthenticated Routes

The following Node.js route groups currently accept requests without any authentication token:
- All work order endpoints (`/inventory/work-orders/*`)
- All gate pass endpoints (`/inventory/gate-passes/*`)

This is a **security vulnerability** — the frontend should continue sending the Authorization header for these routes regardless, and the backend fix is tracked separately.

---

## 7. Recommended Frontend Migration Steps

1. **Update all error interceptors** to read `response.data.message` alongside or instead of `response.data.detail`.
2. **Update all list response readers** to access `response.data.data` (items array) and `response.data.pagination` instead of `response.data.items` and `response.data.total`.
3. **Update pagination params**: rename `page_size` → `limit` in all API calls.
4. **Update test status comparisons**: replace `IN_PROGRESS` → `STARTED`, `VERIFICATION_REQUESTED` → `SUBMITTED` wherever test status is compared in the UI.
5. **Update work order status comparisons**: replace `APPROVED` → `CLOSED` in WO approve confirmation UIs.
6. **Update role/privileges API calls**: change response key from `privileges` → `grants`, and bulk-save body key from `grants` → `rows`.
7. **Audit all places that read `user.permissions`** — this array is not returned by Node.js `/me`.
8. **Do NOT add email-as-login support yet** — Node.js login only supports `username`. Coordinate with backend when this is fixed.
