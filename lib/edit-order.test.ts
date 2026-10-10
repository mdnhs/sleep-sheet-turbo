import { describe, it, expect } from "vitest";
import { calculateItemAddOnCost, colorHasAddOn } from "@/lib/utils";

function normalizeProductVariants(variants: unknown): Array<{ name: string; price: number | null }> {
  if (!Array.isArray(variants)) return [];
  return variants.map((v: unknown) => {
    if (typeof v === "string") return { name: v, price: null };
    if (v && typeof v === "object" && "name" in v) {
      const price = "price" in v ? v.price : undefined;
      return { name: String(v.name), price: typeof price === "number" ? price : null };
    }
    return { name: String(v), price: null };
  });
}

function parseAddOnsFromColor(
  color: string | null | undefined,
  availableAddOns: Array<{ name: string; price: number; costPrice?: number }>
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!color || !availableAddOns || availableAddOns.length === 0) return result;

  for (const addOn of availableAddOns) {
    if (!addOn.name) continue;
    const escaped = addOn.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s+x(\\d+)`);
    const match = color.match(regex);
    if (match && match[1]) {
      const qty = parseInt(match[1], 10);
      if (!isNaN(qty) && qty > 0) {
        result[addOn.name] = qty;
      }
    }
  }
  return result;
}

function parseBaseVariantFromColor(color: string | null | undefined): string {
  if (!color) return "";
  if (color.includes(" (+ ")) {
    return color.split(" (+ ")[0].trim();
  }
  if (color.trim().startsWith("Add-ons:")) {
    return "";
  }
  return color.trim();
}

function computeStockDeltas(
  existingItems: Array<{ id: string; productId: string; quantity: number }>,
  newItems: Array<{ id?: string; productId: string; quantity: number }>
): Map<string, number> {
  const existingMap = new Map(existingItems.map((it) => [it.id, it]));
  const deltas = new Map<string, number>();

  const addDelta = (productId: string, delta: number) => {
    deltas.set(productId, (deltas.get(productId) ?? 0) + delta);
  };

  const keptItemIds = new Set<string>();

  for (const item of newItems) {
    if (item.id && existingMap.has(item.id)) {
      keptItemIds.add(item.id);
      const existing = existingMap.get(item.id)!;
      if (existing.productId === item.productId) {
        addDelta(item.productId, existing.quantity - item.quantity);
      } else {
        addDelta(existing.productId, existing.quantity);
        addDelta(item.productId, -item.quantity);
      }
    } else {
      // New item added
      addDelta(item.productId, -item.quantity);
    }
  }

  for (const existing of existingItems) {
    if (!keptItemIds.has(existing.id)) {
      // Item removed
      addDelta(existing.productId, existing.quantity);
    }
  }

  return deltas;
}

describe("Order Edit Helpers", () => {
  describe("normalizeProductVariants", () => {
    it("handles string arrays", () => {
      const result = normalizeProductVariants(["Red", "Blue"]);
      expect(result).toEqual([
        { name: "Red", price: null },
        { name: "Blue", price: null },
      ]);
    });

    it("handles object arrays with prices", () => {
      const result = normalizeProductVariants([
        { name: "King", price: 1200 },
        { name: "Queen", price: 1000 },
      ]);
      expect(result).toEqual([
        { name: "King", price: 1200 },
        { name: "Queen", price: 1000 },
      ]);
    });

    it("handles null / undefined / empty", () => {
      expect(normalizeProductVariants(null)).toEqual([]);
      expect(normalizeProductVariants(undefined)).toEqual([]);
    });
  });

  describe("parseBaseVariantFromColor", () => {
    it("extracts base variant from composite color string", () => {
      expect(parseBaseVariantFromColor("Navy Blue (+ Pillow x2 (200 TK))")).toBe("Navy Blue");
      expect(parseBaseVariantFromColor("Red")).toBe("Red");
      expect(parseBaseVariantFromColor("Add-ons: Curtain x1 (500 TK)")).toBe("");
      expect(parseBaseVariantFromColor(null)).toBe("");
      expect(parseBaseVariantFromColor(undefined)).toBe("");
    });
  });

  describe("parseAddOnsFromColor", () => {
    const availableAddOns = [
      { name: "Pillow Cover", price: 150, costPrice: 90 },
      { name: "Extra Sheet", price: 400, costPrice: 250 },
    ];

    it("parses multiple add-ons with quantities", () => {
      const color = "Floral Blue (+ Pillow Cover x2 (150 TK), Extra Sheet x1 (400 TK))";
      const addOns = parseAddOnsFromColor(color, availableAddOns);
      expect(addOns).toEqual({
        "Pillow Cover": 2,
        "Extra Sheet": 1,
      });
    });

    it("parses add-ons only without variant", () => {
      const color = "Add-ons: Pillow Cover x3 (150 TK)";
      const addOns = parseAddOnsFromColor(color, availableAddOns);
      expect(addOns).toEqual({
        "Pillow Cover": 3,
      });
    });

    it("returns empty object when no add-ons match or are present", () => {
      expect(parseAddOnsFromColor("Navy Blue", availableAddOns)).toEqual({});
      expect(parseAddOnsFromColor(null, availableAddOns)).toEqual({});
    });
  });

  describe("calculateItemAddOnCost and colorHasAddOn", () => {
    const addOns = [
      { name: "Matching Curtain", price: 350, costPrice: 200 },
      { name: "Pillow", price: 100, costPrice: 60 },
    ];

    it("identifies if color string has add-on", () => {
      expect(colorHasAddOn("Red (+ Matching Curtain x1)")).toBe(true);
      expect(colorHasAddOn("Add-ons: Pillow x2")).toBe(true);
      expect(colorHasAddOn("Emerald Green")).toBe(false);
      expect(colorHasAddOn(null)).toBe(false);
    });

    it("calculates total add-on cost correctly", () => {
      const cost = calculateItemAddOnCost("Rose (+ Matching Curtain x2, Pillow x1)", addOns);
      expect(cost).toBe(200 * 2 + 60 * 1); // 460
    });
  });

  describe("computeStockDeltas", () => {
    it("handles quantity increases and decreases for existing items", () => {
      const existing = [{ id: "item-1", productId: "prod-A", quantity: 2 }];
      // Quantity increased from 2 to 5 -> should deduct 3 from stock (delta: -3)
      const deltasInc = computeStockDeltas(existing, [
        { id: "item-1", productId: "prod-A", quantity: 5 },
      ]);
      expect(deltasInc.get("prod-A")).toBe(-3);

      // Quantity decreased from 2 to 1 -> should return 1 to stock (delta: +1)
      const deltasDec = computeStockDeltas(existing, [
        { id: "item-1", productId: "prod-A", quantity: 1 },
      ]);
      expect(deltasDec.get("prod-A")).toBe(1);
    });

    it("handles product switches", () => {
      const existing = [{ id: "item-1", productId: "prod-A", quantity: 2 }];
      // Changed from prod-A to prod-B with qty 3
      const deltas = computeStockDeltas(existing, [
        { id: "item-1", productId: "prod-B", quantity: 3 },
      ]);
      expect(deltas.get("prod-A")).toBe(2); // Return 2 of prod-A
      expect(deltas.get("prod-B")).toBe(-3); // Deduct 3 of prod-B
    });

    it("handles item removal and addition", () => {
      const existing = [
        { id: "item-1", productId: "prod-A", quantity: 2 },
        { id: "item-2", productId: "prod-B", quantity: 1 },
      ];
      // item-1 kept as is (qty 2), item-2 removed, item-3 added (prod-C, qty 4)
      const deltas = computeStockDeltas(existing, [
        { id: "item-1", productId: "prod-A", quantity: 2 },
        { productId: "prod-C", quantity: 4 },
      ]);
      expect(deltas.get("prod-A")).toBe(0);
      expect(deltas.get("prod-B")).toBe(1); // Return 1 to prod-B
      expect(deltas.get("prod-C")).toBe(-4); // Deduct 4 from prod-C
    });
  });
});
