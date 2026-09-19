#!/usr/bin/env bash
set -u

PANEL_DIR="/lider/portal-fornecedor"
LOG_DIR="$PANEL_DIR/logs"
LOCK_FILE="/tmp/portal-fornecedor.lock"
HOST="0.0.0.0"
PORTS=(8090 9955)

mkdir -p "$LOG_DIR"

(
  flock -n 9 || exit 0
  cd "$PANEL_DIR" || exit 1

  while true; do
    printf '[%s] iniciando Portal do Fornecedor nas portas %s\n' "$(date -Is)" "${PORTS[*]}"
    export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    if [ -f "$PANEL_DIR/.env.postgres" ]; then
      set -a
      # shellcheck disable=SC1091
      . "$PANEL_DIR/.env.postgres"
      set +a
    fi
    export PORTAL_RUNTIME="production"
    export PORTAL_DB_ENGINE="postgres"
    declare -a pids=()
    for port in "${PORTS[@]}"; do
      /usr/bin/npx vite --host "$HOST" --port "$port" >> "$LOG_DIR/portal-${port}.log" 2>&1 &
      pids+=("$!")
    done
    wait -n "${pids[@]}"
    status=$?
    for pid in "${pids[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    printf '[%s] portal saiu com status %s; reiniciando em 5s\n' "$(date -Is)" "$status"
    sleep 5
  done
) 9>"$LOCK_FILE" >>"$LOG_DIR/portal-supervisor.log" 2>&1
