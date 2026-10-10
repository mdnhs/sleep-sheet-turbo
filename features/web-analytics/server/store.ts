import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { getSetting } from "@/lib/settings-cache";

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export async function insertEvent(row: NewAnalyticsEvent): Promise<void> {
  await db.insert(analyticsEvents).values(row);
}

/** On unless an admin switched it off (settings key analytics_enabled = "false"). */
export async function isAnalyticsEnabled(): Promise<boolean> {
  return (await getSetting("analytics_enabled")) !== "false";
}

/** The session's most recent event, which order attribution copies from. */
export async function findLastSessionEvent(sessionId: string): Promise<AnalyticsEvent | null> {
  const [row] = await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.sessionId, sessionId))
    .orderBy(desc(analyticsEvents.ts))
    .limit(1);
  return row ?? null;
}
