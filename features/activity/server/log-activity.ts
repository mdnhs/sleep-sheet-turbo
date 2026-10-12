import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { after } from "next/server";
import { db } from "@/db";
import { getClientIp } from "@/lib/client-ip";
import { sweepRetention } from "@/lib/data-retention";
import { activityLogs } from "@/db/schema";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
} | null;

export interface ActivityChange {
  /** Human label for the field, e.g. "Status", "Price", "Permissions". */
  label: string;
  from?: string | number | boolean | null;
  to?: string | number | boolean | null;
}

export interface ActivityMeta {
  /** The specific thing acted on, e.g. a product name or "#ORD-1234". */
  name?: string | null;
  /** For edits: which fields changed and their before/after values. */
  changes?: ActivityChange[];
}

const ACTIVITY_META_KEY = "activityMeta";

/**
 * Let a route handler attach a human-readable name (and, for edits, a list of
 * changed fields) to the request, right before it returns its response. The
 * logActivity middleware picks this up after `next()` and stores it alongside
 * the generic "Updated order" style action so the activity log can read
 * "Updated order #ORD-1234 — Status: Pending → Delivered" instead of just a
 * method + path. Safe to call multiple times; the last call wins. Routes that
 * never call this still get a generic (but plain-English) log line.
 */
export function setActivityMeta(c: Context, meta: ActivityMeta) {
  c.set(ACTIVITY_META_KEY as never, meta as never);
}

function stringifyChangeValue(v: ActivityChange["from"]): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** "PARTIALLY_REFUNDED" -> "Partially Refunded". Used to make DB enum values read naturally in the log. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Turn a list of entity names from a bulk action into one readable string,
 * e.g. ["A", "B", "C", "D", "E"] -> `"A", "B", "C" and 2 more`. Used so a bulk
 * delete/update still names what was affected instead of just a count.
 */
export function summarizeNames(names: string[], max = 3): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length <= max) return clean.map((n) => `"${n}"`).join(", ");
  const shown = clean.slice(0, max).map((n) => `"${n}"`).join(", ");
  return `${shown} and ${clean.length - max} more`;
}

// Past tense for successful mutations, infinitive for "Failed to ___" error
// phrasing. GET only ever appears in the log when it errors (see `record`
// below), so it has no past-tense form worth writing.
const ACTION_VERBS: Record<string, { past: string; infinitive: string }> = {
  POST: { past: "Created", infinitive: "create" },
  PUT: { past: "Updated", infinitive: "update" },
  PATCH: { past: "Updated", infinitive: "update" },
  DELETE: { past: "Deleted", infinitive: "delete" },
  GET: { past: "Viewed", infinitive: "access" },
};

// Nicer labels for the first path segment after /api/.
const RESOURCE_LABELS: Record<string, string> = {
  products: "product",
  product: "product",
  categories: "category",
  reviews: "review",
  orders: "order",
  "blocked-ips": "blocked IP",
  checkout: "checkout",
  collection: "collection",
  testimonials: "testimonial",
  promotions: "promotion",
  wishlist: "wishlist",
  cart: "cart",
  steadfast: "courier booking",
  "fraud-check": "fraud check",
  settings: "settings",
  blog: "blog post",
  pos: "POS sale",
  reports: "report",
  expenses: "expense",
  roles: "role",
  users: "user",
  auth: "account",
};

function describe(method: string, path: string, isError: boolean): string {
  const segments = path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = segments[0] ?? "";
  const label = RESOURCE_LABELS[resource] ?? resource.replace(/-/g, " ");
  const verbs = ACTION_VERBS[method] ?? { past: method, infinitive: method.toLowerCase() };
  // Sub-actions read better with the tail included: "Updated order status".
  const tail = segments
    .slice(1)
    .filter((s) => !/^[a-z0-9]{20,}$/i.test(s)) // drop opaque ids
    .join(" ")
    .replace(/-/g, " ");
  const target = [label, tail].filter(Boolean).join(" ");
  return isError ? `Failed to ${verbs.infinitive} ${target}`.trim() : `${verbs.past} ${target}`.trim();
}

// Appends the specific entity name to the generic action sentence, e.g.
// `Deleted product` + `Blue Cotton Sheet Set` -> `Deleted product "Blue
// Cotton Sheet Set"`. Names that already read like an identifier (start
// with # or •) skip the quotes since they don't need them.
function composeAction(base: string, name: string | null | undefined): string {
  if (!name) return base;
  const looksLikeIdentifier = /^[#@]/.test(name);
  return looksLikeIdentifier ? `${base} ${name}` : `${base} "${name}"`;
}

// POST endpoints that are semantically reads (bulk lookups, status polls) —
// they fire automatically when pages load and would flood the log.
const EXCLUDED_PATHS = [/^\/api\/steadfast\/track-batch$/, /^\/api\/activity/];

function clientIp(headers: Headers): string {
  return getClientIp((name) => headers.get(name)) ?? "unknown";
}

async function record(c: Context, user: SessionUser, status: number) {
  if (!user) return;
  const isDashboardUser =
    user.role === "ADMIN" ||
    user.role === "MODERATOR" ||
    (Array.isArray(user.permissions) && user.permissions.length > 0);
  if (!isDashboardUser) return;

  const method = c.req.method.toUpperCase();
  if (method === "HEAD" || method === "OPTIONS") return;

  const path = new URL(c.req.url).pathname;
  if (EXCLUDED_PATHS.some((p) => p.test(path))) return;

  const isError = status >= 400;
  // Successful reads are noise (every page load fires several); only log
  // GETs when they fail, so permission/auth/server errors still surface.
  if (method === "GET" && !isError) return;

  // A route handler may have called setActivityMeta(c, { name, changes })
  // right before returning, to identify exactly what it acted on. Errors
  // never carry meta — the route usually bailed before reaching that call.
  const meta = isError ? undefined : (c.get(ACTIVITY_META_KEY as never) as ActivityMeta | undefined);
  const targetName = meta?.name ?? null;
  const changes = meta?.changes?.length
    ? meta.changes.map((ch) => ({
        label: ch.label,
        from: stringifyChangeValue(ch.from),
        to: stringifyChangeValue(ch.to),
      }))
    : null;

  try {
    sweepRetention("activity");
    await db.insert(activityLogs).values({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: composeAction(describe(method, path, isError), targetName),
      method,
      path,
      status,
      ip: clientIp(c.req.raw.headers),
      targetName,
      changes,
    });
  } catch (error) {
    // Auditing must never break the actual request.
    console.error("Failed to write activity log:", error);
  }
}

// Global middleware: records every mutating API request made by a dashboard
// user (anyone with an admin/moderator role or custom role permissions), plus
// any request — including reads — that errors, so failed and crashed actions
// show up in the log alongside successful ones. Storefront customers and
// anonymous requests are never logged.
export const logActivity = createMiddleware(async (c, next) => {
  try {
    await next();
  } catch (error) {
    const user = c.get("user" as never) as SessionUser;
    const status = error instanceof HTTPException ? error.status : 500;
    // Deferred via after() (BAD-11, audit 2026-09-21): this used to be
    // awaited here, so every mutating dashboard request paid for an extra
    // Neon round trip before the client ever saw its response. The audit
    // trail itself doesn't need to be write-before-respond — nothing reads
    // it synchronously off the request that created it — so recording it
    // after the response has gone out (Vercel keeps the function alive to
    // finish it, same as lib/n8n-notify) removes that latency from the
    // request that's actually waiting on it.
    after(() => record(c, user, status));
    throw error; // preserve normal error handling/response for the client
  }

  const user = c.get("user" as never) as SessionUser;
  const status = c.res.status;
  after(() => record(c, user, status));
});
