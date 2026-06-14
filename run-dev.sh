#!/usr/bin/env bash

# Start or restart the local backend and frontend development servers.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
VENV_DIR="$SERVER_DIR/.venv"

SERVER_PORT="${SERVER_PORT:-9030}"
PORT="${PORT:-3000}"
SERVER_PID=""
CLIENT_PID=""
IS_WINDOWS=false

if command -v powershell.exe >/dev/null 2>&1; then
  IS_WINDOWS=true
fi

if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
  echo "client/node_modules not found. Run 'sh setup.sh' first." >&2
  exit 1
fi

if [[ ! -x "$VENV_DIR/bin/python" ]] && [[ ! -x "$VENV_DIR/Scripts/python.exe" ]]; then
  echo "server/.venv not found. Run 'sh setup.sh' first." >&2
  exit 1
fi

if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_CMD="$VENV_DIR/bin/python"
else
  PYTHON_CMD="$VENV_DIR/Scripts/python.exe"
fi

echo "Checking Patchright Chromium..."
"$PYTHON_CMD" -m patchright install chromium

windows_root_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$ROOT_DIR"
  else
    printf '%s' "$ROOT_DIR"
  fi
}

stop_windows_project_servers() {
  local root_windows
  root_windows="$(windows_root_path)"

  powershell.exe -NoProfile -Command \
    "\$root = [regex]::Escape('$root_windows'); \
     Get-CimInstance Win32_Process | \
       Where-Object { \
         \$_.ProcessId -ne \$PID -and \
         \$_.CommandLine -match \$root -and \
         (\$_.CommandLine -match 'uvicorn.+app\.main:app' -or \
          \$_.CommandLine -match 'next(\.cmd)?[\" ]+dev' -or \
          \$_.CommandLine -match 'next-server') \
       } | \
       ForEach-Object { \
         Write-Host ('Stopping existing process ' + \$_.ProcessId + ': ' + \$_.Name); \
         Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue \
       }" >/dev/null
}

port_owner_windows() {
  local port="$1"
  powershell.exe -NoProfile -Command \
    "\$pids = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | \
       Select-Object -ExpandProperty OwningProcess -Unique; \
     if (\$pids) { \$pids -join ',' }" 2>/dev/null | tr -d '\r' || true
}

stop_windows_port_owner() {
  local port="$1"
  local owners
  owners="$(port_owner_windows "$port")"

  if [[ -z "$owners" ]]; then
    return 0
  fi

  local pid
  IFS=',' read -ra pids <<< "$owners"
  for pid in "${pids[@]}"; do
    if [[ -n "$pid" ]] && [[ "$pid" != "0" ]]; then
      echo "Stopping existing process on port $port: $pid"
      powershell.exe -NoProfile -Command \
        "Get-CimInstance Win32_Process | \
           Where-Object { \$_.ParentProcessId -eq $pid } | \
           ForEach-Object { \
             Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue \
           }" >/dev/null 2>&1 || true
      taskkill.exe //PID "$pid" //T //F >/dev/null 2>&1 || \
        powershell.exe -NoProfile -Command \
          "Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1 || true
    fi
  done
}

port_owner_unix() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$port" 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser "$port/tcp" 2>/dev/null || true
  fi
}

port_owner() {
  if [[ "$IS_WINDOWS" == true ]]; then
    port_owner_windows "$1"
  else
    port_owner_unix "$1"
  fi
}

wait_for_free_port() {
  local port="$1"
  local attempts=20

  while [[ $attempts -gt 0 ]]; do
    if [[ -z "$(port_owner "$port")" ]]; then
      return 0
    fi
    sleep 0.25
    attempts=$((attempts - 1))
  done

  local owner
  owner="$(port_owner "$port")"
  echo "Port $port is still in use by process: ${owner:-unknown}" >&2
  return 1
}

stop_existing_servers() {
  if [[ "$IS_WINDOWS" == true ]]; then
    stop_windows_project_servers
    stop_windows_port_owner "$SERVER_PORT"
    stop_windows_port_owner "$PORT"
  else
    local owner
    for port in "$SERVER_PORT" "$PORT"; do
      owner="$(port_owner "$port")"
      if [[ -n "$owner" ]]; then
        echo "Stopping existing process on port $port: $owner"
        kill $owner >/dev/null 2>&1 || true
      fi
    done
  fi

  wait_for_free_port "$SERVER_PORT"
  wait_for_free_port "$PORT"
}

cleanup() {
  local exit_code=$?
  trap - INT TERM EXIT

  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$CLIENT_PID" ]] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi

  if [[ "$IS_WINDOWS" == true ]]; then
    stop_windows_project_servers || true
  fi

  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${SERVER_PORT}/api}"
export PORT

echo "Stopping existing project servers..."
stop_existing_servers

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

wait -n "$SERVER_PID" "$CLIENT_PID"
