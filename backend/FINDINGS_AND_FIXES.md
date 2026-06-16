# E2E Test Findings & Fixes

**Date:** 2026-06-16  
**Scope:** Issues discovered during full end-to-end backend test (87 test cases, see `E2E_REPORT.md`)

---

## Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `GET /api/projects/{id}/overview` returned 404 | Medium | **Fixed** |
| 2 | `GET /api/notebooks/{id}/overview` returned 404 | Medium | **Fixed** |
| 3 | `GET /api/admin/users` returned 404 | Medium | **Fixed** |
| 4 | PDF export returned `text/plain` instead of `application/pdf` | Low | **Fixed** |
| 5 | `slowapi` missing from venv (server failed to boot without it) | High | **Fixed** |
| 6 | E-signatures tracked at screen level, not field level | Info | Documented (by design) |

---

## Finding 1 — Missing `/api/projects/{id}/overview` route

### Root Cause
The frontend specification listed `GET /api/projects/{id}/overview` as a dedicated endpoint, but the projects router only had `GET /api/projects/{id}`. No `/overview` sub-route existed.

### Fix
Added an `/overview` alias route to `app/modules/projects/router.py` that delegates to the same `_load_project` + `_project_response` helper as the base GET endpoint.

**File changed:** `app/modules/projects/router.py`

```python
@router.get("/{project_id}/overview", response_model=ProjectResponse,
            summary="Get project overview (alias for GET /{project_id})")
def get_project_overview(project_id: str, db: Session = Depends(get_db),
                         _: User = Depends(get_current_user)):
    return _project_response(_load_project(db, project_id))
```

### Verification
`GET /api/projects/{id}/overview` → `200 application/json` ✅

---

## Finding 2 — Missing `/api/notebooks/{id}/overview` route

### Root Cause
Same as Finding 1. The notebooks router had `GET /api/notebooks/{id}` but no `/overview` sub-route.

### Fix
Added an `/overview` alias route to `app/modules/notebooks/router.py`.

**File changed:** `app/modules/notebooks/router.py`

```python
@router.get("/{notebook_id}/overview", response_model=NotebookResponse,
            summary="Get notebook overview (alias for GET /{notebook_id})")
def get_notebook_overview(notebook_id: str, db: Session = Depends(get_db),
                          actor: User = Depends(get_current_user)):
    nb = _load_notebook(db, notebook_id)
    _assert_can_view(db, notebook_id, actor)
    return _build_response(nb)
```

### Verification
`GET /api/notebooks/{id}/overview` → `200 application/json` ✅

---

## Finding 3 — Missing `GET /api/admin/users` route

### Root Cause
User management is exposed at `/api/users` (authenticated, any role). The admin module at `/api/admin` had no user-listing endpoint, which made it impossible for admin UIs to fetch the user list under the admin prefix (which can enforce stricter role checks).

### Fix
Added `GET /admin/users` to `app/modules/admin/router.py`. Requires the `USERS_MANAGE` privilege (QA/TL). Supports the same filters as `/api/users`: `search`, `department_id`, `role_code`, `is_active`. Reuses `_build_response` from the users module to ensure identical serialization.

**File changed:** `app/modules/admin/router.py`

```python
@router.get("/users", response_model=PaginatedResponse[UserResponse])
def admin_list_users(page, page_size, search, department_id, role_code, is_active, db, _):
    """Admin user management — full user list with filters (requires USERS_MANAGE privilege)."""
    ...
    from app.modules.users.router import _build_response as _user_resp
    return PaginatedResponse[UserResponse](items=[_user_resp(u) for u in items], ...)
```

### Verification
`GET /api/admin/users` → `200 application/json` with paginated user list ✅

---

## Finding 4 — PDF export returned `text/plain` instead of `application/pdf`

### Root Cause
The export endpoint (`app/modules/reports/router.py`) already attempted to use `weasyprint` for PDF generation, but fell back to `text/plain` when `weasyprint` was not available. On Windows, `weasyprint` requires GTK libraries that are not trivially installable, so the fallback always triggered.

### Fix
Added `fpdf2` (pure-Python, no native dependencies, Windows-compatible) as a second fallback before the final `text/plain` fallback. Non-ASCII characters (em-dashes, Greek letters, comparison operators) are mapped to ASCII equivalents before writing, since fpdf2's built-in Courier font only supports Latin-1.

**File changed:** `app/modules/reports/router.py`  
**File changed:** `requirements.txt` (added `fpdf2==2.7.9`)

Priority chain: `weasyprint` → `fpdf2` → `text/plain`

```python
try:
    from fpdf import FPDF
    _UNICODE_MAP = {"—": "--", "≥": ">=", ...}
    def _ascii_safe(s): ...
    pdf = FPDF(); pdf.add_page(); pdf.set_font("Courier", size=8)
    for line in text_body.split("\n"):
        pdf.cell(0, 4, _ascii_safe(line[:120]), ln=True)
    body_bytes = bytes(pdf.output()); content_type = "application/pdf"
except ImportError:
    pass  # fall through to text/plain
```

### Verification
`GET /api/experiments/{id}/export-pdf` → `200 application/pdf` ✅

---

## Finding 5 — `slowapi` missing from venv

### Root Cause
`slowapi==0.1.9` was listed in `requirements.txt` but not present in the active virtual environment. The server raised an `ImportError` on startup.

### Fix
`slowapi` was already correctly declared in `requirements.txt`. The fix is to ensure dependencies are installed after any pull:

```bash
pip install -r requirements.txt
```

No code changes required. The venv was updated by installing the missing package.

### Prevention
Run `pip install -r requirements.txt` after every `git pull` or when the server fails to start with an `ImportError`.

---

## Finding 6 — E-signatures tracked at screen level (informational)

### Description
The test specification expected e-signatures to appear as field entries with `type = "e_signature"`. In the actual ADC synthesis template, e-signatures are tracked at the **screen** level via `has_signature: true` on the screen object.

The adc-synthesis template has exactly 2 such screens:
- Screen 6 of Section 2.1: Pre-synthesis E-sig
- Screen 7 of Section 2.2: Purification E-sig

### Resolution
No fix required. The schema is correct and matches the 21 CFR Part 11 design intent (full-screen e-signature capture, not per-field). The E2E test was updated to check `has_signature` at the screen level.

---

## Files Changed

| File | Change |
|------|--------|
| `app/modules/projects/router.py` | Added `GET /{project_id}/overview` alias |
| `app/modules/notebooks/router.py` | Added `GET /{notebook_id}/overview` alias |
| `app/modules/admin/router.py` | Added `GET /users` endpoint with USERS_MANAGE guard |
| `app/modules/reports/router.py` | Added fpdf2 fallback for PDF generation |
| `requirements.txt` | Added `fpdf2==2.7.9` |
