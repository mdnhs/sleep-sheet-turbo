# Production Postgres on a VPS (replacing Neon)

The app talks to Postgres through `drizzle-orm/node-postgres` ([db/index.ts](../../db/index.ts)).
In production that connection goes to **PgBouncer** on the VPS (port 6432, TLS),
which pools the short-lived Vercel function connections onto a few real
Postgres connections. Postgres itself only listens on the VPS's loopback.

```
Vercel functions ──TLS──▶ :6432 PgBouncer ──▶ Postgres (127.0.0.1:5432 on the VPS)
                                                 └── nightly backup ▶ ./backups
```

## 1. VPS

- Region: **Singapore**, same as the Vercel functions (`sin1`). Every query
  pays the round trip between them, so a far region slows every page.
- 2 GB RAM / 1–2 vCPU is plenty (the database is ~15 MB today).
- Ubuntu 24.04, Docker Engine + compose plugin installed.
- A DNS name for the database, e.g. `db.sleepsheetbd.com` → VPS IP
  (A record, **not** proxied through Cloudflare).

Firewall: allow only `22` (SSH), `80` (certificate renewal) and `6432` (PgBouncer).

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 6432/tcp && ufw enable
```

Vercel's outbound IPs are not fixed, so 6432 has to stay open to the internet;
TLS and a long random password are what protect it.

## 2. TLS certificate

node-postgres treats `sslmode=require` as `verify-full`, so the certificate
must be real and match the hostname.

```bash
apt install -y certbot
certbot certonly --standalone -d db.sleepsheetbd.com
mkdir -p ~/sleepsheet-db/certs
cp /etc/letsencrypt/live/db.sleepsheetbd.com/{fullchain,privkey}.pem ~/sleepsheet-db/certs/
chmod 644 ~/sleepsheet-db/certs/*.pem
```

Renewal: add a deploy hook that copies the renewed files and restarts PgBouncer:

```bash
cat > /etc/letsencrypt/renewal-hooks/deploy/pgbouncer.sh <<'EOF'
#!/bin/sh
cp /etc/letsencrypt/live/db.sleepsheetbd.com/fullchain.pem /etc/letsencrypt/live/db.sleepsheetbd.com/privkey.pem /root/sleepsheet-db/certs/
chmod 644 /root/sleepsheet-db/certs/*.pem
cd /root/sleepsheet-db && docker compose restart pgbouncer
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/pgbouncer.sh
```

## 3. Start the stack

Copy `docker-compose.yml` and `.env.example` from this directory to
`~/sleepsheet-db/` on the VPS, then:

```bash
cd ~/sleepsheet-db
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')/" .env
docker compose up -d
docker compose ps        # postgres healthy, pgbouncer + backup up
```

The `decrement_stock_or_fail` function, tables and data all arrive with the
copy in step 4; there is nothing to run by hand first.

## 4. Copy the data (rehearsal — Neon stays live)

Run from your machine. Restore **directly into Postgres** through an SSH
tunnel, never through PgBouncer: `pg_restore` sets `search_path = ''` for its
session, and in transaction pooling that setting sticks to a pooled server
connection, which then breaks app queries (`relation "..." does not exist`).
`migrate.sh` refuses port 6432 for this reason.

```bash
ssh -N -L 5434:127.0.0.1:5432 root@<vps-ip> &      # tunnel

SOURCE_DATABASE_URL='<neon url from .env>' \
TARGET_DATABASE_URL='postgresql://sleepsheet:<password>@localhost:5434/sleepsheet' \
  scripts/neon-to-postgres/migrate.sh
```

It dumps Neon (read-only), replaces the target's `public` and `drizzle`
schemas, restores, and runs `verify.sh`, which compares every table's row
count and an md5 over all of its rows plus every sequence. It must end with
`✓ verified`. The dump is kept in `scripts/neon-to-postgres/dumps/`.

Then check the app layer through PgBouncer (every write in it rolls back):

```bash
DATABASE_URL='postgresql://sleepsheet:<password>@db.sleepsheetbd.com:6432/sleepsheet?sslmode=verify-full' \
  npx tsx scripts/neon-to-postgres/smoke-test.ts
```

## 5. Cutover (~10 minutes, low-traffic hour)

The live site keeps writing to Neon (orders, carts, bKash callbacks,
activity log) until the switch, so the final copy has to happen with writes
stopped — otherwise anything written between the copy and the switch is lost.
`freeze-neon.sh` stops them at the database: Neon goes read-only, the
storefront stays browsable, and any write fails instead of landing in Neon.
(Verified on 2026-10-10 that the Neon role owns the database and may
terminate sessions, which the script needs.)

1. Freeze Neon:
   `SOURCE_DATABASE_URL='<neon url>' scripts/neon-to-postgres/freeze-neon.sh on`
   → must print `frozen (read-only)`. From here checkout fails until step 5.
2. Run `migrate.sh` again (same command as step 4). It must print `✓ verified`.
3. Run `smoke-test.ts` through PgBouncer again.
4. Vercel → Project → Settings → Environment Variables: set `DATABASE_URL`
   (Production) to
   `postgresql://sleepsheet:<password>@db.sleepsheetbd.com:6432/sleepsheet?sslmode=verify-full`,
   then redeploy.
5. When the deploy is live: open the site, place a test order, check it in
   the dashboard, then cancel it.

Leave Neon frozen afterwards: any stray old deployment or script still
pointing at it then fails loudly instead of writing data nobody will see.

**Rollback:** `freeze-neon.sh off`, set `DATABASE_URL` back to the Neon URL
and redeploy. Neon holds exactly the pre-cutover data. Keep the Neon project
for a week or two before deleting it; orders placed after the cutover exist
only on the VPS, so copy them back first if you ever roll back late.

## 6. Afterwards

- **Off-site backups.** `./backups` lives on the same disk as the database.
  Sync it somewhere else (e.g. `rclone sync ~/sleepsheet-db/backups r2:sleepsheet-backups`
  in a daily cron) and test a restore once:
  `gunzip -c backups/last/sleepsheet-latest.sql.gz | pg_restore -d <scratch db url>`.
- **Migrations** still follow `db/migrations/README.md`: apply SQL directly
  (`psql` over the SSH tunnel), then `pnpm db:generate`. Never
  `drizzle-kit migrate` — the tracking table is still empty.
- **Updates:** `docker compose pull && docker compose up -d` for minor
  versions. A Postgres major upgrade needs dump/restore, not just a new tag.
- Local development uses `docker-compose.db.yml` at the repo root (port 5433);
  fill it with `migrate.sh` the same way.
