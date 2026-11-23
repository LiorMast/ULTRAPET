#!/bin/bash
# deploy.sh — Updates the demo deployment on this server (compose.prod.yaml: Postgres + gunicorn Flask + nginx) to the
# newest origin/main: pulls it, builds the frontend into frontend/dist, rebuilds and restarts the containers, and checks
# that the site answers.
#
#   ./deploy.sh              pull origin/main, build, restart (stops, without pulling, if the database schema changed)
#   ./deploy.sh --reset-db   back up the database (backups/), pull, restart, then drop, recreate and reseed the database
#                            (seed, import-media, build-catalog). All data entered on the site is lost (it stays in the backup).
#   ./deploy.sh --seed       first deploy: also fill an empty database (seed, import-media, build-catalog)
#   ./deploy.sh --force      rebuild and restart even when already up to date (e.g. after a failed run)
#
# There are no migrations (CLAUDE.md, working rule 5), so a changed create-tables.sql needs --reset-db. Needs .env,
# Docker Compose, Node/npm, a clean working tree on branch main. Everything runs inside main(), which bash reads whole
# before running it, so a pull that changes this file does not break the run in progress.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f compose.prod.yaml)
SCHEMA_FILES=(backend/app/database/create-tables.sql backend/app/database/drop-tables.sql)
STEP="starting"

# Prints a step heading and remembers it for the error message.
# Args: $1 - the step's description.
# Returns: nothing.
step() {
  STEP="$1"
  echo
  echo "==> $1"
}

# Prints a message to stderr and exits with status 1.
# Args: $@ - the message.
# Returns: never.
die() {
  echo "ERROR: $*" >&2
  exit 1
}

# Runs a flask CLI command in the backend container.
# Args: $@ - the flask command and its arguments.
# Returns: the command's exit status.
flask_cmd() {
  "${COMPOSE[@]}" exec -T backend flask "$@"
}

# Fills the database and the file storage: seed (the data from the stubs and .env), import-media (the old site's
# files, skipping those already stored), build-catalog (the PDF catalog, when this version has that command).
# Args: $1 - "strict" = a failed seed is fatal; "lenient" = a refused seed (database not empty) is only a warning.
# Returns: nothing; exits on a fatal failure.
fill_database() {
  if ! flask_cmd seed; then
    [ "$1" = strict ] && die "flask seed failed.${BACKUP:+ The previous data is in $BACKUP.}"
    echo "flask seed refused (the database probably has data already); continuing."
  fi
  flask_cmd import-media || die "flask import-media failed; rerun: ${COMPOSE[*]} exec backend flask import-media"
  if flask_cmd --help | grep -q 'build-catalog'; then
    flask_cmd build-catalog || echo "WARNING: flask build-catalog failed; the site runs, but the PDF catalog may be stale." >&2
  fi
}

# Waits until a URL answers with a success status.
# Args: $1 - the URL.
# Returns: 0 when it answered within about 30 seconds, otherwise 1.
wait_for() {
  for _ in $(seq 1 15); do
    curl -fsS -o /dev/null "$1" && return 0
    sleep 2
  done
  return 1
}

# The whole deployment (see the header for the options).
# Args: $@ - the command-line options.
# Returns: nothing; exits non-zero on any failure.
main() {
  local reset_db=0 seed=0 force=0 arg
  for arg in "$@"; do
    case "$arg" in
      --reset-db) reset_db=1 ;;
      --seed) seed=1 ;;
      --force) force=1 ;;
      -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
      *) die "unknown option $arg (see ./deploy.sh --help)" ;;
    esac
  done
  trap 'echo "ERROR: the step \"$STEP\" failed." >&2' ERR

  step "Preflight"
  [ -f .env ] || die "missing .env: run 'cp .env.example .env' and set POSTGRES_PASSWORD and SECRET_KEY."
  [ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "not on branch main."
  git diff --quiet && git diff --cached --quiet || die "the working tree has uncommitted changes (git status)."

  step "Fetching origin/main"
  git fetch origin main
  local old new changed
  old=$(git rev-parse HEAD)
  new=$(git rev-parse origin/main)
  if [ "$old" = "$new" ] && [ $((reset_db + seed + force)) -eq 0 ]; then
    echo "Already up to date ($(git rev-parse --short HEAD))."
    exit 0
  fi
  changed=$(git diff --name-only "$old" "$new")
  echo "$(git rev-list --count "$old..$new") new commit(s)."

  if [ $reset_db -eq 0 ] && grep -qxF -e "${SCHEMA_FILES[0]}" -e "${SCHEMA_FILES[1]}" <<<"$changed"; then
    git log --oneline "$old..$new"
    die "these commits change the database schema (${SCHEMA_FILES[0]}). There are no migrations, so the database
must be recreated: rerun with --reset-db (backs up the database, then resets and reseeds it; data entered on the
site is lost). Nothing was changed."
  fi

  if grep -qxF .env.example <<<"$changed"; then
    local missing
    missing=$(comm -23 \
      <(git show "$new:.env.example" | sed -n 's/^\([A-Z_][A-Z0-9_]*\)=.*/\1/p' | sort -u) \
      <(sed -n 's/^\([A-Z_][A-Z0-9_]*\)=.*/\1/p' .env | sort -u))
    [ -n "$missing" ] && echo "Note: .env.example has variables that .env does not set (defaults apply): $(echo $missing)"
  fi

  BACKUP=""
  if [ $reset_db -eq 1 ]; then
    step "Backing up the database"
    mkdir -p backups
    BACKUP="backups/content-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
    if ! "${COMPOSE[@]}" exec -T postgres pg_dump -U content content | gzip >"$BACKUP"; then
      rm -f "$BACKUP"
      die "pg_dump failed (is the postgres container running?). Nothing was reset."
    fi
    echo "Saved $BACKUP ($(du -h "$BACKUP" | cut -f1))."
  fi

  step "Pulling origin/main"
  git merge --ff-only origin/main || die "cannot fast-forward main to origin/main (local commits?)."

  step "Building the frontend"
  if [ ! -d frontend/node_modules ] || grep -qxF frontend/package-lock.json <<<"$changed"; then
    (cd frontend && npm ci)
  fi
  (cd frontend && npm run build) || die "the frontend build failed; frontend/dist may be incomplete. Fix it and run
./deploy.sh --force, or go back with: git checkout $old && ./deploy.sh --force"

  step "Rebuilding and restarting the containers"
  "${COMPOSE[@]}" up -d --build --wait --remove-orphans
  docker image prune -f >/dev/null

  if grep -qxF nginx.conf <<<"$changed"; then
    step "Restarting nginx (nginx.conf changed)"
    "${COMPOSE[@]}" restart nginx
  fi

  if [ $reset_db -eq 1 ]; then
    step "Resetting and reseeding the database"
    flask_cmd reset-db --yes
    fill_database strict
  elif [ $seed -eq 1 ]; then
    step "Seeding the database"
    fill_database lenient
  fi

  step "Checking the site"
  wait_for http://localhost/api/health || die "http://localhost/api/health does not answer (${COMPOSE[*]} logs backend)."
  wait_for http://localhost/ || die "http://localhost/ does not answer (${COMPOSE[*]} logs nginx)."

  echo
  echo "Deployed $(git rev-parse --short "$old") -> $(git rev-parse --short "$new")."
  [ "$old" != "$new" ] && git log --oneline "$old..$new"
  exit 0
}

main "$@"
