#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
VENV_DIR="$SERVER_DIR/.venv"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

resolve_system_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
  elif command -v python >/dev/null 2>&1; then
    echo "python"
  else
    echo ""
  fi
}

venv_python() {
  if [[ -x "$VENV_DIR/bin/python" ]]; then
    echo "$VENV_DIR/bin/python"
  elif [[ -x "$VENV_DIR/Scripts/python.exe" ]]; then
    echo "$VENV_DIR/Scripts/python.exe"
  else
    echo ""
  fi
}

require_command yarn

# --- Client ---
echo "==> Installing client dependencies (yarn install) ..."
yarn --cwd "$CLIENT_DIR" install
echo "==> Client dependencies installed."

# --- Server venv ---
if [[ -n "$(venv_python)" ]]; then
  echo "==> server/.venv already exists, reinstalling dependencies ..."
else
  local_sys_py="$(resolve_system_python)"
  if [[ -z "$local_sys_py" ]]; then
    echo "Python 3 not found in PATH. Install Python 3.10+ and try again." >&2
    exit 1
  fi
  echo "==> Creating virtual environment at server/.venv ..."
  "$local_sys_py" -m venv "$VENV_DIR"
fi

PY="$(venv_python)"
echo "==> Installing server dependencies (requirements.txt) ..."
"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet -r "$SERVER_DIR/requirements.txt"
echo "==> Server dependencies installed."

echo ""
echo "Setup complete. Run 'sh run-dev.sh' to start the project."
