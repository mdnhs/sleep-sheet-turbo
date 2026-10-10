import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, parseCollectBody } from "./payload";

const valid = {
  type: "page_view",
  path: "/shop/premium-comforter",
  hostname: "sleepsheetbd.com",
  visitorId: "v1",
  sessionId: "s1",
  referrerHost: "youtube.com",
  utmSource: "youtube",
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  adClick: null,
  label: null,
  productId: null,
  value: null,
};

describe("parseCollectBody", () => {
  it("accepts a well-formed payload", () => {
    expect(parseCollectBody(JSON.stringify(valid))).toEqual(valid);
  });

  it("fills omitted optional fields with null", () => {
    const parsed = parseCollectBody(JSON.stringify({ type: "page_view", path: "/", visitorId: "v", sessionId: "s" }));
    expect(parsed).toMatchObject({ hostname: null, referrerHost: null, adClick: null, value: null });
  });

  it("turns blank strings into null", () => {
    expect(parseCollectBody(JSON.stringify({ ...valid, utmSource: "  " }))?.utmSource).toBeNull();
  });

  it("rejects malformed and hostile bodies", () => {
    expect(parseCollectBody("not json")).toBeNull();
    expect(parseCollectBody("null")).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, type: "order_complete" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, type: "drop_table" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, path: "shop" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, value: -5 }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, visitorId: "" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, label: "x".repeat(301) }))).toBeNull();
  });

  it("rejects bodies over the size cap", () => {
    expect(parseCollectBody(JSON.stringify({ ...valid, label: "x" }).padEnd(MAX_BODY_BYTES + 1, " "))).toBeNull();
  });

  it("counts the size cap in UTF-8 bytes, not characters", () => {
    const body = JSON.stringify({ ...valid, label: "x" });
    // Multi-byte padding: well under the cap in characters, over it in bytes.
    const padding = "\u09E6".repeat(Math.ceil((MAX_BODY_BYTES - body.length) / 3) + 1);
    const raw = body.slice(0, -1) + `,"pad":"${padding}"}`;
    expect(raw.length).toBeLessThan(MAX_BODY_BYTES);
    expect(parseCollectBody(raw)).toBeNull();
  });

  it("accepts a 300-character Bengali label", () => {
    const label = "স".repeat(300);
    const raw = JSON.stringify({ ...valid, label });
    expect(new TextEncoder().encode(raw).length).toBeGreaterThan(raw.length); // multi-byte
    expect(parseCollectBody(raw)?.label).toBe(label);
  });
});
