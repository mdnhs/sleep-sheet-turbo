#!/usr/bin/env bash
# Build and (re)start the production stack from the current main.
# Runs on the VPS from the repo checkout: `deploy/deploy.sh`.
# GitHub Actions calls it over SSH on every push to main.
set -euo pipefail

cd "$(dirname "$0")"
repo="$(cd .. && pwd)"

[[ -f .env ]] || { echo "deploy/.env missing — copy .env.example and fill it in" >&2; exit 1; }

echo "→ updating checkout"
git -C "$repo" fetch --quiet origin main
git -C "$repo" reset --quiet --hard origin/main

export DEPLOYMENT_VERSION
DEPLOYMENT_VERSION="$(git -C "$repo" rev-parse --short HEAD)"

# The image build reaches Postgres on the host loopback (network: host).
set -a; source .env; set +a
umask 077
printf 'postgresql://%s:%s@127.0.0.1:%s/%s' \
  "$POSTGRES_USER" "$POSTGRES_PASSWORD" "${POSTGRES_HOST_PORT:-5432}" "$POSTGRES_DB" \
  > .build_database_url

echo "→ starting database"
docker compose up -d --wait postgres

# Build while the current app keeps serving; only the swap below is downtime.
echo "→ building $DEPLOYMENT_VERSION"
docker compose build app

echo "→ starting app"
docker compose up -d --wait --remove-orphans

docker image prune -f >/dev/null
echo "✓ deployed $DEPLOYMENT_VERSION"
