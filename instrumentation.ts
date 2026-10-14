export async function register() {
  // Proxy (proxy.ts) and route handlers run on the Node.js runtime, but
  // instrumentation itself also loads under `edge` during the build's edge
  // compilation pass — process.env there is a different, more limited set.
  // Only validate on the runtime that actually serves requests.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();

    // Replace the database-less pages from the CI build once the production
    // server is up (not during `next build` or `next dev`).
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      const { scheduleStartupRevalidation } = await import("@/lib/startup-revalidate");
      scheduleStartupRevalidation();
    }
    // Telegram alerts for abandoned checkouts; a no-op unless its webhook is set.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { scheduleDraftAlerts } = await import("@/features/web-analytics/server/draft-alerts");
      scheduleDraftAlerts();
    }
  }
}
