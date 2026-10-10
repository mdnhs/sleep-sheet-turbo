import { describe, expect, it } from "vitest";
import { countryFromHeader, isBot } from "./request-info";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const FACEBOOK_IN_APP =
  "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/485.0.0.70.77;]";

describe("isBot", () => {
  it("lets real browsers through, including Facebook's in-app browser", () => {
    expect(isBot(CHROME_MAC)).toBe(false);
    expect(isBot(IPHONE_SAFARI)).toBe(false);
    expect(isBot(FACEBOOK_IN_APP)).toBe(false);
  });

  it("flags crawlers, preview fetchers, headless browsers and scripts", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(
      isBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36"),
    ).toBe(true);
    expect(isBot("Mozilla/5.0 (Linux; Android 11) Chrome/141.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
  });

  it("treats a missing user agent as a bot", () => {
    expect(isBot(undefined)).toBe(true);
    expect(isBot("")).toBe(true);
  });
});

describe("countryFromHeader", () => {
  it("normalises a two-letter code", () => {
    expect(countryFromHeader("BD")).toBe("BD");
    expect(countryFromHeader(" bd ")).toBe("BD");
  });

  it("drops unknown, Tor and malformed values", () => {
    expect(countryFromHeader("XX")).toBeNull();
    expect(countryFromHeader("T1")).toBeNull();
    expect(countryFromHeader("BGD")).toBeNull();
    expect(countryFromHeader("")).toBeNull();
    expect(countryFromHeader(undefined)).toBeNull();
  });
});
