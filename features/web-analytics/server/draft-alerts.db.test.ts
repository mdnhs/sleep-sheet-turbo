import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { checkoutDrafts } from "@/db/schema";
import { claimIdleDrafts, draftAlertPayload, sendIdleDraftAlerts } from "./draft-alerts";
import { markDraftConverted, parseDraftBody, upsertDraft } from "./drafts";

// Claims drafts across the whole table, so run it against the local Docker
// Postgres only — never the preview or production database:
//   set -a && source .env && set +a && DATABASE_URL="$LOCAL_DATABASE_URL" RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/draft-alerts.db.test.ts
const RUN = process.env.RUN_DB_TESTS === "1";

const SESSIONS = ["alert-test-idle", "alert-test-fresh", "alert-test-old", "alert-test-converted"];
const landing = { referrerHost: null, utmSource: null };
const NOW = new Date();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

async function seed(sessionId: string, phone: string, lastTouched: Date) {
  const parsed = parseDraftBody(
    JSON.stringify({
      sessionId,
      visitorId: "alert-test-v",
      fullName: "Test Customer",
      phone,
      address: "House 1, Dhaka",
      items: [{ productId: "p1", name: "Bedsheet", quantity: 2, price: 1500, size: "King" }],
    }),
  );
  if (!parsed) throw new Error("fixture did not parse");
  await upsertDraft(parsed, landing);
  await db.update(checkoutDrafts).set({ updatedAt: lastTouched }).where(eq(checkoutDrafts.sessionId, sessionId));
}

async function notifiedSessions() {
  const rows = await db
    .select({ sessionId: checkoutDrafts.sessionId, notifiedAt: checkoutDrafts.notifiedAt })
    .from(checkoutDrafts)
    .where(inArray(checkoutDrafts.sessionId, SESSIONS));
  return rows.filter((row) => row.notifiedAt).map((row) => row.sessionId);
}

describe.skipIf(!RUN)("checkout draft alerts", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete(checkoutDrafts).where(inArray(checkoutDrafts.sessionId, SESSIONS));
  });

  it("claims only open drafts idle 20+ minutes inside the lookback, and only once", async () => {
    await seed("alert-test-idle", "01700000011", minutesAgo(25));
    await seed("alert-test-fresh", "01700000012", minutesAgo(5));
    await seed("alert-test-old", "01700000013", minutesAgo(7 * 60));
    await seed("alert-test-converted", "01700000014", minutesAgo(25));
    await markDraftConverted({ orderId: "ord-alert", phone: "01700000014" });

    const claimed = (await claimIdleDrafts(NOW)).filter((d) => d.phone.startsWith("0170000001"));
    expect(claimed.map((d) => d.phone)).toEqual(["01700000011"]);
    expect(draftAlertPayload(claimed[0]!)).toMatchObject({
      customerName: "Test Customer",
      customerPhone: "01700000011",
      address: "House 1, Dhaka",
      totalAmount: 3000,
      items: [{ productId: "p1", name: "Bedsheet", quantity: 2, price: 1500, size: "King", color: null }],
    });

    const again = (await claimIdleDrafts(NOW)).filter((d) => d.phone.startsWith("0170000001"));
    expect(again).toHaveLength(0);
    expect(await notifiedSessions()).toEqual(["alert-test-idle"]);
  });

  it("puts a draft back in line when the webhook fails", async () => {
    await seed("alert-test-idle", "01700000011", minutesAgo(25));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendIdleDraftAlerts("https://n8n.test/webhook", NOW)).toBe(0);
    expect(await notifiedSessions()).toEqual([]);

    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendIdleDraftAlerts("https://n8n.test/webhook", NOW)).toBeGreaterThanOrEqual(1);
    expect(await notifiedSessions()).toEqual(["alert-test-idle"]);
  });
});
