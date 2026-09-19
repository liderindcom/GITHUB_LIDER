#!/usr/bin/env bash
set -u
PANEL_DIR="/lider/portal-fornecedor"
LOG_DIR="$PANEL_DIR/logs"
LOCK_FILE="/tmp/portal-fornecedor.lock"
HOST="127.0.0.1"
PORT="18090"
mkdir -p "$LOG_DIR"
(
  flock -n 9 || exit 0
  cd "$PANEL_DIR" || exit 1
  trap 'kill ${node_pid:-0} 2>/dev/null || true; exit 0' TERM INT
  while true; do
    printf '[%s] iniciando runtime Node em http://%s:%s
' "$(date -Is)" "$HOST" "$PORT"
    export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    if [ -f "$PANEL_DIR/.env.postgres" ]; then
      set -a
      . "$PANEL_DIR/.env.postgres"
      set +a
    fi
    export PORTAL_RUNTIME="production"
    export PORTAL_DB_ENGINE="postgres"
    NITRO_PORT="$PORT" NITRO_HOST="$HOST" /usr/bin/node "$PANEL_DIR/.output/server/index.mjs" >> "$LOG_DIR/portal-node.log" 2>&1 &
    node_pid=$!
    wait "$node_pid"
    status=$?
    printf '[%s] runtime Node saiu com status %s; reiniciando em 5s
' "$(date -Is)" "$status"
    sleep 5
  done
) 9>"$LOCK_FILE" >>"$LOG_DIR/portal-supervisor.log" 2>&1
