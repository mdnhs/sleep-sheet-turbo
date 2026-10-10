# Production on the VPS (replacing Vercel + Neon)

Everything runs on one Mumbai VPS, next to the existing n8n:

```
Cloudflare (proxied DNS, CDN, DDoS)
   └─▶ VPS reverse proxy (shared with n8n.sleepsheetbd.com)
          └─▶ app        127.0.0.1:3000   Next.js standalone (Dockerfile)
                 └─▶ postgres  compose network only (+127.0.0.1:5432 for admin)
              backup   nightly pg_dump → deploy/backups
              cron     daily audience sync (was Vercel Cron)
```

The database never listens on a public interface, so there is no pooler,
no database TLS and no firewall hole for it. Files: [docker-compose.yml](docker-compose.yml),
[deploy.sh](deploy.sh), [.env.example](.env.example), [../Dockerfile](../Dockerfile),
[../.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

## 1. VPS prerequisites

- Docker Engine + compose plugin.
- Firewall: only 22, 80, 443 open (the reverse proxy already uses 80/443 for n8n).
- A deploy SSH key: generate one for GitHub Actions
  (`ssh-keygen -t ed25519 -f deploy_key -N ''`), append `deploy_key.pub` to the
  deploy user's `~/.ssh/authorized_keys`. The deploy user must be able to run
  `docker`.
- The repo cloned at e.g. `/opt/sleepsheet` (read access via a GitHub deploy key).

## 2. Configure

```bash
cd /opt/sleepsheet/deploy
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')/" .env
sed -i "s/^CRON_SECRET=.*/CRON_SECRET=$(openssl rand -hex 32)/" .env
```

Then append the app's Production variables from Vercel (`vercel env pull
.env.vercel --environment=production` on your machine), **except**
`DATABASE_URL` (compose builds it) and `VERCEL_*`. Check
`NEXT_PUBLIC_APP_URL=https://sleepsheetbd.com`. If ports 3000/5432 are
taken on the VPS, change `APP_HOST_PORT` / `POSTGRES_HOST_PORT`.

## 3. Rehearsal (the live site is untouched)

Copy Neon into the VPS database through an SSH tunnel. Always restore
straight into Postgres (the tunnel), as `migrate.sh` expects:

```bash
# on the VPS
cd /opt/sleepsheet/deploy && docker compose up -d --wait postgres

# on your machine, repo root, with .env loaded (set -a && source .env && set +a)
ssh -N -L 5434:127.0.0.1:5432 <user>@<vps-ip> &
SOURCE_DATABASE_URL="$NEON_DATABASE_URL" \
TARGET_DATABASE_URL='postgresql://sleepsheet:<password>@localhost:5434/sleepsheet' \
  scripts/neon-to-postgres/migrate.sh                 # must end ✓ verified
DATABASE_URL='postgresql://sleepsheet:<password>@localhost:5434/sleepsheet' \
  npx tsx scripts/neon-to-postgres/smoke-test.ts      # writes roll back
```

`NEON_DATABASE_URL` keeps `sslmode=require`: libpq tools (pg_dump/psql)
need a root-certificate file for `verify-full`.

Then build and start the stack on the VPS: `deploy/deploy.sh`.
Point the reverse proxy for `sleepsheetbd.com` and `www.sleepsheetbd.com` at
`127.0.0.1:3000` (Caddy: `reverse_proxy 127.0.0.1:3000`; nginx: `proxy_pass`
plus `proxy_buffering off` so streamed pages arrive progressively, and pass
`Host` / `X-Forwarded-For` / `X-Forwarded-Proto`). For Cloudflare's
**Full (strict)** SSL mode, give the proxy a Cloudflare Origin CA
certificate for those two hostnames.

Test the VPS before any DNS change, e.g.
`curl -I --resolve sleepsheetbd.com:443:<vps-ip> https://sleepsheetbd.com/` or
a hosts-file entry: browse, sign in to the dashboard, open a product.

## 4. Cutover (~10 minutes, low-traffic hour)

The live site keeps writing to Neon until the switch. `freeze-neon.sh`
makes Neon read-only so nothing written during the switch can be lost: the
old Vercel site stays browsable, but checkout and other writes fail until
traffic reaches the VPS.

1. `SOURCE_DATABASE_URL="$NEON_DATABASE_URL" scripts/neon-to-postgres/freeze-neon.sh on`
   → `frozen (read-only)`.
2. Final copy: the same `migrate.sh` command as step 3 → `✓ verified`.
   Run `smoke-test.ts` again.
3. On the VPS: `deploy/deploy.sh`. The rebuild re-prerenders every page from
   the final data (the rehearsal build's pages would be stale).
4. Cloudflare → DNS: point `sleepsheetbd.com` and `www` at the VPS IP
   (A records, **proxied**), replacing the Vercel records. Proxied changes
   take effect within seconds.
5. Place a test order, check it in the dashboard (and the n8n Telegram
   alert), then cancel it.

Leave Neon frozen: anything still pointing at it fails loudly instead of
writing data nobody will see.

**Rollback:** `freeze-neon.sh off`, point DNS back at Vercel. Neon holds the
pre-cutover data; orders placed on the VPS since then must be copied back.

## 5. After cutover

- GitHub → Settings → Secrets and variables → Actions:
  secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private `deploy_key`),
  `VPS_KNOWN_HOSTS` (`ssh-keyscan <vps-ip>`), `VPS_APP_DIR` (`/opt/sleepsheet`);
  variable `VPS_DEPLOY_ENABLED=true`. From then on every push to `main`
  runs typecheck, lint and tests in the CI `verify` job, which the image
  build depends on, then deploys. (Typecheck is skipped inside the Docker
  build itself.) Each deploy restarts the app container (a few seconds of
  502 from the proxy).
- Remove the Vercel-only pieces in one commit: `@vercel/analytics` /
  `@vercel/speed-insights` (`components/vercel-analytics.tsx`),
  `attachDatabasePool` in `db/index.ts`, `vercel.json`. Then disconnect the
  repo from the Vercel project and delete it, and delete the Neon project
  after a week or two.
- Core Web Vitals: Vercel Speed Insights goes away; Cloudflare Web Analytics
  (free, RUM) can take its place.
- **Off-site backups.** `deploy/backups` sits on the same disk as the
  database. Sync it elsewhere daily (e.g. `rclone sync /opt/sleepsheet/deploy/backups r2:sleepsheet-backups`)
  and test a restore once:
  `gunzip -c backups/last/sleepsheet-latest.sql.gz | pg_restore -d <scratch db url>`.
- **Migrations** still follow `db/migrations/README.md`: apply SQL directly
  (`psql` over the SSH tunnel), then `pnpm db:generate`. Never
  `drizzle-kit migrate` — the tracking table is still empty.
- **Updates:** `docker compose pull && docker compose up -d` for minor
  versions. A Postgres major upgrade needs dump/restore, not just a new tag.

## 6. Backups (status 2026-10-11)

Production runs on Dokploy (app `sleepsheet-stage` + Postgres `sleepsheet-postgres`,
`postgres:18-alpine`). The compose `backup`/`cron` services described above are **not**
part of the Dokploy setup, and Dokploy has **no backup schedule and no backup destination**
configured yet.

- Manual backup taken before the SP-0 deploy: `pg_dump -Fc` from the owner's machine,
  kept in `~/sleep-sheet-backups/` (not in git — it contains customer data).
- **Restore drill 2026-10-11:** the dump restored cleanly into a scratch database
  (local Postgres 18); orders = 394, matching production at dump time.
- To do: add an S3-compatible destination in Dokploy (Cloudflare R2 free tier works),
  then a daily Postgres backup on `sleepsheet-postgres`, keep at least 14.

## 7. Network exposure (status 2026-10-11)

- Postgres is published on the VPS at port **5434** and is reachable from the internet
  (password-protected only). Unless something outside Dokploy needs it, remove the
  external port in Dokploy, or restrict it to known IPs.
- **Origin firewall:** the app trusts `CF-Connecting-IP` (`lib/client-ip.ts`), which is
  only unforgeable when the origin accepts web traffic from Cloudflare alone. That lock
  is **not applied**, because `n8n`, `ss`, `vps`, `pos`, `product` are DNS-only (not
  proxied) and would be cut off. Proxy those hostnames through Cloudflare first, then drop
  non-Cloudflare traffic on 80/443 in the `DOCKER-USER` iptables chain (Docker-published
  ports bypass ufw) using https://www.cloudflare.com/ips-v4 and /ips-v6.

## 8. SP-0 release migrations (2026-10-11)

Applied by hand, in this order (the numbers run opposite to the order):
1. `0033_user_token_version.sql` — before the deploy (done 2026-10-11, together with
   `UPDATE api_keys SET "rawKey" = NULL` and removing the dead `view_analytics` string
   from the Owner role).
2. Deploy `cfcd01e`.
3. `0032_api_keys_drop_raw_key.sql` — after the deploy has soaked; dropping the column
   earlier would break a rollback to the previous image.

## 9. SP-1 release (2026-10-11)

- Before the push: deleted the unread English `seo_default_title` / `seo_default_description`
  rows (so the live title stayed unchanged), applied `0035_settings_white_label.sql`
  (backfilled `gtm_server_url`, removed 4 dead keys), and added
  `N8N_PRODUCT_CACHE_WEBHOOK_URL` to the Dokploy env (the URL that used to be hardcoded).
- `seo_robots_ai_block = false` is now honoured: robots.txt no longer blocks AI crawlers.
  Turn it back on in Settings → SEO if that was not intended.
- Owner-gated, not done: `SETTINGS_ENCRYPTION_KEY` + `scripts/encrypt-settings.ts`
  (see the SP-1 plan, Deployment order step 4) and the login-cookie rename (branch `sp1-cookie`).
- The local `mcp-server` GA4 tool now needs `GA4_PROPERTY_ID` in its environment (no
  hardcoded fallback anymore).
