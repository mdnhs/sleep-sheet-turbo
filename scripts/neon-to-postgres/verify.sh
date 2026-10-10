#!/usr/bin/env bash
# Prove the target database holds exactly the source's data: for every
# table in `public` and `drizzle`, compare row count and an md5 over all
# rows (sorted, rendered as text), plus every sequence's position.
# Exits non-zero on any mismatch.
#
#   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... \
#     scripts/neon-to-postgres/verify.sh
set -euo pipefail

: "${SOURCE_DATABASE_URL:?set SOURCE_DATABASE_URL}"
: "${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL}"

# Pin text rendering so timestamps/floats print identically on both sides.
session="SET TimeZone = 'UTC'; SET DateStyle = 'ISO, YMD'; SET IntervalStyle = 'postgres'; SET extra_float_digits = 3;"

tables=$(psql "$SOURCE_DATABASE_URL" -Atc "
  SELECT format('%I.%I', table_schema, table_name)
  FROM information_schema.tables
  WHERE table_schema IN ('public', 'drizzle') AND table_type = 'BASE TABLE'
  ORDER BY 1")

fingerprint() {
  local url="$1" sql="$session"
  for t in $tables; do
    sql+=" SELECT '$t', count(*), coalesce(md5(string_agg(r::text, E'\n' ORDER BY r::text)), '-') FROM $t r;"
  done
  sql+=" SELECT format('seq %I.%I', schemaname, sequencename), coalesce(last_value, 0), '-'
         FROM pg_sequences WHERE schemaname IN ('public', 'drizzle') ORDER BY 1;"
  psql "$url" -At -F ' ' -v ON_ERROR_STOP=1 -c "$sql" | grep -v '^SET$'
}

src=$(mktemp) dst=$(mktemp)
trap 'rm -f "$src" "$dst"' EXIT
fingerprint "$SOURCE_DATABASE_URL" > "$src"
fingerprint "$TARGET_DATABASE_URL" > "$dst"

echo "→ comparing $(wc -l < "$src" | tr -d ' ') tables/sequences"
if diff -u --label source --label target "$src" "$dst"; then
  rows=$(awk '$1 !~ /^seq/ {s += $2} END {print s}' "$src")
  echo "✓ verified: every table and sequence matches ($rows rows)"
else
  echo "✗ MISMATCH between source and target (see diff above)" >&2
  exit 1
fi
