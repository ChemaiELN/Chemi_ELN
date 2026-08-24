#!/usr/bin/env bash
# ==============================================================
#  Laurus ELN — redeploy a newer build over an existing install
#
#  Usage:  sudo ./update.sh /path/to/new/Laurus-ELN
#          (the directory containing backend-node/ and frontend/)
#
#  Preserves: .env, uploads/, logs/, and the database.
#  Takes a database backup before applying migrations.
# ==============================================================
set -euo pipefail

APP_USER="laurus"
APP_ROOT="/opt/laurus-eln"
WEB_ROOT="/var/www/laurus-eln"
DB_NAME="laurus_eln"
BACKUP_DIR="/var/backups/laurus-eln"

SRC_DIR="${1:-}"

log()  { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."
[[ -n "$SRC_DIR" ]] || die "Usage: sudo ./update.sh /path/to/new/Laurus-ELN"
[[ -d "$SRC_DIR/backend-node" && -d "$SRC_DIR/frontend" ]] \
  || die "Expected backend-node/ and frontend/ under $SRC_DIR"
[[ -f "$APP_ROOT/backend/.env" ]] || die "No existing install found at $APP_ROOT — run install.sh first."

# ── Backup database ───────────────────────────────────────────
log "Backing up database"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"
sudo -u postgres pg_dump -Fc "$DB_NAME" -f "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
log "Saved $BACKUP_FILE"

# ── Stop API ──────────────────────────────────────────────────
log "Stopping API"
systemctl stop laurus-eln-api

# ── Backend ───────────────────────────────────────────────────
log "Syncing backend source (keeping .env, uploads, logs)"
rsync -a --delete \
  --exclude node_modules --exclude .env --exclude uploads --exclude logs --exclude dist \
  "$SRC_DIR/backend-node/" "$APP_ROOT/backend/"
rsync -a "$SRC_DIR/deploy/ubuntu/" "$APP_ROOT/deploy/ubuntu/"

# Any new upload subdirectory added since the last release.
for d in attachments ard-attachments experiment-files project-attachments \
         user-job-descriptions inv-manufacturer-docs inv-mapping-dsd \
         inventory/coa inventory/docs inventory/uploads; do
  mkdir -p "$APP_ROOT/backend/uploads/$d"
done

log "Installing dependencies and building backend"
cd "$APP_ROOT/backend"
npm ci --no-audit --fund=false
npm run build
[[ -f dist/app.js ]] || die "Backend build produced no dist/app.js — API left stopped."

log "Applying migrations"
if ! npm run migration:run; then
  warn "Migrations FAILED. The API is still stopped."
  warn "Restore with:  sudo -u postgres pg_restore -c -d ${DB_NAME} ${BACKUP_FILE}"
  die "Aborting."
fi

# ── Frontend ──────────────────────────────────────────────────
log "Building frontend"
FE_BUILD="$(mktemp -d)"
rsync -a --exclude node_modules --exclude dist "$SRC_DIR/frontend/" "$FE_BUILD/"
cd "$FE_BUILD"
npm ci --no-audit --fund=false
npm run build
[[ -f dist/index.html ]] || { cd /; rm -rf "$FE_BUILD"; die "Frontend build failed — API left stopped."; }

log "Publishing frontend"
# Preserve any hand-edited config.js rather than clobbering the API_URL.
if [[ -f "$WEB_ROOT/config.js" ]]; then
  cp "$WEB_ROOT/config.js" "$FE_BUILD/dist/config.js"
  log "Kept existing config.js"
else
  install -m 644 "$APP_ROOT/deploy/ubuntu/frontend-config.js" "$FE_BUILD/dist/config.js"
fi
rsync -a --delete "$FE_BUILD/dist/" "$WEB_ROOT/"
cd /
rm -rf "$FE_BUILD"

# ── Permissions, service configs, restart ─────────────────────
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
chown -R www-data:www-data "$WEB_ROOT"

install -m 644 "$APP_ROOT/deploy/ubuntu/laurus-eln-api.service" \
  /etc/systemd/system/laurus-eln-api.service
install -m 644 "$APP_ROOT/deploy/ubuntu/nginx-laurus-eln.conf" \
  /etc/nginx/sites-available/laurus-eln
systemctl daemon-reload

log "Starting API"
systemctl start laurus-eln-api
nginx -t && systemctl reload nginx

# ── Verify ────────────────────────────────────────────────────
sleep 3
if curl -fsS --max-time 10 "http://127.0.0.1/api/health" >/dev/null; then
  log "Update complete — http://192.168.205.247/"
  echo "  Rollback DB if needed:  sudo -u postgres pg_restore -c -d ${DB_NAME} ${BACKUP_FILE}"
else
  warn "Health check failed after update."
  warn "  Logs:       sudo journalctl -u laurus-eln-api -n 80 --no-pager"
  warn "  Rollback DB: sudo -u postgres pg_restore -c -d ${DB_NAME} ${BACKUP_FILE}"
  exit 1
fi

# Keep the 10 most recent backups.
ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f
