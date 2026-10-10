import { Hono, type Context } from "hono";
import { rateLimit } from "@/lib/rate-limit";
import { parseUserAgent } from "@/lib/user-agent-parser";
import { sweepRetention } from "@/lib/data-retention";
import { countryFromHeader, isBot } from "../lib/request-info";
import { toRoute } from "../lib/route-pattern";
import { MAX_BODY_BYTES, parseCollectBody } from "./payload";
import { insertEvent, isAnalyticsEnabled, type NewAnalyticsEvent } from "./store";

export interface CollectDeps {
  insert: (row: NewAnalyticsEvent) => Promise<void>;
  isEnabled: () => Promise<boolean>;
  afterInsert: () => void;
}

// A beacon from our own pages carries an Origin (or, in a few browsers, only
// a Referer) on the same host the request was sent to. Comparing against the
// request's own host works on the dev port and in production alike.
export function isSameOrigin(source: string | undefined, host: string): boolean {
  if (!source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export function requestHost(c: Context): string {
  return c.req.header("x-forwarded-host")?.split(",")[0]?.trim() || c.req.header("host") || new URL(c.req.url).host;
}

/**
 * POST /api/t: the storefront's analytics beacon. Public (no session), so it
 * validates everything and answers 204 whatever happens. Beacons ignore the
 * response, and a failure here must never surface on the page.
 */
export function createCollectRoute(deps: CollectDeps) {
  return new Hono().post("/", rateLimit("collect", 120, 60_000), async (c) => {
    const done = () => c.body(null, 204);
    try {
      if (!isSameOrigin(c.req.header("origin") || c.req.header("referer"), requestHost(c))) return done();
      if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return done();

      const payload = parseCollectBody(await c.req.text());
      if (!payload || payload.path.startsWith("/dashboard")) return done();

      const userAgent = c.req.header("user-agent");
      if (isBot(userAgent)) return done();
      if (!(await deps.isEnabled())) return done();

      const { browser, os, device } = parseUserAgent(userAgent);
      await deps.insert({
        type: payload.type,
        visitorId: payload.visitorId,
        sessionId: payload.sessionId,
        path: payload.path,
        route: toRoute(payload.path),
        hostname: payload.hostname,
        referrerHost: payload.referrerHost,
        utmSource: payload.utmSource,
        utmMedium: payload.utmMedium,
        utmCampaign: payload.utmCampaign,
        utmTerm: payload.utmTerm,
        utmContent: payload.utmContent,
        adClick: payload.adClick,
        country: countryFromHeader(c.req.header("cf-ipcountry")),
        device,
        browser,
        os,
        label: payload.label,
        productId: payload.productId,
        value: payload.value,
      });
      deps.afterInsert();
    } catch (err) {
      console.error("Analytics collect failed:", err);
    }
    return done();
  });
}

export default createCollectRoute({
  insert: insertEvent,
  isEnabled: isAnalyticsEnabled,
  afterInsert: () => sweepRetention("analytics"),
});
