#!/usr/bin/env bash
# Install what's missing, then run the backend and the frontend together. Ctrl+C stops both.
#   API_PORT=8001 ./dev.sh   runs the backend on another port (default 8000)
#   PYTHON=python3.13 ./dev.sh   builds .venv with another Python (default python3)
set -euo pipefail
cd "$(dirname "$0")"

API_PORT="${API_PORT:-8000}"
PYTHON="${PYTHON:-python3}"

if [ ! -x .venv/bin/python ]; then
  if ! "$PYTHON" -c 'import sys; sys.exit(sys.version_info < (3, 11))' 2>/dev/null; then
    echo "Needs Python 3.11 or newer as $PYTHON. Set PYTHON to another interpreter, or use Docker." >&2
    exit 1
  fi
  "$PYTHON" -m venv .venv
fi
if ! command -v npm >/dev/null; then
  echo "Needs Node 20.19 or newer (npm not found), or use Docker." >&2
  exit 1
fi

# Reinstall only when the requirements or the lock file changed since the last install.
if [ backend/requirements.txt -nt .venv/.backend-installed ]; then
  echo "Installing the backend packages..."
  .venv/bin/pip install --quiet -r backend/requirements.txt
  touch .venv/.backend-installed
fi
if [ frontend/package-lock.json -nt frontend/node_modules/.package-lock.json ]; then
  (cd frontend && npm ci)
fi

(cd backend && exec ../.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port "$API_PORT") &
backend=$!
trap 'kill "$backend" 2>/dev/null' EXIT

# Wait until the backend answers, so the frontend never proxies to whatever else holds the port.
until curl -fs -o /dev/null "http://127.0.0.1:$API_PORT/api/runs"; do
  if ! kill -0 "$backend" 2>/dev/null; then
    echo "The backend didn't start. If port $API_PORT is in use, try API_PORT=8001 ./dev.sh" >&2
    exit 1
  fi
  sleep 0.5
done

cd frontend
API_PORT="$API_PORT" npm run dev
