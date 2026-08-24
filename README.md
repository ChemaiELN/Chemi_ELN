# Laurus ELN

_No project-wide README existed before this — this file starts with the Calc
Templates (Univer) feature; extend it as other areas get documented._

## Calc Templates (Univer)

A spreadsheet-based calculation template builder: an admin (HOD/TL) designs a
sheet with real formulas, then locks the formula cells and labels specific
cells as named input/output fields; a regular user later fills in only the
input fields and sees the formulas' results, without ever seeing or editing
the underlying formulas.

Built on [Univer](https://github.com/dream-num/univer) (Apache-2.0), self-hosted
— no CDN dependency, no external network calls at runtime.

### Where things live

| Concern | Location |
|---|---|
| Admin builder UI | `frontend/src/pages/admin/calcTemplates/CalcTemplateBuilderPage.tsx` |
| Template list | `frontend/src/pages/admin/calcTemplates/CalcTemplatesPage.tsx` |
| End-user fill view | `frontend/src/pages/admin/calcTemplates/FillCalcTemplatePage.tsx` (routed at `/calc-templates/:id/fill`, open to any authenticated user — not admin-gated) |
| Field/lock metadata shape | `frontend/src/pages/admin/calcTemplates/types.ts` (`CalcField`, `ProtectedRangeMeta`) |
| API client | `frontend/src/api/calcTemplates.ts` |
| DB models | `backend/app/models/calc_template.py` (`CalcSheetTemplate`, `CalcSheetTemplateVersion`) |
| Endpoints | `backend/app/modules/calc_templates/router.py` |
| Backend re-validation | `backend/app/modules/calc_templates/revalidate.py` + `backend/calc_revalidate/revalidate.js` (headless Univer, Node) |
| Tests | `backend/tests/test_calc_templates.py` |

### What's stored, and where

- **`workbook_data`** — Univer's own `IWorkbookData` snapshot (formulas, cell
  values, formatting, locked-range rules). Produced by the admin builder's
  `workbook.save()` call. Opaque JSON to us — never parsed or typed on either
  side, just stored and handed back to Univer to reload.
- **`field_metadata`** — a metadata layer we own, *not* Univer named ranges:
  `{"fields": [{key, label, role: "input"|"output", sheetId, range, display}],
  "protectedRanges": [{ruleId, permissionId, sheetId, range, display}]}`.
  This is what lets the backend know, independent of the workbook content,
  which cells a user may fill in and which are computed. (Univer's own named
  ranges are a formula-authoring convenience, not a role/lock-aware concept —
  using them would still need this same layer alongside them, so we skipped
  the extra indirection.)
- Both live in `calc_sheet_templates` (current) and `calc_sheet_template_versions`
  (one immutable snapshot per published change — bumped only when the
  content actually changes, mirroring `workflow_templates`/`workflow_template_versions`).

### Admin flow

1. Open **Admin → Calc Templates → New Template** (`/admin/calc-templates/new`).
2. Type values/formulas into the embedded Univer sheet like a normal spreadsheet.
3. Select a cell/range → **Mark as Field** → give it a key, label, and role
   (input or output).
4. Select a range (typically the formula/output cells) → **Lock Selected
   Range** — calls Univer's Permission Facade API (`fRange.getRangePermission().protect(...)`)
   directly; this is what actually gets serialized into the published snapshot.
5. **Save Draft** or **Publish**. Only users with the `calc_templates.manage`
   privilege (via `app/shared/privileges.py` — same QA/QC department gate as
   the rest of the admin module) can create/edit/publish; anyone authenticated
   can read.

No custom Univer `IAuthzIoService` is wired into the admin builder — the
admin can freely edit everything there regardless of any lock, since access
to the builder itself is already gated by the route + backend privilege check.
Locking only matters once a template is published and opened in Fill mode.

### User flow (Fill Template)

1. Open a published template at `/calc-templates/:id/fill`.
2. The sheet loads read-only (`fWorksheet.getWorksheetPermission().setMode('readOnly')`
   on every sheet) — direct in-canvas editing is disabled sheet-wide, not
   selectively per-range. Input values are instead entered through a form
   panel and applied programmatically (`fRange.setValue(...)`), with a live
   client-side recalculation preview.
   
   **Known simplification, not the originally-envisioned UX:** the brief
   pictured users typing directly into unlocked cells in the sheet. That
   needs a custom `IAuthzIoService` (or per-session user override) precisely
   denying non-owners edit rights on protected ranges — real additional
   work, and Univer's default local authorization service was confirmed (by
   reading its source) to grant every fresh session full "Owner" access by
   default, so a bare snapshot load does *not* block editing on its own.
   Since every regular user gets the identical fixed input/output partition
   for a given template (no per-user variance), there's no actual
   backend-side authorization *decision* such a service would need to make —
   only a UX difference. Worth revisiting if direct in-cell editing turns
   out to matter.
3. **Submit** sends only `{"values": {field_key: value}}` — never the whole
   workbook, never the client's own computed output values — to
   `POST /api/calc-templates/{id}/submit`.

### Backend re-validation (the part that actually matters for trust)

The backend never trusts the frontend's lock, the client's Univer instance,
or any client-supplied output value. On submit:

1. Any submitted key that isn't one of this template's known **input**
   fields is rejected outright (HTTP 422) — including a key matching an
   **output** field, which would be an attempt to smuggle a fake result.
2. As a defense against an authoring mistake (not something a submission can
   trigger on its own), an input field whose range overlaps a protected
   range is also rejected.
3. The (whitelisted) values are re-applied onto a **fresh copy of the
   stored, published snapshot** — not anything the client sent — inside a
   headless Univer subprocess (`backend/calc_revalidate/revalidate.js`),
   which recalculates with the real Univer formula engine and returns the
   output field values. Those are what the backend returns and what any
   downstream consumer should use — the client's own live preview is
   cosmetic only.

This is a genuinely separate **Node.js runtime dependency** on the backend
host (`backend/calc_revalidate/`, its own `package.json` — install with
`npm install` there). Univer's formula engine has no Python port, so there's
no way to do this re-validation in pure Python. The script is deliberately
CommonJS (`require`), not ESM: `@univerjs/preset-sheets-node-core` still
transitively pulls in `@univerjs/engine-render`, whose `opentype.js`
dependency throws under Node's ESM loader (a default-vs-named-export
interop bug) — `require()`'s looser interop avoids it.

### Running the tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m alembic upgrade head  # first time only — see below
python -m pytest tests/test_calc_templates.py -v
```

`backend/tests/conftest.py`'s `setup_test_db` fixture runs the real Alembic
migrations against a separate `laurus_eln_test` database (create it once:
`CREATE DATABASE laurus_eln_test;`) rather than `Base.metadata.create_all` —
several tables (e.g. `inv_batches`) use Postgres enum types that only the
real migrations `CREATE TYPE` for; `create_all` doesn't know how to and fails.
This was the first test file in the repo to actually exercise that fixture.

Tests cover: named output field extraction, the submission whitelist (lock
enforcement) rejecting both a smuggled output value and an unknown key, the
input/protected-range overlap guard, the `calc_templates.manage` privilege
gate, and template versioning (version bumps only on real content change,
each version's snapshot stays independently correct).
