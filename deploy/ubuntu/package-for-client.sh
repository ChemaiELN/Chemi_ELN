#!/usr/bin/env bash
# ==============================================================
#  Build the tarball to hand to the client / copy to the server.
#
#  Usage (from anywhere):  ./deploy/ubuntu/package-for-client.sh
#         optional outdir:  ./deploy/ubuntu/package-for-client.sh ~/Desktop
#
#  Produces:  Laurus-ELN-ubuntu-<YYYY-MM-DD>.tar.gz
#
#  Deliberately EXCLUDES:
#    .env          — your dev DB password and JWT_SECRET. install.sh
#                    generates fresh ones on the server; shipping yours
#                    would leak working credentials.
#    node_modules  — reinstalled by `npm ci` on the server from the
#                    committed lockfiles (~400 MB saved).
#    dist          — rebuilt on the server for its own Node version.
#    uploads/logs  — local run artefacts.
#    .git          — history isn't needed to deploy.
#
#  The database dump is NOT included — send it as a separate file.
#  See DEPLOY-UBUNTU.md § "the database cannot be created from scratch".
# ==============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT}"
STAMP="$(date +%Y-%m-%d)"
NAME="Laurus-ELN-ubuntu-${STAMP}"
ARCHIVE="${OUT_DIR}/${NAME}.tar.gz"

log() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"
[[ -d backend-node && -d frontend && -d deploy/ubuntu ]] \
  || die "Run this from within the Laurus-ELN repo (missing backend-node/, frontend/ or deploy/ubuntu/)."
[[ -f backend-node/package-lock.json ]] || die "backend-node/package-lock.json missing — npm ci needs it."
[[ -f frontend/package-lock.json ]]     || die "frontend/package-lock.json missing — npm ci needs it."

mkdir -p "$OUT_DIR"

log "Packaging → ${ARCHIVE}"
tar czf "$ARCHIVE" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.git' \
  --exclude='logs' \
  --exclude='uploads' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --transform "s,^,${NAME}/," \
  backend-node frontend deploy/ubuntu

# ── Verify the archive is complete and clean ───────────────────
log "Verifying"
LISTING="$(tar tzf "$ARCHIVE")"

leaked="$(printf '%s\n' "$LISTING" | grep -E '(^|/)\.env$' || true)"
[[ -z "$leaked" ]] || die "SECRET LEAK — .env is inside the archive:
$leaked"
echo "  no .env in archive                         OK"

for want in \
  "${NAME}/backend-node/package-lock.json" \
  "${NAME}/backend-node/src/app.ts" \
  "${NAME}/backend-node/src/database/migrations" \
  "${NAME}/frontend/package-lock.json" \
  "${NAME}/frontend/public/config.js" \
  "${NAME}/deploy/ubuntu/install.sh" \
  "${NAME}/deploy/ubuntu/DEPLOY-UBUNTU.md" ; do
  printf '%s\n' "$LISTING" | grep -q "^${want}" \
    || die "Archive is missing expected path: ${want}"
done
echo "  source, lockfiles, migrations, scripts     OK"

printf '%s\n' "$LISTING" | grep -q 'node_modules/' \
  && die "node_modules leaked into the archive" \
  || echo "  no node_modules                            OK"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
FILES="$(printf '%s\n' "$LISTING" | wc -l | tr -d ' ')"

cat <<EOF

$(printf '\033[1;32m')Package ready$(printf '\033[0m')

  File     ${ARCHIVE}
  Size     ${SIZE}  (${FILES} entries)

Send TWO files to the client:
  1. ${NAME}.tar.gz
  2. laurus_eln.dump      <- create separately:
                             pg_dump -Fc -U postgres laurus_eln -f laurus_eln.dump

On the Ubuntu server (192.168.205.247):
  tar xzf ${NAME}.tar.gz
  cd ${NAME}/deploy/ubuntu
  chmod +x install.sh update.sh
  sudo ./install.sh ~/laurus_eln.dump
EOF
