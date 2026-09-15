#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
npm --prefix "$ROOT_DIR/server" run build
npm --prefix "$ROOT_DIR/server" run start:prod &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
npm --prefix "$ROOT_DIR/client" run start -- --host "${ATTU_CLIENT_HOST:-127.0.0.1}" --port "${ATTU_CLIENT_PORT:-3001}"
