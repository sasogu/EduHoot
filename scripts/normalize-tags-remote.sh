#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER_HOST="${REMOTE_USER_HOST:-samgua@edutictac.es}"
REMOTE_PORT="${REMOTE_PORT:-2222}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/opt/llixhoot/src}"
LOCAL_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/scripts/normalize-tags.js"
REMOTE_SCRIPT_DIR="${REMOTE_BASE_DIR}/scripts"
REMOTE_SCRIPT_PATH="${REMOTE_SCRIPT_DIR}/normalize-tags.js"
MODE="${1:-dry-run}"

if [[ ! -f "${LOCAL_SCRIPT}" ]]; then
  echo "No existe el script local: ${LOCAL_SCRIPT}" >&2
  exit 1
fi

case "${MODE}" in
  dry-run)
    REMOTE_ENV="DRY_RUN=1"
    ;;
  apply)
    REMOTE_ENV=""
    ;;
  *)
    echo "Uso: $0 [dry-run|apply]" >&2
    exit 1
    ;;
esac

echo "Subiendo script a ${REMOTE_USER_HOST}:${REMOTE_SCRIPT_PATH}"
ssh -p "${REMOTE_PORT}" "${REMOTE_USER_HOST}" "mkdir -p '${REMOTE_SCRIPT_DIR}'"
scp -P "${REMOTE_PORT}" "${LOCAL_SCRIPT}" "${REMOTE_USER_HOST}:${REMOTE_SCRIPT_PATH}"

echo "Ejecutando en remoto (${MODE})"
ssh -p "${REMOTE_PORT}" "${REMOTE_USER_HOST}" "cd '${REMOTE_BASE_DIR}' && ${REMOTE_ENV} node scripts/normalize-tags.js"

echo "Proceso completado."
