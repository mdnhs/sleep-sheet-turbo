import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  purchaseGtmEventId,
  trackGtmEcommerce,
  trackGtmSearch,
  trackGtmPurchase,
  trackGtmAddToCart,
} from "./index";

/**
 * Every dataLayer push must carry an `event_id`.
 *
 * The web container fires the Meta Pixel in the browser and forwards the same
 * event to the server container, whose Stape CAPI tag fires on every GA4
 * event. Meta collapses the pair only when both sides send the same
 * `event_id`; without one, each event is counted twice.
 */
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

const pushes = () => window.dataLayer.filter((e) => e.event);

beforeEach(() => {
  vi.stubGlobal("window", { dataLayer: [] as Record<string, unknown>[] });
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("purchaseGtmEventId", () => {
  // Must match what the web container's Meta Pixel Purchase tag builds from
  // {{dlv - ecommerce.transaction_id}}, so the two agree whether or not that
  // tag has been switched over to read event_id yet.
  it("prefixes the transaction id", () => {
    expect(purchaseGtmEventId("ORD-160925-K3P9XQ")).toBe("purchase_ORD-160925-K3P9XQ");
  });

  it("does not double-prefix an id that already carries one", () => {
    expect(purchaseGtmEventId("purchase_ORD-1")).toBe("purchase_ORD-1");
  });

  // A refresh of the success page must not look like a second sale.
  it("is deterministic for the same transaction", () => {
    expect(purchaseGtmEventId("ORD-1")).toBe(purchaseGtmEventId("ORD-1"));
  });

  it("differs between transactions", () => {
    expect(purchaseGtmEventId("ORD-1")).not.toBe(purchaseGtmEventId("ORD-2"));
  });
});

describe("trackGtmEcommerce", () => {
  it("stamps every push with an event_id", () => {
    trackGtmEcommerce("view_item", { currency: "BDT", items: [] });
    expect(pushes()[0].event_id).toMatch(/^view_item_/);
  });

  it("gives two occurrences of the same event different ids", () => {
    trackGtmEcommerce("view_item", { currency: "BDT", items: [] });
    trackGtmEcommerce("view_item", { currency: "BDT", items: [] });
    const [a, b] = pushes();
    expect(a.event_id).not.toBe(b.event_id);
  });

  it("uses an explicit id when given one", () => {
    trackGtmEcommerce("purchase", {}, undefined, "purchase_ORD-9");
    expect(pushes()[0].event_id).toBe("purchase_ORD-9");
  });

  // GTM best practice: clear `ecommerce` before each push. The reset must not
  // be mistaken for an event.
  it("still clears the previous ecommerce object first", () => {
    trackGtmEcommerce("add_to_cart", { currency: "BDT", items: [] });
    expect(window.dataLayer[0]).toEqual({ ecommerce: null });
  });
});

describe("trackGtmSearch", () => {
  it("stamps the search push, which does not go through trackGtmEcommerce", () => {
    trackGtmSearch("comforter");
    const [push] = pushes();
    expect(push.event).toBe("search");
    expect(push.search_term).toBe("comforter");
    expect(push.event_id).toMatch(/^search_/);
  });
});

describe("trackGtmAddToCart", () => {
  it("stamps the push", () => {
    trackGtmAddToCart({ currency: "BDT", value: 100, items: [{ item_id: "p1", item_name: "P" }] });
    expect(pushes()[0].event_id).toMatch(/^add_to_cart_/);
  });
});

describe("trackGtmPurchase", () => {
  const order = {
    transaction_id: "ORD-160925-K3P9XQ",
    order_id: "cmabc123",
    value: 1200,
    currency: "BDT",
    items: [{ item_id: "p1", item_name: "P", price: 1200, quantity: 1 }],
  };

  it("derives the event_id from the transaction id, not the order id", () => {
    trackGtmPurchase(order);
    expect(pushes()[0].event_id).toBe("purchase_ORD-160925-K3P9XQ");
  });

  // The existing guard: a second call for the same order pushes nothing, so
  // the question of a mismatched id never arises. Uses its own transaction id
  // because the guard is a module-level Set that outlives a single test.
  it("does not push twice for the same order", () => {
    const repeat = { ...order, transaction_id: "ORD-160925-REPEAT", order_id: "cmrepeat" };
    expect(trackGtmPurchase(repeat)).toBe(true);
    expect(trackGtmPurchase(repeat)).toBe(false);
    expect(pushes()).toHaveLength(1);
  });
});
