#!/bin/bash
set -e

REMOTE_HOST="samgua@edutictac.es"
REMOTE_PORT="2222"

echo "Restarting server on $REMOTE_HOST..."

ssh -tt -p $REMOTE_PORT $REMOTE_HOST << 'EOF'
  set -e

  SERVICE_NAME=""
  if systemctl list-unit-files | grep -q '^eduhoot.service'; then
    SERVICE_NAME="eduhoot.service"
  elif systemctl list-unit-files | grep -q '^llixhoot-server.service'; then
    SERVICE_NAME="llixhoot-server.service"
  fi

  if [ -n "$SERVICE_NAME" ]; then
    echo "Using systemd service: $SERVICE_NAME"
    # Evita bloqueos por start-limit-hit cuando hubo reinicios rápidos fallidos.
    sudo -n systemctl reset-failed "$SERVICE_NAME" || true
    if ! sudo -n systemctl restart "$SERVICE_NAME"; then
      echo "✗ Cannot restart $SERVICE_NAME without sudo password"
      echo "Run manually on server: sudo systemctl restart $SERVICE_NAME"
      exit 1
    fi
    sleep 2
    sudo -n systemctl --no-pager -l status "$SERVICE_NAME" | head -20 || true
  else
    echo "No systemd service found; falling back to manual node restart"
    cd /opt/llixhoot/src
    mkdir -p /opt/llixhoot/logs
    pkill -f "node.*server/server.js" || true
    sleep 1
    nohup node server/server.js > /opt/llixhoot/logs/server.log 2>&1 &
  fi

  if curl -fsS http://127.0.0.1:3000/ > /dev/null; then
    echo "✓ HTTP OK"
  else
    echo "✗ HTTP FAIL"
    exit 1
  fi
EOF
