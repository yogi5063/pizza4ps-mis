#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Auto-deploy script for Pizza 4P's MIS
#
# Checks GitHub for new commits on the current branch. If there are any,
# it pulls them and rebuilds/restarts the Docker stack. If nothing changed,
# it does nothing. Designed to be run every couple of minutes by cron.
#
# Manual run:   ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Always operate from the folder this script lives in (the repo root)
cd "$(dirname "$0")"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Get the latest refs from GitHub without changing any files yet
git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') | Already up to date. Nothing to deploy."
    exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') | New commits found. Deploying..."

# Pull the new code and rebuild/restart the containers
git pull origin "$BRANCH"
docker compose up -d --build

# Remove old unused images to keep disk usage down
docker image prune -f >/dev/null 2>&1 || true

echo "$(date '+%Y-%m-%d %H:%M:%S') | Deploy complete."
