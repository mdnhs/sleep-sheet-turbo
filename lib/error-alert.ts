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

const MAX_MESSAGE = 300;

/**
 * Text that is safe to send to Telegram. Drizzle wraps driver errors as
 * "Failed query: <sql>\nparams: <params>", and the params are customer phones
 * and emails, so everything from "\nparams:" on is dropped. The cause (the
 * driver's own error) is the useful part when there is one.
 */
export function sanitizeAlertMessage(err: unknown): string {
  const cause = err instanceof Error ? err.cause : undefined;
  const source = cause instanceof Error ? cause : err;
  const raw = source instanceof Error ? source.message : String(source);
  const cut = raw.indexOf("\nparams:");
  return (cut === -1 ? raw : raw.slice(0, cut)).slice(0, MAX_MESSAGE);
}

/**
 * Throttle key: method + path + error kind. Never the message, which can carry
 * per-request values (query params), so one DB outage is one key, not one per
 * request. The cause's code (e.g. ECONNREFUSED) wins over the class name.
 */
export function alertKey(method: string, path: string, err: unknown): string {
  const cause = err instanceof Error ? err.cause : undefined;
  const code = (cause as { code?: unknown } | undefined)?.code;
  const kind = typeof code === "string" ? code : err instanceof Error ? err.name : typeof err;
  return `${method} ${path} ${kind}`;
}

/** Fire-and-forget alert to n8n (→ Telegram). No-op unless N8N_ERROR_WEBHOOK_URL is set. */
export function notifyServerError(details: { method: string; path: string; message: string; key?: string }): void {
  const webhookUrl = process.env.N8N_ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;
  const { key, ...payload } = details;
  if (!shouldSendAlert(key ?? `${details.method} ${details.path} ${details.message}`, Date.now())) return;

  after(() =>
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      console.error("n8n error alert failed:", error);
    })
  );
}
