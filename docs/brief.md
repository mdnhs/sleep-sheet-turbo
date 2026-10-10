# Single-Store Completion: Brief

| | |
|---|---|
| Status | Draft, awaiting owner review |
| Date | 2026-10-10 |
| Process | superpowers brainstorming, architectural path |
| Companion | [`plan.md`](plan.md): roadmap, plus the detailed plan for SP-0 |
| Previous brief | [`audit-2026-09-21/`](audit-2026-09-21/) (audit remediation, archived) |

This is a program-level spec. It splits the work into sub-projects (SP-0 … SP-7) and decides the direction for each. Each sub-project gets its own design pass and its own detailed implementation plan before work starts. Only SP-0 is planned in detail so far (see `plan.md`).

The analysis behind this brief was discussed with the owner in Bangla on 2026-10-10.

---

## 1. Intent

### What the owner asked for
- **No SaaS yet.** First make this one store (Sleep Sheet) complete and self-sufficient, built so that turning it into SaaS later is easy.
- **Bangladesh-specific growth:** more features for the Bangladeshi e-commerce market; more accurate, more dynamic and more customizable; theme support; an AI assistant.
- **Social AI chat:** an n8n workflow connected to the admin panel. The owner plugs in their own AI API key and switches on AI chat for the Facebook Page and WhatsApp.

### Assumptions (confirm in review)
- **"Marketplace"** means the Bangladeshi e-commerce market. It does not mean a multi-vendor platform like Daraz.
- **"Accurate"** covers four things:
  - the right address and delivery charge
  - correct stock
  - correct order status and profit numbers
  - catching fake COD orders
- **"Theme support"** means changing colours, fonts, layout and home sections from the admin, plus a few ready-made presets. It does not mean separate storefront designs.
- **Performance stays.** The Core Web Vitals gains from the 2026-10-10 performance pass must not be lost.

### Success criteria
| Area | Criterion |
|---|---|
| Security | Every SP-0 issue is closed and has a test. A CI typecheck, lint or test failure blocks the deploy. |
| Dynamic | No store name, address, phone or tracking ID is hardcoded in app code. `grep -rn "Sleep Sheet"` matches only the settings defaults and tests. |
| Customizable | These change from the admin with no deploy: colours, fonts, home section order and visibility, menus, policy pages. |
| Accuracy | The server computes the delivery charge from the address. The stock ledger total equals current stock. Per-order net profit includes courier and return costs. |
| Fake orders | The COD return rate is measured monthly (baseline taken before SP-2) and falls after SP-2. |
| AI | The copilot answers a fixed list of 20 owner questions correctly. The Messenger bot answers product, price, delivery and order-status questions, and staff can take over a chat. |
| Performance | After each sub-project, mobile Lighthouse for Home, Product and Checkout is no more than 3 points below the baseline, and CLS ≤ 0.1. |

---

## 2. Baseline (2026-10-10)

**Stack**
- Next.js 16.3.5 (App Router)
- Hono API in `app/api/[[...route]]`
- Drizzle with Postgres 18
- Docker on a Mumbai VPS, deployed by Dokploy from GitHub Actions through GHCR
- Cloudflare in front; Cloudinary for media
- Self-hosted n8n, which sends Telegram order alerts

**What exists**
- **Orders:** bulk invoice, packing list, Steadfast bulk booking, Sheets booking, refunds
- **POS**
- **Finance:** P&L with expenses
- **Dashboard:** KPIs, cohorts, CLV
- **Fraud and access:** BDCourier fraud checker, IP block, custom roles (12 modules), audit log
- **Payments:** bKash
- **Marketing:** Meta and Google feeds, server-side GTM
- **Content:** video reels, blog, testimonials
- **Integrations:** MCP server with OAuth

**Verified security issues** (each checked in code)
1. The raw API key is stored and returned by the list endpoint (`features/api-keys/server/route.ts:31`, `:62`).
2. `settings:write` alone can overwrite the bKash, Steadfast, Cloudinary and Sheets secrets. Reading them is ADMIN-only; writing is not (`features/settings/server/route.ts:219`).
3. `users:write` lets a user do three things (`features/users/server/route.ts:114-215`):
   - reset the password of anyone except the super admin
   - assign any role to any user, including themselves
   - and on top of that, `roles:write` accepts any permission string
4. The client IP comes from the leftmost `X-Forwarded-For` entry, which the client can forge. Affected places:
   - `lib/rate-limit.ts:39`
   - `lib/blocked-ip.ts:10`
   - `features/activity/server/log-activity.ts:139`
   - `features/pos/server/route.ts:125`
5. `GET /api/orders/by-phone` returns name, address, note and order ids to anyone, with no login (`features/order/server/route.ts:874`).
6. `GET /api/orders/:id` returns `items[].costPrice` and the full product row (add-on cost prices included) to customers (`features/order/server/route.ts:941`).
7. Anyone who knows an order id can cancel a pending bKash order through the callback (`features/bkash/server/route.ts:28`).
8. Steadfast `/book` never checks for an existing tracking number, so an order can be booked twice (`features/steadfast/server/route.ts:149`).
9. JWTs last 7 days and cannot be revoked. The archived 2026-09-21 audit deferred this.

**Quality**
- `pnpm typecheck` passes.
- 21 test files, 224 tests pass.
- `pnpm lint` reports 6 errors and 191 warnings.
- CI runs no checks, and the Docker build sets `SKIP_BUILD_TYPECHECK=1`.
- No error monitoring.

**Performance** (mobile Lighthouse, headless, about ±10 noise)
- Home 73–83, Product 77–83, Checkout 77–85
- Best Practices 100
- TBT 10–70 ms

---

## 3. Principles and constraints

### Performance budget
- New storefront features are either server-rendered or lazy-loaded after load + idle (`lib/after-load-idle.ts`).
- Theme values are CSS variables rendered on the server, so they add no client JS.
- Each sub-project ends with a mobile Lighthouse comparison (Home, Product, Checkout) against the baseline.

### Bangladesh first
bKash, Nagad, COD, Steadfast/Pathao/RedX, districts/thanas and Bangla are core features, not edge cases. They become configurable (a future "region pack"), never removed.

### SaaS-ready rules (no `tenant_id` yet)
1. **No store values in code.** Store-specific values live in the settings registry (SP-1), not in code.
2. **Adapters for external services.** Every external service sits behind an adapter interface. Config and secrets live in the DB, encrypted.
3. **Data access in one place.** New data access goes through feature-level service/repository functions, not inline queries in route handlers, so a tenant filter can later be added in one place.
4. **Cache tags from one helper.** Cache tags come from a single `cacheTag()` helper, so a store prefix can be added later.
5. **Secrets stay protected.** Secrets are encrypted at rest and never logged.

### Security rules
- **Least privilege:** nobody can grant themselves or anyone else more than they hold.
- **Public bots never get admin tools.**
- **The client IP comes only from a trusted header**, and the origin accepts traffic only from Cloudflare.

### Engineering rules
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).
- **Migrations:** write `db/migrations/NNNN_name.sql` and update `db/schema.ts` in the same change. The owner applies the SQL by hand with `psql`. Never run `drizzle-kit migrate` / `db:migrate`.
- Business rules are TDD'd with vitest. Route rules are extracted into pure functions so they can be tested without a running server.
- Commit directly to `main`. A push to `main` deploys to production.

---

## 4. Sub-projects

### SP-0: Safety (security + quality gate), ~1 week
**Status: done 2026-10-11** (deployed `cfcd01e`). Still open: drop `api_keys.rawKey` (0032) after soak, Dokploy backup destination + schedule, close Postgres port 5434, Cloudflare-only origin firewall. See `deploy/README.md` §6–8.

**Goal:** close the verified security holes and stop broken code from reaching production.

**Scope** (each item is a task in `plan.md`)
- **S1, trusted client IP.**
  - One `getClientIp()` in `lib/client-ip.ts` that prefers `CF-Connecting-IP`.
  - It is used by rate limiting, IP blocking, the audit log and POS.
- **S2, API keys hash-only.**
  - Stop writing and returning `api_keys.rawKey`, and null the existing values.
  - The key is shown once, at creation.
- **S3, secret settings.** Secret keys in the settings PATCH are writable by ADMIN only (403 otherwise).
- **S4, privilege containment.**
  - A caller can grant (roles) or assign (users) only permissions they hold.
  - A caller cannot change their own role.
  - A caller cannot reset the password or change the role of a user with privileges they lack, including any system ADMIN.
  - Role permission strings are validated against `MODULES`.
- **S5, session revocation.**
  - Add `User.tokenVersion`, carried in the JWT.
  - The three DB-backed session readers reject stale tokens: `lib/session-middleware.ts`, `lib/get-session-user.ts` and `lib/is-authenticated.ts`.
  - The version is bumped whenever a password is reset or changed. Role changes need no bump: permissions are re-read from the DB on every request, so they already take effect on the next one.
- **S6, track-order privacy.**
  - A phone-only lookup returns no name, address, note or order id.
  - Full details require phone + order number.
- **S7, customer order view.** `/api/orders/:id` returns a whitelisted shape to non-staff: no cost prices and no full product row.
- **S8, bKash callback.** A cancel/failure callback settles the order only when the paymentID matches the one issued for that order.
- **S9, Steadfast double booking.** `/book` returns 409 when a tracking number already exists, unless the request sends `force: true`.
- **S10, quality gate.**
  - Fix the 6 lint errors.
  - Add a GitHub Actions `verify` job (typecheck, lint, test) that the image build depends on.
- **S11, error alerting.**
  - Hono `onError` returns a generic 500 and logs the error.
  - It sends a throttled alert through n8n to Telegram, using the optional `N8N_ERROR_WEBHOOK_URL`.
- **S12, operations.**
  - A backup restore drill proves backups run.
  - Lock the origin firewall to Cloudflare IP ranges.

**Benefits:** customer data and payment credentials are protected, and a broken commit can no longer reach production.

**Acceptance**
- Each of S1–S9 has a vitest test that failed before the fix.
- `pnpm typecheck && pnpm lint && pnpm test` pass locally and in CI.
- A deliberately broken commit fails `verify`, and no image is pushed.
- The restore drill's date and result are recorded in `deploy/README.md`.

### SP-1: Settings engine and store profile, 1–2 weeks
**Goal:** every store-specific value comes from typed settings editable in the admin, and secrets are encrypted at rest.

**Design decisions**
- **Registry.**
  - Keep `site_settings (key, value)` and add a typed registry, `lib/settings/registry.ts`.
  - Each key declares its group, zod schema, default, `secret` flag, `public` flag and write permission (`settings:write` or ADMIN).
  - The settings PATCH validates against the registry instead of its hand-written zod object (~80 keys).
- **Typed reads.**
  - `getSetting(key)` and `getSettingsGroup(group)` cache each group under the tags `settings` and `settings:<group>`.
  - They replace the ad-hoc readers in `lib/settings-cache.ts` and `lib/server-config.ts`.
- **Encryption.**
  - Secrets use AES-256-GCM with `SETTINGS_ENCRYPTION_KEY`; stored values start with `enc:v1:`.
  - A one-off script encrypts the existing rows.
  - Reads decrypt transparently.
- **Store profile `store.*`.**
  - Fields: name, legal name, logo, phone, email, address, city, DBID, trade licence, BIN, social links, locale, timezone.
  - The constants in `lib/seo/config.ts` become defaults only.
  - These read the profile: `generateMetadata`, JSON-LD, manifest, OG image, invoice and footer.
- **Dead keys.**
  - These are saved but never read: `seo_default_title`, `seo_site_name`, `gtm_server_id`, `gtm_server_url`.
  - Wire each one up or delete it.
- **Business rules group:** order-number prefix, low-stock threshold, invoice language, default product filter (today hardcoded "Comforters"), timezone.
- **White-label clean-up.**
  - Remove the hardcoded fallbacks: the GTM ID/host, the GA4 property and the n8n URL.
  - Remove the `LUXSTORE` fallback and the `luxstore.lenishmagar.me` image host.
  - Rename the `luxestore-session` cookie. This logs everyone out once, so schedule it.
- **`cacheTag()` helper** for every cache tag (SaaS rule 4).
- **`ai` group.** Provider, per-task model, encrypted key and budgets. It is defined here, and its UI ships with whichever of SP-5a or SP-5b comes first.

**Benefits:** no developer or deploy is needed to change store details. Theme, couriers, AI and notifications all read from one place, and multi-store later means scoping this one table.

**Acceptance**
- `grep -rn "Sleep Sheet" app components features lib hooks` matches only `lib/settings/defaults.ts` and tests.
- Changing the store name or phone in the admin updates page titles, JSON-LD, footer and invoice after saving, with no deploy.
- Secret rows start with `enc:v1:` (checked with psql).
- Tests cover the registry, the crypto and the write permissions.

### SP-2: Bangladesh checkout and delivery accuracy, 2–3 weeks
**Goal:** correct address, delivery charge, stock and profit, and fewer fake COD orders.

**Design decisions**
- **Location data.**
  - Static JSON in `lib/bd-locations/`: division → district → upazila/thana, plus Dhaka city areas, with Bangla and English names.
  - Lazy-loaded at checkout.
  - Source: a vetted open dataset, for example `nuhil/bangladesh-geocode`, after a licence check.
- **Checkout** collects district, thana/upazila and an address line. The server derives `shippingZone` and never trusts the client's value.
- **Shipping zones.**
  - A `shipping_zones` table: name (bn/en), matching districts/upazilas, base charge, per-kg charge, free-over threshold, COD allowed, ETA min/max days, sort order, plus a fallback zone.
  - Product pages show the ETA.
  - The SP-2 design pass decides whether to extend the existing `shipping_methods` table instead.
- **Weight.** `products.weightGrams` feeds both the charge and courier booking (Pathao needs a weight).
- **Smart COD**, a rules engine evaluated at checkout.
  - Inputs:
    - BDCourier success ratio, cached 24 h per phone
    - our own cancel/return history for that phone
    - order total and zone
    - blocklists
  - Actions: allow, require an advance (delivery charge or a %) via bKash, flag for review, or block.
  - Rules are edited in the admin, and every decision is logged on the order.
  - If BDCourier is down, the default is allow + flag (configurable).
  - An OTP action becomes available once SP-4 adds an SMS channel.
- **Order lifecycle.**
  - Every status change goes through one `transitionOrder()` service with an allowed-transition table and a timeline event.
  - The admin gets a manual status control, and courier sync uses the same service.
  - The SP-2 design pass decides the exact status set (for example packed and returned) after checking the impact on reports.
- **Inventory.**
  - `product_variants` holds SKU, stock and price per variant.
  - A `stock_movements` ledger records order, cancel, return, POS and manual adjustments, each with a reason and the actor.
  - A courier "returned" status restocks automatically.
  - The low-stock threshold comes from settings.
- **Profit.** Net profit per order in reports uses the product-level `costPrice` default, the actual courier charge and the return cost.

**Benefits**
- Every returned parcel costs a delivery charge plus a return charge, so fewer fake COD orders save money directly.
- Fewer disputes about delivery charges.
- Trustworthy profit numbers.

**Acceptance**
- Checkout cannot submit without a district and thana, and the delivery fee charged equals the zone table (server test).
- COD rule decisions are stored on the order and shown in the admin.
- For every variant, the `stock_movements` total equals current stock (consistency test).
- The P&L shows net profit including courier and return costs.

### SP-3: Theme system, 2–3 weeks
**Goal:** change the storefront's look, sections and content from the admin with no deploy and no CWV regression.

**Design decisions**
- **Tokens.**
  - `--brand`, `--brand-foreground`, `--brand-gradient-from`, `--brand-gradient-to`, plus radius and font variables.
  - Mapped in Tailwind v4 `@theme inline` to utilities such as `bg-brand`, plus a `bg-cta-gradient` class.
  - Replace the hardcoded brand hex values: `#B8245A` ×35, `#FF6FA5` ×23 and about 80 inline `bg-[#…]` classes, including the Order Now gradients added on 2026-10-10.
- **Rendering.** The root layout renders the active theme as a server `<style>` block from the `theme` settings group. No client JS, no layout shift.
- **Presets.** 4–6 presets live in code, and the owner can override individual tokens. Dark mode (`next-themes`) is already in place.
- **Fonts.** A curated set declared with `next/font` (only the default is preloaded), switched by a CSS variable.
- **Seasonal schedule.**
  - `theme.schedule[]` entries (preset or overrides, startsAt, endsAt) cover Eid, Puja, Pohela Boishakh and 11.11.
  - The active theme is resolved at render.
  - Pages are ISR-cached for 24 h, so the cron container calls the internal revalidate endpoint at each boundary.
- **Home section builder.**
  - `home.sections[]` entries: id, type, variant, enabled, props, optional schedule.
  - Rendered through a registry of the existing components: Hero, Categories, ProductVideos, NarrowBanner, FeaturedProduct, SubcategoryProducts, BlogCarousel, Testimonials, Newsletter, SeoContent.
  - Drag-and-drop editing with `@dnd-kit`, which is already installed.
- **Menus.** Header/footer menus and an announcement bar are settings.
- **CMS pages.**
  - A `pages` table: slug, title (bn/en), markdown body (bn/en), SEO fields, published flag.
  - It replaces the store copy hardcoded in `hooks/use-language.ts` (about, FAQ, policies).

**Benefits**
- Campaign and festival looks without a developer.
- Every future store can look different, which is a SaaS selling point.

**Acceptance**
- Brand colour, font and section order/visibility change from the admin and show after saving, with no deploy.
- A grep finds no brand hex literals in `components/` or `features/`.
- Mobile Lighthouse for Home and Product stays within 3 points of the pre-SP-3 baseline, and CLS ≤ 0.1.

### SP-4: Courier, payment and notification hub, 3–4 weeks
**Goal:** pluggable couriers, payments and customer notifications, with retries.

**Design decisions**
- **Couriers.**
  - A `CourierProvider` interface: quote, book, track, cancel, parseWebhook, testConnection.
  - Steadfast becomes the first adapter; Pathao and RedX are added.
  - `courier_area_map` maps our district/thana to each courier's city/zone/area ids. It is seeded from the courier APIs, with manual overrides in the admin.
- **Selection and status.**
  - Courier selection rules (zone, price, success rate) live in settings.
  - Status updates arrive at `/api/webhooks/courier/:provider`, verified with a shared secret. Polling stays as a fallback.
- **COD reconciliation.** Import courier payouts (API or CSV), match them to delivered orders, and list missing money.
- **Payments.**
  - A `PaymentProvider` interface.
  - bKash is refactored to fit it; Nagad and SSLCommerz are added.
  - Add the bKash refund API.
- **Notifications.**
  - A `NotificationChannel` interface for SMS, email and, later, WhatsApp templates over SP-5b's connection.
  - Templates in Bangla and English with variables.
  - Triggers: order placed, confirmed, shipped (with tracking link), delivered, review request.
  - The SP-4 design pass picks the SMS gateway (the owner's existing account is preferred).
- **Reliability.**
  - A transactional outbox table plus a `pg-boss` worker, running as a second container from the same image.
  - Retries, with a dead-letter list in the admin.
  - HMAC-signed outbound webhooks (n8n).
- **Integrations page.** One card per provider: enable switch, encrypted credentials (SP-1), Test button, health and last error.

**Benefits**
- Fewer "where is my order" calls.
- Fewer refusals at the door after an SMS confirmation.
- Cheaper courier choices.
- Money is reconciled.

**Acceptance**
- One booking UI works for all three couriers, and status updates arrive by webhook.
- Each trigger sends exactly once (idempotent) with retries, and failures are visible.
- Unmatched COD payouts are listed.

### SP-5a: AI copilot and content AI, 2–3 weeks
**Goal:** run the store by chatting in Bangla, and generate content inside the existing forms.

**Design decisions**
- **Library and key.**
  - The AI SDK is provider-agnostic. Version 7 needs Node 22 or later; the Docker image is already `node:22`. Check the API against the installed package docs.
  - It uses the owner's own key (BYOK) from the `ai` settings group.
- **Copilot.**
  - A dashboard side panel with streaming.
  - Its tools are the existing MCP tool registry (`lib/mcp-tools.ts`), run with the signed-in staff member's permissions.
  - Any write tool needs an explicit confirm click.
  - It answers in the user's language.
- **Content AI.** "Write with AI" buttons for:
  - product description (bn/en, SEO)
  - meta title and description
  - image alt text
  - blog draft
  - Facebook caption
  - review reply
- **Daily owner summary** (sales, profit, risky orders, low stock), sent over the existing n8n → Telegram path.
- **Cost control.** A usage log (tokens, estimated cost) and hard budget caps.

**Acceptance**
- The copilot answers the fixed list of 20 owner questions (the list is written in the SP-5a design) correctly.
- Nothing is written without a confirmation.
- A staff member without `orders:read` cannot read orders through the copilot (test).
- Spending stops at the cap.

### SP-5b: Social AI chat (Messenger + WhatsApp via n8n), 3–4 weeks + Meta setup
**Goal:** AI replies on the Facebook Page and WhatsApp using the owner's AI key, with staff takeover and chat orders.

**Architecture: the store is the gateway and n8n is the AI brain.** This was chosen over an n8n-only option, which has no Inbox and no takeover, and over an app-only option, which has no visual editor. It also lets the brain move into the app later.

```
Customer (Messenger / WhatsApp)
        │ message
        ▼
Store app  /api/webhooks/meta
  • verify Meta signature, 200 immediately
  • save message (idempotent) → admin Inbox
  • bot off, or staff handling this chat? → stop
        │
        ▼
n8n "social-ai-agent" workflow
  • AI Agent with the owner's key and model
  • conversation memory
  • tools → store Bot API (restricted):
      product search/details · delivery quote
      order status (phone + order no.) · order request · ask for a human
        │ reply / handover
        ▼
Store app → Meta Send API → customer   (+ saved to Inbox)
```

**Components**
- **Webhook gateway** at `/api/webhooks/meta`.
  - GET answers the verify-token challenge.
  - POST checks `X-Hub-Signature-256` with the app secret and dedupes on message id.
  - It answers 200 straight away and processes after the response.
- **Tables.**
  - `conversations`: channel, external user id, linked customer, mode (`bot` | `human` | `closed`), assignee, bot-paused-until, last-message-at.
  - `conversation_messages`: direction, author (customer | bot | staff), text, attachments, unique external id.
- **Admin Inbox.**
  - Shows every chat; staff reply from here.
  - "Take over" pauses the bot.
  - A reply sent from Meta Business Suite (an echo event not sent by our app) also switches the chat to human mode.
- **Bot API** at `/api/bot/*`.
  - Endpoints:
    - product search and details
    - delivery quote
    - order status, only when phone and order number both match
    - create an order request (pending, source `messenger` or `whatsapp`, with the Facebook page set)
    - request a human
  - Authenticated by an API key with `scope = 'bot'` (new column `api_keys.scope`).
  - A bot-scoped key is rejected everywhere outside `/api/bot/*`.
- **n8n template** at `integrations/n8n/social-ai-agent.json`.
  - Flow: Webhook → AI Agent → memory → HTTP tools that call the Bot API.
  - The admin manages it through the n8n public API (`N8N_API_URL`, `N8N_API_KEY`):
    - creates the credential for the AI key
    - creates and updates the workflow
    - activates and deactivates it
    - reads failed executions to show health
- **AI key.** Entered once in the admin AI settings and stored encrypted (SP-1). It is pushed to an n8n credential when social chat is switched on.
- **Admin "AI Chat" page.**
  - Channel connection with a Test button.
  - Persona: name, tone, and language. The bot replies in the customer's language, Banglish included.
  - Knowledge: pulled automatically from settings, plus free FAQ text.
  - Rules: never invent discounts, handover triggers, business hours.
  - Per-channel switches.
  - A playground for testing.
  - Stats: messages, chat orders, failures.
- **Limits:** a per-conversation rate limit, a maximum number of bot replies per day, a maximum message length.

**Rollout**
- **v1:** Messenger Q&A, takeover, Inbox, playground.
- **v2:** chat orders, plus private replies that move comments to the inbox.
- **v3:** WhatsApp (Cloud API).
- **v4:** photo search, voice notes.

**External constraints** (checked 2026-10-10; sources in §9)
- **Messenger.**
  - App Review is not required to send and receive messages for your own Page.
  - Other businesses' Pages, which SaaS would need, require Advanced Access, App Review and business verification.
  - The customer must start the conversation, and replies must come within 24 h.
- **WhatsApp pricing (Cloud API).**
  - Meta's pricing page says non-template messages inside the customer-service window are free, and templates are billed per message.
  - Bangladesh utility and authentication rates were lowered from 2026-10-01.
  - Some third-party sites claim service messages became billable in October 2026. Re-check the rate card before launch.
- **WhatsApp number.** A Cloud API number usually cannot also be used in the phone app. Check whether "coexistence" is available in Bangladesh.
- **WhatsApp AI policy.** Since 2026-01-15 Meta bars general-purpose AI assistants from the WhatsApp Business Platform. Customer-support bots for a business's own products and orders are allowed.
- **Unofficial WhatsApp APIs** (Evolution API, Baileys, whatsapp-web.js) break WhatsApp's terms and risk a number ban. They are not used.
- **n8n Sustainable Use License.**
  - Use for the owner's own store is fine.
  - For SaaS, end users may connect their own credentials to automations we built. They may not build or configure their own workflows.
  - Multi-tenant setups need a conversation with n8n sales.

**Acceptance**
- The Messenger bot answers product, price, delivery-charge and order-status questions in Bangla and Banglish.
- After a staff takeover, the bot stops replying from the next message on.
- Chat orders appear as pending orders with their source and page.
- A bot-scoped key gets 401/403 on every non-bot route (test).
- The daily reply cap is enforced.

### SP-6: Marketing and growth, 3–4 weeks
- **Coupons.**
  - A `coupons` table: code, type (percent / fixed / free shipping), value, minimum order, maximum discount, usage limits (total and per customer), start/end, product/category scope, stackable flag.
  - Validated on the server at checkout; discount lines are stored on the order; the GTM `coupon` field is filled.
- **Automatic discounts.** Free delivery over ৳X, combo/bundle offers, first-order discount, and influencer codes with an attribution report.
- **Flash sales and campaigns.** Built on the unused `campaigns` table (headline, badge, CTA, layout, startsAt/endsAt), with a countdown and a campaign page.
- **Ad landing pages.** A single product with an inline order form.
- **Incomplete checkouts.**
  - `checkout_leads` captures phone and cart once the phone field is filled, with a notice to the customer.
  - The admin gets a call-back list.
  - SMS follow-up comes after SP-4.
- **Customer CRM.** Profile with order history, tags (VIP, fraud, wholesale), notes, segments, CSV export, server-side paging.
- **Reviews.** Photos, moderation queue, replies, a review-request SMS after delivery, and product Q&A.
- **Other.** Back-in-stock alerts, pre-orders, and a working newsletter (`newsletter_subscribers`; today the form saves nothing).

**Acceptance**
- Coupons are applied and recorded on the server, with abuse limits.
- Campaign pages can be scheduled.
- Incomplete checkouts are listed.
- Review moderation works.

### SP-7: Admin UX and operations (continuous, alongside the rest)
- **Bangla admin.** Add an admin namespace to the existing `useLanguage` dictionary and migrate screen by screen, starting with orders.
- **Cmd+K global search** for orders (by phone or number), products and customers. Order search ignores phone today.
- **Real-time order alerts.** SSE fed by Postgres `LISTEN/NOTIFY`, with a sound.
- **Dashboard.** Widgets per role; saved order views.
- **Invoice/label designer.**
  - A4 and 80 mm thermal formats, and barcode/QR labels.
  - Removes today's invoice hardcodes: the language is always Bangla and the zone is always `inside_dhaka`.
- **POS.** Barcode scanning, receipt printing, end-of-day cash count.
- **Catalogue.** CSV import/export, product bulk edit, draft/archived status.
- **Staff.** Invite, deactivate, TOTP 2FA, and a permission-filtered mobile nav.
- **Orders page.** Split `app/(dashboard)/dashboard/orders/page.tsx` (4,444 lines) into components.

---

## 5. Sequencing and estimates

| Step | Sub-project | Depends on | Estimate |
|---|---|---|---|
| 1 | SP-0 Safety | n/a | ~1 week |
| 2 | SP-1 Settings engine | SP-0 | 1–2 weeks |
| 3 | SP-2 Checkout and delivery accuracy | SP-1 | 2–3 weeks |
| 4 | SP-3 Theme · SP-5a Copilot · SP-5b v1 (Messenger) | SP-1 (SP-5b chat orders also use SP-2) | 2–4 weeks each, any order |
| 5 | SP-4 Courier/payment/notification hub, plus SP-5b v3 (WhatsApp) | SP-1, SP-2 | 3–4 weeks |
| 6 | SP-6 Marketing | SP-2, SP-4 | 3–4 weeks |
| ongoing | SP-7 Admin UX | n/a | continuous |

**Total:** about 4–5 months for one developer working with AI.

**Why this order**
- SP-1 comes first because everything later reads settings.
- SP-2 saves the most money, and Pathao/RedX booking (SP-4) needs its structured address.
- SP-5a reuses the existing MCP tools, so it is cheap.

---

## 6. Non-goals
- A multi-vendor marketplace.
- Multi-tenancy, billing and a platform console. That is the SaaS phase, after this brief.
- Native mobile apps.
- Markets or currencies outside Bangladesh beyond what settings already support.
- Unofficial WhatsApp APIs.
- Giving any public bot admin-level tools.
- Removing n8n. It stays for automations.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Scope creep across nine sub-projects | One sub-project at a time, each with its own design and plan, and a gate between them |
| Performance regressions | Server-rendered or lazy patterns only; a Lighthouse check at every gate |
| Hand-applied migrations | SQL reviewed in the plan; DB backup before applying; `schema.ts` updated in the same commit |
| Meta policy or pricing changes | Adapters; re-check before each channel launch; Messenger first |
| AI cost or abuse | Budget caps, rate limits, cheap models for simple tasks |
| One developer | Estimates assume one developer with AI; stop the line on CI failures |
| Cookie rename logs everyone out | Run it at a low-traffic hour and tell staff beforehand |

---

## 8. Owner decisions (defaults apply if not changed)

1. **Social chat architecture and timing.**
   - Default: the gateway-in-store design above, with SP-5b v1 at step 4 (after SP-2).
   - Alternative: SP-5b v1 right after SP-1.
2. **Track-order UX.**
   - Default: a phone search shows only a status summary; details need the order number.
3. **SMS gateway.**
   - Default: chosen in the SP-4 design, with the owner's existing account preferred.
4. **Second courier.**
   - Default: Pathao first, then RedX.
5. **AI provider for BYOK.**
   - Default: whichever key the owner already has. The AI SDK supports the major providers.
6. **Cookie rename timing.**
   - Default: during SP-1, at a low-traffic hour.
7. **Theme presets.**
   - Default: the current rose look plus four proposals made in the SP-3 design.

---

## 9. External references
- n8n Sustainable Use License FAQ: https://docs.n8n.io/n8n-community-license/community-license/license-faq
- Meta, Messenger Platform overview (App Review for your own Page): https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview
- Meta, WhatsApp Business Platform pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Third-party claim that service messages are billed from Oct 2026: https://help.zoho.com/portal/en/community/topic/whatsapp-business-platform-message-pricing-guide
- TechCrunch, WhatsApp bars general-purpose chatbots (effective 2026-01-15): https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform
