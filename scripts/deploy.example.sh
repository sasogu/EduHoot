#!/usr/bin/env bash
set -euo pipefail

# Copia este archivo a scripts/deploy.sh y rellena tus datos reales.
# scripts/deploy.sh está en .gitignore para evitar publicar credenciales o rutas del VPS.

DEPLOY_TARGET="${DEPLOY_TARGET:-usuario@vps:/var/www/eduhoot}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_REMOTE_CMD="${DEPLOY_REMOTE_CMD:-cd /var/www/eduhoot/src && npm ci --omit=dev && pm2 restart eduhoot}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${DRY_RUN:-0}"
DELETE_MODE="${DELETE_MODE:-0}"

RSYNC_ARGS=(
  -az
  --info=stats2,progress2
  --human-readable
  --exclude=.git/
  --exclude=node_modules/
  --exclude=src/node_modules/
  --exclude=logs/
  --exclude=*.log
  --exclude=.DS_Store
  --exclude=install-files/
)

if [[ "${DRY_RUN}" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run)
fi

if [[ "${DELETE_MODE}" == "1" ]]; then
  RSYNC_ARGS+=(--delete)
fi

echo "Deploying ${ROOT_DIR} -> ${DEPLOY_TARGET}"
rsync "${RSYNC_ARGS[@]}" -e "ssh -p ${DEPLOY_PORT}" "${ROOT_DIR}/" "${DEPLOY_TARGET}"

if [[ -n "${DEPLOY_REMOTE_CMD}" ]]; then
  REMOTE_HOST="${DEPLOY_TARGET%%:*}"
  echo "Running remote command on ${REMOTE_HOST}"
  ssh -p "${DEPLOY_PORT}" "${REMOTE_HOST}" "${DEPLOY_REMOTE_CMD}"
fi

echo "Deploy finished."
