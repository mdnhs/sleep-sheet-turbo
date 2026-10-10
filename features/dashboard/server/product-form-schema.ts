import { z } from "zod";

/**
 * Product create/update take `multipart/form-data` (they carry image files
 * alongside the product fields), so they can't use Hono's `zValidator("form",
 * ...)` the way every JSON route does — that target doesn't give a clean way
 * to keep the existing multi-file `formData.getAll("productImages")` handling
 * alongside typed field validation. Both handlers instead build a plain
 * object from the non-file fields and run it through this schema by hand via
 * `.safeParse`, which gets the same result zValidator would: a 400 with a
 * generic error rather than a 500 (NaN price, negative stock, malformed JSON)
 * or a leaked internal error message.
 *
 * `jsonArrayField` turns a JSON-encoded form field into a validated array
 * without letting `JSON.parse` throw past a try/catch and become an
 * uncaught 500 — a malformed string becomes an ordinary Zod issue instead.
 */
function jsonArrayField<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.string().transform((raw, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
    const result = z.array(itemSchema).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "Invalid array contents" });
      return z.NEVER;
    }
    return result.data;
  });
}

const variantSchema = z.object({
  name: z.string(),
  price: z.number().nullable(),
});

const addOnSchema = z.object({
  name: z.string(),
  price: z.number(),
  costPrice: z.number().optional(),
});

const specificationSchema = z.object({
  key: z.string(),
  value: z.string(),
});

/**
 * A required numeric form field. `z.coerce.number()` alone turns a
 * missing/empty string into 0 (`Number("") === 0`) instead of rejecting
 * it — this requires a non-empty string first, so an omitted field fails
 * validation instead of silently becoming a free/zero-stock product.
 */
function requiredNumberField(requiredMessage: string, numberSchema: z.ZodNumber) {
  return z.string().trim().min(1, requiredMessage).transform((raw, ctx) => {
    const n = Number(raw);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: requiredMessage });
      return z.NEVER;
    }
    const result = numberSchema.safeParse(n);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: result.error.issues[0]?.message ?? requiredMessage });
      return z.NEVER;
    }
    return result.data;
  });
}

/** Shared by POST /upload (create) and PUT /update — every non-file field
 * from the product form. */
export const productFormSchema = z.object({
  productName: z.string().trim().min(1, "Product name is required"),
  productDescription: z.string().trim().min(1, "Description is required"),
  productPrice: requiredNumberField("Price is required", z.number().min(0, "Price must be 0 or more")),
  productStock: requiredNumberField("Stock is required", z.number().int().min(0, "Stock must be 0 or more")),
  productSKU: z.string().trim().min(1, "SKU is required"),
  productVariants: jsonArrayField(variantSchema),
  // Optional field: an empty/missing value means "no add-ons", same as the
  // `|| '[]'` fallback the handlers used before.
  productAddOns: z.string().optional()
    .transform((v) => v || "[]")
    .pipe(jsonArrayField(addOnSchema)),
  productTags: jsonArrayField(z.string()),
  productSize: jsonArrayField(z.string()),
  productFeature: jsonArrayField(z.string()),
  specifications: jsonArrayField(specificationSchema),
  careInstruction: z.string().optional().transform((v) => v || null),
  isFeatured: z.string().optional().transform((v) => v === "true" || v === "on"),
  productCategory: z.string().trim().min(1, "Category is required"),
  // A 500% "discount" isn't a data-entry typo the UI can catch after the
  // fact — this caps it at the DB write, same as price/stock.
  discount: z.coerce.number().min(0).max(100).optional().default(0),
  defaultVariantName: z.string().optional().transform((v) => v || null),
  // Cloudinary URL of the product video (uploaded directly from the browser —
  // see lib/product-video.ts). Empty/missing means "no video"; the handlers
  // check it really is a video in this store's account.
  productVideo: z.string().trim().optional().transform((v) => v || null),
});

export type ProductFormFields = z.infer<typeof productFormSchema>;

/** Pulls every field `productFormSchema` expects out of a FormData into a
 * plain object, ready for `.safeParse`. File fields (productImages) are
 * handled separately by the caller. */
export function productFormDataToObject(formData: FormData): Record<string, string | undefined> {
  const keys = [
    "productName", "productDescription", "productPrice", "productStock",
    "productSKU", "productVariants", "productAddOns", "productTags",
    "productSize", "productFeature", "specifications", "careInstruction",
    "isFeatured", "productCategory", "discount", "defaultVariantName", "productVideo",
  ] as const;
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : undefined;
  }
  return out;
}
