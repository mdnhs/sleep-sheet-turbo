# Performance Audit Remediation — Brief

## Source
Deep performance-only audit conducted 2026-09-21 (static code analysis).
Full report in `sleep_sheet_performance_audit.md`. This document is the
working brief for implementation; `plan.md` breaks it into vertical phases.

## Goal
Close every BAD performance finding from the audit. Maximize Lighthouse,
Core Web Vitals, reduce TBT/CLS, and make checkout as close to instant
as realistically possible — without changing product behavior.

## Non-goals
- No UI/design changes
- No dependency version bumps
- No security/correctness work (covered by `docs/audit-2026-09-21/brief.md` separately)
- No API route splitting in this pass (too invasive, separate branch)

## Findings being addressed (sorted by impact)

### Phase 1 — Immediate wins (LOW difficulty, HIGH impact)
1. **BAD-6**: `favicon.ico` 254KB → optimize to ~5KB
2. **BAD-3**: Checkout unnecessary wishlist fetch on checkout page
3. **BAD-7**: Public folder unoptimized PNGs (hero-banner ~850KB each)
4. **Audit §22**: Double `hasMounted` skeleton cycle in checkout
5. **Audit §16**: Order summary images missing `sizes` prop
6. **Audit §13**: ProductCard Dialog always mounted (8+ DOM trees)
7. **Audit §25**: Product page sequential data fetching

### Phase 2 — Medium impact, medium effort
8. **BAD-2**: `useLanguage()` decentralized — centralize to Zustand store
9. **BAD-4**: `client-layout.tsx` — Footer as client component (make server)
10. **Audit §11**: `date-fns` top-level import in shared utils.ts

### Phase 3 — Advanced optimization
11. **BAD-4 cont.**: Lazy-load below-fold sections (Testimonials, Newsletter)
12. **Audit §19**: Cart `addToCart` unnecessary sequential auth check

## Explicitly deferred
- API route splitting (BAD-1) — separate branch, high risk
- Cookie-based language detection — requires middleware changes
- Navbar partial server rendering — complex refactor
