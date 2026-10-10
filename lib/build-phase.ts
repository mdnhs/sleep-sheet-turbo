// The production image is built in GitHub Actions, where the database is not
// reachable. Data reads during `next build` therefore have to degrade to an
// empty result, or the build fails — but at runtime the same empty result is
// poison: whatever caches it (unstable_cache, an ISR page, a route handler)
// keeps serving "no products" for a day. Readers call buildFallback() from
// their catch block: it hands back the fallback only while building and
// rethrows otherwise, so a runtime failure is never cached and the last good
// version keeps being served. lib/startup-revalidate.ts then replaces the
// empty build-time pages once the server is up.

export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function buildFallback<T>(err: unknown, fallback: T, label: string): T {
  if (isBuildPhase()) {
    console.warn(`[build] ${label}: database unreachable, using empty fallback`);
    return fallback;
  }
  throw err;
}
