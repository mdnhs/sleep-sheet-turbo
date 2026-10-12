import { Hono } from "hono";
import { rateLimit } from "@/lib/rate-limit";
import { isBot } from "../lib/request-info";
import { isSameOrigin, requestHost } from "./collect";
import { MAX_DRAFT_BODY_BYTES, parseDraftBody, upsertDraft, type DraftPayload } from "./drafts";
import { findLastSessionEvent, isAnalyticsEnabled } from "./store";

export interface DraftCollectDeps {
  upsert: (draft: DraftPayload, landing: { referrerHost: string | null; utmSource: string | null }) => Promise<void>;
  findLanding: (sessionId: string) => Promise<{ referrerHost: string | null; utmSource: string | null } | null>;
  isEnabled: () => Promise<boolean>;
}

/**
 * POST /api/t/draft: the checkout form's autosave beacon, sent once the
 * visitor has typed a valid phone. Public, so it validates everything and
 * answers 204 whatever happens, like /api/t. Off with analytics tracking.
 */
export function createDraftCollectRoute(deps: DraftCollectDeps) {
  return new Hono().post("/", rateLimit("checkout-draft", 30, 60_000), async (c) => {
    const done = () => c.body(null, 204);
    try {
      if (!isSameOrigin(c.req.header("origin") || c.req.header("referer"), requestHost(c))) return done();
      if (Number(c.req.header("content-length") ?? 0) > MAX_DRAFT_BODY_BYTES) return done();
      if (isBot(c.req.header("user-agent"))) return done();

      const draft = parseDraftBody(await c.req.text());
      if (!draft) return done();
      if (!(await deps.isEnabled())) return done();

      const landing = await deps.findLanding(draft.sessionId);
      await deps.upsert(draft, {
        referrerHost: landing?.referrerHost ?? null,
        utmSource: landing?.utmSource ?? null,
      });
    } catch (err) {
      console.error("Checkout draft collect failed:", err);
    }
    return done();
  });
}

export default createDraftCollectRoute({
  upsert: upsertDraft,
  findLanding: findLastSessionEvent,
  isEnabled: isAnalyticsEnabled,
});
