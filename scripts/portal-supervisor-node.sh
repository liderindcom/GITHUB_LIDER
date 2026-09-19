#!/usr/bin/env bash
set -u
PANEL_DIR="/lider/portal-fornecedor"
LOG_DIR="$PANEL_DIR/logs"
LOCK_FILE="/tmp/portal-fornecedor.lock"
HOST="0.0.0.0"
PORTS=(8090 9955)
CERT="/etc/letsencrypt/live/intelider-servicos/fullchain.pem"
KEY="/etc/letsencrypt/live/intelider-servicos/privkey.pem"
mkdir -p "$LOG_DIR"
(
  flock -n 9 || exit 0
  cd "$PANEL_DIR" || exit 1
  trap 'kill ${pids[@]:-} 2>/dev/null || true; exit 0' TERM INT
  while true; do
    export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    if [ -f "$PANEL_DIR/.env.postgres" ]; then
      set -a
      . "$PANEL_DIR/.env.postgres"
      set +a
    fi
    export PORTAL_RUNTIME="production"
    export PORTAL_DB_ENGINE="postgres"
    declare -a pids=()
    for port in "${PORTS[@]}"; do
      NITRO_PORT="$port" NITRO_HOST="$HOST" NITRO_SSL_CERT="$CERT" NITRO_SSL_KEY="$KEY" /usr/bin/node "$PANEL_DIR/.output/server/index.mjs" >> "$LOG_DIR/portal-$port.log" 2>&1 &
      pids+=("$!")
    done
    wait -n "${pids[@]}"
    status=$?
    kill "${pids[@]}" 2>/dev/null || true
    wait 2>/dev/null || true
    printf '[%s] runtime Node saiu com status %s; reiniciando em 5s\n' "$(date -Is)" "$status" >> "$LOG_DIR/portal-supervisor.log"
    sleep 5
  done
) 9>"$LOCK_FILE" >>"$LOG_DIR/portal-supervisor.log" 2>&1
