// Crawlers, link-preview fetchers, monitoring probes and headless automation.
// In-app browsers (Facebook, Instagram, YouTube) are real visitors and must not
// match: their user agents carry FBAN/FBAV/Instagram tokens, none of these.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|phantomjs|selenium|puppeteer|playwright/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/** Cloudflare's cf-ipcountry as ISO alpha-2, or null for unknown (XX) / Tor (T1). */
export function countryFromHeader(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
}
