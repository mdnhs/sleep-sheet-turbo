import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { lt } from "drizzle-orm";

// Activity rows are append-only and were never pruned, so the table grew
// forever. A bigger table means slower scans (more compute time) and more
// storage, for data nobody looks at after a few weeks.
//
// There is no cron in this app, so the sweep is opportunistic: the write paths
// call it, and it actually runs at most once per SWEEP_INTERVAL_MS per server
// instance. Deletes are indexed on createdAt, so a no-op sweep is cheap.
export const ACTIVITY_RETENTION_DAYS = 90;

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // once an hour per instance

const lastSweep: Record<string, number> = {};

function due(key: string): boolean {
  const now = Date.now();
  if (lastSweep[key] && now - lastSweep[key] < SWEEP_INTERVAL_MS) return false;
  // Stamped before the work runs so concurrent requests don't all sweep.
  lastSweep[key] = now;
  return true;
}

function cutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Delete activity log entries older than the retention window. */
export async function purgeOldActivityLogs(): Promise<void> {
  await db.delete(activityLogs).where(lt(activityLogs.createdAt, cutoff(ACTIVITY_RETENTION_DAYS)));
}

/**
 * Fire-and-forget hourly sweep. Never awaited by request handlers and never
 * throws — a failed cleanup must not fail the request that triggered it.
 */
export function sweepRetention(kind: "activity"): void {
  if (!due(kind)) return;
  void purgeOldActivityLogs().catch((err) =>
    console.error(`Retention sweep (${kind}) failed:`, err)
  );
}
