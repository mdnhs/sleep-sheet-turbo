import {Hono} from "hono";
import {handle} from "hono/vercel";

export const dynamic = "force-dynamic";
import auth from "@/features/auth/server/route"
import products from "@/features/product/server/route"
import product from "@/features/dashboard/server/route"
import categories from "@/features/categories/server/route"
import review from "@/features/review/server/route"
import checkout from "@/features/checkout/server/route"
import bkash from "@/features/bkash/server/route"
import cart from "@/features/cart/server/route"
import orders from "@/features/order/server/route"
import collection from "@/features/collections/server/route"
import testimonials from "@/features/testimonials/server/route"
import wishlist from "@/features/wishlist/server/route"
import analytics from "@/features/analytics/server/route";
import steadfast from "@/features/steadfast/server/route";
import settings from "@/features/settings/server/route";
import blog from "@/features/blog/server/route";
import pos from "@/features/pos/server/route";
import reports from "@/features/reports/server/route";
import expenses from "@/features/expenses/server/route";
import roles from "@/features/roles/server/route";
import users from "@/features/users/server/route";
import activity from "@/features/activity/server/route";
import apiKeys from "@/features/api-keys/server/route";
import blockedIps from "@/features/blocked-ips/server/route";
import googleSheets from "@/features/google-sheets/server/route";
import fraudChecker from "@/features/fraud-checker/server/route";
import audiences from "@/features/audiences/server/route";
import { logActivity } from "@/features/activity/server/log-activity";
import { cors } from "hono/cors";

// Browser requests here carry the session cookie, so allowing every origin
// (the previous `cors()` default) let any site read cookie-authenticated
// responses via a logged-in visitor's browser. Server-to-server callers
// (MCP clients, the API-key/OAuth Bearer paths in sessionMiddleware) aren't
// browsers and were never subject to CORS anyway, so restricting this to a
// known-origin allowlist only affects the credentialed browser path.
const trustedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  ...(process.env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
].filter((origin): origin is string => Boolean(origin));

const app = new Hono().basePath("/api");
app.use(
  "*",
  cors({
    origin: (origin) => (trustedOrigins.includes(origin) ? origin : undefined),
    credentials: true,
  })
);
// Audit trail: records every mutating request made by a dashboard user.
app.use("*", logActivity);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes =app
.route("/auth",auth)
.route("/products",products)
.route("/product",product)
.route("/categories",categories)
.route("/reviews",review)
.route("/cart",cart)
.route("/checkout",checkout)
.route("/bkash",bkash)
.route("/orders",orders)
.route("/collection",collection)
.route("/testimonials",testimonials)
.route("/wishlist",wishlist)
.route("/analytics",analytics)
.route("/steadfast",steadfast)
.route("/settings",settings)
.route("/blog",blog)
.route("/pos",pos)
.route("/reports",reports)
.route("/expenses",expenses)
.route("/roles",roles)
.route("/users",users)
.route("/activity",activity)
.route("/api-keys",apiKeys)
.route("/blocked-ips",blockedIps)
.route("/google-sheets",googleSheets)
.route("/fraud-check",fraudChecker)
.route("/audiences",audiences)

export const GET = handle(app)
export const POST = handle(app)
export const PUT =handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
export type AppType = typeof routes;
