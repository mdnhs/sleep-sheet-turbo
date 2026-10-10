#!/usr/bin/env bash
# Stop (or resume) every write to a database without touching app code, for
# the cutover window:
#
#   SOURCE_DATABASE_URL=<neon url> scripts/neon-to-postgres/freeze-neon.sh on
#   SOURCE_DATABASE_URL=<neon url> scripts/neon-to-postgres/freeze-neon.sh status
#   SOURCE_DATABASE_URL=<neon url> scripts/neon-to-postgres/freeze-neon.sh off
#
# `on` makes new sessions read-only (ALTER DATABASE ... SET
# default_transaction_read_only) and terminates existing ones, because a
# setting only applies to sessions opened after it — pooled connections
# would otherwise stay writable. Reads keep working, so the storefront stays
# browsable; any write (checkout, bKash callback, dashboard edits, tracking)
# fails instead of landing in a database that is about to be retired.
#
# Freezing at the database is deliberate: it covers every write path (178+
# routes, GET callbacks included) where an app-level switch would have to
# find them all, and it takes effect without a redeploy.
set -euo pipefail

: "${SOURCE_DATABASE_URL:?set SOURCE_DATABASE_URL}"
url="$SOURCE_DATABASE_URL"

terminate_others() {
  psql "$url" -Atq -v ON_ERROR_STOP=1 -c "
    SELECT count(pg_terminate_backend(pid))
    FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()" >/dev/null
}

status() {
  # A fresh session reports what the next app query will see.
  local ro
  ro=$(psql "$url" -Atc "SHOW default_transaction_read_only")
  if [[ "$ro" == "on" ]]; then echo "frozen (read-only)"; else echo "writable"; fi
}

case "${1:-}" in
  on)
    psql "$url" -q -v ON_ERROR_STOP=1 -c \
      "ALTER DATABASE \"$(psql "$url" -Atc 'SELECT current_database()')\" SET default_transaction_read_only = on"
    terminate_others
    echo "→ $(status)"
    ;;
  off)
    # The connecting session is read-only too once frozen; lift it for this
    # one statement so the reset itself can run.
    psql "$url" -q -v ON_ERROR_STOP=1 -c "SET default_transaction_read_only = off" -c \
      "ALTER DATABASE \"$(psql "$url" -Atc 'SELECT current_database()')\" RESET default_transaction_read_only"
    terminate_others
    echo "→ $(status)"
    ;;
  status)
    status
    ;;
  *)
    echo "usage: $0 on|off|status" >&2
    exit 1
    ;;
esac
