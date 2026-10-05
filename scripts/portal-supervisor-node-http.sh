#!/usr/bin/env bash
set -u
PANEL_DIR="/lider/portal-fornecedor"
LOG_DIR="$PANEL_DIR/logs"
LOCK_FILE="/tmp/portal-fornecedor.lock"
HOST="127.0.0.1"
PORT="18090"
# Cure a classe de bug "HTML velho servindo hashes de JS removidos": após cada
# `npm run build`, o .output muda no disco, mas o processo Node em execução
# continua servindo o manifest antigo. O supervisor agora detecta a troca do
# runtime (mtime+size do .output/server/index.mjs) e reinicia o filho.
BUILD_MARKER="$PANEL_DIR/.output/server/index.mjs"
POLL_SECONDS=5
mkdir -p "$LOG_DIR"
(
  flock -n 9 || exit 0
  cd "$PANEL_DIR" || exit 1
  trap 'kill ${node_pid:-0} 2>/dev/null || true; exit 0' TERM INT
  while true; do
    if [ -f "$BUILD_MARKER" ]; then
      BUILD_SIG="$(stat -c '%Y-%s' "$BUILD_MARKER" 2>/dev/null || echo '')"
    else
      BUILD_SIG=''
    fi
    printf '[%s] iniciando runtime Node em http://%s:%s (build_sig=%s)
' "$(date -Is)" "$HOST" "$PORT" "${BUILD_SIG:-nenhum}"
    export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    if [ -f "$PANEL_DIR/.env.postgres" ]; then
      set -a
      . "$PANEL_DIR/.env.postgres"
      set +a
    fi
    # O .env.postgres é a fonte principal de produção. Enquanto a configuração
    # SMTP ainda não foi migrada para ele, reaproveita somente o arquivo local
    # já usado pelo card Líder Fomento, sem imprimir os valores no log.
    if [ -z "${SMTP_HOST:-}" ] && [ -f "$PANEL_DIR/.env" ]; then
      set -a
      . "$PANEL_DIR/.env"
      set +a
    fi
    export PORTAL_RUNTIME="production"
    export PORTAL_DB_ENGINE="postgres"
    NITRO_PORT="$PORT" NITRO_HOST="$HOST" /usr/bin/node "$PANEL_DIR/.output/server/index.mjs" >> "$LOG_DIR/portal-node.log" 2>&1 &
    node_pid=$!

    # Loop de vigilância: enquanto o filho estiver vivo, verifica se o build
    # mudou. Se mudou, reinicia o filho de forma graciosa (ninguém entra em
    # `wait` bloqueante antes de detectar o novo deploy).
    while kill -0 "$node_pid" 2>/dev/null; do
      sleep "$POLL_SECONDS"
      if [ -f "$BUILD_MARKER" ]; then
        NOW_SIG="$(stat -c '%Y-%s' "$BUILD_MARKER" 2>/dev/null || echo '')"
      else
        NOW_SIG=''
      fi
      if [ -n "$BUILD_SIG" ] && [ "$NOW_SIG" != "$BUILD_SIG" ]; then
        printf '[%s] .output mudou (%s -> %s); reinicio graceful do runtime
' "$(date -Is)" "$BUILD_SIG" "$NOW_SIG"
        kill -TERM "$node_pid" 2>/dev/null || true
        # Aguarda o encerramento graciosamente; força após ~30s.
        for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
          kill -0 "$node_pid" 2>/dev/null || break
          sleep 1
        done
        kill -0 "$node_pid" 2>/dev/null && kill -KILL "$node_pid" 2>/dev/null || true
        break
      fi
    done

    wait "$node_pid" 2>/dev/null
    status=$?
    printf '[%s] runtime Node saiu com status %s; reiniciando em 5s
' "$(date -Is)" "$status"
    sleep 5
  done
) 9>"$LOCK_FILE" >>"$LOG_DIR/portal-supervisor.log" 2>&1
