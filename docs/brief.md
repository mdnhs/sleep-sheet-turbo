# Audit Remediation — Brief

## Source
Findings from the full-repo senior engineering review conducted 2026-09-21
(read-only audit; see chat history / PR description for the full Bangla
report). This document is the English working brief for implementation;
`plan.md` in this folder breaks it into vertical, independently-shippable
phases.

## Goal
Close every BAD/WORST finding from the audit without changing product
behavior for legitimate users, and without over-engineering (no Redis,
no repository-pattern rewrite, no microservices — the audit explicitly
found the current architecture appropriate for this scale).

## Non-goals
- No UI/design changes beyond what a fix requires (e.g. POS idempotency
  key generation is invisible to the user).
- No dependency version bumps beyond removing unused packages and aligning
  `eslint-config-next` to the installed `next` version.
- No rewrite of `orders/page.tsx` into small components in this pass — it's
  flagged as P1 for maintainability but is not a correctness/security bug;
  it's called out in the plan as a follow-up, not blocking the rest.

## Findings being addressed (severity → ticket)

### P0 — Critical
1. **WORST-1**: `isIpBlocked()` is dead code — never called from checkout.
2. **WORST-2**: Drizzle migration snapshots (`db/migrations/meta/`) stop at
   `0007` while the journal has 21 entries through `0020` — next
   `db:generate`/`db:push` would attempt to redo already-applied migrations.

### P1 — High
3. **BAD-1**: Order PATCH (`features/order/server/route.ts`) does 12-15
   sequential, non-transactional writes.
4. **BAD-2**: Order DELETE / bulk-delete — 5 sequential deletes, no
   transaction, unbounded `ids` array on bulk-delete.
5. **BAD-3**: Refund/cancel read-then-write race; no DB constraint backstop.
6. **BAD-4**: Product create/update (`features/dashboard/server/route.ts`)
   have zero Zod validation on FormData fields; `error.message` leaks to
   the client.
7. **BAD-8**: `eslint .` exits 1 (9 errors) — CI's lint step is currently
   red, including one real cascading-render bug.
8. **BAD-9**: POS sale has no idempotency key (checkout does).

### P2 — Medium
9. **BAD-5**: Uploads (blog/category/product images) have no MIME/size
   validation.
10. **BAD-6**: External fetches (Steadfast, n8n, MCP self-call) have no
    timeout except `lib/bdcourier.ts`.
11. **BAD-7**: `next.config.ts` sets zero security headers.
12. **BAD-13**: `?admin=true` on the public products endpoint lets anyone
    bypass CDN caching (no auth check backs the flag).
13. **BAD-16**: `/api/settings/secrets` only requires `settings:read`, not
    ADMIN, to read raw third-party credentials.
14. **BAD-11**: `logActivity` middleware awaits its DB insert before the
    response returns, adding latency to every dashboard mutation.
15. **BAD-14**: Product update deletes Cloudinary images before the DB
    write succeeds, and does so sequentially.

### P3 — Lower priority, still addressed here
16. **BAD-12**: Product search runs `ILIKE '%...%'` over the full
    description HTML — no index can serve it.
17. **BAD-15**: Product update overwrites `stock` absolutely (lost-update
    vs. concurrent sales).
18. Over-fetching: `GET /orders/order`, `/orders/by-phone`, review routes
    pull full product rows.

### Dependency / hygiene (from §21/§23 of the audit)
19. Remove unused deps: `@dnd-kit/modifiers`, `@dnd-kit/react`,
    `@uiw/react-md-editor`, `nodemailer`, `@types/nodemailer`, `pg`,
    `@types/pg`, `uuid`, `next-remove-imports`.
20. Move `dotenv` to `devDependencies`.
21. Align `eslint-config-next` to `16.3.5`.
22. Move throwaway root scripts (`fix-orders.ts`, `scratch.ts`,
    `seed-messenger.ts`) into `scripts/`; keep `feed.xml` (it's a real
    generated/tracked data file some tooling may depend on — confirm
    before deleting).

## Post-audit addendum

Found while trimming `/orders/by-phone`'s over-fetching (item 18): the route
required staff `orders:read`, but its only caller is the public "Track your
order" page (`app/(client)/track-order/page.tsx`), which has no session —
grep confirms nothing dashboard-side ever calls it. Every real customer
using that page was getting a 401 instead of their orders. Not one of the
23 audit findings; found incidentally and fixed at the user's request.

Fix: made the route public (dropped `sessionMiddleware`/`isAllowed`), added
`rateLimit("orders-by-phone", 20, 5min)` per IP since phone number is a far
weaker secret than the order-id capability `/orders/:id` already relies on
for its own public path, and switched to an explicit `columns` allowlist
(status/totals/address/items — exactly what the page renders) instead of
the full row, so fraud/device metadata, attribution fields, and the
idempotency key never leave the server for this now-anonymous-reachable
endpoint.

## Recheck (2026-09-21, second pass)

User asked to reverify every fix against the review. Re-checked each of the
24 items above against actual current code (grep evidence, not memory) —
all confirmed present. That pass also surfaced gaps the first pass missed,
same bug classes applied inconsistently:

- **BAD-14 (Cloudinary delete-before-commit)** was only fixed in `PUT
  /update`. Same bug existed in `PATCH /:id/details` (used by the MCP
  product-editing tool — not dead code), `DELETE /:id`, `POST
  /bulk-delete`, and the categories `PATCH /:value` / `DELETE /delete/:value`
  routes. All now fixed the same way (delete after commit, deferred via
  `after()`).
- **BAD-1/2 pattern (non-atomic multi-statement writes)**, not caught in
  the original review for this file: `DELETE /product/:id` and `POST
  /product/bulk-delete` ran their six dependent-row cleanups as one
  `db.batch`, then the actual `products` delete as a **separate** trailing
  `await` — so a failure on that last statement left dependent rows gone
  but the product row orphaned. Folded into one batch each.
- **Missing validation**: `POST /product/bulk-delete` had no request schema
  at all (not even the array-cap issue BAD-2 flagged elsewhere — no
  validation whatsoever). Added `zValidator` + the same `.max(200)` cap.

All confirmed with `tsc --noEmit`, `eslint .` (0 errors throughout),
`vitest run` (184/184), and `next build` after each round.

## Explicitly deferred (documented, not fixed in this pass)
- **WORST-3** (`orders/page.tsx` 4,102 lines): tracked as its own
  follow-up; too large/risky to fold into a correctness-fix branch.
- Cart→React Query migration (BAD-10), xlsx/Tiptap dynamic import,
  Sentry/error-tracking integration, checkout integration test suite,
  OAuth code-exchange race, JWT revocation — all POTENTIAL RISK / P2-P3
  items that don't corrupt data or bypass auth today. Listed in plan.md
  Phase 5 as future work, not executed here unless time remains.
