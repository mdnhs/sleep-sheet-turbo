import { describe, expect, it } from "vitest";
import {
  EMPTY_LANDING,
  SESSION_IDLE_MS,
  loadSession,
  parseLanding,
  referrerHostOf,
  resolveSession,
  saveSession,
  type StoredSession,
} from "./session";

const HOME = "https://sleepsheetbd.com/";
const ids = (...values: string[]) => {
  let i = 0;
  return () => values[i++] ?? "extra";
};

describe("referrerHostOf", () => {
  it("returns the external host without www.", () => {
    expect(referrerHostOf("https://www.youtube.com/watch?v=1", "sleepsheetbd.com")).toBe("youtube.com");
    expect(referrerHostOf("https://m.facebook.com/", "sleepsheetbd.com")).toBe("m.facebook.com");
  });

  it("treats the store's own host as no referrer, whatever the www. or case", () => {
    expect(referrerHostOf("https://www.sleepsheetbd.com/shop", "sleepsheetbd.com")).toBeNull();
    expect(referrerHostOf("https://SLEEPSHEETBD.COM/", "www.sleepsheetbd.com")).toBeNull();
    expect(referrerHostOf("https://sleepsheetbd.com/", "sleepsheetbd.com")).toBeNull();
  });

  it("returns null for an empty or broken referrer", () => {
    expect(referrerHostOf("", "sleepsheetbd.com")).toBeNull();
    expect(referrerHostOf("not a url", "sleepsheetbd.com")).toBeNull();
  });
});

describe("parseLanding", () => {
  it("reads UTM tags and the ad click id", () => {
    const landing = parseLanding(
      "https://sleepsheetbd.com/shop/a?utm_source=youtube&utm_medium=cpc&utm_campaign=oct&gclid=abc",
      "https://www.youtube.com/",
    );
    expect(landing).toEqual({
      referrerHost: "youtube.com",
      utmSource: "youtube",
      utmMedium: "cpc",
      utmCampaign: "oct",
      utmTerm: null,
      utmContent: null,
      adClick: "google",
    });
    expect(parseLanding(`${HOME}?fbclid=x`, "").adClick).toBe("facebook");
  });

  it("caps long tag values at 150 characters", () => {
    expect(parseLanding(`${HOME}?utm_campaign=${"x".repeat(400)}`, "").utmCampaign).toHaveLength(150);
  });

  it("returns an empty landing for an unparsable URL", () => {
    expect(parseLanding("::", "")).toEqual(EMPTY_LANDING);
  });
});

describe("resolveSession", () => {
  const start = 1_000_000;

  it("starts a session when there is none", () => {
    const s = resolveSession(null, start, HOME, "https://www.youtube.com/", ids("a"));
    expect(s).toEqual({ id: "a", lastSeen: start, landing: { ...EMPTY_LANDING, referrerHost: "youtube.com" } });
  });

  it("continues within the idle window and keeps the landing", () => {
    const first = resolveSession(null, start, HOME, "https://www.youtube.com/", ids("a"));
    const next = resolveSession(first, start + SESSION_IDLE_MS - 1, `${HOME}shop`, "https://sleepsheetbd.com/", ids("b"));
    expect(next.id).toBe("a");
    expect(next.lastSeen).toBe(start + SESSION_IDLE_MS - 1);
    expect(next.landing.referrerHost).toBe("youtube.com");
  });

  it("starts a new session after 30 idle minutes", () => {
    const first = resolveSession(null, start, HOME, "", ids("a"));
    expect(resolveSession(first, start + SESSION_IDLE_MS + 1, HOME, "", ids("b")).id).toBe("b");
  });

  it("keeps the session for more events on the same campaign landing URL", () => {
    const url = `${HOME}shop/a?utm_source=youtube&utm_campaign=oct`;
    const first = resolveSession(null, start, url, "", ids("a"));
    expect(resolveSession(first, start + 1000, url, "", ids("b")).id).toBe("a");
  });

  it("starts a new session for a different campaign click", () => {
    const first = resolveSession(null, start, `${HOME}?utm_campaign=oct`, "", ids("a"));
    const next = resolveSession(first, start + 1000, `${HOME}?utm_campaign=nov`, "", ids("b"));
    expect(next.id).toBe("b");
    expect(next.landing.utmCampaign).toBe("nov");
  });
});

describe("loadSession / saveSession", () => {
  const session: StoredSession = { id: "a", lastSeen: 5, landing: { ...EMPTY_LANDING, utmSource: "yt" } };
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };

  it("round-trips through storage", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    saveSession(storage, "ss_session", session);
    expect(loadSession(storage, "ss_session")).toEqual(session);
  });

  it("returns null for missing, broken or wrongly shaped values", () => {
    expect(loadSession(null, "k")).toBeNull();
    expect(loadSession({ getItem: () => "{not json" }, "k")).toBeNull();
    expect(loadSession({ getItem: () => JSON.stringify({ id: 1 }) }, "k")).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    expect(loadSession(throwing, "k")).toBeNull();
    expect(() => saveSession(throwing, "k", session)).not.toThrow();
  });
});
