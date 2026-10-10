# Audit Remediation — Implementation Plan

Vertical, phase-by-phase per project convention: each phase ships complete,
working code, gets reviewed against requirements, tested (`pnpm test`,
`pnpm typecheck`, `pnpm lint`), and only then does the next phase start.
One feature branch (`fix/audit-remediation-phase1-4`), one commit, amended
as each phase lands (per the global amend-workflow rule).

---

## Phase 1 — Critical data-integrity & security (P0/P1)

Everything here either silently corrupts money/inventory data or disables a
control that's advertised as active. Ships together because they touch the
same two files (`features/order/server/route.ts`,
`features/dashboard/server/route.ts`) and because partial deployment of
"some" transactional fixes but not others leaves the same class of bug live.

1. **IP-block enforcement** (WORST-1)
   - Call `isIpBlocked()` in `features/checkout/server/route.ts` before any
     DB write, for both the logged-in and guest branches.
   - Return 403 with a generic message (don't reveal *why* to the caller).
2. **Migration snapshot resync** (WORST-2)
   - Rebuild `db/migrations/meta/*.json` snapshots through `0020` by
     applying all SQL migrations to a scratch Postgres and re-baselining,
     OR (lighter-weight, chosen here) verify the actual DB state matches
     `schema.ts` and regenerate a fresh baseline snapshot at `0020` so
     `drizzle-kit generate` diffs against current reality going forward.
   - Document the incident in a migration README note so it isn't repeated.
3. **Order PATCH atomicity** (BAD-1)
   - Collect every `orderItems` insert/update/delete and the `products`
     stock-delta updates into arrays, then issue one `db.batch([...])`.
   - Keep the existing per-item diffing logic (kept vs. new vs. removed);
     only the execution strategy changes (deferred + batched vs. immediate
     sequential awaits).
4. **Order DELETE / bulk-delete atomicity + cap** (BAD-2)
   - Wrap the 4-5 deletes in `db.batch([...])`.
   - Add `.min(1).max(200)` to the bulk-delete `ids` schema.
5. **Refund/cancel race fix** (BAD-3)
   - Refund: conditional `UPDATE ... WHERE id = $id AND refundedAmount + $x
     <= totalAmount RETURNING *`; no row back → 400 "already fully
     refunded" or amount-exceeded, same as today's message.
   - Cancel: conditional `UPDATE ... WHERE id = $id AND status <>
     'CANCELLED' RETURNING *`; no row back → 400 "already cancelled".
   - New migration adding `CHECK (refunded_amount <= total_amount)` on
     `orders`.
6. **Product create/update validation** (BAD-4)
   - Convert both FormData handlers to `zValidator("form", schema)` with
     `z.coerce.number().min(0)` for price/stock, `.min(0).max(100)` for
     discount, and safe JSON-parsing for variants/addOns/tags/sizes/features
     (a small `z.string().transform(...).pipe(z.array(...))` helper, so a
     malformed JSON string is a 400 not a 500 with a leaked stack).
   - Replace `error instanceof Error ? error.message : ...` in the catch
     blocks with a generic message; log the real error server-side only.
7. **POS idempotency** (BAD-9)
   - Add `idempotencyKey` to the POS request schema, reuse the exact
     `orders.idempotencyKey` unique index + `isUniqueViolation` pattern
     from checkout.
   - POS client: generate a UUID per sale attempt (crypto.randomUUID(),
     matching checkout's approach), clear it only after a successful
     response.
8. **CI lint red → green** (BAD-8)
   - Fix the 9 ESLint errors (the `analytics-client.tsx` synchronous
     setState-in-effect is a real bug, not just a lint nit — trace it and
     move the state derivation out of the effect or into an event handler).
   - Leave the 194 warnings for a later hygiene pass unless trivial
     (unused imports in files already being touched get cleaned inline).

**Phase 1 exit criteria:** `pnpm typecheck`, `pnpm lint`, `pnpm test` all
green; manual trace of each changed route confirms behavior parity for the
happy path (same response shape, same status codes) plus the new guards.

---

## Phase 2 — Security hardening & cost/perf guardrails (P2)

9. **Upload validation** (BAD-5): MIME allowlist
   (`image/jpeg|png|webp|avif`) + 5MB size cap in the three upload routes
   (`features/dashboard`, `features/blog`, `features/categories`), checked
   before `arrayBuffer()`/Cloudinary call.
10. **External fetch timeouts** (BAD-6): `AbortSignal.timeout(10_000)` on
    every `fetch()` in `lib/steadfast.ts`, `lib/n8n-notify/index.ts`,
    `lib/mcp-tools.ts`. Reduce `sync-inflight` concurrency from unlimited
    (well, `Promise.allSettled` over up to 100) — keep the 100-row cap
    (already present) but this is primarily the timeout; concurrency
    chunking is Phase 3 (perf), not a correctness fix.
11. **Security headers** (BAD-7): `next.config.ts` `async headers()` with
    `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `Strict-Transport-Security`. CSP deferred (needs a report-only rollout
    the audit itself recommends staging separately — noted as follow-up,
    not blocking).
12. **`?admin=true` cache-bypass close** (BAD-13): require
    `sessionMiddleware` + `can(user, "products", "read")` for the
    uncached/admin branch of `GET /api/products`; unauthenticated requests
    always get the cached path regardless of the query param.
13. **`/settings/secrets` ADMIN-only** (BAD-16): change the guard from
    `can(user, "settings", "read")` to `user.role === "ADMIN"`.
14. **`logActivity` off the response path** (BAD-11): wrap the `record(...)`
    call in `after()` (already used in `lib/n8n-notify`), same pattern.
15. **Cloudinary delete ordering** (BAD-14): move `deleteImageFromStorage`
    calls to after the DB update succeeds, and run them with
    `Promise.allSettled` instead of a sequential `for` loop.

**Phase 2 exit criteria:** same as Phase 1, plus manual check that image
upload still works end-to-end for a valid file and is rejected cleanly for
an oversized/wrong-type one.

---

## Phase 3 — Performance (P3)

16. **Product search index** (BAD-12): new migration adding `pg_trgm`
    extension + GIN trigram index on `products.name`; drop `description`
    from the `ILIKE` search (it's HTML, rarely what a shopper searches by,
    and it's the expensive one) — keep name/category/tag search fast.
17. **Stock lost-update guard** (BAD-15): product update no longer accepts
    an absolute `stock` overwrite from the form; instead the dashboard
    already has line items for creating/editing — for this pass, the
    fix is to stop silently trusting a stale form value: read current
    stock at write time and only apply the *delta* the admin actually
    intended, OR (simpler, chosen) require the client to send the
    `expectedStock` it loaded the form with and reject with 409 if it no
    longer matches, so the admin sees a conflict instead of silently
    clobbering concurrent sales.
18. **Over-fetching trims**: add explicit `columns` to `GET /orders/order`,
    `GET /orders/by-phone`, and the review routes' product lookups, mirroring
    what the orders list endpoint already does.

**Phase 3 exit criteria:** same gates; confirm the new index is actually
used (`EXPLAIN`) if a local Postgres is available, otherwise document the
expectation.

---

## Phase 4 — Dependency & repo hygiene

19. Remove unused deps (`@dnd-kit/modifiers`, `@dnd-kit/react`,
    `@uiw/react-md-editor`, `nodemailer`, `@types/nodemailer`, `pg`,
    `@types/pg`, `uuid`, `next-remove-imports`) via `pnpm remove`.
20. Move `dotenv` to `devDependencies`.
21. Bump `eslint-config-next` to `16.3.5`.
22. Move `fix-orders.ts`, `scratch.ts`, `seed-messenger.ts` into `scripts/`
    (keep them — they're referenced as real one-off tools, just misplaced).
23. Add missing `package.json` scripts: `db:migrate`, `lint:fix`.

**Phase 4 exit criteria:** `pnpm install` succeeds with the trimmed
lockfile, `pnpm typecheck`/`lint`/`test`/`build` all still pass.

---

## Phase 5 — Explicitly deferred (not executed unless requested)

- `orders/page.tsx` decomposition (WORST-3) — large, high-risk, deserves
  its own branch/review cycle.
- Cart Zustand → React Query migration (BAD-10).
- `xlsx`/Tiptap dynamic imports (bundle-size perf).
- Sentry/error-tracking integration.
- Checkout PGlite integration test suite.
- OAuth authorization-code exchange race (`UPDATE ... WHERE usedAt IS
  NULL RETURNING *`).
- JWT revocation / token versioning.

These are listed so nothing from the audit is silently dropped, but they
are out of scope for this remediation branch per the brief's non-goals.

---

## Verification strategy per phase

1. `pnpm typecheck` — must stay at 0 errors throughout (currently is).
2. `pnpm lint` — must reach 0 errors by end of Phase 1, stay there.
3. `pnpm test` — 173 existing tests must keep passing; new tests added
   where a phase changes behavior a test can cheaply cover (idempotency,
   refund conditional update, form validation).
4. Manual read-through of every diff against the specific audit finding it
   closes, confirming the fix matches the recommended approach and doesn't
   change unrelated behavior.
5. Commit once per phase is *not* the rule here — per the global amend
   workflow, this branch carries ONE commit total, amended after each
   phase, with the numbered body growing to reflect the cumulative set of
   changes.
