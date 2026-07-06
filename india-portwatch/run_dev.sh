#!/usr/bin/env bash
# India PortWatch — dev runner.
# Backend serves the API *and* the static frontend, so one process is enough.
set -euo pipefail
cd "$(dirname "$0")"

# Point at the model outputs of the parent capstone repo by default.
export PORTWATCH_OUTPUTS_DIR="${PORTWATCH_OUTPUTS_DIR:-../outputs}"
export PORTWATCH_FRONTEND_DIR="${PORTWATCH_FRONTEND_DIR:-./frontend}"
export PORT="${PORT:-8080}"

echo ">> outputs : $PORTWATCH_OUTPUTS_DIR"
echo ">> frontend: $PORTWATCH_FRONTEND_DIR"
echo ">> http://localhost:$PORT"
cargo run -p portwatch-backend
