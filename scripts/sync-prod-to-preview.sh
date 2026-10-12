#!/usr/bin/env bash
# Refresh the preview database with production data (data only — preview keeps
# its own schema, which may be ahead of prod).
#
#   scripts/sync-prod-to-preview.sh            # backup preview, then sync
#   scripts/sync-prod-to-preview.sh --dry-run  # show what would happen
#
# Reads PROD_DATABASE_URL and PREVIEW_DATABASE_URL from the environment or
# .env. Prod is only read (pg_dump). Preview is backed up to
# .db-backups/preview-<timestamp>.dump, then every table that exists in both
# databases (minus SYNC_EXCLUDE) is TRUNCATEd with CASCADE and reloaded inside
# a single transaction — any error rolls the whole thing back.
#
# CASCADE also empties preview-only tables that reference synced rows
# (product_variants, stock_movements, payment_logs, ...): their old ids would
# be dangling after the reload anyway.
#
# SYNC_EXCLUDE (space-separated) keeps preview's own rows. The default keeps
# preview's settings (payment gateway, webhooks, pixel) and credentials so the
# preview app never runs with prod secrets.
# Restore a backup: pg_restore --clean --if-exists --no-owner -d "$PREVIEW_DATABASE_URL" <file>
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${PROD_DATABASE_URL:?set PROD_DATABASE_URL}"
: "${PREVIEW_DATABASE_URL:?set PREVIEW_DATABASE_URL}"
SYNC_EXCLUDE="${SYNC_EXCLUDE:-site_settings api_keys oauth_clients oauth_access_tokens oauth_refresh_tokens oauth_authorization_codes}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ "$PROD_DATABASE_URL" == "$PREVIEW_DATABASE_URL" ]]; then
  echo "PROD_DATABASE_URL and PREVIEW_DATABASE_URL are the same — refusing." >&2
  exit 1
fi
if [[ "$PREVIEW_DATABASE_URL" != *":5435/"* ]]; then
  echo "PREVIEW_DATABASE_URL is not on port 5435 (Dokploy preview) — refusing." >&2
  exit 1
fi

TABLES_SQL="SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1"
prod_tables=$(psql "$PROD_DATABASE_URL" -Atc "$TABLES_SQL")
preview_tables=$(psql "$PREVIEW_DATABASE_URL" -Atc "$TABLES_SQL")

tables=()
skipped=()
for t in $prod_tables; do
  if ! grep -qxF "$t" <<<"$preview_tables"; then
    skipped+=("$t (missing in preview)")
  elif [[ " $SYNC_EXCLUDE " == *" $t "* ]]; then
    skipped+=("$t (excluded)")
  else
    tables+=("$t")
  fi
done

# Columns prod has that preview lacks would make COPY fail — check up front.
COLS_SQL="SELECT table_name || '.' || column_name FROM information_schema.columns
  WHERE table_schema = 'public' ORDER BY 1"
missing_cols=$(comm -23 \
  <(psql "$PROD_DATABASE_URL" -Atc "$COLS_SQL" | sort) \
  <(psql "$PREVIEW_DATABASE_URL" -Atc "$COLS_SQL" | sort) |
  while read -r c; do
    for t in "${tables[@]}"; do [[ "${c%%.*}" == "$t" ]] && echo "$c"; done
  done)
if [[ -n "$missing_cols" ]]; then
  echo "Preview schema is missing prod columns — migrate preview first:" >&2
  echo "$missing_cols" >&2
  exit 1
fi

echo "Sync ${#tables[@]} tables: ${tables[*]}"
for s in "${skipped[@]}"; do echo "  skip: $s"; done
if [[ $DRY_RUN == 1 ]]; then
  echo "Dry run — nothing changed."
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir -p .db-backups
backup=".db-backups/preview-$(date +%Y%m%d-%H%M%S).dump"
echo "Backing up preview → $backup"
pg_dump -Fc --no-owner --no-privileges -d "$PREVIEW_DATABASE_URL" -f "$backup"

echo "Dumping prod data…"
dump_args=()
for t in "${tables[@]}"; do dump_args+=(-t "public.\"$t\""); done
pg_dump --data-only --no-owner --no-privileges "${dump_args[@]}" \
  -d "$PROD_DATABASE_URL" -f "$work/data.sql"

truncate_list=$(printf 'public."%s", ' "${tables[@]}")
truncate_list=${truncate_list%, }

echo "Loading into preview…"
{
  echo "SET session_replication_role = replica;"
  echo "TRUNCATE $truncate_list CASCADE;"
  cat "$work/data.sql"
  echo "SET session_replication_role = DEFAULT;"
} | psql "$PREVIEW_DATABASE_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f -

echo "Row counts (prod → preview):"
for t in "${tables[@]}"; do
  p=$(psql "$PROD_DATABASE_URL" -Atc "SELECT count(*) FROM public.\"$t\"")
  v=$(psql "$PREVIEW_DATABASE_URL" -Atc "SELECT count(*) FROM public.\"$t\"")
  flag=""; [[ "$p" != "$v" ]] && flag="  ← MISMATCH"
  printf '  %-28s %8s → %-8s%s\n' "$t" "$p" "$v" "$flag"
done
echo "Done. Preview backup: $backup"
