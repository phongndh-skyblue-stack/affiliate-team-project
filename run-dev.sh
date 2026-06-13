#!/usr/bin/env bash

# Chạy dự án (cần chạy setup.sh trước nếu là lần đầu)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
VENV_DIR="$SERVER_DIR/.venv"

SERVER_PID=""
CLIENT_PID=""

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
  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

is_running_job() {
  local job_pid
  for job_pid in $(jobs -r -p); do
    if [[ "$job_pid" == "$1" ]]; then
      return 0
    fi
  done
  return 1
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

while is_running_job "$SERVER_PID" && is_running_job "$CLIENT_PID"; do
  sleep 1
done

if ! is_running_job "$SERVER_PID"; then
  server_status=0
  wait "$SERVER_PID" || server_status=$?
  exit "$server_status"
fi

wait "$CLIENT_PID"
