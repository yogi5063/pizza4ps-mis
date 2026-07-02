#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pizza 4P's MIS — pre-deploy code backup.
#
# Run this LOCALLY before every deploy (git push). It creates two rollback
# points for the commit being deployed:
#   1. a git tag   deploy-<timestamp>-<sha>   (redeploy this to roll back)
#   2. a source zip in $BACKUP_DIR             (retrievable copy, no git needed)
#
# The zip is produced with `git archive`, so it contains only tracked source
# (no node_modules / uploads / *.db).
#
# Usage:   ./backup_build.sh [git-ref]      (ref defaults to the current branch)
#          BACKUP_DIR=/some/path ./backup_build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

REF="${1:-$(git rev-parse --abbrev-ref HEAD)}"
BACKUP_DIR="${BACKUP_DIR:-/d/pizza4ps-mis-backups}"
mkdir -p "$BACKUP_DIR"

SHA="$(git rev-parse --short "$REF")"
TS="$(date '+%Y%m%d_%H%M')"
NAME="pizza4ps_${TS}_${REF//\//-}_${SHA}"

# 1. source zip
OUT="${BACKUP_DIR}/${NAME}.zip"
git archive --format=zip -o "$OUT" "$REF"

# 2. rollback tag (+ push so it exists on GitHub too)
TAG="deploy-${TS}-${SHA}"
git tag -f "$TAG" "$REF"
git push -f origin "$TAG" >/dev/null 2>&1 || echo "  (tag push skipped/offline)"

echo "Backup complete:"
echo "  zip : $OUT"
echo "  tag : $TAG  -> $SHA"
echo ""
echo "To roll back later:  git checkout $TAG   (or redeploy that tag)"
