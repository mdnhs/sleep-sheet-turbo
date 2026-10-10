// Session rules for first-party analytics. Pure functions: the collector
// (collector.ts) supplies the clock, the URL, the referrer and storage.

export const SESSION_IDLE_MS = 30 * 60 * 1000;

const MAX_PARAM = 150;
const MAX_HOST = 100;
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

export type AdClick = "google" | "facebook";

export interface Landing {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  adClick: AdClick | null;
}

export interface StoredSession {
  id: string;
  lastSeen: number;
  landing: Landing;
}

export const EMPTY_LANDING: Landing = {
  referrerHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  adClick: null,
};

const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** The external referrer's host without "www.", or null for none or our own site. */
export function referrerHostOf(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = bare(new URL(referrer).hostname);
    if (!host || host === bare(ownHost)) return null;
    return host.slice(0, MAX_HOST);
  } catch {
    return null;
  }
}

function param(url: URL, key: string): string | null {
  const value = url.searchParams.get(key)?.trim();
  return value ? value.slice(0, MAX_PARAM) : null;
}

export function parseLanding(href: string, referrer: string): Landing {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return EMPTY_LANDING;
  }
  return {
    referrerHost: referrerHostOf(referrer, url.hostname),
    utmSource: param(url, "utm_source"),
    utmMedium: param(url, "utm_medium"),
    utmCampaign: param(url, "utm_campaign"),
    utmTerm: param(url, "utm_term"),
    utmContent: param(url, "utm_content"),
    adClick: url.searchParams.has("gclid") ? "google" : url.searchParams.has("fbclid") ? "facebook" : null,
  };
}

function hasCampaign(href: string): boolean {
  try {
    const url = new URL(href);
    return CAMPAIGN_KEYS.some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
}

function sameCampaign(a: Landing, b: Landing): boolean {
  return (
    a.utmSource === b.utmSource &&
    a.utmMedium === b.utmMedium &&
    a.utmCampaign === b.utmCampaign &&
    a.utmTerm === b.utmTerm &&
    a.utmContent === b.utmContent &&
    a.adClick === b.adClick
  );
}

/**
 * The session this event belongs to. A new one starts when there is no
 * previous session, after SESSION_IDLE_MS without events, or when the URL
 * carries a different campaign than the session landed with (a new ad click).
 * Otherwise the session continues and only its lastSeen moves forward.
 */
export function resolveSession(
  prev: StoredSession | null,
  now: number,
  href: string,
  referrer: string,
  newId: () => string,
): StoredSession {
  const fresh = (): StoredSession => ({ id: newId(), lastSeen: now, landing: parseLanding(href, referrer) });
  if (!prev || now - prev.lastSeen > SESSION_IDLE_MS) return fresh();
  if (hasCampaign(href) && !sameCampaign(parseLanding(href, referrer), prev.landing)) return fresh();
  return { ...prev, lastSeen: now };
}

export function loadSession(storage: Pick<Storage, "getItem"> | null, key: string): StoredSession | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession> | null;
    if (
      typeof value?.id !== "string" ||
      typeof value.lastSeen !== "number" ||
      typeof value.landing !== "object" ||
      value.landing === null
    ) {
      return null;
    }
    return { id: value.id, lastSeen: value.lastSeen, landing: { ...EMPTY_LANDING, ...value.landing } };
  } catch {
    return null;
  }
}

export function saveSession(storage: Pick<Storage, "setItem"> | null, key: string, session: StoredSession): void {
  try {
    storage?.setItem(key, JSON.stringify(session));
  } catch {
    // Storage blocked or full: the collector keeps the session in memory.
  }
}
