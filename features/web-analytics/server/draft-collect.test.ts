import { describe, expect, it } from "vitest";
import { createDraftCollectRoute, type DraftCollectDeps } from "./draft-collect";
import { draftValue, parseDraftBody, type DraftPayload } from "./drafts";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const valid = {
  sessionId: "s1",
  visitorId: "v1",
  fullName: "Rahim",
  phone: "+880 1712-345678",
  email: "",
  address: "House 1, Road 2, Dhanmondi",
  shippingZone: "inside_dhaka",
  items: [{ productId: "p1", name: "Bedsheet", quantity: 2, price: 1200, size: "King", color: null }],
};

function setup(overrides: Partial<DraftCollectDeps> = {}) {
  const saved: { draft: DraftPayload; landing: { referrerHost: string | null; utmSource: string | null } }[] = [];
  const app = createDraftCollectRoute({
    upsert: async (draft, landing) => {
      saved.push({ draft, landing });
    },
    findLanding: async () => ({ referrerHost: "facebook.com", utmSource: "fb" }),
    isEnabled: async () => true,
    ...overrides,
  });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request("/", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        origin: "http://localhost",
        "user-agent": CHROME_MAC,
        "content-type": "text/plain",
        "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.2`,
        ...headers,
      },
    });
  return { saved, post };
}

describe("parseDraftBody", () => {
  it("normalizes the phone and blanks empty optionals", () => {
    const draft = parseDraftBody(JSON.stringify(valid));
    expect(draft).toMatchObject({ phone: "01712345678", email: null, fullName: "Rahim" });
  });

  it("rejects an invalid phone, an empty cart and bad JSON", () => {
    expect(parseDraftBody(JSON.stringify({ ...valid, phone: "12345" }))).toBeNull();
    expect(parseDraftBody(JSON.stringify({ ...valid, items: [] }))).toBeNull();
    expect(parseDraftBody("{nope")).toBeNull();
  });

  it("totals the cart", () => {
    expect(draftValue([{ productId: "a", name: "A", quantity: 3, price: 99.9, size: null, color: null }])).toBe(299.7);
  });
});

describe("POST /api/t/draft", () => {
  it("saves a valid draft with the session's landing attributes", async () => {
    const { saved, post } = setup();
    expect((await post(valid)).status).toBe(204);
    expect(saved).toHaveLength(1);
    expect(saved[0].draft.phone).toBe("01712345678");
    expect(saved[0].landing).toEqual({ referrerHost: "facebook.com", utmSource: "fb" });
  });

  it("drops cross-origin, bot, disabled and invalid requests", async () => {
    const { saved, post } = setup();
    await post(valid, { origin: "https://evil.example" });
    await post(valid, { "user-agent": "Googlebot/2.1" });
    await post({ ...valid, phone: "017" });
    expect(saved).toHaveLength(0);

    const off = setup({ isEnabled: async () => false });
    await off.post(valid);
    expect(off.saved).toHaveLength(0);
  });
});
