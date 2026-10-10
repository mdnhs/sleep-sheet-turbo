import { getBdCourierConfig } from "@/lib/server-config";

const BASE_URL = "https://api.bdcourier.com";

export interface CourierStats {
  name: string;
  logo: string;
  total_parcel: number;
  success_parcel: number;
  cancelled_parcel: number;
  success_ratio: number;
}

export interface FraudReport {
  id: string;
  name: string;
  details: string;
  created_at: string;
  courierLogo: string;
  courierName: string;
}

export interface CourierCheckResult {
  couriers: Record<string, CourierStats>;
  summary: Pick<
    CourierStats,
    "total_parcel" | "success_parcel" | "cancelled_parcel" | "success_ratio"
  >;
  reports: FraudReport[];
}

// Message is shown to the admin as-is, so keep it human-readable.
export class BdCourierError extends Error {}

export interface BdCourierPlan {
  has_subscription: boolean;
  plan_name?: string;
  plan_type?: string;
  is_free?: boolean;
  status?: string;
  next_due_date?: string | null;
  expires_at?: string | null;
  days_remaining?: number | null;
  frequency?: string;
  price?: number;
  api_calls?: number;
  paid_calls?: number;
  call_limit?: number;
  paid_limit?: number;
  remaining_free_calls?: number;
  remaining_paid_calls?: number;
}

async function bdRequest<T extends { status?: string; message?: string }>(
  path: string,
  init: { method: "GET" | "POST"; json?: unknown; timeoutMs?: number }
): Promise<T> {
  const { apiKey } = await getBdCourierConfig();
  if (!apiKey) {
    throw new BdCourierError(
      "BD Courier API key সেট করা নেই। Settings → Shipping & Courier এ গিয়ে যোগ করুন।"
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
  } catch {
    throw new BdCourierError("BD Courier এ পৌঁছানো যায়নি। একটু পরে আবার চেষ্টা করুন।");
  }

  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !body || body.status !== "success") {
    throw new BdCourierError(body?.message || `BD Courier থেকে এরর এসেছে (${res.status})।`);
  }
  return body;
}

/**
 * `timeoutMs` exists for the server-side prefetch: that runs inside the page
 * render, so a slow BD Courier would hold the whole page. A short budget there
 * just falls back to the client fetching it.
 */
export async function getMyPlan(timeoutMs?: number): Promise<BdCourierPlan> {
  const body = await bdRequest<{ status?: string; message?: string; data?: BdCourierPlan }>(
    "/my-plan",
    { method: "GET", timeoutMs }
  );
  return body.data ?? { has_subscription: false };
}

export async function checkCourier(phone: string): Promise<CourierCheckResult> {
  const body = await bdRequest<{
    status?: string;
    message?: string;
    data?: Record<string, CourierStats | CourierCheckResult["summary"]>;
    reports?: FraudReport[];
  }>("/courier-check", { method: "POST", json: { phone } });

  if (!body.data) {
    throw new BdCourierError(body.message || "BD Courier কোনো ডেটা পাঠায়নি।");
  }

  const { summary, ...couriers } = body.data;
  return {
    couriers: couriers as Record<string, CourierStats>,
    summary: (summary as CourierCheckResult["summary"]) ?? {
      total_parcel: 0,
      success_parcel: 0,
      cancelled_parcel: 0,
      success_ratio: 0,
    },
    reports: body.reports ?? [],
  };
}
