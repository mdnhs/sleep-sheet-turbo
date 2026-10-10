import { getSteadfastConfig } from "@/lib/server-config"

const BASE_URL = "https://portal.packzy.com/api/v1";

// Every call here used to have no timeout — a hung/slow Steadfast response
// would hold the request open until the platform's own function timeout,
// and features/steadfast/server/route.ts fans out up to 100 of these
// concurrently via Promise.allSettled (BAD-6, audit 2026-09-21). 10s is
// generous for a courier status/balance lookup and still bounds the worst
// case.
const TIMEOUT_MS = 10_000;

async function headers() {
  const config = await getSteadfastConfig()
  return {
    "Api-Key": config.apiKey,
    "Secret-Key": config.secretKey,
    "Content-Type": "application/json",
  };
}

export interface SteadfastOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
}

export interface SteadfastOrderResponse {
  status: number;
  message: string;
  consignment: {
    consignment_id: number;
    invoice: string;
    tracking_code: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    cod_amount: number;
    status: string;
  };
}

export interface SteadfastStatusResponse {
  status: number;
  delivery_status: string;
  consignment?: {
    consignment_id: number;
    tracking_code: string;
    invoice: string;
    status: string;
  };
}

export interface SteadfastBalanceResponse {
  status: number;
  current_balance: number;
}

export async function createSteadfastOrder(
  payload: SteadfastOrderPayload
): Promise<SteadfastOrderResponse> {
  const res = await fetch(`${BASE_URL}/create_order`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({})) as SteadfastOrderResponse & { message?: string; errors?: unknown };
  if (!res.ok || (body.status && body.status !== 200)) {
    console.error("[Steadfast] create_order failed:", JSON.stringify(body));
    throw new Error(
      (body as { message?: string }).message || `Steadfast error ${res.status}`
    );
  }
  if (!body.consignment) {
    console.error("[Steadfast] create_order no consignment in response:", JSON.stringify(body));
    throw new Error((body as { message?: string }).message || "Steadfast: no consignment returned");
  }
  return body;
}

export async function getSteadfastStatusByInvoice(
  invoice: string
): Promise<SteadfastStatusResponse> {
  const res = await fetch(`${BASE_URL}/status_by_invoice/${invoice}`, {
    headers: await headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Steadfast error ${res.status}`);
  }
  return res.json();
}

export async function getSteadfastBalance(): Promise<SteadfastBalanceResponse> {
  const res = await fetch(`${BASE_URL}/get_balance`, {
    headers: await headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Steadfast error ${res.status}`);
  }
  return res.json();
}
