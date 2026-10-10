# Sleep Sheet — Deep Performance Audit Report

> **এটি সম্পূর্ণ static code analysis-এর ভিত্তিতে তৈরি একটি performance assessment। Actual Lighthouse scores বা measured milliseconds এখানে নেই — শুধুমাত্র code-path tracing থেকে প্রাপ্ত findings।**

---

## ১. Executive Summary

Sleep Sheet একটি পরিপক্ব e-commerce application যেটি Next.js 16 (App Router), Hono API layer, Drizzle ORM (Neon PostgreSQL), Zustand state management, React Query caching, Cloudinary CDN, এবং Google Tag Manager ব্যবহার করছে। Bangladesh-এর customers-দের জন্য Vercel Singapore → Neon Singapore architecture-এ deploy করা হয়েছে।

### সামগ্রিক Performance অবস্থা

| দিক | মূল্যায়ন |
|---|---|
| **Server-side data architecture** | ✅ GOOD — `unstable_cache` + tag-based invalidation + in-process route calling |
| **LCP optimization** | ✅ GOOD — Hero image `priority` + settings seed in server HTML |
| **Font loading** | ✅ GOOD — non-critical fonts `preload: false`, `display: swap` |
| **Client-side hydration boundary** | ⚠️ ACCEPTABLE — Root layout providers force full-tree hydration |
| **Bundle composition** | 🔴 BAD — Heavy admin-only deps (xlsx, @react-pdf/renderer, recharts, tiptap, googleapis) in monolithic API route |
| **Checkout critical path** | ⚠️ ACCEPTABLE — Clean flow কিন্তু 3টি parallel API call (settings, current user, wishlist) checkout-এ অপ্রয়োজনীয় |
| **Image optimization** | ✅ GOOD — Custom Cloudinary loader, responsive `sizes`, `quality=65` |
| **Third-party scripts** | ✅ GOOD — GTM deferred via effect, not on dashboard, no render-blocking |
| **Database latency** | ✅ GOOD — `db.batch()` atomic checkout, in-process settings cache |
| **Caching strategy** | ✅ GOOD — 24h `revalidate` + write-time tag invalidation |

**সবচেয়ে বড় সুযোগ**: Monolithic API route bundle splitting, checkout-এ অপ্রয়োজনীয় network requests কমানো, এবং `client-layout.tsx`-এর client boundary scope কমানো।

---

## ২. Performance Architecture Overview

### Request Flow — Storefront Page (SSR/ISR)

```
Bangladesh User (Dhaka)
  ↓ ~30-60ms RTT
Vercel Edge (Singapore)
  ↓ Route to Node.js Function
Next.js Server Component
  ↓ unstable_cache HIT → cached JSON (no DB call)
  ↓ unstable_cache MISS ↓
  ↓ In-process Hono route call (fromRoute())
  ↓   ↓ Neon HTTP (Singapore → Singapore, ~1-5ms)
  ↓   ↓ DB response
  ↓ Cached for 86400s (tagged)
Server HTML + RSC Payload
  ↓ ~30-60ms RTT
Browser
  ↓ Download JS bundles
  ↓ Hydrate client-layout.tsx (entire storefront)
  ↓ React Query: settings (seeded), current user, wishlist
  ↓ Client-side fetches: products, categories (off-LCP-path)
Interactive
```

### Checkout Submit Flow

```
User clicks "Place Order"
  ↓ React Hook Form validation (client)
  ↓ POST /api/checkout (Hono route)
    ↓ sessionMiddleware (JWT verify)
    ↓ zod validation
    ↓ IP block check (1 DB query)
    ↓ Idempotency check (1 DB query)
    ↓ Payment method check (cached settings)
    ↓ Cart/product fetch (1 DB query with relations)
    ↓ Price calculation (in-memory)
    ↓ Shipping cost (cached settings)
    ↓ findOrCreateCustomerByPhone (1-2 DB queries)
    ↓ withOrderNumber + db.batch (1 atomic batch: insert order + items + stock + clear cart)
    ↓ notifyNewOrder (fire-and-forget, not awaited)
  ↓ Response JSON
Browser redirects → /order-success
```

**ভালো দিক**: `db.batch()` single round-trip-এ atomic order creation। `notifyNewOrder` fire-and-forget।

---

## ৩. Infrastructure & Region Analysis

### বর্তমান Architecture

```
Bangladesh User (Dhaka/Chittagong)
  ↓ ~30-60ms (undersea cable to Singapore)
Vercel Singapore (sin1)
  ↓ ~1-5ms (same datacenter/region)
Neon PostgreSQL Singapore
```

### মূল্যায়ন

**Singapore + Singapore একটি সঠিক পছন্দ** এই কারণে:

1. **Bangladesh-এর nearest Vercel/Neon region হলো Singapore।** Mumbai-তে Neon এর availability নেই (এটি static code analysis থেকে verify করা সম্ভব নয়, কিন্তু Singapore সাধারণত South/Southeast Asia-র জন্য primary region)।
2. **Server-to-DB latency ~1-5ms** — একই region-এ থাকায় এটি optimal।
3. **User-to-Server latency ~30-60ms** — Bangladesh থেকে Singapore পর্যন্ত submarine cable path।

### সম্ভাব্য উন্নতি (evidence প্রয়োজন)

| Option | Benefit | Risk |
|---|---|---|
| **Vercel Edge Config for static data** | Settings/categories edge-এ cache হলে TTFB কমতো | Edge runtime-এ DB access pattern পরিবর্তন প্রয়োজন |
| **Mumbai region** | Bangladesh-এ ~10-20ms কম latency | Neon Mumbai availability যাচাই করতে হবে; server↔DB latency বাড়তে পারে যদি DB Singapore-এ থাকে |

**সুপারিশ**: বর্তমান setup পরিবর্তন করবেন না। Vercel's function region setting verify করুন যে এটি `sin1` এ set আছে।

---

## ৪. BEST — সবচেয়ে ভালো Performance Implementations

### ৪.১ In-Process Server Data Fetching
**File**: [prefetch-home.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/lib/prefetch-home.ts)

Settings, categories, products সবকিছু `fromRoute()` দিয়ে in-process call করা হচ্ছে — কোনো HTTP round-trip নেই। `unstable_cache` + tag invalidation দিয়ে cache করা হচ্ছে। এটি একটি excellent pattern।

### ৪.২ Settings Seed via Server Component
**File**: [settings-seed.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/provider/settings-seed.tsx) + [(client)/layout.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/app/(client)/layout.tsx)

Server component-এ settings fetch করে React Query cache-এ seed করা হচ্ছে — Hero component server HTML-এ real content দেখায়, skeleton নয়। এটি LCP-এর জন্য critical optimization।

### ৪.৩ Cloudinary Image Loader
**File**: [image-loader.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/lib/image-loader.ts)

Custom loader Cloudinary URL-এ `f_auto, q_auto:good, c_limit, w_{width}` transform inject করছে — browser-এর supported format (WebP/AVIF) এবং requested width অনুযায়ী image serve হচ্ছে।

### ৪.৪ Checkout Idempotency
**File**: [checkout-idempotency.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/lib/checkout-idempotency.ts)

sessionStorage-based idempotency key — double-submit prevention কোনো extra network request ছাড়াই।

### ৪.৫ Atomic Order Creation via db.batch()
**File**: [checkout/server/route.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/features/checkout/server/route.ts#L183-L224)

Order insert + order items + stock decrement + cart clear — সব একটি single HTTP round-trip-এ Neon-এ পাঠানো হচ্ছে।

---

## ৫. GOOD — ভালো Implementations

### ৫.১ Font Loading Strategy
- Figtree (body) ও Space Grotesk (heading) preload ✅
- Geist Mono ও Hind Siliguri `preload: false` ✅ — dashboard-only fonts LCP path-এ নেই
- `display: swap` সব font-এ ✅

### ৫.২ Hero Image Priority
**File**: [hero.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/components/home/hero.tsx#L126-L141)
- প্রথম slide: `priority={true}`, `fetchPriority="high"`
- পরবর্তী slides: default lazy — bandwidth waste হচ্ছে না

### ৫.৩ Product Page Caching
**File**: [get-product.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/features/product/server/get-product.ts)
- `unstable_cache` (cross-request) + `react cache` (same-render dedup) — `generateMetadata` ও page component একই product দুইবার fetch করে না

### ৫.৪ Lightbox Dynamic Import
**File**: [switch-image.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/features/product/components/switch-image.tsx#L10-L12)
- `yet-another-react-lightbox` dynamically imported, `ssr: false` — initial bundle-এ নেই

### ৫.৫ React Query Configuration
**File**: [query-provider.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/provider/query-provider.tsx)
- `staleTime: 5min`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false` — unnecessary refetches এবং DB wakeups বন্ধ

### ৫.৬ GTM Loading
**File**: [google-analytics.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/components/google-analytics.tsx)
- Effect-based loading (render-blocking নয়)
- Dashboard-এ skip করা হচ্ছে
- Duplicate container guard আছে

---

## ৬. ACCEPTABLE — কাজ করছে কিন্তু Optimization সম্ভব

### ৬.১ Root Layout Client Provider Chain
**File**: [app/layout.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/app/layout.tsx#L174-L191)

```
ThemeProvider ("use client")
  └─ TooltipProvider
    └─ Toaster
    └─ QueryProvider ("use client")
      └─ SeoVerification
      └─ GoogleAnalytics ("use client")
      └─ TrackingIdentity ("use client")
      └─ NuqsAdapter
        └─ {children}
```

**সমস্যা**: ThemeProvider root-এ থাকায় পুরো tree একটি client boundary-র মধ্যে। তবে Next.js App Router-এ Server Components children হিসেবে pass হলেও তারা server-এ render হয়, তাই এটি actual rendering-এ সমস্যা করে না — কিন্তু ThemeProvider, TooltipProvider, Toaster-এর JS client bundle-এ যায়।

**Impact**: LOW-MEDIUM — library code hydrate হয় কিন্তু actual content server-rendered থাকে।

### ৬.২ Hind Siliguri Font Weights
**File**: [app/layout.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/app/layout.tsx#L44-L50)

4টি weight (400, 500, 600, 700) load হচ্ছে। `preload: false` থাকায় initial load-এ impact নেই, কিন্তু dashboard-এ first Bengali text render-এ 4টি font file download হবে।

### ৬.৩ Cart Provider Auth Check
**File**: [cart-provider.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/provider/cart-provider.tsx#L11)

`useCurrent()` — প্রতিটি page load-এ `/api/auth/current` call হচ্ছে। Guest users-দের জন্য এটি unnecessary network request।

---

## ৭. BAD — গুরুত্বপূর্ণ Performance সমস্যা

### BAD-1: Monolithic API Route Bundle

**Priority**: CRITICAL  
**Severity**: BAD  
**File**: [app/api/[[...route]]/route.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/app/api/%5B%5B...route%5D%5D/route.ts)  
**Page/Route**: সব API routes  

**Current Behavior**: একটি single catch-all route file-এ 25টি feature module import হচ্ছে:
```
auth, products, product (dashboard), categories, review, cart, checkout,
orders, collection, testimonials, wishlist, analytics, steadfast, settings,
blog, pos, reports, expenses, roles, users, activity, apiKeys, blockedIps,
googleSheets, fraudChecker
```

**Performance Problem**: প্রতিটি API request-এ সব module-এর server code load হয়। এর মধ্যে:
- `@react-pdf/renderer` (invoice-pdf.tsx — শুধু order download-এ দরকার)
- `recharts` (analytics dashboard-এ দরকার)
- `xlsx` (export-এ দরকার)
- `@tiptap/react` + extensions (blog editor-এ দরকার)
- `googleapis` (Google Sheets integration-এ দরকার)
- `@google-analytics/data` (analytics-এ দরকার)
- `@dnd-kit` (dashboard drag/sort-এ দরকার)

**Why It Happens**: Next.js catch-all route-এ Hono app mount করা হয়েছে। সব feature-এর server route একসাথে import হচ্ছে।

**Impact**: Serverless function cold start time বৃদ্ধি। প্রতিটি `/api/checkout` call-এ recharts, xlsx, tiptap-এর code memory-তে load হয়। Vercel function size বড় হয়।

**Recommended Fix**: 
- গুরুত্বপূর্ণ routes (checkout, cart, auth, settings, products) আলাদা Next.js route files-এ split করুন
- অথবা heavy dependencies (xlsx, @react-pdf/renderer, recharts, tiptap, googleapis) dynamic import করুন তাদের specific route handler-এর ভেতরে

**Expected Benefit**: Checkout API cold start ৩০-৫০% দ্রুত হতে পারে। Function memory usage উল্লেখযোগ্যভাবে কমবে।

**Difficulty**: MEDIUM

---

### BAD-2: useLanguage() Hook — প্রতিটি Component-এ আলাদা localStorage Read + State

**Priority**: HIGH  
**Severity**: BAD  
**File**: [hooks/use-language.ts](file:///Users/iboxlab/Test/sleep-sheet-reborn/hooks/use-language.ts)  
**Page/Route**: সব storefront pages  

**Current Behavior**: `useLanguage()` hook প্রতিটি component-এ call হলে:
1. `useState("bn")` — SSR-এ "bn" render হয়
2. `useEffect` — mount-এ localStorage read → `setLanguageState(saved)` 
3. যদি saved language "en" হয়, re-render trigger হয়

এই hook ব্যবহৃত হচ্ছে: Navbar, Footer, Cart Drawer, Product Card, Hero, Checkout, OrderSummary — minimum ১০+ components।

**Performance Problem**: 
- প্রতিটি component আলাদাভাবে localStorage read করছে
- "en" users-দের জন্য hydration mismatch: server "bn" render করে, client "en" — পুরো component re-render হয়
- Language change event listener প্রতিটি instance-এ আলাদা

**Impact**: 
- TBT বৃদ্ধি (multiple synchronous localStorage reads during hydration)
- CLS risk ("bn" → "en" switch-এ layout shift)
- Unnecessary re-renders propagation

**Recommended Fix**: Language state একটি Zustand store বা React Context-এ centralize করুন, যাতে localStorage read একবারই হয়। অথবা cookie-based language detection ব্যবহার করুন যাতে server-এও সঠিক language render হয়।

**Expected Benefit**: TBT কমবে, CLS risk কমবে, hydration mismatch দূর হবে।  
**Difficulty**: MEDIUM

---

### BAD-3: Checkout Page-এ অপ্রয়োজনীয় API Calls

**Priority**: HIGH  
**Severity**: BAD  
**File**: [checkout-client.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/app/(client)/checkout/checkout-client.tsx), [shipping-information-card.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/features/checkout/components/shipping-information-card.tsx)  
**Page/Route**: /checkout  

**Current Behavior**: Checkout page load-এ যেসব API call হয়:

| # | Call | Source | প্রয়োজনীয়? |
|---|---|---|---|
| 1 | `GET /api/settings` | `useSettings()` in ShippingInformationCard | ❌ Server-এ already fetched ও `initialSettings` হিসেবে pass করা হয়েছে |
| 2 | `GET /api/auth/current` | `useCurrent()` in ShippingInformationCard | ⚠️ Pre-fill-এর জন্য, কিন্তু guest checkout-এ unnecessary |
| 3 | `GET /api/auth/current` | `useCurrent()` in CartProvider | ❌ Duplicate — #2 এর সাথে deduplicated হবে React Query-তে, কিন্তু still একটি network request |
| 4 | `GET /api/auth/current` | `useCurrent()` in Navbar | ❌ Triple call — same query key |
| 5 | `GET /api/auth/current` | `useCurrent()` in TrackingIdentity | ❌ Quadruple — React Query dedup |
| 6 | `GET /api/wishlist` | `useWishlist()` in Navbar | ❌ Checkout-এ wishlist দরকার নেই |
| 7 | `GET /api/products?sort=newest` | `useGetProducts()` possibly from FeaturedProduct if loaded | ❌ Checkout-এ product listing দরকার নেই |

**Performance Problem**: 
- React Query same queryKey deduplicate করে, তাই `useCurrent()` আসলে 1টি network request করে — কিন্তু `useWishlist()` checkout-এ সম্পূর্ণ অপ্রয়োজনীয়
- `useSettings()` call server-fetched `initialSettings` পাওয়া সত্ত্বেও — SettingsSeed `["settings"]` key-তে data set করায় এটি cache hit হবে (refetch হবে না)

**Impact**: Checkout page interactivity-তে বিলম্ব — wishlist API wait। Guest users-দের জন্য auth call 401 return করে কিন্তু network time নেয়।

**Recommended Fix**:
1. Navbar-তে checkout page detect করে wishlist/unnecessary calls skip করুন
2. `useSettings()` in ShippingInformationCard: SettingsSeed আছে বলে refetch হচ্ছে না — এটি আসলে OK, কিন্তু `initialSettings` prop direct ব্যবহার করলে আরো নিশ্চিত

**Expected Benefit**: Checkout-এ ১-২টি কম network request → faster interactive  
**Difficulty**: LOW

---

### BAD-4: client-layout.tsx — সম্পূর্ণ Storefront Client Boundary

**Priority**: HIGH  
**Severity**: BAD  
**File**: [client-layout.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/app/(client)/client-layout.tsx)  
**Page/Route**: সব storefront pages  

**Current Behavior**: `"use client"` directive — এই component-এ Navbar, Footer, Testimonials, Newsletter, CartProvider, TrafficTracker, WhatsApp button, scroll-to-top — সব hydrate হয়।

**Performance Problem**: 
- Navbar (467 lines) — search, auth, wishlist, cart, theme toggle, mobile menu, bottom nav — সব hydrate হচ্ছে
- Footer (304 lines) — social links, language switcher — hydration cost
- Testimonials ও Newsletter conditionally render হচ্ছে কিন্তু তাদের JS code সবসময় bundle-এ
- `window.scrollTo(0, 0)` every pathname change — scroll position management overhead

**Impact**: 
- প্রতিটি page-এ ~800+ lines of client component hydration
- TBT বৃদ্ধি — বিশেষত low-end Android devices-এ

**Recommended Fix**:
1. Footer-কে server component করুন (language switch আলাদা ছোট client component)
2. Testimonials ও Newsletter lazy load করুন (intersection observer)
3. WhatsApp button ও scroll-to-top আলাদা ছোট client components

**Expected Benefit**: TBT ২০-৩০% কমতে পারে  
**Difficulty**: MEDIUM

---

### BAD-5: feed.xml — 317KB Static File in Repository Root

**Priority**: MEDIUM  
**Severity**: BAD  
**File**: [feed.xml](file:///Users/iboxlab/Test/sleep-sheet-reborn/feed.xml)  
**Page/Route**: Build/deploy  

**Current Behavior**: 317KB XML file repository root-এ। এটি সম্ভবত Facebook/Google product feed।

**Performance Problem**: 
- এটি build output-এ include হতে পারে
- যদি public folder-এ serve হয়, এটি CDN-এ cache হচ্ছে কিন্তু static file হিসেবে serve হচ্ছে
- Crawler visits-এ bandwidth waste

**Recommended Fix**: Feed dynamically generate করুন (route handler দিয়ে) এবং static file remove করুন।

**Expected Benefit**: Deploy size কমবে, feed সবসময় fresh থাকবে  
**Difficulty**: LOW (already `/facebook-feed` route আছে rewrite সহ)

---

### BAD-6: favicon.ico — 254KB

**Priority**: MEDIUM  
**Severity**: BAD  
**File**: `app/favicon.ico`  
**Page/Route**: সব pages  

**Current Behavior**: 254KB favicon.ico — প্রতিটি নতুন visitor-এর browser এটি download করবে।

**Performance Problem**: Standard favicon 5-15KB হওয়া উচিত। 254KB favicon LCP-কে delay করতে পারে কারণ browser favicon-কে high priority দিয়ে থাকে।

**Recommended Fix**: favicon.ico optimize করুন — 32x32 ICO format-এ convert করুন (~5KB)। Apple-touch-icon আলাদা রাখুন।

**Expected Benefit**: প্রতিটি নতুন visit-এ ~240KB কম download  
**Difficulty**: LOW

---

### BAD-7: Public Folder-এ Unoptimized PNG Images

**Priority**: MEDIUM  
**Severity**: BAD  
**File**: `public/hero-banner-1.png` (963KB), `public/hero-banner-2.png` (832KB), `public/hero-slider-1.png` (838KB), `public/dark-logo.png` (254KB), `public/logo.png` (103KB)  

**Current Behavior**: Fallback hero images ও logos PNG format-এ।

**Performance Problem**:
- Hero images যদি Cloudinary-তে না থাকলে fallback হিসেবে ব্যবহার হয়, এগুলো ~850KB PNG — কোনো CDN transform ছাড়া
- Logo 103KB PNG — WebP-তে convert করলে ~20-30KB হবে
- Dark logo 254KB — same issue

**Impact**: প্রথমবারের visitor-দের জন্য, যদি Cloudinary URL available না হয়, hero images raw PNG হিসেবে load হবে।

**Recommended Fix**: 
- এই images WebP format-এ convert করুন
- Logo-কে SVG বা optimized WebP-তে convert করুন
- `next/image` component logo-র জন্যও Cloudinary loader ব্যবহার করুন

**Expected Benefit**: Fallback scenario-তে ~2MB কম download  
**Difficulty**: LOW

---

## ৮. WORST — Critical Performance সমস্যা

### WORST: নেই

কোনো single catastrophic performance issue পাওয়া যায়নি যেটি site-কে unusable করবে। সবচেয়ে গুরুতর সমস্যা (BAD-1: Monolithic API bundle) serverless cold start-কে প্রভাবিত করে কিন্তু warm function-এ acceptable latency দেয়।

---

## ৯. Lighthouse Analysis

### সম্ভাব্য Score Impact (Static Analysis ভিত্তিক)

| Metric | সম্ভাব্য Impact | কারণ |
|---|---|---|
| **FCP** | ✅ ভালো হওয়ার কথা | Server-rendered HTML with real content (settings seed) |
| **LCP** | ✅ ভালো হওয়ার কথা | Hero image `priority` + Cloudinary CDN + `fetchPriority="high"` |
| **TBT** | ⚠️ মাঝারি concern | Client-layout.tsx hydration + useLanguage re-renders + multiple providers |
| **CLS** | ✅ ভালো হওয়ার কথা | `font-display: swap` + Image dimensions specified + skeletons |
| **Speed Index** | ⚠️ মাঝারি concern | Hero carousel opacity transition — progressive paint pattern ভালো |

### Lighthouse-এ Penalize করতে পারে যা:

1. **254KB favicon** — "Avoid enormous network payloads" warning
2. **Unoptimized public PNGs** — "Serve images in modern formats" if used
3. **Client-side language detection** — hydration mismatch → extra paint → Speed Index প্রভাবিত
4. **backdrop-blur-md on navbar** — GPU-intensive on mobile, কিন্তু Lighthouse সাধারণত এটি catch করে না

---

## ১০. Core Web Vitals Analysis

### LCP (Largest Contentful Paint)

**Home page LCP element**: Hero carousel-এর প্রথম slide image।

| চেকপয়েন্ট | অবস্থা |
|---|---|
| `priority` prop | ✅ `priority={index === 0}` |
| `fetchPriority` | ✅ `"high"` for first slide |
| `sizes` | ✅ `"(max-width: 1024px) 100vw, 66vw"` |
| Cloudinary CDN | ✅ Custom loader transforms URL |
| Image format | ✅ `f_auto` → WebP/AVIF |
| Server rendering | ✅ Settings seeded → hero content in server HTML |
| Preload | ✅ Next.js `priority` prop generates `<link rel="preload">` |

**Product page LCP element**: Product main image (`switch-image.tsx`)
| চেকপয়েন্ট | অবস্থা |
|---|---|
| `priority` | ✅ `priority={true}` |
| `sizes` | ✅ `"(max-width: 1024px) 100vw, 50vw"` |
| Image source | ⚠️ Cloudinary URL direct ব্যবহার হচ্ছে, custom loader `getOptimizedImageUrl` ছাড়া — `next/image` এর `loader` prop missing |

### INP (Interaction to Next Paint)

| উৎস | Impact |
|---|---|
| Product card "Buy Now" button | ⚠️ `router.push("/checkout")` — client navigation + cart state update — acceptable |
| Checkout form submission | ✅ `isPending` state → spinner — good UX |
| Search submit | ✅ Lightweight — `nuqs` query state update |
| `useLanguage` re-renders | ⚠️ Language change triggers re-render of every component using the hook — INP spike possible |

### CLS (Cumulative Layout Shift)

| উৎস | Risk |
|---|---|
| Font loading | ✅ LOW — `display: swap` with good fallbacks |
| Hero carousel | ✅ LOW — fixed height container (`h-55 sm:h-100 lg:h-[320px]`) |
| Product images | ✅ LOW — `fill` + `aspect-[4/3]` container |
| Checkout skeleton → content | ✅ LOW — skeleton matches layout |
| Language switch (bn↔en) | ⚠️ MEDIUM — text length difference may cause shifts |

### TTFB

| Factor | অবস্থা |
|---|---|
| ISR caching | ✅ `revalidate: 86400` — cache hit-এ TTFB excellent |
| Server component data | ✅ `unstable_cache` — DB hit rare |
| Cold start | ⚠️ Monolithic API bundle cold start may affect first request |
| Bangladesh→Singapore | ~30-60ms network latency — unavoidable |

---

## ১১. JavaScript & Bundle Analysis

### Heavy Dependencies (Client-side Impact)

| Package | Size (approx) | সব page-এ load? | করণীয় |
|---|---|---|---|
| `@react-pdf/renderer` | ~500KB+ | ❌ Dashboard only (invoice download) | ✅ Dashboard-এ আছে, storefront-এ import হয় না |
| `recharts` | ~300KB+ | ❌ Dashboard analytics only | ⚠️ API route bundle-এ import |
| `xlsx` | ~300KB+ | ❌ Dashboard export only | ⚠️ API route bundle-এ import |
| `@tiptap/react` + extensions | ~200KB+ | ❌ Blog editor only | ⚠️ API route bundle-এ import |
| `googleapis` | ~150KB+ | ❌ Server-side only | ⚠️ API route bundle-এ import |
| `@tabler/icons-react` | ~varies | ✅ Footer-এ 4টি icon | ⚠️ Tree-shakeable কিন্তু icon library |
| `lucide-react` | ~varies | ✅ সব pages | ✅ Tree-shakeable |
| `embla-carousel-react` | ~30KB | ✅ Home page | ✅ Reasonable size |
| `radix-ui` | ~varies | ✅ UI components | ✅ Tree-shakeable |
| `date-fns` | ~varies | ✅ `lib/utils.ts` | ⚠️ Top-level import — সব subDays, subWeeks function bundle-এ |
| `sonner` | ~15KB | ✅ Root layout | ✅ Small |
| `marked` | ~30KB | ❌ Blog rendering | ⚠️ Blog page-এ only |
| `sanitize-html` | ~varies | ❌ Server-side | ✅ Server only |
| `zod` | ~15KB | ✅ Client + Server | ✅ Reasonable |

### মুখ্য Concern

**`date-fns` top-level import in `lib/utils.ts`**:
```typescript
import { subDays, subWeeks, subMonths, subYears, startOfToday } from 'date-fns'
```
এটি `utils.ts`-এর top-এ আছে এবং `cn()` function-ও এই file-এ — তাই যেকোনো component `cn()` import করলে `date-fns` functions-ও bundle-এ আসতে পারে। Tree-shaking এটি handle করার কথা, কিন্তু barrel file pattern-এ sometimes tree-shaking fail করে।

---

## ১২. Hydration Analysis

### Root-Level Hydration Chain

```
<html>
  <body>
    ThemeProvider         ← "use client" — hydrates
    ├─ TooltipProvider    ← client context
    ├─ Toaster           ← client component
    ├─ QueryProvider     ← "use client" — hydrates
    │  ├─ SeoVerification ← "use client" — empty render
    │  ├─ GoogleAnalytics ← "use client" — effect only
    │  ├─ TrackingIdentity ← "use client" — effect only
    │  └─ NuqsAdapter    ← context provider
    │     └─ (client) layout ← Server Component ✅
    │        └─ SettingsSeed ← "use client" — minimal (cache set)
    │           └─ ClientLayout ← "use client" — HEAVY
    │              ├─ CartProvider ← "use client" — effects
    │              ├─ TrafficTracker ← "use client" — effect only
    │              ├─ Navbar ← "use client" — 467 lines
    │              ├─ Footer ← "use client" — 304 lines
    │              ├─ Testimonials ← "use client"
    │              ├─ Newsletter ← "use client"
    │              └─ WhatsApp + ScrollTop buttons
    └─ VercelAnalytics ← "use client" — small
```

### Hydration Budget

| Component | Lines | Hydration প্রয়োজন? |
|---|---|---|
| ThemeProvider | ~10 | ✅ হ্যাঁ (class toggle) |
| QueryProvider | ~60 | ✅ হ্যাঁ (data fetching) |
| GoogleAnalytics | ~88 | ⚠️ Effect-only — hydrate to run effect |
| TrackingIdentity | ~52 | ⚠️ Effect-only |
| Navbar | ~467 | ⚠️ Search + cart + auth interactive, কিন্তু static parts (logo, links) hydrate হওয়ার দরকার নেই |
| Footer | ~304 | ⚠️ শুধু language switcher interactive — বাকি সব static links |
| CartProvider | ~52 | ✅ হ্যাঁ (localStorage + fetch) |

---

## ১৩. React Rendering Performance

### উল্লেখযোগ্য সমস্যা

**1. `useLanguage()` — প্রতি component-এ independent state**

প্রতিটি `useLanguage()` call তৈরি করে:
- 1 useState
- 1 useEffect (localStorage read)
- 1 event listener

10+ components-এ call হলে: 10 localStorage reads, 10 event listeners, language change-এ 10 independent re-renders।

**2. ProductCard — Complex inline state**

[product-card.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/components/product/product-card.tsx) প্রতিটি card-এ:
- 5টি useState (selectedSize, selectedColor, selectedAddOns, quantity, isDrawerOpen, dialogAction)
- Multiple event handlers recreated every render

Product listing-এ 8+ cards render হলে, প্রতিটি card-এর Dialog component (Radix) mount হয় — এমনকি closed অবস্থাতেও।

**Recommendation**: Dialog component render on-demand (যখন `isDrawerOpen === true`), ইতিমধ্যে Lightbox-এ এই pattern ব্যবহার হচ্ছে।

**3. Cart store subscriptions — ভালো**

```typescript
const totalItems = useCartStore(selectTotalItems);
```

✅ Selector pattern ব্যবহার করা হচ্ছে — store-এর শুধু প্রয়োজনীয় slice-এ subscribe। এটি correct pattern।

---

## ১৪. Next.js Performance

### Server Components ব্যবহার ✅

- Home page (`page.tsx`) — Server Component, `Promise.all` parallel fetch
- Product detail page — Server Component, cached product + related products
- Shop page — Server Component with Suspense boundaries
- Checkout page — Server Component wrapper (`CheckoutPage`) fetches settings

### Dynamic Imports ✅

- `ProductLightbox` — `dynamic()` with `ssr: false` ✅
- Invoice PDF — Dashboard only, not on storefront ✅

### ISR/Caching ✅

- `revalidate: 86400` (24h) for storefront layout
- Tag-based invalidation on write
- `unstable_cache` with proper tags

### সমস্যা

**Middleware (proxy.ts)**: `jwt.verify()` প্রতিটি dashboard request-এ — Node.js runtime, crypto operation। Dashboard-only, storefront-কে প্রভাবিত করে না।

---

## ১৫. Network & Request Waterfall

### Home Page Request Flow

```
  ──── Server-side (parallel) ────
  │ getPublicSettings()      ◄── cache hit
  │ getPublicCategories()    ◄── cache hit  
  │ getPublicProducts()      ◄── cache hit
  ──── HTML sent ────
  
  ──── Client-side (after hydration) ────
  │ GET /api/auth/current    ◄── 401 for guests
  │ GET /api/wishlist        ◄── fails for guests
  │ GET /api/settings        ◄── React Query cache hit (seeded)
  │ GET /api/products?sort=newest ◄── client fetch for FeaturedProduct
  │ GTM gtm.js download     ◄── async, non-blocking
  ──── Interactive ────
```

**Waterfall Issue**: `useCurrent()` → 401 → `useWishlist()` → also fails for guests. এই 2টি request guest users-দের জন্য waste।

### Checkout Page Request Flow

```
  ──── Server-side ────
  │ getPublicSettings()      ◄── cache hit
  ──── HTML + skeleton sent ────
  
  ──── Client-side ────
  │ T0: Hydrate ClientLayout → CartProvider → Navbar → ShippingCard
  │ T1: GET /api/auth/current     (from useCurrent × 4 calls, deduped to 1)
  │ T1: GET /api/settings         (React Query cache hit from seed — no request)
  │ T1: GET /api/wishlist         ◄── UNNECESSARY on checkout
  │ T2: Cart state from Zustand localStorage (sync, no network)
  │ T3: mounted=true → render checkout form
  ──── Interactive (form visible) ────
```

**Optimized Flow**:
```
  T1: GET /api/auth/current   (1 request only — needed for form pre-fill)
  ──── REMOVE: GET /api/wishlist ────
  ──── Cart state from localStorage (sync) ────
  ──── Interactive (faster) ────
```

---

## ১৬. Image Performance

### Cloudinary Integration ✅

| Feature | অবস্থা |
|---|---|
| Format auto-detection | ✅ `f_auto` → WebP/AVIF |
| Width-based transform | ✅ `w_{width}` |
| Quality control | ✅ `q_auto:good` or `q_{quality}` |
| Responsive sizes | ✅ `sizes` prop properly set |
| Lazy loading | ✅ Default for non-priority images |

### সমস্যা

**1. Product card image** — `getOptimizedImageUrl()` manually called:
```typescript
src={getOptimizedImageUrl(product.images?.[0], 400)}
```
কিন্তু `next/image` default loader-ও width-based transform করে (custom loader set আছে)। Double transformation হচ্ছে না — `getOptimizedImageUrl` শুধু Cloudinary URL transform করে, তারপর custom loader আবার করে। **Potentially redundant transformation — image URL-এ double `f_auto` prefix হতে পারে।**

**2. Order summary images** — `fill` prop with no `sizes`:
```typescript
<Image src={cartItem?.image} alt={cartItem?.name} fill className="object-cover" />
```
[order-summery-card.tsx](file:///Users/iboxlab/Test/sleep-sheet-reborn/features/checkout/components/order-summery-card.tsx#L45-L50) — `sizes` missing, Next.js default `100vw` ধরে নেবে — 40x40px container-এ full-width image request হবে।

**Recommended Fix**: `sizes="40px"` (mobile) / `sizes="56px"` (desktop) add করুন।

---

## ১৭. Font Performance

### বর্তমান কনফিগারেশন

| Font | Preload | Usage | Weight |
|---|---|---|---|
| Figtree | ✅ Yes | Body text | Variable |
| Space Grotesk | ✅ Yes | Headings | Variable |
| Geist Mono | ❌ No | Dashboard/checkout mono | Variable |
| Hind Siliguri | ❌ No | Bengali text | 400, 500, 600, 700 |

### Assessment: ✅ GOOD

Critical fonts preload হচ্ছে, non-critical fonts demand-এ load হচ্ছে। `display: swap` সব font-এ — FOUT acceptable, FOIT নেই।

### Minor Concern

Hind Siliguri 4টি weight — যদি Bengali text অল্প ব্যবহার হয় (শুধু dashboard), তাহলে 2টি weight (400, 700) sufficient হতে পারে।

---

## ১৮. Caching & CDN

### Caching Layers

```
Browser Cache
  └─ Static assets: Vercel CDN (immutable hash, long-lived)
  └─ API responses: React Query (staleTime: 5min)

Vercel CDN
  └─ ISR pages: revalidate 86400s (24h)
  └─ Static assets: immutable

Next.js Data Cache
  └─ unstable_cache: settings, categories, products, blog, testimonials
  └─ Tags: settings, categories, products, blog, testimonials
  └─ Write-time invalidation: revalidateTag()

Server-side In-Process Cache
  └─ settings-cache.ts: TTL 60s, in-memory Map
  └─ react cache(): per-request dedup (product page)
```

### Assessment: ✅ GOOD

Multi-layer caching properly implemented। Tag-based invalidation ensures freshness on write।

### Minor Improvement

Product listing page (`/shop`) — `getPublicProducts()` returns only 8 products (`?sort=newest&limit=8`), কিন্তু shop page-এ user filter/search করতে পারে — client-side `useGetProducts()` call সেক্ষেত্রে fresh data আনে। এটি correct behavior।

---

## ১৯. Data Fetching Performance

### Positive Patterns

1. **Parallel fetching on home page**: `Promise.all([getPublicCategories(), getPublicProducts()])` ✅
2. **In-process route calling**: `fromRoute()` — no HTTP overhead ✅
3. **React Query staleTime**: 5min prevents refetch storms ✅
4. **Checkout db.batch()**: single round-trip atomic operation ✅

### Concern

**Cart `addToCart` flow**: 
```typescript
// use-cart-store.ts line 64
const res = await client.api.auth.current.$get(); // ← Extra auth check
const user = await res.json();
if (!user) { /* guest flow */ }
// ...
const postRes = await client.api.cart.$post({ json: apiPayload });
// ...
await get().fetchCart(); // ← Full cart refetch after add
```

প্রতিটি "Add to Cart" action-এ 3টি sequential request:
1. Auth check
2. Cart POST
3. Full cart refetch

**Optimized Flow**: Auth status React Query-তে cached আছে — `useCurrent()` data directly check করুন store-এ auth call না করে। Cart POST-এর response-এ updated cart return করলে full refetch দরকার নেই (optimistic update)।

---

## ২০. API / Database Latency Impact

### Checkout Server Route — Query Count

| Step | Queries | Sequential? |
|---|---|---|
| IP block check | 1 | Yes |
| Idempotency check | 1 | Yes |
| Payment method check | 0 (cached) | - |
| Cart + products fetch | 1 (with relations) | Yes |
| Shipping cost | 0 (cached) | - |
| findOrCreateCustomer | 1-2 | Yes |
| Order batch | 1 (batch of 3-4 inserts) | Atomic |
| **Total** | **5-6 queries** | Sequential |

**Analysis**: প্রতিটি query Neon HTTP driver-এ — independent HTTP request to PostgreSQL। Singapore→Singapore ~1-5ms per query = total ~10-30ms DB time for checkout。

**Possible Optimization**: IP block check ও idempotency check parallel চালানো যায় — কিন্তু improvement ~1-5ms, worthwhile নয়।

### N+1 Query Risk

কোনো N+1 pattern পাওয়া যায়নি। Product listing, cart fetch — সব `with` relations ব্যবহার করে single query-তে।

---

## ২১. Mobile & Slow Network Performance

### Bangladesh Mobile Context

| Factor | অবস্থা |
|---|---|
| **Network** | 4G average ~10-20 Mbps, 3G ~1-5 Mbps |
| **Devices** | Predominantly low-mid range Android (2-4GB RAM) |
| **CPU** | Snapdragon 4xx/6xx series — JS parsing cost significant |

### Critical Concerns

1. **TBT on low-end devices**: Client-layout hydration (Navbar + Footer + providers) ১০০-২০০ms+ blocking time হতে পারে 2GB RAM Android-এ
2. **backdrop-blur-md on navbar**: GPU-intensive CSS effect — low-end GPU-তে janky scroll
3. **Product card Dialog mount**: 8+ Radix Dialog components mount on listing page — each creates DOM nodes
4. **254KB favicon**: 3G-তে ~2 seconds download time
5. **useLanguage localStorage reads**: Synchronous main thread work during hydration

### Slow 4G (1.5 Mbps, 150ms RTT) Analysis

| Step | Estimated Time |
|---|---|
| DNS + TLS | ~300ms |
| HTML download (~50KB gzipped) | ~270ms |
| First contentful paint | ~800ms |
| JS bundle download (~200-400KB gzipped) | ~1.5-3s |
| Hydration | ~500-1000ms |
| API calls (auth, settings) | ~300-600ms per call |
| **Total to Interactive** | **~3-5s** |

**Home page hero**: ✅ Server-rendered, should paint early
**Checkout**: ⚠️ Skeleton → hydration → form — ~2-3s to interactive

---

## ২২. Checkout — EXTREME PERFORMANCE AUDIT

### Checkout Critical Path Analysis

#### Step 1: Navigation to /checkout

- Cart drawer "Proceed to Checkout" → `<Link href="/checkout">` client navigation
- Next.js prefetch: checkout page JS chunk likely prefetched (default `<Link>` behavior)

#### Step 2: Server-side rendering

```typescript
// checkout/page.tsx (Server Component)
const settings = await getPublicSettings().catch(() => null);
return <CheckoutClient initialSettings={settings} />;
```
- `getPublicSettings()` — `unstable_cache` hit → ~0ms DB
- HTML with skeleton rendered server-side

#### Step 3: HTML delivery

- Checkout HTML includes: `<CheckoutSkeleton />` (server-rendered)
- Settings data embedded via `initialSettings` prop

#### Step 4: JavaScript download

- Checkout client chunk: `checkout-client.tsx` + `shipping-information-card.tsx` + `order-summery-card.tsx`
- Dependencies: react-hook-form, @hookform/resolvers, zod, lucide-react icons
- **Plus**: client-layout.tsx hydration (Navbar, Footer, CartProvider)

#### Step 5: Hydration

- ClientLayout hydrates (Navbar, Footer, CartProvider, TrafficTracker)
- CheckoutClient hydrates
- `useState(false)` → `setMounted(true)` — skeleton → content flash
- `getOrCreateCheckoutIdempotencyKey()` — sessionStorage read (sync, fast)

#### Step 6: Cart state restoration

- Zustand store already has cart data (persisted from previous navigation)
- `useCartStore` read — synchronous, no network

#### Step 7: Form initialization

- `useForm()` with resolver + default values
- `useCurrent()` → React Query cached or fetches `/api/auth/current`
- Form pre-fills from currentUser data when available

#### Step 8: Settings for shipping costs

- `useSettings()` → React Query cache hit (SettingsSeed populated it)
- `initialSettings` prop as fallback
- Shipping zone costs calculated from settings

#### Step 9: User sees checkout form

- 2টি Card: ShippingInformation + OrderSummary
- Form fields: fullName, phone, address, shippingZone
- Payment method: COD (card disabled)
- Cart items rendered from Zustand store

### Checkout Performance Issues

| Issue | Impact | Priority |
|---|---|---|
| Double `hasMounted` pattern — both CheckoutClient and ShippingInformationCard have `useState(false) → setMounted(true)` | Extra render cycle — skeleton → content → skeleton → content | MEDIUM |
| `useWishlist()` in Navbar loads on checkout | Unnecessary network request | HIGH |
| `useSettings()` in ShippingInformationCard despite `initialSettings` prop | React Query cache hit — no request, কিন্তু unnecessary hook overhead | LOW |
| Form `mode: "onChange"` — validation runs on every keystroke | CPU work on every input change on low-end devices | LOW |

### Checkout JS Budget

শুধু checkout-specific code:
- `checkout-client.tsx`: ~2.7KB
- `shipping-information-card.tsx`: ~21.8KB
- `order-summery-card.tsx`: ~4.6KB  
- `checkout-skeleton.tsx`: ~4.7KB
- `use-checkout.ts`: ~4.2KB
- checkout schema: ~3.7KB
- Total checkout code: ~41.7KB source

Plus dependencies:
- react-hook-form: ~30KB
- @hookform/resolvers + zod: ~20KB
- lucide-react icons (8+ icons): tree-shaken

Plus layout hydration:
- Navbar: ~18.5KB source
- Footer: ~14.9KB source

---

## ২৩. Checkout Critical Path

### বর্তমান Flow

```
User clicks "Checkout"
  ↓
Next.js client navigation (prefetched JS chunk)
  ↓
Server: getPublicSettings() → cache hit → HTML with skeleton
  ↓ ~60ms (Bangladesh → Singapore)
Browser receives HTML
  ↓
Hydrate ClientLayout (Navbar, Footer, CartProvider)
  ↓ ~100-300ms on mobile
Hydrate CheckoutClient
  ↓
CheckoutClient: mounted=false → render <CheckoutSkeleton/>
  ↓
useEffect → setMounted(true) → re-render
  ↓
ShippingInformationCard mounts
  ↓
ShippingInformationCard: hasMounted=false → render <ShippingInformationSkeleton/>
  ↓
useEffect → setHasMounted(true) → re-render ← UNNECESSARY SECOND SKELETON
  ↓
useForm() initializes → form renders
  ↓
useCurrent() → /api/auth/current → wait for response
  ↓ ~100-200ms
Form pre-fills (if logged in)
  ↓
CHECKOUT VISIBLE & INTERACTIVE
```

### Optimized Flow

```
User clicks "Checkout"
  ↓
Next.js client navigation
  ↓
Server: getPublicSettings() → HTML with real form (not skeleton)
  ↓ ~60ms
Browser receives HTML with visible form
  ↓
Hydrate (minimal — no double skeleton)
  ↓
Cart from Zustand (sync) — order summary visible
  ↓
useCurrent() prefilled via React Query cache (if previously loaded)
  ↓
CHECKOUT VISIBLE & INTERACTIVE
  
  Background (non-blocking):
  - GTM begin_checkout event
  - Idempotency key generation
```

**Key Differences**:
1. একটি skeleton cycle eliminate — ShippingInformationCard-এর `hasMounted` pattern redundant কারণ CheckoutClient already mounted check করে
2. Navbar wishlist call remove
3. Auth data already cached from previous page

---

## ২৪. Checkout Performance Strategy

### A. Initial Checkout Page Load — Target: <1.5s mobile

| Strategy | Implementation |
|---|---|
| **Prefetch checkout JS** | ✅ Already done — `<Link>` default prefetch |
| **Server-render with real settings** | ✅ Already done — `initialSettings` prop |
| **Eliminate double skeleton** | Remove `hasMounted` from ShippingInformationCard |
| **Skip wishlist on checkout** | Navbar conditionally skip `useWishlist()` on checkout path |

### B. User Interaction Latency — Target: INP <200ms

| Strategy | Implementation |
|---|---|
| **Form validation** | ⚠️ `mode: "onChange"` — consider `mode: "onBlur"` for mobile |
| **Shipping zone selection** | ✅ Fast — local state update |
| **Payment method** | ✅ Fast — radio toggle |

### C. Order Submission — Target: <2s

| Strategy | Implementation |
|---|---|
| **Single API call** | ✅ Already one POST |
| **Server db.batch()** | ✅ Atomic, single DB round-trip |
| **Optimistic redirect** | ❌ UNSAFE — order must be confirmed before redirect |
| **Loading state** | ✅ Spinner on button during isPending |

### D. Payment Processing — Not applicable

COD (Cash on Delivery) — কোনো real-time payment processing নেই। Order placement সরাসরি DB write।

---

## ২৫. Page-by-Page Performance

### Home

| Aspect | অবস্থা | বিস্তারিত |
|---|---|---|
| **Data fetching** | ✅ GOOD | Server-side parallel fetch, cached |
| **LCP** | ✅ GOOD | Hero image priority, Cloudinary CDN |
| **JS** | ⚠️ ACCEPTABLE | Client-layout hydration overhead |
| **Images** | ✅ GOOD | Responsive sizes, lazy loading for non-hero |
| **CLS** | ✅ GOOD | Fixed-height hero container |
| **Caching** | ✅ GOOD | 24h ISR + tag invalidation |

### Category

| Aspect | অবস্থা |
|---|---|
| **Data fetching** | ✅ Server-side category data |
| **Images** | ✅ Cloudinary transform |
| **Caching** | ✅ Tag-based invalidation |

### Product

| Aspect | অবস্থা | বিস্তারিত |
|---|---|---|
| **Data fetching** | ✅ GOOD | `unstable_cache` + `react cache` dedup |
| **LCP** | ✅ GOOD | Main image `priority=true` |
| **JS** | ⚠️ ACCEPTABLE | ProductPicker 22KB — complex variant selection |
| **Images** | ⚠️ ACCEPTABLE | Thumbnails lazy, main priority — কিন্তু lightbox lazy import ✅ |
| **Related products** | ⚠️ ACCEPTABLE | `getPublicProducts()` sequential after main product fetch |

**Optimization**: Product ও related products parallel fetch করুন — `Promise.all([getProductById(id), getPublicProducts()])`.

### Cart

| Aspect | অবস্থা |
|---|---|
| **Data source** | ✅ Zustand store (local) + localStorage (guest) |
| **Images** | ✅ Small thumbnails |
| **Interaction** | ✅ Fast — local state update |
| **Network** | ⚠️ `addToCart` calls auth API |

### Checkout

Detailed in sections ২২-২৪.

---

## ২৬. Performance Opportunity Matrix

| Issue | Page | Metric | Impact | Difficulty | Priority |
|---|---|---|---|---|---|
| Monolithic API route bundle | All API | TTFB (cold start) | HIGH | MEDIUM | CRITICAL |
| useLanguage per-component state | All storefront | TBT, CLS | MEDIUM | MEDIUM | HIGH |
| Wishlist fetch on checkout | Checkout | TTFB | MEDIUM | LOW | HIGH |
| Client-layout hydration scope | All storefront | TBT | MEDIUM-HIGH | MEDIUM | HIGH |
| Double hasMounted skeleton | Checkout | FCP | LOW | LOW | HIGH |
| 254KB favicon | All pages | Payload | MEDIUM | LOW | MEDIUM |
| Unoptimized public PNGs | Home (fallback) | LCP | MEDIUM | LOW | MEDIUM |
| date-fns in utils.ts | All | Bundle size | LOW | LOW | MEDIUM |
| Order summary image missing sizes | Checkout | Image payload | LOW | LOW | MEDIUM |
| ProductCard Dialog always mounted | Shop/Home | DOM size, TBT | LOW-MEDIUM | LOW | MEDIUM |
| Product page sequential fetch | Product | TTFB | LOW | LOW | LOW |
| Cart addToCart auth check | Product/Shop | Interaction latency | LOW | MEDIUM | LOW |
| Footer as client component | All storefront | TBT | LOW | MEDIUM | LOW |

---

## ২৭. Recommended Performance Budget

### Checkout Page (Mobile, 4G)

| Metric | Target |
|---|---|
| **TTFB** | <800ms |
| **FCP** | <1.5s |
| **LCP** | <2.0s |
| **TBT** | <200ms |
| **CLS** | <0.05 |
| **INP** | <200ms |
| **Initial JS (compressed)** | <150KB |
| **Critical requests** | ≤5 |
| **Image requests** | ≤5 (cart item thumbnails) |
| **Third-party scripts** | ≤1 (GTM only, deferred) |

### Home Page (Mobile, 4G)

| Metric | Target |
|---|---|
| **TTFB** | <600ms (ISR cache hit) |
| **FCP** | <1.2s |
| **LCP** | <2.5s |
| **TBT** | <300ms |
| **CLS** | <0.1 |
| **Initial JS (compressed)** | <200KB |

**এগুলো RECOMMENDED TARGETS — measured values নয়।**

---

## ২৮. Optimization Roadmap

### Phase 1 — Immediate High Impact (1-3 দিন)

1. ✅ **favicon.ico optimize** — 254KB → ~5KB (ICO format, 32x32)
2. ✅ **Remove wishlist fetch on checkout** — Navbar-এ pathname check
3. ✅ **Eliminate double hasMounted** — ShippingInformationCard-এর pattern remove
4. ✅ **Add `sizes` to order summary images** — `sizes="40px"`
5. ✅ **Public PNG optimization** — WebP convert

### Phase 2 — Before Production (1-2 সপ্তাহ)

6. 🔧 **Centralize useLanguage** — Zustand store বা Context-এ move
7. 🔧 **Product page parallel fetch** — `Promise.all` for product + related
8. 🔧 **Footer server component** — language switcher আলাদা client component
9. 🔧 **ProductCard Dialog lazy render** — render only when `isDrawerOpen`

### Phase 3 — Advanced Optimization (2-4 সপ্তাহ)

10. 🔧 **API route splitting** — checkout, cart, auth আলাদা route files
11. 🔧 **date-fns import optimization** — separate file বা subpath imports
12. 🔧 **Cart addToCart flow** — auth check eliminate (use cached data)
13. 🔧 **Cookie-based language** — server-side correct language render

### Phase 4 — Optional Optimization

14. ⚙️ **Navbar partial server rendering** — static parts server, interactive parts client
15. ⚙️ **Streaming for product page** — Suspense boundary for reviews
16. ⚙️ **Prefetch checkout on cart open** — `router.prefetch('/checkout')`

---

## ২৯. Top 10 Highest-Impact Performance Improvements

### 1. Monolithic API Route Splitting

- **সমস্যা**: 25টি feature module একটি serverless function-এ bundle হচ্ছে
- **কোথায়**: `app/api/[[...route]]/route.ts`
- **কেন গুরুত্বপূর্ণ**: Cold start time বৃদ্ধি, memory usage বৃদ্ধি — checkout API-র latency প্রভাবিত
- **কীভাবে ঠিক করতে হবে**: Checkout, cart, auth, products-কে আলাদা route files-এ move করুন
- **Expected Benefit**: Cold start 30-50% faster, memory ~40% less
- **Difficulty**: MEDIUM
- **Affects**: ✅ Lighthouse, ✅ Core Web Vitals (TTFB), ✅ Checkout, ✅ Mobile

### 2. useLanguage Centralization

- **সমস্যা**: প্রতি component-এ independent localStorage read + state
- **কোথায়**: `hooks/use-language.ts` + 10+ consumer components
- **কেন গুরুত্বপূর্ণ**: Hydration mismatch (bn→en), multiple re-renders, TBT বৃদ্ধি
- **কীভাবে ঠিক করতে হবে**: Zustand store-এ centralize + cookie-based server detection
- **Expected Benefit**: TBT 10-20% reduction, CLS elimination for language mismatch
- **Difficulty**: MEDIUM
- **Affects**: ✅ Lighthouse, ✅ Core Web Vitals (TBT, CLS), ✅ Mobile

### 3. Checkout Unnecessary Network Requests

- **সমস্যা**: Wishlist fetch + potential duplicate requests on checkout
- **কোথায়**: `components/nav-bar.tsx`, `client-layout.tsx`
- **কেন গুরুত্বপূর্ণ**: Checkout interactivity delay, bandwidth waste
- **কীভাবে ঠিক করতে হবে**: Navbar-এ checkout path detect করে skip
- **Expected Benefit**: Checkout interactive 100-200ms faster
- **Difficulty**: LOW
- **Affects**: ✅ Checkout, ✅ Mobile

### 4. favicon.ico Optimization

- **সমস্যা**: 254KB favicon
- **কোথায়**: `app/favicon.ico`
- **কেন গুরুত্বপূর্ণ**: প্রতিটি নতুন visitor 254KB extra download করে
- **কীভাবে ঠিক করতে হবে**: 32x32 ICO format-এ optimize (~5KB)
- **Expected Benefit**: 240KB less per new visit
- **Difficulty**: LOW
- **Affects**: ✅ Lighthouse, ✅ Mobile

### 5. Client Layout Hydration Reduction

- **সমস্যা**: Footer + Testimonials + Newsletter সবসময় hydrate হচ্ছে
- **কোথায়**: `app/(client)/client-layout.tsx`
- **কেন গুরুত্বপূর্ণ**: Low-end mobile-এ 100-200ms extra TBT
- **কীভাবে ঠিক করতে হবে**: Footer-কে server component, Testimonials/Newsletter lazy load
- **Expected Benefit**: TBT 20-30% reduction
- **Difficulty**: MEDIUM
- **Affects**: ✅ Lighthouse, ✅ Core Web Vitals (TBT), ✅ Mobile

### 6. ProductCard Dialog Lazy Render

- **সমস্যা**: প্রতিটি ProductCard-এ Radix Dialog mount হচ্ছে (closed অবস্থাতেও)
- **কোথায়**: `components/product/product-card.tsx`
- **কেন গুরুত্বপূর্ণ**: 8+ cards = 8+ Dialog DOM trees — DOM size বৃদ্ধি
- **কীভাবে ঠিক করতে হবে**: `{isDrawerOpen && <Dialog>...</Dialog>}` pattern
- **Expected Benefit**: DOM nodes 30-40% reduction on listing pages
- **Difficulty**: LOW
- **Affects**: ✅ Lighthouse (DOM size), ✅ Mobile

### 7. Double Skeleton Elimination on Checkout

- **সমস্যা**: CheckoutClient ও ShippingInformationCard দুটোতেই hasMounted pattern
- **কোথায়**: `checkout-client.tsx`, `shipping-information-card.tsx`
- **কেন গুরুত্বপূর্ণ**: Extra render cycle — user skeleton দেখে, তারপর content, তারপর আবার skeleton, তারপর content
- **কীভাবে ঠিক করতে হবে**: ShippingInformationCard-এর hasMounted remove (parent already handles)
- **Expected Benefit**: Checkout form 50-100ms faster visible
- **Difficulty**: LOW
- **Affects**: ✅ Checkout, ✅ Core Web Vitals (FCP)

### 8. Public Asset Optimization

- **সমস্যা**: hero-banner PNGs ~850KB each, dark-logo 254KB
- **কোথায়**: `public/` directory
- **কেন গুরুত্বপূর্ণ**: Fallback scenario-তে massive downloads
- **কীভাবে ঠিক করতে হবে**: WebP conversion + logo optimization
- **Expected Benefit**: ~2MB less in fallback scenarios
- **Difficulty**: LOW
- **Affects**: ✅ Lighthouse, ✅ Mobile

### 9. Product Page Parallel Data Fetching

- **সমস্যা**: Product fetch → then related products fetch (sequential)
- **কোথায়**: `app/(client)/shop/[productId]/page.tsx`
- **কেন গুরুত্বপূর্ণ**: TTFB বৃদ্ধি
- **কীভাবে ঠিক করতে হবে**: `Promise.all([getProductById(id), getPublicProducts()])`
- **Expected Benefit**: Product page TTFB 30-50% improvement
- **Difficulty**: LOW
- **Affects**: ✅ Core Web Vitals (TTFB), ✅ Lighthouse

### 10. Order Summary Image Sizes

- **সমস্যা**: `<Image fill>` without `sizes` prop in order summary
- **কোথায়**: `features/checkout/components/order-summery-card.tsx`
- **কেন গুরুত্বপূর্ণ**: Browser full-width image request করবে 40px container-এর জন্য
- **কীভাবে ঠিক করতে হবে**: `sizes="(max-width: 1024px) 40px, 56px"` add
- **Expected Benefit**: Checkout image payload 80-90% reduction
- **Difficulty**: LOW
- **Affects**: ✅ Checkout, ✅ Mobile

---

## ৩০. Final Conclusion

### কোথায় ভালো

Sleep Sheet-এর performance architecture সামগ্রিকভাবে **GOOD level-এ** আছে:

- **Server-side data fetching** excellent — in-process route calling, multi-layer caching, tag-based invalidation
- **Image optimization** well-implemented — Cloudinary CDN, responsive sizes, priority LCP
- **Font strategy** correct — critical fonts preloaded, non-critical deferred
- **Checkout data flow** efficient — atomic db.batch(), fire-and-forget notifications, idempotency protection
- **ISR caching** properly configured — 24h revalidation with instant invalidation on write

### কোথায় Bottleneck

1. **Monolithic API bundle** — সবচেয়ে বড় architectural bottleneck, cold start ও memory-র উপর significant impact
2. **Client-side hydration scope** — Navbar + Footer + providers সব page-এ hydrate হচ্ছে
3. **useLanguage pattern** — decentralized state, hydration mismatch risk
4. **Oversized static assets** — favicon (254KB), public PNGs

### সবচেয়ে বেশি Impact কোন Optimizations দেবে

1. **API route splitting** → Checkout cold start dramatically faster
2. **useLanguage centralization** → TBT ও CLS improvement across all pages
3. **Checkout network request reduction** → Faster checkout interactivity
4. **favicon + public asset optimization** → Immediate payload reduction

এই codebase-এ কোনো **WORST** (catastrophic) performance issue নেই। প্রতিটি recommended optimization incremental improvement — কিন্তু তাদের combined effect, বিশেষত Bangladesh-এর low-end mobile users-দের জন্য, significant হবে।

> **এটি static code analysis-এর ভিত্তিতে সম্ভাব্য performance assessment; actual measurement নয়।** Production-এ Lighthouse, Chrome DevTools Performance tab, এবং Vercel Analytics দিয়ে validate করুন।
