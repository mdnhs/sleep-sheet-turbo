export async function register() {
  // Proxy (proxy.ts) and route handlers run on the Node.js runtime, but
  // instrumentation itself also loads under `edge` during the build's edge
  // compilation pass — process.env there is a different, more limited set.
  // Only validate on the runtime that actually serves requests.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
