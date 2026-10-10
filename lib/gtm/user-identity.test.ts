import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { primeGtmIdentity, getGtmIdentity, clearGtmIdentity } from "./user-identity";
import { trackGtmEcommerce, trackGtmAddToCart } from "./index";

/**
 * Only Purchase used to carry identifiers. Everything else reached Meta with
 * an IP and a user agent, which is the weakest match it accepts — and the
 * server-side copy has nothing else to fall back on.
 */

let pushed: Record<string, unknown>[];

beforeEach(async () => {
  clearGtmIdentity();
  pushed = [];
  (globalThis as Record<string, unknown>).window = {
    location: { pathname: "/shop" },
    dataLayer: pushed,
  };
  // captureFbclid's reader, and the add_to_cart throttle
  (globalThis as Record<string, unknown>).document = { cookie: "" };
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  const w = (globalThis as Record<string, unknown>).window as { dataLayer: unknown[] };
  w.dataLayer = pushed;
});

afterEach(() => {
  clearGtmIdentity();
  for (const k of ["window", "document", "localStorage", "sessionStorage"]) {
    delete (globalThis as Record<string, unknown>)[k];
  }
});

const lastEvent = () => pushed.filter((p) => p.event).at(-1);

describe("primeGtmIdentity", () => {
  it("hashes the signed-in user's identifiers", async () => {
    await primeGtmIdentity({ id: "u1", email: "Customer@Example.COM", phone: "01700000000" });
    const identity = getGtmIdentity();
    expect(identity?.external_id).toBe("u1");
    expect(identity?.email_sha256).toBe(
      "e233d4a29013e9d87150c6237c6777bedf379ebf1acdc5d6126fec7e8bb74fb5",
    );
    expect(identity?.phone_sha256).toBe(
      "12c84ad04eb79fc11a96dc89aa966423ff15513b1257bcacacdd93db3c509112",
    );
  });

  it("clears on sign-out so the next visitor inherits nothing", async () => {
    await primeGtmIdentity({ id: "u1", email: "a@b.com", phone: "01700000000" });
    await primeGtmIdentity(null);
    expect(getGtmIdentity()).toBeUndefined();
  });

  it("primes guest identity with phone even without user.id", async () => {
    await primeGtmIdentity({ phone: "01800000000" });
    const identity = getGtmIdentity();
    expect(identity?.external_id).toBeUndefined();
    expect(identity?.phone_number).toBe("01800000000");
    expect(identity?.phone_sha256).toBeDefined();
  });
});

describe("events carry the identity", () => {
  it("attaches it to an event whose caller passed none", async () => {
    await primeGtmIdentity({ id: "u1", email: "a@b.com", phone: "01700000000" });
    trackGtmAddToCart({ currency: "BDT", value: 100, items: [{ item_id: "p1", item_name: "P" }] });

    const event = lastEvent();
    expect(event?.event).toBe("add_to_cart");
    expect((event?.user_data as Record<string, unknown>)?.external_id).toBe("u1");
  });

  it("lets the caller's own values win, field by field", async () => {
    await primeGtmIdentity({ id: "session-user", email: "session@b.com", phone: "01700000000" });
    trackGtmEcommerce("purchase", { value: 1 }, {
      user_data: { external_id: "order-user", email: "guest@b.com" },
    });

    const ud = lastEvent()?.user_data as Record<string, unknown>;
    // The order knows the buyer better than the session does...
    expect(ud.external_id).toBe("order-user");
    expect(ud.email).toBe("guest@b.com");
    // ...but does not wipe what it had nothing to say about.
    expect(ud.phone_sha256).toBe(
      "12c84ad04eb79fc11a96dc89aa966423ff15513b1257bcacacdd93db3c509112",
    );
  });

  it("sends no user_data at all when nothing is known", () => {
    trackGtmEcommerce("view_item", { value: 1 });
    expect(lastEvent()?.user_data).toBeUndefined();
  });
});
