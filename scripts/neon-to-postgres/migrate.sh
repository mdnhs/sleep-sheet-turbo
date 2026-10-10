#!/usr/bin/env bash
# Copy the Neon database into a plain Postgres database, then verify that
# every table matches row-for-row.
#
#   SOURCE_DATABASE_URL=<neon url> TARGET_DATABASE_URL=<postgres url> \
#     scripts/neon-to-postgres/migrate.sh
#
# The source is only read (pg_dump), never written. The target's `public`
# and `drizzle` schemas are dropped and recreated, so the script can be
# re-run as often as needed — the final run happens during the cutover
# window while checkout is paused.
#
# Needs pg_dump / pg_restore / psql at least as new as the source server
# (Neon runs Postgres 18).
set -euo pipefail

: "${SOURCE_DATABASE_URL:?set SOURCE_DATABASE_URL (Neon)}"
: "${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL (new Postgres)}"

if [[ "$SOURCE_DATABASE_URL" == "$TARGET_DATABASE_URL" ]]; then
  echo "source and target are the same database — refusing" >&2
  exit 1
fi
if [[ "$TARGET_DATABASE_URL" == *neon.tech* ]]; then
  echo "target looks like a Neon database — refusing to overwrite it" >&2
  exit 1
fi
# pg_restore sets `search_path = ''` for its session. Through PgBouncer in
# transaction mode that setting sticks to the pooled server connection and
# later app queries fail with `relation "..." does not exist`. Restore
# straight into Postgres (SSH tunnel to the VPS's 127.0.0.1:5432) instead.
if [[ "$TARGET_DATABASE_URL" =~ :6432/ && "${ALLOW_POOLER:-}" != 1 ]]; then
  echo "target is the PgBouncer port (6432) — connect to Postgres directly" >&2
  echo "(see deploy/postgres/README.md), or set ALLOW_POOLER=1 to override" >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
dump_dir="${DUMP_DIR:-$here/dumps}"
mkdir -p "$dump_dir"
dump_file="$dump_dir/neon-$(date +%Y%m%d-%H%M%S).dump"

# Only the app's schemas. Neon-only objects (neon_auth schema,
# pg_session_jwt extension) are not used by the app and do not exist on
# vanilla Postgres. Ownership/grants are Neon roles, so they are dropped
# and the target's connecting role owns everything.
echo "→ dumping Neon (public + drizzle) to $dump_file"
pg_dump "$SOURCE_DATABASE_URL" \
  --format=custom \
  --schema=public --schema=drizzle \
  --no-owner --no-privileges \
  --file="$dump_file"

# The dump recreates both schemas itself (including `public`).
echo "→ resetting target schemas"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
SQL

# One transaction: a failed restore leaves the target without schemas
# rather than half-filled.
echo "→ restoring into target"
pg_restore --dbname="$TARGET_DATABASE_URL" \
  --no-owner --no-privileges \
  --exit-on-error \
  --single-transaction \
  "$dump_file"

echo "→ analyzing target"
psql "$TARGET_DATABASE_URL" -q -c "ANALYZE;"

"$here/verify.sh"
echo "✓ migration complete — dump kept at $dump_file"
