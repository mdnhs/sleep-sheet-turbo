import { describe, expect, it } from "vitest";
import { gtmContainer } from "@/lib/gtm/container";

describe("gtmContainer", () => {
  it("loads the container saved in settings from the saved first-party host", () => {
    expect(gtmContainer({ gtm_web_id: "GTM-ABC123", gtm_server_url: "https://ss.example.com/" })).toEqual({
      id: "GTM-ABC123",
      host: "https://ss.example.com",
    });
  });

  it("falls back to Google's host when no server container is saved", () => {
    expect(gtmContainer({ gtm_web_id: "GTM-ABC123" })?.host).toBe("https://www.googletagmanager.com");
  });

  it("uses the env id when settings have none", () => {
    expect(gtmContainer({}, "GTM-ENV1")?.id).toBe("GTM-ENV1");
  });

  it("loads nothing rather than a hardcoded container", () => {
    expect(gtmContainer({})).toBeNull();
    expect(gtmContainer(undefined)).toBeNull();
  });

  it("ignores a malformed id", () => {
    expect(gtmContainer({ gtm_web_id: "UA-1234" })).toBeNull();
  });
});
