// bKash Tokenized Checkout (Payment Gateway) client. Server-only: it reads
// the merchant credentials the admin saved under Settings → Payments, which
// are never exposed through the public settings endpoint.
//
// Flow (see features/bkash/server/route.ts for the callback half):
//   grant token → create payment (returns bkashURL) → customer pays on
//   bKash's page → bKash redirects to our callback → execute payment.
import { getSettingsMap } from "@/lib/settings-cache";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const API_VERSION = "v1.2.0-beta";
const SANDBOX_BASE =
  process.env.BKASH_SANDBOX_URL?.trim().replace(/\/+$/, "") ||
  "https://bkash-proxy.mdnhs-cse.workers.dev";
const LIVE_BASE =
  process.env.BKASH_LIVE_URL?.trim().replace(/\/+$/, "") ||
  "https://tokenized.pay.bka.sh";

const BASE_URLS = {
  sandbox: `${SANDBOX_BASE}/${API_VERSION}/tokenized/checkout`,
  live: `${LIVE_BASE}/${API_VERSION}/tokenized/checkout`,
} as const;

export type BkashMode = keyof typeof BASE_URLS;

export interface BkashConfig {
  enabled: boolean;
  mode: BkashMode;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
}

export class BkashError extends Error {
  constructor(message: string, readonly statusCode?: string) {
    super(message);
    this.name = "BkashError";
  }
}

export function parseBkashConfig(settings: Record<string, string>): BkashConfig {
  return {
    enabled: settings.payment_method_bkash === "true",
    mode: settings.bkash_mode === "live" ? "live" : "sandbox",
    appKey: (settings.bkash_app_key ?? "").trim(),
    appSecret: (settings.bkash_app_secret ?? "").trim(),
    username: (settings.bkash_username ?? "").trim(),
    password: (settings.bkash_password ?? "").trim(),
  };
}

export function isBkashConfigured(config: BkashConfig): boolean {
  return Boolean(config.appKey && config.appSecret && config.username && config.password);
}

export async function getBkashConfig(): Promise<BkashConfig> {
  return parseBkashConfig(await getSettingsMap());
}

/** Enabled by the admin AND every credential filled in. */
export async function isBkashAvailable(): Promise<boolean> {
  const config = await getBkashConfig();
  return config.enabled && isBkashConfigured(config);
}

// bKash tokens live for an hour; reuse one per credential set for 1 hour.
// Checklist 0: Grant API can only be called twice per hour, so the id_token
// must be persisted in database cache and reused across all gateway users and server instances.
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

async function loadTokenFromDb(key: string): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const row = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.key, `_bkash_token_${key}`),
    });
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as { token: string; expiresAt: number };
    if (parsed.token && parsed.expiresAt > Date.now()) {
      return parsed;
    }
  } catch {
    // If DB is unavailable or during early migrations/isolated unit tests, fall back cleanly.
  }
  return null;
}

async function saveTokenToDb(key: string, token: string, expiresAt: number): Promise<void> {
  try {
    const value = JSON.stringify({ token, expiresAt });
    await db
      .insert(siteSettings)
      .values({
        key: `_bkash_token_${key}`,
        value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedAt: new Date() },
      });
  } catch {
    // DB write failed
  }
}

export function resetBkashTokenCache(key?: string): void {
  tokenCache = null;
  if (key) {
    try {
      db.delete(siteSettings).where(eq(siteSettings.key, `_bkash_token_${key}`)).catch(() => {});
    } catch {}
  }
}

function sanitizeBkashLog(path: string, data: unknown): unknown {
  if (path === "/token/grant" && data && typeof data === "object") {
    const copy = { ...(data as Record<string, unknown>) };
    if (typeof copy.id_token === "string") {
      copy.id_token = `${copy.id_token.slice(0, 16)}...[REDACTED]`;
    }
    return copy;
  }
  return data;
}

async function bkashFetch<T>(
  config: BkashConfig,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<T> {
  const safeBody =
    path === "/token/grant"
      ? { app_key: (body as Record<string, unknown>).app_key, app_secret: "[REDACTED]" }
      : body;
  console.log(`[bKash API Request] ${config.mode.toUpperCase()} POST ${path}:`, JSON.stringify(safeBody));

  let res: Response;
  try {
    res = await fetch(`${BASE_URLS[config.mode]}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error(`[bKash API Network Error] ${config.mode.toUpperCase()} POST ${path}:`, error);
    throw new BkashError(
      error instanceof Error && error.name === "TimeoutError"
        ? "bKash did not respond in time"
        : "Could not reach bKash",
    );
  }

  const text = await res.text();
  let data: T | null = null;
  try {
    data = JSON.parse(text) as T;
  } catch {
    console.error(`[bKash API Error] Non-JSON response (HTTP ${res.status}) from ${path}:`, text.slice(0, 500));
    const snippet = text.trim().slice(0, 100);
    throw new BkashError(
      snippet
        ? `bKash returned an unreadable response (HTTP ${res.status}): ${snippet}`
        : `bKash returned an unreadable response (HTTP ${res.status})`,
    );
  }
  if (!data) throw new BkashError(`bKash returned an unreadable response (HTTP ${res.status})`);

  console.log(
    `[bKash API Response] ${config.mode.toUpperCase()} POST ${path} (HTTP ${res.status}):`,
    JSON.stringify(sanitizeBkashLog(path, data), null, 2),
  );

  return data;
}

interface TokenResponse {
  id_token?: string;
  expires_in?: number;
  statusCode?: string;
  statusMessage?: string;
  errorCode?: string;
  errorMessage?: string;
  errorMessageEn?: string;
  message?: string;
}

async function getToken(config: BkashConfig): Promise<string> {
  const key = [config.mode, config.appKey, config.username].join("|");

  // 1. In-process memory cache (L1 fast path)
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  // 2. Database cache (L2 persistent path: shared across instances/serverless for 1 hour)
  const dbCached = await loadTokenFromDb(key);
  if (dbCached && dbCached.expiresAt > Date.now()) {
    tokenCache = { key, token: dbCached.token, expiresAt: dbCached.expiresAt };
    return dbCached.token;
  }

  // 3. Grant API call (called at most once an hour per checklist item 0)
  const data = await bkashFetch<TokenResponse>(
    config,
    "/token/grant",
    { app_key: config.appKey, app_secret: config.appSecret },
    { username: config.username, password: config.password },
  );

  if (!data.id_token) {
    throw new BkashError(
      data.errorMessageEn || data.errorMessage || data.statusMessage || data.message || "bKash rejected the credentials",
      data.statusCode || data.errorCode,
    );
  }

  // Refresh 60 seconds before full expiration so token never expires mid-flight
  const ttlMs = Math.max(60, (data.expires_in ?? 3600) - 60) * 1000;
  const expiresAt = Date.now() + ttlMs;

  tokenCache = { key, token: data.id_token, expiresAt };
  await saveTokenToDb(key, data.id_token, expiresAt);

  return data.id_token;
}

async function authedHeaders(config: BkashConfig): Promise<Record<string, string>> {
  return { Authorization: await getToken(config), "X-APP-Key": config.appKey };
}

/** Verifies the saved credentials by requesting a token. Throws BkashError. */
export async function testBkashCredentials(config: BkashConfig): Promise<void> {
  resetBkashTokenCache([config.mode, config.appKey, config.username].join("|"));
  await getToken(config);
}

interface PaymentResponse {
  paymentID?: string;
  bkashURL?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  merchantInvoiceNumber?: string;
  statusCode?: string;
  statusMessage?: string;
  errorMessage?: string;
  errorMessageEn?: string;
}

export interface BkashPayment {
  paymentID: string;
  bkashURL: string;
}

export async function createBkashPayment(
  config: BkashConfig,
  input: { amount: number; invoiceNumber: string; callbackURL: string; payerReference: string },
): Promise<BkashPayment> {
  const data = await bkashFetch<PaymentResponse>(
    config,
    "/create",
    {
      mode: "0011",
      payerReference: input.payerReference,
      callbackURL: input.callbackURL,
      amount: input.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: input.invoiceNumber,
    },
    await authedHeaders(config),
  );

  if (data.statusCode !== "0000" || !data.paymentID || !data.bkashURL) {
    const errorMsg =
      data.errorMessageEn || data.errorMessage || data.statusMessage || "bKash could not start the payment";
    throw new BkashError(errorMsg, data.statusCode);
  }
  return { paymentID: data.paymentID, bkashURL: data.bkashURL };
}

export interface BkashResult {
  paymentID: string;
  trxID: string;
  amount: number;
  invoiceNumber: string;
}

function toResult(data: PaymentResponse): BkashResult | null {
  if (data.transactionStatus !== "Completed" || !data.trxID || !data.paymentID) return null;
  return {
    paymentID: data.paymentID,
    trxID: data.trxID,
    amount: Number(data.amount),
    invoiceNumber: data.merchantInvoiceNumber ?? "",
  };
}

/**
 * Captures a payment the customer has authorized.
 *
 * bKash Checklist:
 * 3. From Execute API response [transactionStatus = "Completed"] is for successful payment.
 *    Any other response is a failure case; extract errorMessageEn to display on failure page.
 * 4. Query payment API should be called if and only if there is NO response from the Execute API
 *    (Timeout or null response). Other than this, do not call Query API in payment flow.
 */
export async function executeBkashPayment(
  config: BkashConfig,
  paymentID: string,
): Promise<BkashResult> {
  let data: PaymentResponse | null = null;
  let hasTimeoutOrNoResponse = false;

  try {
    data = await bkashFetch<PaymentResponse>(
      config,
      "/execute",
      { paymentID },
      await authedHeaders(config),
    );
  } catch (error) {
    if (
      error instanceof BkashError &&
      (error.message.includes("did not respond in time") ||
        error.message.includes("Could not reach bKash") ||
        error.message.includes("unreadable response"))
    ) {
      hasTimeoutOrNoResponse = true;
    } else {
      throw error;
    }
  }

  // Fallback ONLY when there was NO response or timeout from Execute API (Checklist item 4)
  if (hasTimeoutOrNoResponse || !data) {
    console.warn(`[bKash Execute] No response/timeout from Execute API for ${paymentID}. Fallback to Query Payment API.`);
    const queried = await queryBkashPayment(config, paymentID);
    if (queried) return queried;
    throw new BkashError(
      "bKash Execute API did not respond in time and transaction could not be verified",
      "TIMEOUT",
    );
  }

  // Response was received from Execute API
  const result = toResult(data);
  if (result) {
    return result;
  }

  // Any other response is a failure case from Execute API (Checklist item 3).
  // Surface proper errorMessageEn from the API response.
  const errorMessageEn =
    data.errorMessageEn ||
    data.errorMessage ||
    data.statusMessage ||
    `Payment not completed (Status: ${data.transactionStatus || data.statusCode || "Failed"})`;

  throw new BkashError(errorMessageEn, data.statusCode);
}

export async function queryBkashPayment(
  config: BkashConfig,
  paymentID: string,
): Promise<BkashResult | null> {
  const data = await bkashFetch<PaymentResponse>(
    config,
    "/payment/status",
    { paymentID },
    await authedHeaders(config),
  );
  return toResult(data);
}

export interface BkashRefundInput {
  paymentID: string;
  trxID: string;
  amount: number;
  sku?: string;
  reason?: string;
}

export interface BkashRefundResult {
  statusCode: string;
  statusMessage?: string;
  originalTrxID?: string;
  refundTrxID?: string;
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  errorMessage?: string;
  errorMessageEn?: string;
}

/**
 * Executes a refund on a completed bKash transaction using the same stored id_token (Checklist item 5).
 */
export async function refundBkashPayment(
  config: BkashConfig,
  input: BkashRefundInput,
): Promise<BkashRefundResult> {
  const data = await bkashFetch<BkashRefundResult>(
    config,
    "/payment/refund",
    {
      paymentID: input.paymentID,
      amount: input.amount.toFixed(2),
      trxID: input.trxID,
      sku: input.sku || "Refund",
      reason: input.reason || "Customer refund",
    },
    await authedHeaders(config),
  );

  if (data.statusCode !== "0000" || data.transactionStatus !== "Completed") {
    const errorMsg =
      data.errorMessageEn ||
      data.errorMessage ||
      data.statusMessage ||
      `bKash refund failed (${data.statusCode || "Failed"})`;
    throw new BkashError(errorMsg, data.statusCode);
  }

  return data;
}

