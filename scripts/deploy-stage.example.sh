#!/usr/bin/env bash
set -euo pipefail

# Entorno stage (preproducción) para validar cambios sin tocar producción.
# Uso recomendado:
#   cp scripts/deploy-stage.example.sh scripts/deploy-stage.sh
#   chmod +x scripts/deploy-stage.sh
#   ./scripts/deploy-stage.sh
#
# También puedes lanzar la plantilla directamente sobreescribiendo variables:
#   DEPLOY_TARGET=usuario@vps:/opt/llixhoot-stage/src bash scripts/deploy-stage.example.sh

DEPLOY_TARGET="${DEPLOY_TARGET:-usuario@vps:/opt/llixhoot-stage/src}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_REMOTE_CMD="${DEPLOY_REMOTE_CMD-cd /opt/llixhoot-stage/src && npm ci --omit=dev && sudo systemctl restart llixhoot-stage-server && sudo systemctl --no-pager --full status llixhoot-stage-server | sed -n '1,12p'}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SOURCE_DIR="${DEPLOY_SOURCE_DIR:-${ROOT_DIR}/src}"
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

if [[ ! -d "${DEPLOY_SOURCE_DIR}" ]]; then
  echo "Deploy source not found: ${DEPLOY_SOURCE_DIR}" >&2
  exit 1
fi

echo "[stage] Deploying ${DEPLOY_SOURCE_DIR} -> ${DEPLOY_TARGET}"
rsync "${RSYNC_ARGS[@]}" -e "ssh -p ${DEPLOY_PORT}" "${DEPLOY_SOURCE_DIR}/" "${DEPLOY_TARGET}"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[stage] Dry run mode: skipping remote command execution."
elif [[ -n "${DEPLOY_REMOTE_CMD}" ]]; then
  REMOTE_HOST="${DEPLOY_TARGET%%:*}"
  echo "[stage] Running remote command on ${REMOTE_HOST}"
  ssh -p "${DEPLOY_PORT}" "${REMOTE_HOST}" "${DEPLOY_REMOTE_CMD}"
fi

echo "[stage] Deploy finished."
