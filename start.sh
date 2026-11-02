#!/bin/bash
# start.sh — Starts the local dev environment: the backend (PostgreSQL + Flask, in Docker) and the frontend dev server.
#
#   ./start.sh            start the backend containers, then the frontend (http://localhost:5173)
#   ./start.sh --seed     also fill an empty database from the frontend stubs (skipped when it already has data)
#
# Needs Docker with Compose and a .env file (copy .env.example). Ctrl+C stops the frontend; the backend containers
# keep running (stop them with `docker compose down`, which keeps the data volume).
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Missing .env: run 'cp .env.example .env' and set POSTGRES_PASSWORD and SECRET_KEY." >&2
  exit 1
fi

docker compose up -d --build --wait

if [ "$1" = "--seed" ]; then
  # `flask seed` refuses a database that already has data; that is fine here.
  docker compose exec -T backend flask seed || true
fi

echo "Backend: http://localhost:5000/api/health"
cd frontend && npm run dev
