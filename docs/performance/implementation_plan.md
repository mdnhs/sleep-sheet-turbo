# Performance Audit — Implementation Plan

> **Docs created**: `docs/performance/brief.md` + `docs/performance/plan.md`

---

## Phase 1 — Immediate Wins (7 items, ~2 hours)

| # | Fix | File(s) | Impact |
|---|---|---|---|
| 1 | favicon.ico 254KB → ~5KB | `app/favicon.ico` | 240KB/visitor |
| 2 | Skip wishlist on checkout | `components/nav-bar.tsx`, `features/wishlist/api/use-wishlist.ts` | -1 network req |
| 3 | Public PNGs → WebP | `public/*.png` | ~2MB fallback savings |
| 4 | Double hasMounted elimination | `shipping-information-card.tsx`, `order-summery-card.tsx` | 50-100ms faster checkout |
| 5 | Order summary image `sizes` | `order-summery-card.tsx` | 80-90% image reduction |
| 6 | ProductCard Dialog lazy | `product-card.tsx` | 30-40% DOM reduction |
| 7 | Product page parallel fetch | `shop/[productId]/page.tsx` | TTFB improvement |

## Phase 2 — Language & Hydration (3 items, ~4 hours)

| # | Fix | File(s) | Impact |
|---|---|---|---|
| 8 | Centralize useLanguage → Zustand | `hooks/use-language-store.ts` [NEW], `hooks/use-language.ts` | TBT -20%, CLS fix |
| 9 | Footer → server component | `components/footer.tsx`, `footer-language-switcher.tsx` [NEW] | -14KB hydration |
| 10 | Isolate date-fns from utils | `lib/utils.ts`, `lib/date-utils.ts` [NEW] | Bundle tree-shake |

## Phase 3 — Below-Fold & Cart (2 items, ~3 hours)

| # | Fix | File(s) | Impact |
|---|---|---|---|
| 11 | Lazy-load Testimonials/Newsletter | `client-layout.tsx` | -11KB initial JS |
| 12 | Cart addToCart auth skip | `use-cart-store.ts` | Instant cart add |

---

## Verification per phase
- `pnpm typecheck` — 0 errors
- `pnpm build` — success
- Manual smoke test of affected flows
