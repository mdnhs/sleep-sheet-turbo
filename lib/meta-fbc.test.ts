import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureFbclid, fbclidFromFbc, getCapturedFbc } from "./meta-fbc";

/**
 * The click id decides which ad a sale is credited to, and it is the one
 * identifier a returning customer can silently carry from the wrong
 * campaign, so these pin the overwrite rules rather than just "a cookie gets
 * written".
 */

// A cookie jar just real enough for the module: document.cookie assignment
// appends, reading returns "k=v; k=v".
let jar: Record<string, string>;
let store: Record<string, string>;

function setUrl(search: string) {
  (globalThis as Record<string, unknown>).window = {
    location: { search },
  };
}

beforeEach(() => {
  jar = {};
  store = {};
  (globalThis as Record<string, unknown>).document = {
    get cookie() {
      return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(raw: string) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1);
    },
  };
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
  };
  setUrl("");
});

afterEach(() => {
  for (const key of ["window", "document", "localStorage"]) {
    delete (globalThis as Record<string, unknown>)[key];
  }
});

describe("fbclidFromFbc", () => {
  it("reads the click id out of Meta's format", () => {
    expect(fbclidFromFbc("fb.1.1700000000000.ABC123")).toBe("ABC123");
  });

  it("keeps a click id that contains a dot", () => {
    expect(fbclidFromFbc("fb.1.1700000000000.AB.CD")).toBe("AB.CD");
  });

  it("returns null for anything that is not an fbc value", () => {
    expect(fbclidFromFbc(null)).toBeNull();
    expect(fbclidFromFbc("")).toBeNull();
    expect(fbclidFromFbc("fb.1.123")).toBeNull();
  });
});

describe("captureFbclid", () => {
  it("does nothing without an fbclid in the URL", () => {
    captureFbclid();
    expect(getCapturedFbc()).toBeUndefined();
  });

  it("stores a click id in Meta's format", () => {
    setUrl("?fbclid=FIRSTCLICK");
    captureFbclid();
    const fbc = getCapturedFbc();
    expect(fbc).toMatch(/^fb\.1\.\d+\.FIRSTCLICK$/);
    expect(store._fbc_captured).toBe(fbc);
  });

  it("overwrites a stored click id when a NEW ad is clicked", () => {
    setUrl("?fbclid=OLDCLICK");
    captureFbclid();
    const first = getCapturedFbc();

    setUrl("?fbclid=NEWCLICK");
    captureFbclid();

    // The regression this guards: the cookie lives 90 days, so bailing out
    // whenever one existed credited the new sale to the old campaign.
    expect(getCapturedFbc()).not.toBe(first);
    expect(fbclidFromFbc(getCapturedFbc())).toBe("NEWCLICK");
  });

  it("leaves the stored value untouched on a repeat view of the same click", () => {
    setUrl("?fbclid=SAMECLICK");
    captureFbclid();
    const first = getCapturedFbc();

    captureFbclid();

    // Rewriting would push the creation timestamp forward on every page
    // view, which is meant to record when the click happened.
    expect(getCapturedFbc()).toBe(first);
  });

  it("falls back to localStorage when the cookie did not stick", () => {
    setUrl("?fbclid=BLOCKEDCOOKIE");
    captureFbclid();
    const stored = store._fbc_captured;
    jar = {};
    expect(getCapturedFbc()).toBe(stored);
  });
});
