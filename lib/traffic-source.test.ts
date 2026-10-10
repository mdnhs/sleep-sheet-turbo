import { describe, it, expect } from "vitest";
import { deriveLandingSource } from "./traffic-source";

describe("deriveLandingSource", () => {
  describe("explicit UTM tagging wins", () => {
    it("labels a Facebook UTM as an ad when the medium is paid", () => {
      expect(deriveLandingSource({ utmSource: "facebook", utmMedium: "cpc" })).toBe("facebook_ad");
    });

    it("labels a Facebook UTM without a paid medium as organic", () => {
      expect(deriveLandingSource({ utmSource: "facebook", utmMedium: "social" })).toBe("facebook_organic");
    });

    it("labels a YouTube UTM as an ad when a gclid rides along", () => {
      expect(deriveLandingSource({ utmSource: "youtube", gclid: "abc123" })).toBe("youtube_ad");
    });

    it("labels a bare YouTube UTM (no gclid, no paid medium) as organic", () => {
      expect(deriveLandingSource({ utmSource: "youtube" })).toBe("youtube_organic");
    });

    it("labels a Google UTM with a paid medium as a Google ad", () => {
      expect(deriveLandingSource({ utmSource: "google", utmMedium: "cpc" })).toBe("google_ad");
    });

    it("does not invent an ad from utm_source=google alone", () => {
      // No gclid and no paid medium — someone could tag a newsletter link
      // this way by mistake. Nothing here says it was a paid click, so this
      // falls through to whatever the referrer/click-id fallback finds:
      // nothing at all here, hence "direct", and a real referring site
      // otherwise.
      expect(deriveLandingSource({ utmSource: "google" })).toBe("direct");
      expect(deriveLandingSource({ utmSource: "google", referrer: "https://example.com/" })).toBe("referral");
    });

    it("catches a paid medium on a platform that isn't Facebook/YouTube/Google", () => {
      expect(deriveLandingSource({ utmSource: "tiktok", utmMedium: "paid" })).toBe("other_ad");
    });
  });

  describe("no UTM tagging: falls back to click ids and referrer", () => {
    it("an fbc value alone is organic Facebook, not an ad", () => {
      // fbclid is added to every outbound Facebook link, not only ads.
      expect(deriveLandingSource({ fbc: "fb.1.1700000000000.abc" })).toBe("facebook_organic");
    });

    it("a stale fbc cookie does not turn a direct visit into an ad", () => {
      expect(deriveLandingSource({ fbc: "fb.1.1700000000000.abc", referrer: null })).not.toBe("facebook_ad");
    });

    it("an untagged Facebook utm_source with fbc stays organic", () => {
      expect(deriveLandingSource({ utmSource: "facebook", fbc: "fb.1.1700000000000.abc" })).toBe("facebook_organic");
    });

    it("a gclid with a youtube.com referrer means a YouTube ad", () => {
      expect(deriveLandingSource({ gclid: "xyz", referrer: "https://www.youtube.com/watch?v=abc" })).toBe("youtube_ad");
    });

    it("a gclid with no referrer, or a non-YouTube referrer, means a Google ad", () => {
      expect(deriveLandingSource({ gclid: "xyz" })).toBe("google_ad");
      expect(deriveLandingSource({ gclid: "xyz", referrer: "https://www.google.com/" })).toBe("google_ad");
    });

    it("a gclid wins over a bare fbc", () => {
      // gclid is only issued for an ad click; fbc is not proof of one.
      expect(deriveLandingSource({ fbc: "fb.1.1700000000000.abc", gclid: "xyz" })).toBe("google_ad");
    });

    it("a bare Facebook/Instagram referrer with no click id is organic", () => {
      expect(deriveLandingSource({ referrer: "https://www.facebook.com/sleepsheet2025" })).toBe("facebook_organic");
      expect(deriveLandingSource({ referrer: "https://l.instagram.com/" })).toBe("facebook_organic");
    });

    it("a bare YouTube referrer with no gclid is organic", () => {
      expect(deriveLandingSource({ referrer: "https://youtu.be/abc123" })).toBe("youtube_organic");
    });

    it("a search engine referrer with no gclid is organic search", () => {
      expect(deriveLandingSource({ referrer: "https://www.google.com/search?q=sleep+sheet" })).toBe("organic_search");
      expect(deriveLandingSource({ referrer: "https://www.bing.com/search?q=comforter" })).toBe("organic_search");
    });

    it("no referrer at all is a normal, direct visitor", () => {
      expect(deriveLandingSource({})).toBe("direct");
      expect(deriveLandingSource({ referrer: null })).toBe("direct");
    });

    it("any other referring site is a plain referral", () => {
      expect(deriveLandingSource({ referrer: "https://www.somebengaliblog.com/reviews" })).toBe("referral");
    });

    it("an unparseable referrer is treated as no referrer", () => {
      expect(deriveLandingSource({ referrer: "not-a-url" })).toBe("direct");
    });
  });
});
