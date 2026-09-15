#!/usr/bin/env bash

# Chạy dự án (cần chạy setup.sh trước nếu là lần đầu)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
VENV_DIR="$SERVER_DIR/.venv"

SERVER_PORT="${SERVER_PORT:-4050}"
PORT="${PORT:-4000}"
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
  trap - INT TERM EXIT
  trap '' INT TERM

  if [[ -n "$SERVER_PID" ]]; then
    terminate_tree "$SERVER_PID" TERM
    kill -TERM "-$SERVER_PID" >/dev/null 2>&1 || true
    kill -TERM "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$CLIENT_PID" ]]; then
    terminate_tree "$CLIENT_PID" TERM
    kill -TERM "-$CLIENT_PID" >/dev/null 2>&1 || true
    kill -TERM "$CLIENT_PID" >/dev/null 2>&1 || true
  fi

  for _ in 1 2 3 4 5; do
    if ! is_running_job "$SERVER_PID" && ! is_running_job "$CLIENT_PID"; then
      break
    fi
    sleep 0.2
  done

  if [[ -n "$SERVER_PID" ]]; then
    terminate_tree "$SERVER_PID" KILL
    kill -KILL "-$SERVER_PID" >/dev/null 2>&1 || true
    kill -KILL "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$CLIENT_PID" ]]; then
    terminate_tree "$CLIENT_PID" KILL
    kill -KILL "-$CLIENT_PID" >/dev/null 2>&1 || true
    kill -KILL "$CLIENT_PID" >/dev/null 2>&1 || true
  fi

  wait "$SERVER_PID" "$CLIENT_PID" >/dev/null 2>&1 || true
  exit "$exit_code"
}

terminate_tree() {
  local parent_pid="$1"
  local signal_name="$2"
  local child_pid

  if [[ -z "$parent_pid" ]]; then
    return 0
  fi

  for child_pid in $(pgrep -P "$parent_pid" 2>/dev/null || true); do
    terminate_tree "$child_pid" "$signal_name"
  done

  kill "-$signal_name" "$parent_pid" >/dev/null 2>&1 || true
}

port_in_use() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

print_port_owner() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
}

ensure_port_free() {
  local port="$1"
  local label="$2"

  if port_in_use "$port"; then
    echo "$label port $port is already in use:" >&2
    print_port_owner "$port"
    echo "" >&2
    echo "Stop it, then run this script again:" >&2
    echo "  kill \$(lsof -tiTCP:$port -sTCP:LISTEN)" >&2
    return 1
  fi
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

port_error=0
ensure_port_free "$SERVER_PORT" "Backend" || port_error=1
ensure_port_free "$PORT" "Frontend" || port_error=1
if [[ "$port_error" -ne 0 ]]; then
  exit 1
fi

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${SERVER_PORT}/api}"
export PORT

trap cleanup INT TERM EXIT

echo "Starting backend  -> http://localhost:${SERVER_PORT}"
(
  cd "$SERVER_DIR"
  "$PYTHON_CMD" -m uvicorn app.main:app --reload --port "$SERVER_PORT"
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
