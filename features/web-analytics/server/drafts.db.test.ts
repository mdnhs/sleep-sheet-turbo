import { afterEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { checkoutDrafts } from "@/db/schema";
import { dismissDraft, listOpenDrafts, markDraftConverted, parseDraftBody, upsertDraft } from "./drafts";

// Runs against the local Docker Postgres:
//   set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/drafts.db.test.ts
// The draft helpers use the shared db handle, so each test deletes its own rows.
const RUN = process.env.RUN_DB_TESTS === "1";

const SESSIONS = ["draft-test-s1", "draft-test-s2"];
const landing = { referrerHost: null, utmSource: null };

function draft(sessionId: string, phone: string, fullName = "Test") {
  const parsed = parseDraftBody(
    JSON.stringify({
      sessionId,
      visitorId: "draft-test-v",
      fullName,
      phone,
      items: [{ productId: "p1", name: "Bedsheet", quantity: 1, price: 1500 }],
    }),
  );
  if (!parsed) throw new Error("fixture did not parse");
  return parsed;
}

async function rows() {
  return db.select().from(checkoutDrafts).where(inArray(checkoutDrafts.sessionId, SESSIONS));
}

describe.skipIf(!RUN)("checkout drafts", () => {
  afterEach(async () => {
    await db.delete(checkoutDrafts).where(inArray(checkoutDrafts.sessionId, SESSIONS));
  });

  it("upserts one row per session and keeps the latest fields", async () => {
    await upsertDraft(draft("draft-test-s1", "01700000001", "First"), landing);
    await upsertDraft(draft("draft-test-s1", "01700000001", "Second"), landing);
    const [row, ...rest] = await rows();
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ fullName: "Second", phone: "01700000001", status: "open", value: 1500 });
  });

  it("converts by session or phone, and a late beacon can't reopen it", async () => {
    await upsertDraft(draft("draft-test-s1", "01700000001"), landing);
    await upsertDraft(draft("draft-test-s2", "01700000002"), landing);
    await markDraftConverted({ orderId: "ord-1", sessionId: "draft-test-s1" });
    await markDraftConverted({ orderId: "ord-2", phone: "+8801700000002" });
    await upsertDraft(draft("draft-test-s1", "01700000001", "Late"), landing);

    const byS = Object.fromEntries((await rows()).map((r) => [r.sessionId, r]));
    expect(byS["draft-test-s1"]).toMatchObject({ status: "converted", orderId: "ord-1", fullName: "Test" });
    expect(byS["draft-test-s2"]).toMatchObject({ status: "converted", orderId: "ord-2" });
  });

  it("dismisses open drafts and drops them from the list", async () => {
    await upsertDraft(draft("draft-test-s1", "01700000001"), landing);
    const [row] = await rows();
    expect(await dismissDraft(row.id)).toBe(true);
    expect(await dismissDraft(row.id)).toBe(false);
    const open = await listOpenDrafts(50, 0);
    expect(open.find((d) => d.id === row.id)).toBeUndefined();
  });
});
