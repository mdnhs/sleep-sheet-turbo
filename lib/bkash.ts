// bKash Tokenized Checkout (Payment Gateway) client. Server-only: it reads
// the merchant credentials the admin saved under Settings → Payments, which
// are never exposed through the public settings endpoint.
//
// Flow (see features/bkash/server/route.ts for the callback half):
//   grant token → create payment (returns bkashURL) → customer pays on
//   bKash's page → bKash redirects to our callback → execute payment.
import { getSettingsMap } from "@/lib/settings-cache";

const API_VERSION = "v1.2.0-beta";
const BASE_URLS = {
  sandbox: `https://tokenized.sandbox.bka.sh/${API_VERSION}/tokenized/checkout`,
  live: `https://tokenized.pay.bka.sh/${API_VERSION}/tokenized/checkout`,
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

// bKash tokens live for an hour; reuse one per credential set instead of
// granting a fresh one on every payment. In-process, so each warm instance
// keeps its own — the grant call is cheap.
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

export function resetBkashTokenCache(): void {
  tokenCache = null;
}

async function bkashFetch<T>(
  config: BkashConfig,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<T> {
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
    console.error(`[bKash] Non-JSON response (HTTP ${res.status}) from ${path}:`, text.slice(0, 500));
    const snippet = text.trim().slice(0, 100);
    throw new BkashError(
      snippet
        ? `bKash returned an unreadable response (HTTP ${res.status}): ${snippet}`
        : `bKash returned an unreadable response (HTTP ${res.status})`,
    );
  }
  if (!data) throw new BkashError(`bKash returned an unreadable response (HTTP ${res.status})`);
  return data;
}

interface TokenResponse {
  id_token?: string;
  expires_in?: number;
  statusCode?: string;
  statusMessage?: string;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
}

async function getToken(config: BkashConfig): Promise<string> {
  const key = [config.mode, config.appKey, config.username].join("|");
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const data = await bkashFetch<TokenResponse>(
    config,
    "/token/grant",
    { app_key: config.appKey, app_secret: config.appSecret },
    { username: config.username, password: config.password },
  );

  if (!data.id_token) {
    throw new BkashError(
      data.statusMessage || data.errorMessage || data.message || "bKash rejected the credentials",
      data.statusCode || data.errorCode,
    );
  }

  // Refresh a minute early so a token never expires mid-request.
  const ttlMs = Math.max(60, (data.expires_in ?? 3600) - 60) * 1000;
  tokenCache = { key, token: data.id_token, expiresAt: Date.now() + ttlMs };
  return data.id_token;
}

async function authedHeaders(config: BkashConfig): Promise<Record<string, string>> {
  return { Authorization: await getToken(config), "X-APP-Key": config.appKey };
}

/** Verifies the saved credentials by requesting a token. Throws BkashError. */
export async function testBkashCredentials(config: BkashConfig): Promise<void> {
  resetBkashTokenCache();
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
    throw new BkashError(data.statusMessage || "bKash could not start the payment", data.statusCode);
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
 * Captures a payment the customer has authorised. Returns the completed
 * transaction, or null when bKash says it did not go through. If the execute
 * call itself fails (timeout etc.) the payment may still have succeeded, so
 * the status endpoint is asked before giving up.
 */
export async function executeBkashPayment(
  config: BkashConfig,
  paymentID: string,
): Promise<BkashResult | null> {
  try {
    const data = await bkashFetch<PaymentResponse>(
      config,
      "/execute",
      { paymentID },
      await authedHeaders(config),
    );
    const result = toResult(data);
    if (result) return result;
    // Already captured (e.g. the callback fired twice) — ask for the real state.
    if (data.statusCode === "2062") return queryBkashPayment(config, paymentID);
    return null;
  } catch (error) {
    if (!(error instanceof BkashError)) throw error;
    return queryBkashPayment(config, paymentID);
  }
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
