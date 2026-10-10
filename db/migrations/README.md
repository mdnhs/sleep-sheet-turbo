# Migrations

Generated and applied with `drizzle-kit` (`pnpm db:generate`, `pnpm db:push`).
`meta/_journal.json` + `meta/<idx>_snapshot.json` are drizzle-kit's own
bookkeeping — don't hand-edit them except as described below.

## 2026-09-21 incident: snapshot desync (do not repeat)

Migrations `0008` through `0020` were written and applied to the database
without ever regenerating `meta/*_snapshot.json`. `drizzle-kit generate`
diffs `db/schema.ts` against the **newest snapshot file present**, so for
months it was silently diffing against `0007` — the next `db:generate` would
have tried to recreate every table/column/constraint added since (`blocked_ips`,
`api_keys`, all `oauth_*` tables, the money-column numeric conversion, etc.),
and `db:push` could have proposed dropping "unrecognized" objects that were
actually already correct.

Fixed by `scripts/rebuild-snapshot.mjs`, which uses drizzle-kit's own
`generateDrizzleJson` (schema.ts → full snapshot, no DB connection, no diff
against prior state) to rebuild `meta/0020_snapshot.json` directly from the
current schema — which already reflects every migration through `0020`.
Verified with `drizzle-kit generate`: reports "No schema changes, nothing to
migrate" against the unmodified schema, confirming the snapshot now matches
reality.

**Going forward:** every schema change MUST go through `pnpm db:generate`
(never hand-write a migration file and skip it) so the snapshot chain stays
in sync. If a migration is ever hand-written for something drizzle-kit can't
express (a raw SQL function, like `decrement_stock_or_fail` in `0014`), that's
fine — but any hand-written migration must be followed by `pnpm db:generate`
once the corresponding schema.ts change (if any) is committed, so no gap like
this one reopens.

## 2026-09-23: same gap recurred at 0023

`0023_products_slug.sql` was applied without a matching `meta/0023_snapshot.json`
(only `0000`-`0007` and `0020`-`0022` exist). The next `pnpm db:generate`
(adding `Category.seoContent`) silently diffed against `0022` again and tried
to re-add `products.slug` as if it were new. Fixed the same way: kept the
freshly generated `0024_snapshot.json` (it's a full-state snapshot built from
the current `db/schema.ts`, so it's correct regardless of which prior
snapshot it diffed against), but hand-trimmed the emitted `0024` SQL down to
just the actual new column, since `products.slug` was already live in the DB.
**Lesson:** after *every* `pnpm db:generate`, diff the emitted SQL file
against what's actually already in the database before applying/committing
it — don't assume the diff is against the right baseline just because the
command succeeded.
