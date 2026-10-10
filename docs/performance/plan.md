# Performance Audit Remediation — Implementation Plan

Vertical, phase-by-phase: each phase ships complete, working code, gets
verified (`pnpm typecheck`, `pnpm lint`, `pnpm build`), and only then
does the next phase start.

---

## Phase 1 — Immediate Wins (LOW difficulty, HIGH impact)

All 7 items here are small, safe, one-file changes with no behavioral impact.

### 1. favicon.ico optimization (254KB → ~5KB)

**File**: `app/favicon.ico`
**Change**: Convert to optimized 32×32 ICO format using `sips`/`iconutil`.
**Impact**: 240KB less per new visitor.

### 2. Skip wishlist fetch on checkout page

**File**: `components/nav-bar.tsx`
**Change**: In `NavbarActions` (line 132) and `MobileBottomNav` (line 244), conditionally skip `useWishlist()` when on checkout page. Add `enabled` parameter to `useWishlist` hook.
**Impact**: 1 fewer network request on checkout.

### 3. Optimize public folder PNGs

**Files**: `public/hero-banner-1.png` (963KB), `public/hero-banner-2.png` (832KB), `public/hero-slider-1.png` (838KB), `public/dark-logo.png` (254KB), `public/logo.png` (103KB)
**Change**: Convert to WebP. Update references.
**Impact**: ~2MB less in fallback scenarios.

### 4. Eliminate double hasMounted skeleton in checkout

**Files**: `features/checkout/components/shipping-information-card.tsx` (line 140-142), `features/checkout/components/order-summery-card.tsx` (line 27-31)
**Change**: Remove `hasMounted` guard — parent `checkout-client.tsx` already handles it.
**Impact**: 1 fewer render cycle → checkout form 50-100ms faster.

### 5. Add `sizes` to order summary images

**File**: `features/checkout/components/order-summery-card.tsx` (line 45-50)
**Change**: Add `sizes="(max-width: 1024px) 40px, 56px"` to Image component.
**Impact**: 80-90% image payload reduction per cart item.

### 6. ProductCard Dialog lazy render

**File**: `components/product/product-card.tsx` (line 323-457)
**Change**: Wrap `<Dialog>` in `{isDrawerOpen && (...)}` conditional.
**Impact**: 8+ Dialog DOM trees eliminated on listing pages.

### 7. Product page parallel data fetching

**File**: `app/(client)/shop/[productId]/page.tsx` (lines 48-54)
**Change**: `Promise.all([getProductById(id), getPublicProducts()])` instead of sequential.
**Impact**: Product page TTFB improvement.

**Phase 1 exit criteria**: `pnpm typecheck` passes, `pnpm build` succeeds.

---

## Phase 2 — Language & Hydration Optimization (MEDIUM difficulty)

### 8. Centralize useLanguage to Zustand store

**Files**: [NEW] `hooks/use-language-store.ts`, [MODIFY] `hooks/use-language.ts`
**Change**: Single Zustand store for language state. All consumers unchanged.
**Impact**: 1 localStorage read instead of 10+, no hydration mismatch.

### 9. Footer as server component

**Files**: [MODIFY] `components/footer.tsx`, [NEW] `components/footer-language-switcher.tsx`
**Change**: Extract language switcher to client component, make footer server component.
**Impact**: ~14KB less hydration cost.

### 10. Isolate date-fns from shared utils

**Files**: [MODIFY] `lib/utils.ts`, [NEW] `lib/date-utils.ts`
**Change**: Move date-fns imports to separate file.
**Impact**: Tree-shaking guarantee for storefront pages.

**Phase 2 exit criteria**: `pnpm typecheck`, `pnpm build`, language switching works.

---

## Phase 3 — Below-Fold & Cart Optimization (MEDIUM difficulty)

### 11. Lazy-load below-fold sections

**File**: `app/(client)/client-layout.tsx`
**Change**: `next/dynamic` with `ssr: false` for Testimonials/Newsletter.
**Impact**: ~11KB less initial JS on non-home pages.

### 12. Cart addToCart auth optimization

**File**: `features/cart/state/use-cart-store.ts`
**Change**: Pass auth state as parameter instead of sequential API call.
**Impact**: Cart add feels instant — no auth wait.

**Phase 3 exit criteria**: `pnpm typecheck`, `pnpm build`, cart add works.

---

## Verification Strategy

1. `pnpm typecheck` — 0 errors throughout
2. `pnpm build` — successful build after each phase
3. Manual verification per phase

## Files Changed Summary

| Phase | Files Modified | Files Created |
|-------|---------------|---------------|
| **1** | 5 files + favicon + images | 0 |
| **2** | 3 files | 2 new files |
| **3** | 2 files | 0 |
| **Total** | **10 files** | **2 new files** |
