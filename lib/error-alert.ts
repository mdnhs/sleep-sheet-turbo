import { after } from "next/server";

const ALERT_WINDOW_MS = 5 * 60_000;
const lastSent = new Map<string, number>();

/**
 * One alert per distinct error per window, so a crash loop sends one
 * Telegram message instead of hundreds. In-process, like the rate limiter:
 * enough for one container.
 */
export function shouldSendAlert(key: string, now: number, windowMs = ALERT_WINDOW_MS): boolean {
  const last = lastSent.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  lastSent.set(key, now);
  if (lastSent.size > 500) {
    for (const [k, t] of lastSent) if (now - t >= windowMs) lastSent.delete(k);
  }
  return true;
}

export function resetAlertThrottle(): void {
  lastSent.clear();
}

/** Fire-and-forget alert to n8n (→ Telegram). No-op unless N8N_ERROR_WEBHOOK_URL is set. */
export function notifyServerError(details: { method: string; path: string; message: string }): void {
  const webhookUrl = process.env.N8N_ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;
  if (!shouldSendAlert(`${details.method} ${details.path} ${details.message}`, Date.now())) return;

  after(() =>
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...details, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      console.error("n8n error alert failed:", error);
    })
  );
}
