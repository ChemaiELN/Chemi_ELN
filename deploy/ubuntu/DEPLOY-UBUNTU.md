# Laurus ELN — Ubuntu Deployment (Node backend)

Target server: **192.168.205.247**

> Supersedes the repo-root `DEPLOY.md`, which documents the retired
> Python/FastAPI backend on Windows. This stack is Node/Express + React,
> served by nginx on Ubuntu.

## Architecture

```
        browser  ──http://192.168.205.247──►  nginx :80
                                               │
                            ┌──────────────────┴──────────────────┐
                            │  /                                  │  /api/*
                            ▼                                     ▼
                  /var/www/laurus-eln                  Node API  127.0.0.1:8000
                  (built React app)                    (systemd: laurus-eln-api)
                                                                  │
                                                                  ▼
                                                        PostgreSQL  :5432
```

Frontend and API share **one origin**, so CORS is never exercised and only
**port 80** is exposed. The API is not reachable from outside the host.

| | |
|---|---|
| App source | `/opt/laurus-eln/backend` (holds `dist/`, `.env`, `uploads/`, `logs/`) |
| Web root | `/var/www/laurus-eln` |
| Service | `laurus-eln-api` (runs as `laurus`) |
| Node | 22 LTS — Vite 8 requires ≥ 20.19 |
| DB backups | `/var/backups/laurus-eln` |

---

## ⚠️ Read this before you start: the database cannot be created from scratch

This repo **cannot build a working database on an empty Postgres.** Two reasons:

1. **Migrations only alter an existing schema.** The live database has ~124
   tables, but `backend-node/src/database/migrations/` contains just four
   files — three `ALTER`s on `users` and one `CREATE TABLE` for
   `department_role_privileges`. The other ~123 tables were created by the
   previous Python/Alembic tooling, which is gone. Running
   `npm run migration:run` on an empty database fails immediately, because it
   tries to add a column to a `users` table that does not exist.
2. **There are no seeders.** `src/database/seeders/` is empty, so `npm run seed`
   does nothing. Even with a schema you would have no roles and no users, and
   therefore no way to log in.

**So deployment requires a `pg_dump` from the current working database.** On the
machine whose database you want to carry over:

```bash
pg_dump -Fc -U postgres laurus_eln -f laurus_eln.dump
```

Copy that file to the Ubuntu server and pass it to `install.sh`. Everything else
is automated.

> Worth fixing separately: a proper baseline migration (or a checked-in
> `schema.sql`) plus seeders would make clean installs possible and remove this
> dependency on an existing database. Until then, a dump is the only route.

---

## Install

```bash
# 1 — copy the source tree and the dump to the server
scp -r ./Laurus-ELN laurus_eln.dump user@192.168.205.247:~/

# 2 — install
ssh user@192.168.205.247
cd ~/Laurus-ELN/deploy/ubuntu
chmod +x install.sh update.sh
sudo ./install.sh ~/laurus_eln.dump
```

`install.sh` is idempotent and does the following:

- installs Node 22, PostgreSQL, nginx
- creates the `laurus` system user, the `laurus` DB role (with a generated
  password) and the `laurus_eln` database, then restores the dump
- writes `/opt/laurus-eln/backend/.env` with a generated `JWT_SECRET` and the
  DB password already filled in
- pre-creates all ten upload subdirectories (see note below)
- `npm ci` + build for backend and frontend, then applies migrations
- publishes the frontend to `/var/www/laurus-eln` with the production `config.js`
- installs and starts the systemd unit and the nginx site, opens port 80
- verifies `/api/health` directly and through nginx

Then open **http://192.168.205.247/** and sign in with a user from the restored
database.

### Re-running

Safe to re-run. It will **not** re-restore the database if `laurus_eln` already
exists, and it keeps an existing `.env`. To force a clean restore:

```bash
sudo systemctl stop laurus-eln-api
sudo -u postgres dropdb laurus_eln
sudo ./install.sh ~/laurus_eln.dump
```

---

## Updating

```bash
scp -r ./Laurus-ELN user@192.168.205.247:~/Laurus-ELN-new
ssh user@192.168.205.247
sudo /opt/laurus-eln/deploy/ubuntu/update.sh ~/Laurus-ELN-new
```

Backs the database up to `/var/backups/laurus-eln` first, then rebuilds both
halves, runs migrations, and restarts. `.env`, `uploads/`, and a hand-edited
`config.js` are preserved. If the build or the migrations fail it stops with the
API down and prints the exact `pg_restore` rollback command rather than leaving a
half-applied deploy running.

---

## Files in this directory

| File | Installed to | Purpose |
|---|---|---|
| `install.sh` | — | First-time provisioning |
| `update.sh` | `/opt/laurus-eln/deploy/ubuntu/` | Redeploy a newer build |
| `env.production.example` | → `/opt/laurus-eln/backend/.env` | Backend config |
| `laurus-eln-api.service` | `/etc/systemd/system/` | systemd unit |
| `nginx-laurus-eln.conf` | `/etc/nginx/sites-available/laurus-eln` | nginx site |
| `frontend-config.js` | `/var/www/laurus-eln/config.js` | Runtime `API_URL` |

---

## Operating

```bash
sudo systemctl status laurus-eln-api
sudo systemctl restart laurus-eln-api
sudo journalctl -u laurus-eln-api -f          # live logs
sudo journalctl -u laurus-eln-api -n 100      # recent
curl http://192.168.205.247/api/health

sudo -u postgres pg_dump -Fc laurus_eln -f /var/backups/laurus-eln/manual.dump
```

### Changing the server's IP

Nothing needs rebuilding. `config.js` uses `window.location.origin`, so the
frontend follows whatever address the browser used.

1. `server_name` in `/etc/nginx/sites-available/laurus-eln` → `sudo systemctl reload nginx`
2. `CORS_ORIGINS` in `/opt/laurus-eln/backend/.env` → `sudo systemctl restart laurus-eln-api`

---

## Design notes

**Upload directories are pre-created deliberately.** The app creates only the
top-level `uploads/`; multer's `diskStorage` destination callback does *not*
`mkdir` its subdirectory, so a missing one makes that upload type fail with
`ENOENT`. All ten are created by the scripts:

```
attachments  ard-attachments  experiment-files  project-attachments
user-job-descriptions  inv-manufacturer-docs  inv-mapping-dsd
inventory/coa  inventory/docs  inventory/uploads
```

Uploaded files are **not** statically served — they go through `res.download()`
so authentication still applies. nginx therefore proxies only `/api`.

**SSE needs its own nginx location.** `/api/sse/events` is an `EventSource`
stream, so that block sets `proxy_buffering off` and a 24h read timeout. With
nginx's default buffering the browser receives nothing and live notification
refresh silently stops.

**`config.js` is served `no-store`.** It carries `API_URL` and is meant to be
editable in place; a cached copy would pin browsers to a stale backend. The
fingerprinted files under `/assets/` are cached for a year.

**`npm ci` installs devDependencies on purpose.** `typescript` (build) and
`sequelize-cli` (migrations) are both devDependencies, so `--omit=dev` would
break both.

**`client_max_body_size` is 60m** against `MAX_UPLOAD_BYTES` of 50 MB, so the
backend returns the size error rather than nginx cutting the connection.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Service won't start | `journalctl -u laurus-eln-api -n 60`. Most often a missing `JWT_SECRET` (the app throws on boot) or a wrong `DB_PASSWORD`. |
| `migration:run` fails on a fresh DB | Expected on an empty database — see the warning above. Restore a dump first. |
| Login page loads, API calls fail | `curl http://127.0.0.1:8000/api/health` on the server. If that works, the nginx proxy is the problem: `/var/log/nginx/laurus-eln.error.log`. |
| Deep links 404 on refresh | SPA fallback missing — confirm the `try_files $uri $uri/ /index.html` block is present and nginx was reloaded. |
| Uploads fail with `ENOENT` | A missing upload subdirectory; re-run the `mkdir -p` loop from `install.sh`. |
| Uploads fail at ~50 MB | Raise `MAX_UPLOAD_BYTES` and keep `client_max_body_size` above it. |
| Notification badge never updates | SSE is being buffered — check the `/api/sse/` block, and that no other proxy sits in front. |
| Frontend points at the wrong API | `cat /var/www/laurus-eln/config.js`; it should be `window.location.origin`. Hard-refresh. |
| Permission denied writing uploads | `sudo chown -R laurus:laurus /opt/laurus-eln` — and note `ProtectSystem=strict` means new writable paths must be added to `ReadWritePaths` in the unit. |

---

## Not included

- **TLS/HTTPS** — plain HTTP on an internal IP. For TLS, put a certificate on
  the nginx site and switch the redirect; the app needs no change because
  `config.js` derives the origin (including scheme) from the browser.
- **Offline install** — `install.sh` fetches Node and apt packages from the
  network. If the server has no internet, the old Windows guide's bundled-wheel
  approach has no Node equivalent here; you would need a local apt mirror and a
  pre-populated `node_modules`.
- **Automated backups** — `update.sh` backs up before each deploy and keeps the
  last 10. For scheduled backups add a cron entry calling `pg_dump`.
