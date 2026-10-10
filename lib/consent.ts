/**
 * Google Consent Mode v2 — cookie/ad tags stay in "denied" state (set by the
 * inline script in components/consent-default-script.tsx, which runs before
 * anything else on the page) until the visitor answers the cookie banner
 * (components/cookie-consent-banner.tsx). Both files read/write the same
 * cookie, kept in sync here as one source of truth for its name and shape.
 *
 * Two categories only — analytics and ads — not the full Google Consent Mode
 * v2 signal list, since this storefront has no functionality/personalization
 * cookie that isn't one of those two anyway. `security_storage` is never
 * asked about; it stays granted, same as any site's fraud-prevention cookies.
 */

export const COOKIE_CONSENT_NAME = "cookie_consent";
const COOKIE_CONSENT_DAYS = 180;

export type ConsentChoice = "granted" | "denied";

export interface StoredConsent {
  analytics: ConsentChoice;
  ads: ConsentChoice;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/** The visitor's stored choice, or null if they haven't answered the banner yet. */
export function getStoredConsent(): StoredConsent | null {
  const raw = getCookie(COOKIE_CONSENT_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.analytics && parsed.ads) return parsed;
  } catch {
    /* fall through to null below */
  }
  return null;
}

function pushConsentUpdate(consent: StoredConsent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown as unknown[]).push(arguments);
  };
  window.gtag("consent", "update", {
    analytics_storage: consent.analytics,
    ad_storage: consent.ads,
    ad_user_data: consent.ads,
    ad_personalization: consent.ads,
  });
}

/** Record the visitor's choice and tell Google's tags about it immediately. */
export function saveConsent(consent: StoredConsent): void {
  setCookie(COOKIE_CONSENT_NAME, JSON.stringify(consent), COOKIE_CONSENT_DAYS);
  pushConsentUpdate(consent);
}

export const ACCEPT_ALL_CONSENT: StoredConsent = { analytics: "granted", ads: "granted" };
export const REJECT_ALL_CONSENT: StoredConsent = { analytics: "denied", ads: "denied" };

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}
