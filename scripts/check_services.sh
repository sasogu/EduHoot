#!/usr/bin/env bash

# Quick helper to ensure MongoDB and the app server are running.
# - Checks for a mongod/mongodb service or process; starts it if possible.
# - Starts the Node server (src/server/server.js) if not already running.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
SERVER_PID_FILE="$LOG_DIR/server.pid"
OPEN_BROWSER=0
SERVER_URL="http://localhost:3000/create/"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

ensure_mongo() {
  if pgrep -x mongod >/dev/null 2>&1; then
    log "MongoDB ya está en ejecución (proceso mongod)."
    return 0
  fi

  local started=1

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files | grep -q '^mongod\.service'; then
      log "Iniciando mongod via systemctl..."
      if sudo systemctl start mongod; then started=0; fi
    elif systemctl list-unit-files | grep -q '^mongodb\.service'; then
      log "Iniciando mongodb via systemctl..."
      if sudo systemctl start mongodb; then started=0; fi
    fi
  fi

  if (( started != 0 )) && command -v service >/dev/null 2>&1; then
    if service mongod status >/dev/null 2>&1; then
      log "Iniciando mongod via service..."
      if sudo service mongod start; then started=0; fi
    elif service mongodb status >/dev/null 2>&1; then
      log "Iniciando mongodb via service..."
      if sudo service mongodb start; then started=0; fi
    fi
  fi

  if (( started == 0 )); then
    log "MongoDB arrancado (revisa con 'sudo systemctl status mongod')."
    return 0
  fi

  log "No se encontró servicio mongod/mongodb. Instala MongoDB o exporta MONGO_URL a una instancia remota."
  return 1
}

server_running() {
  if [[ -f "$SERVER_PID_FILE" ]]; then
    local pid
    pid=$(cat "$SERVER_PID_FILE") || true
    if [[ -n "$pid" ]] && ps -p "$pid" -o comm= >/dev/null 2>&1; then
      return 0
    fi
  fi

  pgrep -f "src/server/server.js" >/dev/null 2>&1
}

start_server() {
  mkdir -p "$LOG_DIR"
  log "Iniciando servidor Node (src/server/server.js)..."
  (
    cd "$REPO_ROOT/src"
    nohup node server/server.js >"$LOG_DIR/server.log" 2>&1 &
    echo $! >"$SERVER_PID_FILE"
  )
  log "Servidor iniciado. PID $(cat "$SERVER_PID_FILE"). Logs en $LOG_DIR/server.log"
}

parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --open)
        OPEN_BROWSER=1
        ;;
    esac
  done
}

open_browser() {
  log "Abriendo $SERVER_URL ..."
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$SERVER_URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$SERVER_URL" >/dev/null 2>&1 &
  else
    log "No se encontró un comando para abrir el navegador."
  fi
}

main() {
  parse_args "$@"

  ensure_mongo || exit 1

  if server_running; then
    log "Servidor Node ya en ejecución."
  else
    start_server
  fi

  if (( OPEN_BROWSER == 1 )); then
    open_browser
  fi
}

main "$@"
