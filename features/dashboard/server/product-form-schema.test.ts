import { describe, it, expect } from "vitest";
import { productFormSchema } from "./product-form-schema";

// BAD-4 (audit 2026-09-21): product create/update accepted unvalidated
// FormData — NaN price, negative stock, unbounded discount, and a malformed
// JSON field all reached the database (or crashed with a leaked error
// message) instead of failing cleanly. These tests cover the schema that
// now guards both routes.

const validFields = {
  productName: "Cotton Comforter Set",
  productDescription: "<p>Soft and cozy.</p>",
  productPrice: "1500",
  productStock: "20",
  productSKU: "CCS-001",
  productVariants: JSON.stringify([{ name: "Red", price: null }]),
  productAddOns: JSON.stringify([{ name: "Gift wrap", price: 50 }]),
  productTags: JSON.stringify(["bestseller"]),
  productSize: JSON.stringify(["King"]),
  productFeature: JSON.stringify(["Breathable"]),
  specifications: JSON.stringify([{ key: "Material", value: "Cotton" }]),
  careInstruction: "Machine wash cold",
  isFeatured: "true",
  productCategory: "bedding",
  discount: "10",
  defaultVariantName: "Red",
};

describe("productFormSchema", () => {
  it("accepts a fully valid form submission", () => {
    const result = productFormSchema.safeParse(validFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productPrice).toBe(1500);
      expect(result.data.productStock).toBe(20);
      expect(result.data.discount).toBe(10);
      expect(result.data.isFeatured).toBe(true);
      expect(result.data.productVariants).toEqual([{ name: "Red", price: null }]);
    }
  });

  it("rejects a missing/non-numeric price instead of becoming NaN", () => {
    const result = productFormSchema.safeParse({ ...validFields, productPrice: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = productFormSchema.safeParse({ ...validFields, productPrice: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects negative stock", () => {
    const result = productFormSchema.safeParse({ ...validFields, productStock: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a discount over 100", () => {
    const result = productFormSchema.safeParse({ ...validFields, discount: "500" });
    expect(result.success).toBe(false);
  });

  it("defaults discount to 0 when omitted", () => {
    const { discount: _discount, ...rest } = validFields;
    const result = productFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.discount).toBe(0);
  });

  it("rejects malformed JSON in an array field instead of throwing", () => {
    expect(() =>
      productFormSchema.safeParse({ ...validFields, productVariants: "{not valid json" })
    ).not.toThrow();
    const result = productFormSchema.safeParse({ ...validFields, productVariants: "{not valid json" });
    expect(result.success).toBe(false);
  });

  it("rejects an array field whose JSON parses but doesn't match the item shape", () => {
    const result = productFormSchema.safeParse({
      ...validFields,
      productTags: JSON.stringify([{ not: "a string" }]),
    });
    expect(result.success).toBe(false);
  });

  it("treats a missing productAddOns as an empty array", () => {
    const { productAddOns: _addOns, ...rest } = validFields;
    const result = productFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.productAddOns).toEqual([]);
  });

  it("rejects an empty product name", () => {
    const result = productFormSchema.safeParse({ ...validFields, productName: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing category", () => {
    const result = productFormSchema.safeParse({ ...validFields, productCategory: "" });
    expect(result.success).toBe(false);
  });
});
