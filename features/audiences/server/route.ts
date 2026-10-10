import { Context, Hono } from "hono";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { authenticateApiKey } from "@/lib/api-keys";
import { sessionMiddleware } from "@/lib/session-middleware";
import { syncGoogleAdsCustomerMatchSheet, type CustomerMatchSheetRow } from "@/lib/google-sheets";

const app = new Hono();

function normalizeBdPhone(input: unknown): string | null {
  if (!input) return null;
  const str = String(input).trim();
  const clean = str.replace(/[^\d+]/g, "");
  const match = clean.match(/(?:(?:\+?880)|0)?(1[3-9]\d{8})$/);
  if (match) {
    return "+880" + match[1];
  }
  return null;
}

function cleanEmail(input: unknown): string | null {
  if (!input) return null;
  const email = String(input).trim().toLowerCase();
  if (
    email.endsWith(".local") ||
    email.includes("@pos.") ||
    email.includes("@guest.") ||
    !email.includes("@") ||
    !email.includes(".")
  ) {
    return null;
  }
  return email;
}

function splitName(fullName: unknown): { first: string; last: string } {
  if (!fullName) return { first: "", last: "" };
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: "" };
  }
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

/**
 * Extracts and sanitizes unique customer records from Neon DB.
 */
export async function extractCustomerList(): Promise<CustomerMatchSheetRow[]> {
  const allOrders = await db
    .select({
      guestPhone: orders.guestPhone,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      shippingPostalCode: orders.shippingPostalCode,
    })
    .from(orders);

  const allUsers = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users);

  const customerMap = new Map<string, CustomerMatchSheetRow>();

  for (const u of allUsers) {
    const phone = normalizeBdPhone(u.phone);
    const email = cleanEmail(u.email);
    if (!phone && !email) continue;
    const key = phone || (email as string);
    const { first, last } = splitName(u.name);
    customerMap.set(key, {
      email: email || "",
      phone: phone || "",
      firstName: first,
      lastName: last,
      country: "BD",
      zip: "",
    });
  }

  for (const o of allOrders) {
    let phone = normalizeBdPhone(o.guestPhone);
    let rawName = o.guestName;
    if (!phone && normalizeBdPhone(o.guestName)) {
      phone = normalizeBdPhone(o.guestName);
      rawName = o.guestPhone;
    }
    const email = cleanEmail(o.guestEmail);
    if (!phone && !email) continue;
    const key = phone || (email as string);
    const { first, last } = splitName(rawName);

    const existing = customerMap.get(key) || {
      email: email || "",
      phone: phone || "",
      firstName: first,
      lastName: last,
      country: "BD",
      zip: o.shippingPostalCode || "",
    };

    if (phone && !existing.phone) existing.phone = phone;
    if (email && !existing.email) existing.email = email;
    if (first && !existing.firstName) {
      existing.firstName = first;
      existing.lastName = last;
    }
    if (o.shippingPostalCode && !existing.zip) existing.zip = o.shippingPostalCode;

    customerMap.set(key, existing);
  }

  return Array.from(customerMap.values());
}

/**
 * Validates request authorization:
 * 1. Bearer API key or sk_live_ token in header/query
 * 2. AUDIENCE_SYNC_SECRET or CRON_SECRET matching query token
 * 3. Logged-in admin session
 */
async function isAuthorized(c: Context): Promise<boolean> {
  const queryToken = c.req.query("token") || c.req.query("apiKey");
  const authHeader = c.req.header("Authorization");
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : queryToken;

  // Check matching environment secret if configured. This is also how the
  // scheduled sync authenticates (cron sends `Authorization: Bearer
  // $CRON_SECRET`). An `x-vercel-cron` header used to be trusted on its own
  // when CRON_SECRET was unset — any client can send that header, so it
  // granted the customer export to anyone; it is no longer accepted.
  const syncSecret = process.env.AUDIENCE_SYNC_SECRET || process.env.CRON_SECRET;
  if (syncSecret && rawToken && rawToken === syncSecret) {
    return true;
  }

  // Check API key (sk_live_...)
  if (rawToken && rawToken.startsWith("sk_live_")) {
    const apiKeyUser = await authenticateApiKey(rawToken);
    if (apiKeyUser && (apiKeyUser.role === "ADMIN" || apiKeyUser.permissions.includes("orders:view"))) {
      return true;
    }
  }

  // Fallback to active session user if called from dashboard UI
  const sessionUser = c.get("user");
  if (sessionUser && (sessionUser.role === "ADMIN" || sessionUser.permissions.includes("orders:view"))) {
    return true;
  }

  return false;
}

app.use("*", sessionMiddleware);

/**
 * Live Customer Match CSV/JSON endpoint
 */
app.get("/customer-match", async (c) => {
  const authorized = await isAuthorized(c);
  if (!authorized) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Provide a valid ?token=sk_live_... or Authorization Bearer header.",
      },
      401
    );
  }

  const format = c.req.query("format") || "csv";
  const rows = await extractCustomerList();

  if (format === "json") {
    return c.json({
      count: rows.length,
      customers: rows,
    });
  }

  // Format as official Google Ads Customer Match CSV
  const header = "Email,Phone,First Name,Last Name,Country,Zip\n";
  const escapeCsv = (val: string) => {
    if (!val) return "";
    const s = String(val).replace(/"/g, '""');
    return s.includes(",") ? `"${s}"` : s;
  };

  const lines = rows.map(
    (r) =>
      `${escapeCsv(r.email)},${escapeCsv(r.phone)},${escapeCsv(r.firstName)},${escapeCsv(r.lastName)},${escapeCsv(r.country)},${escapeCsv(r.zip)}`
  );

  const csvContent = header + lines.join("\n");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sleep_sheet_customer_match.csv"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
});

async function handleSheetSync(c: Context) {
  const authorized = await isAuthorized(c);
  if (!authorized) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Provide a valid ?token=sk_live_... or Authorization Bearer header.",
      },
      401
    );
  }

  const tab = c.req.query("tab") || "Google Ad";
  const rows = await extractCustomerList();
  const result = await syncGoogleAdsCustomerMatchSheet(rows, tab);

  console.log(`[cron] Synced ${rows.length} customers to Google Sheet tab '${tab}' at ${new Date().toISOString()}`);

  return c.json({
    success: true,
    tab,
    count: rows.length,
    updatedRows: result.updatedRows,
    syncedAt: new Date().toISOString(),
  });
}

/**
 * Scheduled Cron Sync (called by Vercel Cron daily at 3:00 AM BST)
 */
app.get("/cron-sync", handleSheetSync);

/**
 * Direct sync endpoints (supports both GET and POST)
 */
app.get("/sync-google-sheet", handleSheetSync);
app.post("/sync-google-sheet", handleSheetSync);

export default app;
