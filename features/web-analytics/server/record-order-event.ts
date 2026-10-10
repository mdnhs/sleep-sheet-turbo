import { z } from "zod";
import { parseUserAgent } from "@/lib/user-agent-parser";
import { countryFromHeader } from "../lib/request-info";
import { toRoute } from "../lib/route-pattern";
import {
  findLastSessionEvent,
  insertEvent,
  isAnalyticsEnabled,
  type AnalyticsEvent,
  type NewAnalyticsEvent,
} from "./store";

/**
 * Lenient schema for the analytics ids a checkout request carries: an
 * oversized or non-string value becomes undefined instead of failing request
 * validation, so attribution can never reject an order.
 */
export const analyticsIdSchema = z.string().trim().max(64).optional().catch(undefined);

export interface OrderEventInput {
  orderId: string;
  value: number;
  visitorId?: string | null;
  sessionId?: string | null;
  headers: Headers;
}

export interface OrderEventDeps {
  isEnabled: () => Promise<boolean>;
  findLast: (sessionId: string) => Promise<AnalyticsEvent | null>;
  insert: (row: NewAnalyticsEvent) => Promise<void>;
}

const defaultDeps: OrderEventDeps = {
  isEnabled: isAnalyticsEnabled,
  findLast: findLastSessionEvent,
  insert: insertEvent,
};

/**
 * Records a website order as an `order_complete` analytics event, carrying
 * the visit's landing attributes so the dashboard can tie revenue to the
 * referrer or campaign that brought it. Revenue itself is always read back
 * from `orders`, so later cancellations and refunds are reflected. Never
 * rejects: a failure here must not affect the checkout that called it.
 */
export async function recordOrderEvent(input: OrderEventInput, deps: OrderEventDeps = defaultDeps): Promise<void> {
  try {
    if (!(await deps.isEnabled())) return;

    const sessionId = input.sessionId || `srv-${input.orderId}`;
    const visitorId = input.visitorId || sessionId;
    const last = input.sessionId ? await deps.findLast(input.sessionId) : null;
    const ua = parseUserAgent(input.headers.get("user-agent"));
    const path = last?.path ?? "/checkout";

    await deps.insert({
      type: "order_complete",
      visitorId,
      sessionId,
      path,
      route: toRoute(path),
      hostname: last?.hostname ?? null,
      referrerHost: last?.referrerHost ?? null,
      utmSource: last?.utmSource ?? null,
      utmMedium: last?.utmMedium ?? null,
      utmCampaign: last?.utmCampaign ?? null,
      utmTerm: last?.utmTerm ?? null,
      utmContent: last?.utmContent ?? null,
      adClick: last?.adClick ?? null,
      country: last?.country ?? countryFromHeader(input.headers.get("cf-ipcountry")),
      device: last?.device ?? ua.device,
      browser: last?.browser ?? ua.browser,
      os: last?.os ?? ua.os,
      label: null,
      productId: null,
      value: input.value,
      orderId: input.orderId,
    });
  } catch (err) {
    console.error("Analytics order event failed:", err);
  }
}
