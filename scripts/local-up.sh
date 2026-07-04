#!/usr/bin/env bash
# =============================================================================
# Eulard — Start local development environment
#
# Brings up docker-compose (postgres + app), waits for health,
# triggers DB initialization, seeds test users, and prints URLs.
#
# Usage: ./scripts/local-up.sh [--native]
#   --native    Skip docker app container; only start postgres, then run pnpm dev
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
NATIVE_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --native) NATIVE_MODE=true; shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

echo "============================================"
echo "  Eulard Local Development Environment"
echo "============================================"
echo ""

# --- Ensure .env.local exists ---
if [ ! -f "${ROOT_DIR}/.env.local" ]; then
  echo "WARNING: .env.local not found."
  echo "  Option 1: Pull real secrets:  ./scripts/pull-secrets.sh"
  echo "  Option 2: Copy the example:   cp .env.local.example .env.local"
  echo ""
  echo "  Creating minimal .env.local from example..."
  if [ -f "${ROOT_DIR}/.env.local.example" ]; then
    cp "${ROOT_DIR}/.env.local.example" "${ROOT_DIR}/.env.local"
    echo "  Copied .env.local.example → .env.local"
  else
    echo "ERROR: No .env.local.example found either. Create .env.local manually."
    exit 1
  fi
  echo ""
fi

# --- Start services ---
if [ "${NATIVE_MODE}" = true ]; then
  echo "==> Native mode: starting only postgres via docker compose..."
  docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d postgres
else
  echo "==> Starting all services via docker compose..."
  docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d --build
fi

# --- Wait for postgres ---
echo ""
echo "==> Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if PGPASSWORD=localdev pg_isready -h 127.0.0.1 -p 5433 -U eulard-app -d eulard &>/dev/null; then
    echo "    PostgreSQL ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: PostgreSQL did not become ready within 30 seconds."
    echo "       Check: docker compose logs postgres"
    exit 1
  fi
  sleep 1
done

# --- Initialize database schema (via /api/init) ---
echo ""
if [ "${NATIVE_MODE}" = true ]; then
  echo "==> Starting pnpm dev in background for DB init..."
  cd "${ROOT_DIR}"
  pnpm dev &
  APP_PID=$!
  echo "    Waiting for Next.js to start..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/api/healthz &>/dev/null; then
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "WARNING: Next.js did not respond in 30s. Continuing anyway..."
    fi
    sleep 1
  done
else
  echo "==> Waiting for app container to be healthy..."
  for i in $(seq 1 60); do
    if curl -sf http://localhost:3000/api/healthz &>/dev/null; then
      echo "    App server ready."
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "WARNING: App did not respond in 60s. Check: docker compose logs app"
    fi
    sleep 1
  done
fi

echo "==> Initializing database schema..."
INIT_RESP=$(curl -sf http://localhost:3000/api/init 2>/dev/null || echo '{"error":"failed"}')
echo "    /api/init response: ${INIT_RESP}"

# --- Seed test users ---
echo ""
echo "==> Seeding test users..."
cd "${ROOT_DIR}"
node scripts/seed-test-users.js

# --- Print summary ---
echo ""
echo "============================================"
echo "  Eulard is running!"
echo "============================================"
echo ""
echo "  App:        http://localhost:3000"
echo "  Login:      http://localhost:3000/login"
echo "  Health:     http://localhost:3000/api/healthz"
echo "  PostgreSQL: localhost:5433 (user: eulard-app, pass: localdev)"
echo ""
echo "  Test accounts (password: password123):"
echo "    admin@test.local  (admin)"
echo "    user@test.local   (user)"
echo "    viewer@test.local (user)"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f        # tail all logs"
echo "    docker compose logs -f app    # tail app logs"
echo "    docker compose down           # stop everything"
echo "    docker compose down -v        # stop + delete data"
echo ""

if [ "${NATIVE_MODE}" = true ] && [ -n "${APP_PID:-}" ]; then
  echo "  Next.js is running in the background (pid ${APP_PID})."
  echo "  Press Ctrl+C or kill ${APP_PID} to stop."
  wait "${APP_PID}" 2>/dev/null || true
fi
