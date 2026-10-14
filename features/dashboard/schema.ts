import { z } from "zod";

export const ProductSchema = z.object({
  productName: z.string().trim().min(1, "Required"),
  productDescription: z.string().trim().min(1, "Required"),
  productPrice: z.coerce.number().min(0, "Required"),
  productStock: z.coerce.number().min(0, "Required"),
  productCategory: z.string().trim().min(1, "Required"),
  productSKU: z.string().trim().min(1, "Required"),
  productVariants: z.array(z.object({ name: z.string().min(1, "Required"), price: z.coerce.number().nullable().optional() })).optional(),
  productAddOns: z.array(z.object({ name: z.string().min(1, "Required"), price: z.coerce.number().min(0, "Required"), costPrice: z.coerce.number().min(0).optional() })).optional(),
  productImages: z.array(z.union([z.string(), z.instanceof(File)])).min(1, "Required"),
  // Cloudinary URL of the optional product video ("" = none).
  productVideo: z.string().optional(),
  productTags: z.array(z.string()).optional(),
  productSize: z.array(z.string()).optional(),
  specifications: z
  .array(
    z.object({
      key: z.string().min(1, "Required"),
      value: z.string().min(1, "Required"),
    })
  ).optional(),
  productFeatures: z.array(z.string()).optional(),
  careInstructions: z.string().optional(),
  isFeatured:z.boolean().optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  defaultVariantName: z.string().optional(),
});

// Editing may leave a product with no images (it then shows the
// placeholder); creating one still needs at least one.
export const ProductUpdateSchema = ProductSchema.extend({
  productImages: z.array(z.union([z.string(), z.instanceof(File)])),
});


export type ProductFormValues = z.infer<typeof ProductSchema>;