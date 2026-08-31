#!/usr/bin/env bash
set -u

PANEL_DIR="/lider/portal-fornecedor"
LOG_DIR="$PANEL_DIR/logs"
LOCK_FILE="/tmp/portal-fornecedor.lock"
HOST="10.15.2.101"
PORT="8090"

mkdir -p "$LOG_DIR"

(
  flock -n 9 || exit 0
  cd "$PANEL_DIR" || exit 1

  while true; do
    printf '[%s] iniciando Portal do Fornecedor em http://%s:%s/\n' "$(date -Is)" "$HOST" "$PORT"
    export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    if [ -f "$PANEL_DIR/.env.postgres" ]; then
      set -a
      # shellcheck disable=SC1091
      . "$PANEL_DIR/.env.postgres"
      set +a
    fi
    /usr/bin/npx vite --host "$HOST" --port "$PORT"
    status=$?
    printf '[%s] portal saiu com status %s; reiniciando em 5s\n' "$(date -Is)" "$status"
    sleep 5
  done
) 9>"$LOCK_FILE" >>"$LOG_DIR/portal-supervisor.log" 2>&1
