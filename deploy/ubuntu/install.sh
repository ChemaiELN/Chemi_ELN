#!/usr/bin/env bash
# ==============================================================
#  Laurus ELN — first-time install on Ubuntu
#
#  Usage:  sudo ./install.sh /path/to/laurus_eln.dump
#
#  The dump argument is REQUIRED. This repo's Sequelize migrations
#  only ALTER an existing schema (the ~124 base tables were created
#  by the previous Python/Alembic tooling), and src/database/seeders
#  is empty — so there is no way to build a working database from
#  scratch here. A pg_dump restore from a known-good database is the
#  only supported path. See DEPLOY-UBUNTU.md § Database.
#
#  Idempotent: safe to re-run. Re-running does NOT re-restore the
#  database unless the target DB is absent.
# ==============================================================
set -euo pipefail

SERVER_IP="192.168.205.247"
APP_USER="laurus"
APP_ROOT="/opt/laurus-eln"
WEB_ROOT="/var/www/laurus-eln"
DB_NAME="laurus_eln"
DB_USER="laurus"
NODE_MAJOR="22"   # Vite 8 requires Node >= 20.19; 22 LTS is the safe floor.

# Repo root = two levels up from this script (deploy/ubuntu/install.sh)
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DUMP_FILE="${1:-}"

log()  { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."
[[ -n "$DUMP_FILE" ]] || die "Missing database dump.
  Usage: sudo ./install.sh /path/to/laurus_eln.dump
  Create one on the current working server with:
    pg_dump -Fc -U postgres laurus_eln -f laurus_eln.dump
  (see DEPLOY-UBUNTU.md § Database for why this is required)"
[[ -f "$DUMP_FILE" ]] || die "Dump file not found: $DUMP_FILE"
[[ -d "$SRC_DIR/backend-node" && -d "$SRC_DIR/frontend" ]] \
  || die "Expected backend-node/ and frontend/ under $SRC_DIR"

# ── Packages ──────────────────────────────────────────────────
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# rsync and openssl are used below and are absent on minimal images.
apt-get install -y -qq curl ca-certificates gnupg rsync openssl \
                      postgresql postgresql-contrib nginx ufw

if ! command -v node >/dev/null 2>&1 || \
   [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt "$NODE_MAJOR" ]]; then
  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
log "Node $(node -v) / npm $(npm -v)"

systemctl enable --now postgresql

# ── Service account & directories ─────────────────────────────
log "Creating service account and directories"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_ROOT" "$WEB_ROOT"

# ── Database ──────────────────────────────────────────────────
log "Configuring PostgreSQL"
DB_PASSWORD=""
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  warn "Role '${DB_USER}' already exists — leaving its password unchanged."
  warn "If you don't know it, set a new one and update .env:"
  warn "  sudo -u postgres psql -c \"ALTER ROLE ${DB_USER} WITH PASSWORD 'newpass';\""
else
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  sudo -u postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
  log "Created role '${DB_USER}'"
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  warn "Database '${DB_NAME}' already exists — skipping create AND restore."
  warn "To force a clean restore:  sudo -u postgres dropdb ${DB_NAME}  then re-run."
else
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  log "Restoring dump into '${DB_NAME}' (this is the only way the schema gets created)"
  # Restore as superuser so extensions/ownership in the dump apply cleanly.
  # --no-owner remaps objects to the target role; non-fatal notices are normal.
  cp "$DUMP_FILE" /tmp/laurus_restore.dump
  chmod 644 /tmp/laurus_restore.dump
  if head -c5 /tmp/laurus_restore.dump | grep -q 'PGDMP'; then
    sudo -u postgres pg_restore --no-owner --role="$DB_USER" -d "$DB_NAME" /tmp/laurus_restore.dump \
      || warn "pg_restore reported non-fatal errors — review the output above."
  else
    warn "Dump is not custom-format; treating it as plain SQL."
    sudo -u postgres psql -q -d "$DB_NAME" -f /tmp/laurus_restore.dump
  fi
  rm -f /tmp/laurus_restore.dump
  sudo -u postgres psql -qd "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -qd "$DB_NAME" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -qd "$DB_NAME" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
  TABLES=$(sudo -u postgres psql -tAd "$DB_NAME" -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
  log "Restored — ${TABLES} tables in public schema"
  [[ "$TABLES" -gt 50 ]] || warn "Only ${TABLES} tables restored; expected ~124. Check the dump."
fi

# ── Application files ─────────────────────────────────────────
log "Copying application source to ${APP_ROOT}"
mkdir -p "$APP_ROOT/backend"
rsync -a --delete \
  --exclude node_modules --exclude .env --exclude uploads --exclude logs --exclude dist \
  "$SRC_DIR/backend-node/" "$APP_ROOT/backend/"
mkdir -p "$APP_ROOT/deploy/ubuntu"
rsync -a "$SRC_DIR/deploy/ubuntu/" "$APP_ROOT/deploy/ubuntu/"

# ── Backend .env ──────────────────────────────────────────────
ENV_FILE="$APP_ROOT/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn "Keeping existing $ENV_FILE"
else
  log "Writing $ENV_FILE"
  JWT_SECRET="$(openssl rand -hex 32)"
  sed -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" \
      -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://${SERVER_IP}|" \
      "$APP_ROOT/deploy/ubuntu/env.production.example" > "$ENV_FILE"
  if [[ -n "$DB_PASSWORD" ]]; then
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" "$ENV_FILE"
  else
    warn "DB_PASSWORD left as CHANGE_ME in $ENV_FILE — set it before starting."
  fi
fi

# ── Upload directories ────────────────────────────────────────
# multer's diskStorage does NOT create these on demand; a missing
# subdirectory makes the corresponding upload fail with ENOENT.
log "Creating upload directories"
for d in attachments ard-attachments experiment-files project-attachments \
         user-job-descriptions inv-manufacturer-docs inv-mapping-dsd \
         inventory/coa inventory/docs inventory/uploads; do
  mkdir -p "$APP_ROOT/backend/uploads/$d"
done
mkdir -p "$APP_ROOT/backend/logs"

# ── Build backend ─────────────────────────────────────────────
# Full install (not --omit=dev): tsc and sequelize-cli are devDependencies
# and are needed to build and to run migrations.
log "Installing backend dependencies and building"
cd "$APP_ROOT/backend"
npm ci --no-audit --fund=false
npm run build
[[ -f dist/app.js ]] || die "Backend build produced no dist/app.js"

log "Applying database migrations"
npm run migration:run

# ── Build frontend ────────────────────────────────────────────
log "Building frontend"
FE_BUILD="$(mktemp -d)"
rsync -a --exclude node_modules --exclude dist "$SRC_DIR/frontend/" "$FE_BUILD/"
cd "$FE_BUILD"
npm ci --no-audit --fund=false
npm run build
[[ -f dist/index.html ]] || die "Frontend build produced no dist/index.html"

log "Publishing frontend to ${WEB_ROOT}"
rsync -a --delete dist/ "$WEB_ROOT/"
install -m 644 "$APP_ROOT/deploy/ubuntu/frontend-config.js" "$WEB_ROOT/config.js"
cd /
rm -rf "$FE_BUILD"

# ── Ownership ─────────────────────────────────────────────────
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
chown -R www-data:www-data "$WEB_ROOT"

# ── systemd ───────────────────────────────────────────────────
log "Installing systemd service"
install -m 644 "$APP_ROOT/deploy/ubuntu/laurus-eln-api.service" \
  /etc/systemd/system/laurus-eln-api.service
systemctl daemon-reload
systemctl enable laurus-eln-api
systemctl restart laurus-eln-api

# ── nginx ─────────────────────────────────────────────────────
log "Configuring nginx"
install -m 644 "$APP_ROOT/deploy/ubuntu/nginx-laurus-eln.conf" \
  /etc/nginx/sites-available/laurus-eln
ln -sfn /etc/nginx/sites-available/laurus-eln /etc/nginx/sites-enabled/laurus-eln
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

# ── Firewall ──────────────────────────────────────────────────
# Only port 80 is exposed; the API is reached through nginx.
if ufw status | grep -q "Status: active"; then
  log "Opening port 80 in ufw"
  ufw allow 80/tcp >/dev/null
else
  warn "ufw is inactive — not enabling it. To enable:  sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw enable"
fi

# ── Verify ────────────────────────────────────────────────────
log "Verifying"
sleep 3
if curl -fsS --max-time 10 "http://127.0.0.1:8000/api/health" >/dev/null; then
  echo "  backend  /api/health   OK"
else
  die "Backend health check FAILED. Inspect:  journalctl -u laurus-eln-api -n 60 --no-pager"
fi
if curl -fsS --max-time 10 "http://127.0.0.1/api/health" >/dev/null; then
  echo "  nginx    /api/health   OK (proxy works)"
else
  warn "nginx proxy check failed — see /var/log/nginx/laurus-eln.error.log"
fi
curl -fsS --max-time 10 "http://127.0.0.1/" | grep -q '<div id="root">' \
  && echo "  frontend index.html   OK" \
  || warn "Frontend did not serve as expected."

cat <<EOF

$(printf '\033[1;32m')Done.$(printf '\033[0m')

  URL          http://${SERVER_IP}/
  API health   http://${SERVER_IP}/api/health
  Logs         sudo journalctl -u laurus-eln-api -f
  Restart      sudo systemctl restart laurus-eln-api
  Env          ${ENV_FILE}
  Update       sudo ${APP_ROOT}/deploy/ubuntu/update.sh /path/to/new/source

Sign in with a user that exists in the restored database.
EOF
