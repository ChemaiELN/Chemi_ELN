# Laurus ELN — Intranet Deployment Guide (Windows Server, Offline)

This package runs fully offline. No internet access is required on the server.

Server IP already baked into this build: **10.10.51.90**
(frontend `config.js` and `.env.example` CORS are pre-set to this address)

## Prerequisites on the Server (one-time)

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11.x or 3.12.x (64-bit) | Must already be on PATH |
| PostgreSQL | 14+ | An **empty** database named `laurus_eln` is enough |

> All Python package dependencies are already bundled in `backend\packages\`
> — no internet is needed to install them. This includes `rdkit` (renders
> chemical structure images in experiment reports) and its dependency
> `numpy`, for both Python 3.11 and 3.12.

---

## Folder Structure After Unzip

```
Laurus-ELN\
  backend\
    app\            FastAPI application
    migrations\     Alembic database migrations
    seeds\          Seed data scripts
    packages\       Bundled Python wheels (offline install)
    seed_all.py     One-shot seeder (roles, admin user, reference data)
    requirements.txt
    start.bat       ← Run this to start the backend (first time / after updates)
    run-backend.bat ← Slim launcher for auto-start (skips install/migrate/seed)
    .env.example    ← Copy to .env and edit
  frontend\
    dist\           Built React app (static files)
      config.js     ← Already points at http://10.10.51.90:8000
    serve.bat       ← Run this to serve the frontend
    serve.py        ← Static file server the .bat calls (SPA-aware)
  DEPLOY.md
```

---

## Step 1 — Create the Database

In pgAdmin or psql, create an (empty) database. Example:
```sql
CREATE DATABASE laurus_eln;
```
The tables are created automatically in Step 3.

---

## Step 2 — Configure the Backend

1. Open the `backend\` folder.
2. Copy `.env.example` → `.env`.
3. Edit `.env`:
   - `DATABASE_URL` — set to your PostgreSQL user/password/host/db, e.g.
     `postgresql://postgres:MyPassword@localhost:5432/laurus_eln`

     **If your password contains an `@` or any of `: / ? # [ ] %` , it must be
     URL-encoded** or the connection string will be misread. `@` → `%40`.
     Example: password `cgt@2024` must be written as `cgt%402024`:
     `postgresql://postgres:cgt%402024@localhost:5432/laurus_eln`
   - `SECRET_KEY` — generate one:
     `python -c "import secrets; print(secrets.token_hex(32))"`
   - `CORS_ORIGINS` — already set to `["http://10.10.51.90:9091"]`. Only
     change this if the server's IP is not 10.10.51.90.
   - `AD_API_BASE_URL` / `AD_INTEGRATION_API_KEY` / `AD_DEFAULT_TL_USERNAME` —
     only needed if this server also talks to a separate AD (Analytical R&D)
     backend for "Submit to AD" from ADC experiments. Leave the placeholder
     values if that integration isn't used; the app runs fine without it.

---

## Step 3 — Start the Backend

Double-click `backend\start.bat` (run as Administrator). It will:
- Install all dependencies **offline** from `packages\` into the base Python
  (no virtual environment — see note below)
- Run database migrations (creates all tables)
- Seed roles, reference data, and the initial admin user
- Start the API on **http://0.0.0.0:8000**

> **Why no virtual environment?** On locked-down servers, AppLocker or
> antivirus policies can block executing the copied `python.exe`/`pip.exe`
> inside a `venv\Scripts\` folder outside standard install paths, causing
> `Fatal error in launcher: ... Access is denied`. `start.bat` installs
> directly into the system Python and runs everything via `python -m ...`
> to avoid that. If `start.bat` still fails with "Access is denied" on the
> install step, ask IT to whitelist this folder / the Python executable, or
> run the commands inside `start.bat` manually from an elevated CMD.

**Initial login:**  `qa.admin`  /  `Admin@123`  *(change this after first login)*

---

## Step 4 — Verify the Frontend Config

`frontend\dist\config.js` is already set to:
```js
window.__APP_CONFIG__ = {
  API_URL: "http://10.10.51.90:8000"
};
```
Only edit this if the backend ends up running on a different IP/port.
No rebuild needed — just edit and refresh the browser.

---

## Step 5 — Start the Frontend

Double-click `frontend\serve.bat`. It serves the app on **http://0.0.0.0:9091**.

---

## Step 6 — Open in a Browser

From any machine on the intranet:
```
http://10.10.51.90:9091
```

---

## Windows Firewall (on the server)

Allow inbound TCP on the two ports:
```
netsh advfirewall firewall add rule name="Laurus ELN Backend" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="Laurus ELN Frontend" dir=in action=allow protocol=TCP localport=9091
```

---

## Auto-start on Reboot (optional)

Put shortcuts to `backend\run-backend.bat` and `frontend\serve.bat` in:
```
C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\
```
`run-backend.bat` is a slim launcher — it assumes `start.bat` has already
been run once (dependencies installed, DB migrated + seeded) and just starts
uvicorn directly, so it comes up faster on every reboot.

---

## Updating an Existing Deployment

When re-deploying a newer build over an existing server install:
1. Stop both running servers (close their console windows, or Ctrl+C).
2. Replace the `backend\` and `frontend\` folders with the new versions —
   **except** keep your existing `backend\.env` (don't overwrite it with
   `.env.example`).
3. Re-run `backend\start.bat` — it re-installs any new/changed dependencies
   from `packages\` and applies any new database migrations automatically.
4. Re-run `frontend\serve.bat`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `start.bat`: "Fatal error in launcher... Access is denied" | AppLocker/AV is blocking venv executables. Already fixed in this `start.bat` (no venv used). If it still happens, IT must allow the Python executable/folder to run. |
| Browser loads but login/API calls fail | Check `config.js` API_URL and that `CORS_ORIGINS` in `.env` matches `http://10.10.51.90:9091` |
| `start.bat` fails at migration | Verify PostgreSQL is running and `DATABASE_URL` is correct — check for un-encoded special characters in the password (see Step 2) |
| Other machines can't connect | Confirm the firewall rules above and that they use the server IP (not localhost) |
| Fonts look plain | Expected — web fonts are disabled for offline use; the app uses system fonts |
| Chemical structure images missing from a downloaded experiment report | Confirm `rdkit`/`numpy` installed without errors during `start.bat`'s dependency step (check the console output) — antivirus occasionally quarantines large `.whl` files; whitelist `backend\packages\` if so. |
