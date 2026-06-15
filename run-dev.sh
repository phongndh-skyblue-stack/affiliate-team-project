#!/usr/bin/env bash

# Chạy dự án (cần chạy setup.sh trước nếu là lần đầu)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
VENV_DIR="$SERVER_DIR/.venv"

SERVER_PID=""
CLIENT_PID=""
WORKER_PID=""

# Kiểm tra môi trường đã được setup chưa
if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
  echo "client/node_modules not found. Run 'sh setup.sh' first." >&2
  exit 1
fi

if [[ ! -x "$VENV_DIR/bin/python" ]] && [[ ! -x "$VENV_DIR/Scripts/python.exe" ]]; then
  echo "server/.venv not found. Run 'sh setup.sh' first." >&2
  exit 1
fi

PYTHON_CMD=""
if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_CMD="$VENV_DIR/bin/python"
else
  PYTHON_CMD="$VENV_DIR/Scripts/python.exe"
fi

cleanup() {
  local exit_code=$?
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$CLIENT_PID" ]] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:9030/api}"
export PORT="${PORT:-3000}"

trap cleanup INT TERM EXIT

echo "Starting backend  -> http://localhost:9030"
(
  cd "$SERVER_DIR"
  "$PYTHON_CMD" -m uvicorn app.main:app --reload --port 9030
) &
SERVER_PID=$!

echo "Starting frontend -> http://localhost:${PORT}"
(
  cd "$CLIENT_DIR"
  export PATH="$CLIENT_DIR/node_modules/.bin:$PATH"
  yarn dev
) &
CLIENT_PID=$!

REDIS_URL="${ARQ_REDIS_URL:-redis://127.0.0.1:6379/0}"

redis_alive() {
  "$PYTHON_CMD" -c "import redis,sys; sys.exit(0) if redis.from_url('$REDIS_URL').ping() else sys.exit(1)" >/dev/null 2>&1
}

# Tự bật Redis nếu chưa chạy (ưu tiên brew services, fallback redis-server nền).
ensure_redis() {
  if redis_alive; then
    return 0
  fi
  echo "Redis chưa chạy — đang thử tự khởi động..."
  if command -v brew >/dev/null 2>&1 && brew list redis >/dev/null 2>&1; then
    brew services start redis >/dev/null 2>&1 || true
  elif command -v redis-server >/dev/null 2>&1; then
    redis-server --daemonize yes >/dev/null 2>&1 || true
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if redis_alive; then
      echo "Redis đã sẵn sàng."
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# ARQ worker: chạy schedule quét quảng cáo + cron theo dõi chính sách Google Ads (hàng giờ).
if ensure_redis; then
  echo "Starting ARQ worker (schedules + policy watch cron)"
  (
    cd "$SERVER_DIR"
    "$PYTHON_CMD" -m arq app.api.search_ads.tasks.WorkerSettings
  ) &
  WORKER_PID=$!
else
  echo "WARNING: Không bật được Redis — bỏ qua ARQ worker (cron chính sách sẽ không chạy)." >&2
  echo "         Hãy cài/khởi động Redis thủ công rồi chạy lại." >&2
fi

wait "$SERVER_PID" "$CLIENT_PID"