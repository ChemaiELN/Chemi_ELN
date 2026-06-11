# Chemia ELN — Dependency & Package Report

**Project:** Chemia Electronic Laboratory Notebook (ELN)  
**Stack:** FastAPI (Python 3.11+) · React 18 · TypeScript 5  
**Report Date:** June 2026  
**Prepared by:** Technical Documentation  

---

## Table of Contents

1. [Backend — Python / FastAPI](#1-backend--python--fastapi)
   - [Core Framework & Database](#11-core-framework--database)
   - [Authentication & Security](#12-authentication--security)
   - [API & Validation](#13-api--validation)
   - [Testing & Quality](#14-testing--quality)
   - [Utilities & Helpers](#15-utilities--helpers)
   - [Python Standard Library — Key Modules](#16-python-standard-library--key-modules)
   - [Recommended — Not Yet Installed](#17-recommended--not-yet-installed-backend)
2. [Frontend — React + TypeScript](#2-frontend--react--typescript)
   - [Core Framework & Build Tools](#21-core-framework--build-tools)
   - [UI Components & Styling](#22-ui-components--styling)
   - [Rich-Text & Scientific Editors](#23-rich-text--scientific-editors)
   - [State Management](#24-state-management)
   - [API & Data Fetching](#25-api--data-fetching)
   - [Routing](#26-routing)
   - [Testing & Quality](#27-testing--quality)
   - [Utilities & Helpers](#28-utilities--helpers)
   - [Recommended — Not Yet Installed](#29-recommended--not-yet-installed-frontend)
3. [Summary & Recommendations](#3-summary--recommendations)

---

## 1. Backend — Python / FastAPI

> **Source file:** `backend/requirements.txt`

---

### 1.1 Core Framework & Database

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **fastapi** | `0.111.0` | Web Framework | Main API framework — defines all HTTP routes, request/response models, dependency injection, and OpenAPI docs generation | Chosen for async-first design, automatic Swagger UI, native Pydantic integration, and high performance |
| **uvicorn[standard]** | `0.29.0` | ASGI Server | Runs the FastAPI application; `[standard]` includes `uvloop` (faster event loop) and `websockets` support | Production-grade ASGI server; `[standard]` extras ensure maximum throughput |
| **sqlalchemy** | `2.0.30` | ORM / Database | Full ORM for all database models and queries; uses the 2.0 `Session` + `select()` style throughout | SQLAlchemy 2.0 is the modern standard — typed queries, async support, and clean relationship mapping |
| **alembic** | `1.13.1` | DB Migrations | Manages all schema migrations — generates versioned migration scripts, handles upgrades and rollbacks | Required for production-safe schema evolution without dropping and recreating tables |
| **psycopg2-binary** | `2.9.9` | DB Driver | PostgreSQL adapter for Python; the `-binary` variant bundles libpq so no system deps are needed | PostgreSQL is the production database; binary build avoids C compilation issues on Windows/CI |

---

### 1.2 Authentication & Security

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **python-jose[cryptography]** | `3.3.0` | JWT / Auth | Creates and verifies JWT access tokens; `[cryptography]` backend enables RS256/HS256 signing | Standard library for JWTs in Python; the `cryptography` extra is required for production-strength signing algorithms |
| **passlib[bcrypt]** | `1.7.4` | Password Hashing | Hashes and verifies user passwords using bcrypt; used directly in the auth module | bcrypt is the industry standard for password storage — adaptive work-factor prevents brute-force attacks |
| **slowapi** | `0.1.9` | Rate Limiting | Applies request rate limits on sensitive endpoints (login is capped at 5 requests/minute per IP) | Prevents credential stuffing and brute-force attacks on the auth endpoints without needing a reverse proxy |

> **Configuration note — Rate Limiting:**  
> The `slowapi` limiter is initialized once in `app/main.py` and shared across all routers via a module-level import:
> ```python
> from slowapi import Limiter
> from slowapi.util import get_remote_address
> limiter = Limiter(key_func=get_remote_address)
> ```
> The login endpoint is decorated with `@limiter.limit("5/minute")`.

> **Configuration note — Password Hashing:**  
> `passlib` is used with the `bcrypt` scheme. Passwords are hashed on user creation and verified on login. Raw passwords are never stored or logged.

---

### 1.3 API & Validation

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **pydantic** | `2.7.1` | Data Validation | All request and response schemas are Pydantic v2 models; handles type coercion, field validation, and serialization | Pydantic v2 is the native FastAPI schema layer — it's significantly faster than v1 and has improved TypeScript-like typing |
| **pydantic-settings** | `2.3.0` | Configuration | Loads environment variables from `.env` into a typed `Settings` class (database URL, secret key, etc.) | Provides a single source of truth for all app config; prevents hardcoded secrets in source code |
| **python-multipart** | `0.0.9` | File Upload | Enables `multipart/form-data` parsing — required for file upload endpoints (experiment attachments, ATR documents) | FastAPI requires this as a separate dependency for any endpoint that receives uploaded files |

---

### 1.4 Testing & Quality

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **pytest** | `8.2.2` | Testing Framework | Core test runner for all unit and integration tests in `backend/tests/` | The de facto standard for Python testing — extensive plugin ecosystem and excellent FastAPI integration |
| **pytest-asyncio** | `0.23.7` | Async Testing | Enables `async def` test functions with `@pytest.mark.asyncio` for testing async FastAPI routes | FastAPI endpoints are async — this plugin lets test functions `await` API calls properly |
| **httpx** | `0.27.0` | HTTP Test Client | `AsyncClient` is used in tests to make HTTP requests directly to the FastAPI app in-process (no server needed) | FastAPI's `TestClient` uses `requests` (sync); `httpx.AsyncClient` allows testing async routes without starting a real server |

> **Test suite coverage:**  
> `test_crud.py` — 158 tests covering all 32 endpoint groups (all passing as of last run).  
> `tests/` — 28 individual test modules covering auth, experiments, inventory, ATR, notebooks, and more.

---

### 1.5 Utilities & Helpers

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **python-dotenv** | `1.0.1` | Environment Config | Loads `.env` file at startup so environment variables are available to `pydantic-settings` | Standard practice for local development — keeps secrets out of source code and shell profiles |
| **beautifulsoup4** | `4.12.3` | HTML Parsing | Sanitizes rich-text HTML stored from the React Quill editor; strips dangerous tags before saving to DB | Experiment procedure/observations fields accept HTML from the frontend editor — BeautifulSoup ensures only safe HTML tags are persisted |

---

### 1.6 Python Standard Library — Key Modules

> These are **built into Python** — no `pip install` needed and no entry in `requirements.txt`.  
> They are listed here because they perform non-trivial, application-critical work in this project and a new developer must know where and why they are used.

| Module | Category | Used In | Purpose / Usage |
|---|---|---|---|
| **`difflib`** | Version Diff Engine | `app/utils/richtext.py` | Powers the experiment version comparison feature. `difflib.SequenceMatcher` performs **word-level diffs** between two HTML fields to produce `<ins>`/`<del>` HTML for the UI. `difflib.unified_diff` produces unified text diffs for the audit log. This is the core of `GET /api/experiments/{id}/diff/{other_id}` |
| **`bs4` / `beautifulsoup4`** | HTML Parsing & Sanitisation | `app/utils/richtext.py` | Parses HTML produced by the react-quill editor; strips disallowed tags (`<script>`, `on*` attributes, unknown tags); extracts plain text for difflib input. *(Note: `beautifulsoup4` IS in `requirements.txt` — listed here because it works as a pair with `difflib`)* |
| **`ast`** | Formula Engine | `app/modules/experiments/formula_engine.py` | Safely parses formula strings (e.g. `P1 + P2 * P3`) into an AST. Only a whitelist of node types (`BinOp`, `UnaryOp`, `Constant`, `Name`) is allowed — prevents arbitrary code execution in user-entered formulas |
| **`operator`** | Formula Engine | `app/modules/experiments/formula_engine.py` | Maps AST node types (`ast.Add`, `ast.Sub`, `ast.Mul`, `ast.Div`) to Python's built-in arithmetic operators for safe formula evaluation without `eval()` |
| **`decimal`** | Precision Arithmetic | `app/modules/experiments/formula_engine.py` | All formula calculations use `Decimal` instead of `float` to avoid floating-point precision errors in scientific measurements (e.g. `25.1 + 0.2 = 25.3`, not `25.299999999`) |
| **`secrets`** | Cryptographic Tokens | `app/core/security.py`, `app/modules/auth/router.py` | Generates cryptographically secure random tokens for refresh tokens and password-reset links using `secrets.token_urlsafe()`. Safer than `random` for security-sensitive values |
| **`hashlib`** | Token Storage | `app/modules/auth/router.py` | Hashes refresh tokens with `hashlib.sha256()` before storing them in the DB. The raw token is sent to the client; only the hash is persisted — prevents token theft if the DB is compromised |
| **`bcrypt`** | Password Hashing | `app/core/security.py`, `app/modules/auth/esignature.py` | Directly imported alongside `passlib` for password hashing and e-signature PIN verification. The `bcrypt` package is installed as a dependency of `passlib[bcrypt]` |
| **`html`** | HTML Escaping | `app/utils/richtext.py` | `html.escape()` is used inside the diff renderer to safely escape word tokens before wrapping them in `<ins>`/`<del>` tags — prevents XSS in rendered diffs |
| **`re`** | Regex | `app/utils/richtext.py`, `app/utils/files.py`, `app/modules/reports/router.py` | Three distinct uses: (1) collapse excess newlines in `strip_html()`, (2) sanitise uploaded filenames to strip unsafe characters, (3) strip HTML tags from text in report generation |
| **`mimetypes`** | File Upload | `app/modules/experiments/router.py` | Detects the MIME type of uploaded experiment attachments from their filename extension — used to validate allowed file types before saving to disk |
| **`os`** / **`pathlib`** | File System | `app/utils/files.py`, multiple modules | `pathlib.Path` constructs upload directory paths; `os.makedirs()` / `os.remove()` manage the `backend/uploads/` directory tree for experiment and ATR file attachments |
| **`textwrap`** | Report Formatting | `app/modules/reports/router.py` | Wraps long text values to fixed column widths when generating plain-text inventory and batch reports |
| **`uuid`** | ID Generation | `app/models/base.py` | `uuid.uuid4()` generates all primary keys across every model. Wrapped in the `new_uuid()` helper used as the `default=` for every `id` column |
| **`datetime`** | Timestamps | Throughout all models and routers | `datetime.now(timezone.utc)` stamps `created_at`, `updated_at`, `completed_date`, `expires_at` on every record. Always stored as timezone-aware UTC |
| **`json`** | Serialisation | `app/middleware/logging.py`, config | Serialises request/response bodies for the audit middleware log; parses JSON payloads in a few utility functions |
| **`logging`** | Application Logging | `app/middleware/logging.py`, `app/main.py` | Standard Python logger used for request logging middleware and startup/shutdown events |

---

### 1.7 Recommended — Not Yet Installed (Backend)

| Package | Category | Purpose | Recommendation Reason |
|---|---|---|---|
| **celery + redis** | Background Tasks | Async task queue for long-running jobs (PDF export, batch report generation, email notifications) | Currently all operations are synchronous. For PDF exports and scheduled report delivery, a task queue is essential |
| **redis** | Caching / Session | Cache frequently-read master data (roles, settings) and store rate-limit counters | Would replace in-process rate-limit storage with a shared store, enabling multi-worker deployments |
| **sentry-sdk** | Error Monitoring | Real-time exception tracking and performance monitoring in production | No observability tooling exists today — Sentry is the fastest way to catch production errors |
| **structlog** | Logging | Structured JSON logging for production log aggregation (Datadog, CloudWatch, ELK) | The current middleware logs plain text; structured logs are required for any log-aggregation pipeline |
| **pytest-cov** | Test Coverage | Generates HTML/XML coverage reports from pytest runs | Helps identify untested code paths; pairs with `coverage.py` for CI coverage gates |
| **black + isort** | Code Quality | Auto-formatter and import sorter | Enforces consistent code style across the entire backend codebase without manual effort |
| **mypy** | Static Typing | Type-checks all Python source files | The codebase uses Pydantic types extensively — mypy would catch type errors at development time rather than runtime |

---

## 2. Frontend — React + TypeScript

> **Source file:** `frontend/package.json`

---

### 2.1 Core Framework & Build Tools

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **react** | `^18.3.1` | UI Framework | Core React library — component model, hooks, virtual DOM | The primary UI framework for the entire frontend application |
| **react-dom** | `^18.3.1` | UI Framework | Renders React component trees into the browser DOM | Required companion to `react` for browser rendering |
| **typescript** | `^5.4.5` | Language | Adds static typing to all JavaScript — interfaces, enums, generics | Prevents runtime type errors; essential for a large codebase with complex data models (experiments, inventory, etc.) |
| **vite** | `^5.3.1` | Build Tool | Dev server with HMR and production bundler (Rollup-based) | Significantly faster than Webpack for both dev startup and production builds |
| **@vitejs/plugin-react** | `^4.3.1` | Build Plugin | Enables React Fast Refresh and JSX transform for Vite | Required Vite plugin for React projects — enables instant hot module replacement |
| **autoprefixer** | `^10.4.19` | CSS PostProcessor | Adds vendor prefixes to CSS automatically | Ensures cross-browser CSS compatibility without manual `-webkit-`, `-moz-` prefixes |
| **postcss** | `^8.4.38` | CSS Processing | CSS transformation pipeline used with Tailwind and autoprefixer | Required peer dependency for Tailwind CSS processing |

---

### 2.2 UI Components & Styling

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **antd** | `^5.18.0` | UI Component Library | Primary UI library — provides all core components: Tables, Forms, Modals, Drawers, Tabs, Notifications, Date Pickers, etc. | Ant Design 5 has a comprehensive component set suited for data-heavy ELN interfaces; built-in design system ensures visual consistency |
| **@ant-design/icons** | `^5.3.7` | Icon Library | 1,000+ SVG icons used throughout the UI (menus, buttons, status indicators) | Official icon pack for Ant Design — matches the component library's visual language |
| **@fontsource/inter** | `^5.0.18` | Typography | Self-hosted Inter font — used as the global application typeface | Self-hosting avoids external font CDN dependencies; Inter is highly readable for dense data tables |
| **tailwindcss** | `^3.4.4` | Utility CSS | Utility-first CSS for custom layouts, spacing, and responsive design where Ant Design components need override | Tailwind complements Ant Design for one-off spacing/layout needs without writing custom CSS |
| **styled-components** | `^6.1.11` | CSS-in-JS | Component-scoped styles for complex custom components where Tailwind utilities are insufficient | Used in specific complex components (e.g., the experiment canvas, custom editor wrappers) that require dynamic styling |
| **less** | `^4.2.0` | CSS Preprocessor | Required by Ant Design 5 for theme customization (CSS variables, token overrides) | Ant Design's theming system uses Less variables — this enables custom brand colors and design tokens |

---

### 2.3 Rich-Text & Scientific Editors

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **react-quill** | `^2.0.0` | Rich-Text Editor | WYSIWYG editor for experiment fields — `procedure`, `observations`, `results`, `conclusion` | These fields require formatted text (bullet lists, bold/italic, tables). Quill outputs HTML, which is stored in the DB and rendered back as-is |
| **@tiptap/react** | `^3.26.0` | Rich-Text Editor | Modern ProseMirror-based editor (alternative/replacement for Quill) | Tiptap is more actively maintained and extensible than Quill; used in newer editor components |
| **@tiptap/starter-kit** | `^3.26.0` | Editor Extension | Bundle of core Tiptap extensions: bold, italic, lists, headings, code blocks | Provides all standard formatting toolbar features in a single import |
| **@tiptap/extension-placeholder** | `^3.26.0` | Editor Extension | Shows placeholder text when an editor field is empty | Improves UX — users see "Enter procedure here..." instead of a blank editor |
| **@tiptap/extension-underline** | `^3.26.0` | Editor Extension | Adds underline formatting support to the Tiptap editor toolbar | Scientific documents frequently use underline — this adds it as a first-class toolbar option |
| **@tiptap/pm** | `^3.26.0` | Editor Core | ProseMirror peer dependency required by all Tiptap extensions | Required internal dependency — all Tiptap extensions depend on the ProseMirror core |
| **ketcher-react** | `^3.12.0` | Chemistry Editor | Chemical structure drawing editor (React wrapper for Ketcher) | ELN-specific requirement — chemists need to draw and store molecular structures (SMILES, MOL files) within experiments |
| **ketcher-standalone** | `^3.12.0` | Chemistry Engine | Standalone Ketcher chemistry engine (runs without a backend structure service) | Enables structure drawing without an external Indigo/Ketcher server dependency |

> **Storage note — Rich Text:**  
> All rich-text fields (`procedure`, `observations`, `results`, `conclusion`, `objective`) are stored as raw HTML strings in PostgreSQL `TEXT` columns. The backend sanitizes this HTML using `beautifulsoup4` before persistence. On the frontend, content is rendered using `dangerouslySetInnerHTML` (safe because it was already sanitized server-side).

---

### 2.4 State Management

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **@reduxjs/toolkit** | `^2.2.5` | State Management | Global application state — authenticated user, session tokens, UI preferences, notification state | Redux Toolkit is the modern, opinionated Redux setup — eliminates boilerplate with `createSlice` and `createAsyncThunk` |
| **react-redux** | `^9.1.2` | State Binding | Connects React components to the Redux store via `useSelector` and `useDispatch` hooks | Required companion to Redux Toolkit for React integration |

---

### 2.5 API & Data Fetching

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **axios** | `^1.17.0` | HTTP Client | All API requests to the FastAPI backend — GET, POST, PATCH, DELETE with JSON bodies and Bearer token headers | Axios has cleaner interceptor support than `fetch` — the auth interceptor automatically attaches JWT tokens and handles 401 token refresh |

> **Configuration note — Axios:**  
> A shared `axios` instance (`src/api/client.ts`) is configured with:
> - `baseURL` pointing to the FastAPI backend
> - Request interceptor to attach `Authorization: Bearer <token>` from Redux state
> - Response interceptor to catch `401` and trigger token refresh via the refresh endpoint

---

### 2.6 Routing

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **react-router-dom** | `^6.23.1` | Client-Side Routing | All application navigation — route definitions, protected routes, nested layouts, URL params | React Router v6 is the standard for React SPAs; v6's `<Outlet>` pattern simplifies nested module layouts |

---

### 2.7 Testing & Quality

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **vitest** | `^1.6.1` | Test Runner | Runs all frontend unit and component tests; configured via `vite.config.ts` | Vitest shares the Vite config — no separate Jest config needed; significantly faster than Jest for TypeScript projects |
| **@vitest/ui** | `^1.6.1` | Test UI | Browser-based test results dashboard for visualizing test runs | Provides a visual interface for exploring test results, especially useful during development |
| **@testing-library/react** | `^15.0.7` | Component Testing | Renders React components in isolation and queries the DOM for assertions | The standard for React component testing — tests behavior from the user's perspective, not implementation details |
| **@testing-library/jest-dom** | `^6.9.1` | DOM Assertions | Custom matchers like `toBeInTheDocument()`, `toHaveValue()`, `toBeDisabled()` | Dramatically improves test readability over raw DOM assertions |
| **@testing-library/user-event** | `^14.6.1` | User Interaction | Simulates real user interactions (typing, clicking, tabbing) more accurately than `fireEvent` | Required for testing form interactions in the experiment and inventory modules |
| **msw** | `^2.3.0` | API Mocking | Mock Service Worker — intercepts real HTTP requests in tests without changing application code | Enables realistic API mocking at the network layer; tests run without a real backend |
| **jsdom** | `^24.1.3` | DOM Simulation | Provides a browser-like DOM environment for Vitest (runs in Node.js) | Required for `@testing-library/react` to work in the Vitest/Node.js environment |
| **eslint** | `^8.57.0` | Linting | Static code analysis — catches bugs, enforces code style, flags unused variables | Prevents common JavaScript/TypeScript mistakes before they reach review |
| **@typescript-eslint/eslint-plugin** | `^7.13.0` | ESLint Plugin | TypeScript-specific ESLint rules (type-aware linting) | Enables type-aware lint rules that catch errors TypeScript's compiler misses |
| **@typescript-eslint/parser** | `^7.13.0` | ESLint Parser | Allows ESLint to parse TypeScript syntax | Required for any TypeScript ESLint rules to work |
| **eslint-plugin-react-hooks** | `^4.6.2` | ESLint Plugin | Enforces Rules of Hooks (no conditional hooks, exhaustive deps in `useEffect`) | Prevents subtle React hook bugs that cause stale closures and infinite renders |
| **eslint-plugin-react-refresh** | `^0.4.7` | ESLint Plugin | Warns when a component can't benefit from React Fast Refresh | Ensures HMR works correctly during development |

---

### 2.8 Utilities & Helpers

| Package / Library | Version | Category | Purpose / Usage | Why It Was Added |
|---|---|---|---|---|
| **@types/react** | `^18.3.3` | TypeScript Types | TypeScript definitions for React (hooks, components, events) | Required for TypeScript to understand React's API |
| **@types/react-dom** | `^18.3.0` | TypeScript Types | TypeScript definitions for `react-dom` | Required companion type package for `react-dom` |
| **@types/styled-components** | `^5.1.34` | TypeScript Types | TypeScript definitions for `styled-components` | Enables type-safe usage of the `styled` API and theme context |

---

### 2.9 Recommended — Not Yet Installed (Frontend)

| Package | Category | Purpose | Recommendation Reason |
|---|---|---|---|
| **@tanstack/react-query** | Data Fetching | Server state management — caching, background refetch, pagination, optimistic updates | Currently all API state lives in Redux, which is not designed for server state. React Query would handle loading/error/cache states automatically |
| **react-hook-form** | Forms | Performant form management with minimal re-renders | The inventory and experiment forms are complex — React Hook Form reduces boilerplate and improves performance over controlled inputs |
| **zod** | Validation | Schema-based runtime validation for form data and API responses | Pairs with React Hook Form for end-to-end type-safe validation; schemas can be auto-generated from Pydantic models |
| **dayjs** | Date Utilities | Lightweight date manipulation and formatting (2KB vs moment.js 67KB) | Many date fields exist across experiments, schedules, and batches — a consistent date utility prevents formatting bugs |
| **@sentry/react** | Error Monitoring | Frontend exception tracking with React component stack traces | No frontend observability today — Sentry captures user-facing errors with full context |
| **playwright** | E2E Testing | End-to-end browser automation for testing full user workflows | The most critical flows (login → create experiment → submit → approve) should have E2E coverage. Playwright is faster and more reliable than Cypress for TypeScript projects |
| **react-pdf** or **pdfmake** | PDF Generation | Client-side PDF generation for experiment exports | Users will need printable experiment reports; this avoids a server round-trip for basic PDF layouts |
| **i18next + react-i18next** | Internationalization | Multi-language support | If the product will be used internationally (US, EU markets), i18n infrastructure should be added before the codebase grows further |

---

## 3. Summary & Recommendations

### 3.1 Total Dependency Count

| Scope | Runtime | Development | Stdlib (key modules) | Total |
|---|---|---|---|---|
| Backend (Python) | 13 | 3 | 17 | **33** |
| Frontend (JS/TS) | 17 | 21 | — | **38** |
| **Combined** | **30** | **24** | **17** | **71** |

> *Stdlib modules are zero-install (bundled with Python) but are listed because they perform non-trivial application logic — version diffing, formula evaluation, token security, file handling.*

---

### 3.2 Most Critical / High-Impact Libraries

| Library | Why It's Critical |
|---|---|
| **FastAPI** | Every single API endpoint runs through this framework — it IS the backend |
| **SQLAlchemy 2.0** | All data persistence, relationships, and queries go through the ORM |
| **Alembic** | Without this, schema changes cannot be deployed safely to production |
| **Pydantic v2** | All request validation and response serialization depends on this |
| **React 18** | The entire frontend UI is built on React |
| **Ant Design 5** | Provides 80%+ of all visible UI components |
| **Redux Toolkit** | Manages auth state, session tokens, and shared UI state |
| **python-jose + passlib** | The entire authentication system — access tokens + password security |
| **Ketcher** | Unique to ELN — enables chemical structure drawing, a core differentiator |
| **Axios** | Every frontend-to-backend API call goes through this client |

---

### 3.3 Libraries to Consider for Future Removal or Replacement

| Library | Issue | Suggested Replacement |
|---|---|---|
| **react-quill** `^2.0.0` | No longer actively maintained; v2 has known React 18 compatibility warnings | **@tiptap** (already installed) — migrate all Quill editors to Tiptap and remove Quill |
| **styled-components** | Dual-styling approach (Tailwind + styled-components) adds cognitive overhead | Consolidate on Tailwind + Ant Design CSS-in-JS tokens; remove styled-components unless there's a strong reason to keep it |
| **Redux (for server state)** | Using Redux for API response caching creates large amounts of boilerplate | Add **TanStack React Query** for server state; keep Redux only for auth/session/UI state |
| **passlib** | `passlib` is in maintenance mode; has a known deprecation warning with bcrypt ≥ 4.x | Switch to direct `bcrypt` library calls (`import bcrypt; bcrypt.hashpw(...)`) — the code already uses bcrypt under the hood |

---

### 3.4 Recommendations for Keeping Dependencies Clean

1. **Pin all backend versions exactly** (`==`) — already done. Never use `>=` in `requirements.txt` for a production service; unpinned ranges cause silent breakage on deployment.

2. **Audit frontend ranges quarterly** — `^` ranges in `package.json` allow minor version updates automatically. Run `npm outdated` before each sprint to review what has changed.

3. **Split requirements files** — consider separating `requirements.txt` into:
   - `requirements/base.txt` — production dependencies only
   - `requirements/dev.txt` — testing, linting, dev tools (includes `base.txt`)
   This prevents test tools from being installed in the production Docker image.

4. **Do not add dependencies for single-function tasks** — check if the standard library covers the use case first (e.g., `uuid`, `datetime`, `hashlib`, `os.path` are all built-in).

5. **Consolidate rich-text editors** — having both `react-quill` and `@tiptap/*` in production dependencies adds ~400KB to the bundle. Pick one and migrate.

6. **Add a `package-lock.json` / `pip freeze` policy** — `package-lock.json` is already generated by npm and should always be committed. For Python, consider generating a `requirements.lock` (via `pip-tools`) for reproducible CI builds.

7. **Set up Dependabot or Renovate** — automates dependency update PRs with changelogs, so the team doesn't fall months behind on security patches.

---

*End of Dependency Report — Chemia ELN v1.0*
