import { Hono } from 'hono';
import { after } from 'next/server';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { batch, db } from '@/db';
import { products, categories, specifications, wishlistItems, cartItems, reviews, orderItems, campaigns } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { imageStorage } from '@/lib/imageStorage';
import { deleteImageFromStorage } from '@/lib/deleteImage';
import { sessionMiddleware } from '@/lib/session-middleware';
import { invalidateFeed } from '@/lib/meta-catalog/cache';
import { can, isAllowed } from "@/lib/permissions";
import { sanitizeRichText } from "@/lib/sanitize";
import { setActivityMeta, summarizeNames, type ActivityChange } from "@/features/activity/server/log-activity";
import { productFormSchema, productFormDataToObject } from "./product-form-schema";
import { validateImageFiles } from "@/lib/validate-image-upload";
import { buildProductSlug } from "@/lib/slug";
import { deleteVideo, isOwnVideoUrl, signVideoUpload } from "@/lib/media";
import { ensureVideoDerivatives, ensureVideoDerivativesQuietly } from "@/lib/video-derivatives";
import { isCloudinaryUrl } from "@/lib/media-url";
import { unusedMedia } from "@/features/media/server/usage";

const app = new Hono();

// A product video URL comes from a form field, so it is only accepted when it
// is a video in this store's own Cloudinary account or R2 bucket (or empty =
// no video).
async function resolveVideoUrl(raw: string | null): Promise<{ ok: true; url: string | null } | { ok: false }> {
  if (!raw) return { ok: true, url: null };
  return (await isOwnVideoUrl(raw)) ? { ok: true, url: raw } : { ok: false };
}

async function deleteVideoQuietly(url: string | null | undefined) {
  if (!url) return;
  try {
    // Picked from the media library, it may still back another product.
    if ((await unusedMedia([url])).length === 0) return;
    await deleteVideo(url);
  } catch (error) {
    console.error("Failed to delete product video:", error);
  }
}

// Step 1 of a video upload: the browser asks for an upload ticket (a
// Cloudinary signature or a presigned R2 PUT for this exact file), then
// uploads the file straight to storage and stores the URL via create/update.
app.post(
  '/video-signature',
  sessionMiddleware,
  zValidator('json', z.object({ type: z.string().max(100), size: z.number().int().positive() })),
  async (c) => {
    const user = c.get("user");
    if (!user || !can(user, "products", "write")) {
      return c.json({ success: false, error: 'Unauthorized' }, 403);
    }
    const result = await signVideoUpload(c.req.valid('json'));
    if (!result.ok) {
      return c.json({ success: false, error: result.error }, 400);
    }
    return c.json({ success: true, ticket: result.ticket });
  },
);

// Step 3 for an R2 video: generate its stored poster and renditions
// (lib/video-derivatives.ts) before the form is saved, so the product never
// goes live pointing at files that don't exist yet.
app.post(
  '/video-derivatives',
  sessionMiddleware,
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const user = c.get("user");
    if (!user || !can(user, "products", "write")) {
      return c.json({ success: false, error: 'Unauthorized' }, 403);
    }
    const { url } = c.req.valid('json');
    if (isCloudinaryUrl(url) || !(await isOwnVideoUrl(url))) {
      return c.json({ success: false, error: 'Not a video in this store\'s R2 bucket' }, 400);
    }
    const result = await ensureVideoDerivatives(url);
    if (!result.ok) return c.json({ success: false, error: result.error }, 502);
    return c.json({ success: true, made: result.made });
  },
);

app.post('/upload',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if(!user || !can(user, "products", "write")){
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  try {
    const formData = await c.req.formData();

    const parsed = productFormSchema.safeParse(productFormDataToObject(formData));
    if (!parsed.success) {
      return c.json({
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product data",
      }, 400);
    }
    const fields = parsed.data;

    const videoCheck = await resolveVideoUrl(fields.productVideo);
    if (!videoCheck.ok) {
      return c.json({ success: false, error: 'Invalid product video' }, 400);
    }

    const imageFiles = formData.getAll('productImages');
    const newImageValidation = validateImageFiles(imageFiles.filter((f): f is File => f instanceof File));
    if (!newImageValidation.ok) {
      return c.json({ success: false, error: newImageValidation.error }, 400);
    }

    const uploadedImageUrls: string[] = [];

    for (const file of imageFiles) {
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { url } = await imageStorage(buffer);
        uploadedImageUrls.push(url);
      } else if (typeof file === 'string') {
        uploadedImageUrls.push(file);
      }
    }

    const category = await db.query.categories.findFirst({
      where: eq(categories.value, fields.productCategory),
    });

    if (!category) {
      return c.json({ success: false, error: 'Category not found' }, 400);
    }

      const [newProduct] = await db.insert(products).values({
        name: fields.productName,
        description: sanitizeRichText(fields.productDescription),
        price: fields.productPrice,
        stock: fields.productStock,
        sku: fields.productSKU,
        slug: buildProductSlug(fields.productName, fields.productSKU),
        variants: fields.productVariants,
        addOns: fields.productAddOns,
        tags: fields.productTags,
        sizes: fields.productSize,
        features: fields.productFeature,
        careInstruction: fields.careInstruction,
        images: uploadedImageUrls,
        video: videoCheck.url,
        isFeatured: fields.isFeatured,
        categoryId: category.id,
        discount: fields.discount,
        defaultVariantName: fields.defaultVariantName,
      }).returning();

      const specsToInsert = fields.specifications.map((spec) => ({
        key: spec.key,
        value: spec.value,
        productId: newProduct.id,
      }));

      let insertedSpecs: (typeof specifications.$inferSelect)[] = [];
      if (specsToInsert.length > 0) {
        insertedSpecs = await db.insert(specifications).values(specsToInsert).returning();
      }

      invalidateFeed();

      // Normally done right after the upload; this covers a video picked
      // from the library or one whose processing failed then.
      const savedVideo = videoCheck.url;
      if (savedVideo && !isCloudinaryUrl(savedVideo)) after(() => ensureVideoDerivativesQuietly(savedVideo));

      const product = {
        ...newProduct,
        category,
        specifications: insertedSpecs,
      };

    setActivityMeta(c, { name: product.name });

    return c.json({
      success: true,
      product: {
        id: product.id,
        productName: product.name,
        productDescription: product.description,
        productPrice: product.price,
        productStock: product.stock,
        productSKU: product.sku,
        productVariants: product.variants,
        productAddOns: product.addOns,
        productTags: product.tags,
        productImages: product.images,
        productSize: product.sizes,
        isFeatured: product.isFeatured,
        productDiscount: product.discount,
        productDefaultVariantName: product.defaultVariantName,
        productCategory: product.category.value,
        productSpecifications: product.specifications,
        createdAt: product.createdAt,
      }
    }, 201);
  } catch (error) {
    // Log the real error server-side only — the raw message (which can
    // include DB constraint text, stack fragments, etc.) never reaches the
    // client.
    console.error('Error creating product:', error);
    return c.json({ success: false, error: 'Failed to create product' }, 400);
  }
})
.put("/update",sessionMiddleware, async (c) => {
  const user = c.get("user");
  if(!user || !can(user, "products", "write")){
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const formData = await c.req.formData();
    const productId = formData.get("id") as string;

    const existingProduct = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!existingProduct) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }

    // Optional optimistic-concurrency guard (BAD-15, audit 2026-09-21): the
    // edit form loads with a stock count, and this write used to overwrite
    // `stock` with whatever the form still holds — even after sales that
    // happened while the form was open had already decremented it. A form
    // that sends the stock value it loaded with lets a stale save be caught
    // as a conflict instead of silently clobbering those sales; a form that
    // doesn't send it (or an API caller) keeps the previous unconditional
    // behavior.
    const expectedStockRaw = formData.get("expectedStock");
    if (typeof expectedStockRaw === "string" && expectedStockRaw.trim()) {
      const expectedStock = Number(expectedStockRaw);
      if (!Number.isNaN(expectedStock) && expectedStock !== existingProduct.stock) {
        return c.json({
          success: false,
          error: `Stock changed since this form was loaded (now ${existingProduct.stock}, was ${expectedStock}). Reload and try again.`,
        }, 409);
      }
    }

    const parsed = productFormSchema.safeParse(productFormDataToObject(formData));
    if (!parsed.success) {
      return c.json({
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product data",
      }, 400);
    }
    const fields = parsed.data;

    const videoCheck = await resolveVideoUrl(fields.productVideo);
    if (!videoCheck.ok) {
      return c.json({ success: false, error: "Invalid product video" }, 400);
    }

    const imageFiles = formData.getAll("productImages");
    const newImageValidation = validateImageFiles(imageFiles.filter((f): f is File => f instanceof File));
    if (!newImageValidation.ok) {
      return c.json({ success: false, error: newImageValidation.error }, 400);
    }

    const uploadedImageUrls: string[] = [];

    for (const file of imageFiles) {
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { url } = await imageStorage(buffer);
        uploadedImageUrls.push(url);
      } else if (typeof file === "string") {
        uploadedImageUrls.push(file);
      }
    }

    const removedImages = existingProduct.images.filter(
      (oldImg) => !uploadedImageUrls.includes(oldImg)
    );

    const category = await db.query.categories.findFirst({
      where: eq(categories.value, fields.productCategory),
    });

    if (!category) {
      return c.json({ success: false, error: "Category not found" }, 400);
    }

      const [newProduct] = await db.update(products)
        .set({
          name: fields.productName,
          description: sanitizeRichText(fields.productDescription),
          price: fields.productPrice,
          stock: fields.productStock,
          sku: fields.productSKU,
          variants: fields.productVariants,
          addOns: fields.productAddOns,
          tags: fields.productTags,
          sizes: fields.productSize,
          features: fields.productFeature,
          careInstruction: fields.careInstruction,
          images: uploadedImageUrls,
          video: videoCheck.url,
          isFeatured: fields.isFeatured,
          categoryId: category.id,
          discount: fields.discount,
          defaultVariantName: fields.defaultVariantName,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
        .returning();

      // Stored images are only deleted once the DB row that stops
      // referencing them has actually committed — deleting them first meant
      // a failed write below (or even just this request racing a concurrent
      // one) could permanently lose an image the product row still pointed
      // at. Deferred via after() (same pattern as lib/n8n-notify) so Vercel
      // keeps the function alive to finish the storage calls instead of
      // freezing the instance the moment the response goes out; run in
      // parallel since each is an independent external call and a failure
      // in one must not block the others.
      if (removedImages.length > 0) {
        after(async () => {
          const results = await Promise.allSettled(
            (await unusedMedia(removedImages)).map((img) => deleteImageFromStorage(img))
          );
          for (const result of results) {
            if (result.status === "rejected") {
              console.error("Failed to delete replaced product image:", result.reason);
            }
          }
        });
      }

      // Same rule for the video: the old stored video goes only once the
      // row has stopped pointing at it (replaced or removed).
      if (existingProduct.video && existingProduct.video !== videoCheck.url) {
        const oldVideo = existingProduct.video;
        after(() => deleteVideoQuietly(oldVideo));
      }

      await db.delete(specifications).where(eq(specifications.productId, productId));

      let insertedSpecs: (typeof specifications.$inferSelect)[] = [];
      if (fields.specifications.length > 0) {
        insertedSpecs = await db.insert(specifications).values(
          fields.specifications.map((spec) => ({
            key: spec.key,
            value: spec.value,
            productId: productId,
          }))
        ).returning();
      }

      invalidateFeed();

      // Same safety net as on create.
      const savedVideo = videoCheck.url;
      if (savedVideo && !isCloudinaryUrl(savedVideo)) after(() => ensureVideoDerivativesQuietly(savedVideo));

      const updatedProduct = {
        ...newProduct,
        category,
        specifications: insertedSpecs,
      };

      const changes: ActivityChange[] = [];
      if (existingProduct.name !== newProduct.name) {
        changes.push({ label: "Name", from: existingProduct.name, to: newProduct.name });
      }
      if (existingProduct.price !== newProduct.price) {
        changes.push({ label: "Price", from: existingProduct.price, to: newProduct.price });
      }
      if (existingProduct.stock !== newProduct.stock) {
        changes.push({ label: "Stock", from: existingProduct.stock, to: newProduct.stock });
      }
      if (existingProduct.categoryId !== newProduct.categoryId) {
        const oldCategory = await db.query.categories.findFirst({
          where: eq(categories.id, existingProduct.categoryId),
          columns: { label: true },
        });
        changes.push({ label: "Category", from: oldCategory?.label ?? "—", to: category.label });
      }
      if (existingProduct.discount !== newProduct.discount) {
        changes.push({ label: "Discount", from: existingProduct.discount, to: newProduct.discount });
      }
      if (existingProduct.isFeatured !== newProduct.isFeatured) {
        changes.push({ label: "Featured", from: existingProduct.isFeatured, to: newProduct.isFeatured });
      }
      setActivityMeta(c, { name: newProduct.name, changes });

    return c.json({ success: true, product: updatedProduct }, 200);
  } catch (error) {
    console.error("Error updating product:", error);
    return c.json({ success: false, error: "Update failed" }, 400);
  }
})

app.post(
  '/bulk-delete',
  sessionMiddleware,
  zValidator('json', z.object({
    // Capped for the same reason orders/bulk-delete is (BAD-2 pattern):
    // an unbounded array here is an unbounded IN (...) clause across seven
    // statements. This endpoint previously had no validation at all — not
    // even a schema — so a malformed body reached `ids.length` as a
    // TypeError instead of a 400.
    ids: z.array(z.string()).min(1).max(200),
  })),
  async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "products", "write", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  try {
    const { ids } = c.req.valid('json');

    // One query per TABLE instead of eight queries per PRODUCT: deleting 50
    // products used to fire ~400 separate statements at the database.
    const found = await db.query.products.findMany({
      where: inArray(products.id, ids),
      columns: { id: true, name: true, images: true, video: true },
    });

    if (found.length === 0) {
      return c.json({ success: true, deleted: 0 });
    }

    const deletedNames = found.map((product) => product.name);
    const foundIds = found.map((product) => product.id);

    // All seven statements — six dependent-row cleanups plus the products
    // delete itself — in one batch, so a failure partway through can't
    // leave dependent rows gone while the product rows survive (or vice
    // versa). Previously the products delete was a separate `await` after
    // this batch, with the same gap DELETE /:id had (fixed above).
    await batch((tx) => [
      tx.delete(campaigns).where(inArray(campaigns.productId, foundIds)),
      tx.delete(wishlistItems).where(inArray(wishlistItems.productId, foundIds)),
      tx.delete(cartItems).where(inArray(cartItems.productId, foundIds)),
      tx.delete(reviews).where(inArray(reviews.productId, foundIds)),
      tx.delete(specifications).where(inArray(specifications.productId, foundIds)),
      tx.update(orderItems).set({ productId: null }).where(inArray(orderItems.productId, foundIds)),
      tx.delete(products).where(inArray(products.id, foundIds)),
    ]);

    // Stored images deleted only after the DB batch commits (same
    // BAD-14 reasoning as the single-product delete above), deferred via
    // after() and run in parallel.
    const allVideos = found.flatMap((product) => (product.video ? [product.video] : []));
    if (allVideos.length > 0) {
      after(async () => {
        await Promise.allSettled(allVideos.map((video) => deleteVideoQuietly(video)));
      });
    }

    const allImages = found.flatMap((product) => product.images);
    if (allImages.length > 0) {
      after(async () => {
        const results = await Promise.allSettled((await unusedMedia(allImages)).map((img) => deleteImageFromStorage(img)));
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("Failed to delete product image after bulk delete:", result.reason);
          }
        }
      });
    }

    invalidateFeed();
    setActivityMeta(c, { name: `${deletedNames.length} products: ${summarizeNames(deletedNames)}` });
    return c.json({ success: true, deleted: foundIds.length });
  } catch (error) {
    console.error("Error bulk deleting products:", error);
    return c.json({ error: "Failed to delete products" }, 500);
  }
})

// Admin-only product fetch for the edit form. Deliberately separate from
// the public GET /api/products/:id (features/product/server/get-product.ts):
// that one is wrapped in a cross-request unstable_cache keyed only by id, so
// it can never conditionally include costPrice without risking a public
// visitor being served an admin's cached, cost-inclusive response.
app.get('/:id', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "products", "write", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const productId = c.req.param("id");

  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: { category: true, specifications: true },
    });
    if (!product) return c.json({ error: "Product not found" }, 404);

    return c.json({
      id: product.id,
      slug: product.slug ?? product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      sku: product.sku,
      tags: product.tags,
      images: product.images,
      category: product.category.value,
      categoryLabel: product.category.label,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      specifications: product.specifications.map((s) => ({ key: s.key, value: s.value })),
      care: product.careInstruction || "",
      colors: product.variants,
      addOns: product.addOns || [],
      sizes: product.sizes,
      features: product.features,
      isFeatured: product.isFeatured,
      discount: product.discount,
      defaultVariantName: product.defaultVariantName || undefined,
      reviews: [],
      reviewCount: 0,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return c.json({ error: "Failed to fetch product" }, 500);
  }
});

app.delete('/:id', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "products", "write", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const productId = c.req.param("id");

  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    if (!product) return c.json({ error: "Product not found" }, 404);

    // All seven statements — the six dependent-row cleanups and the
    // products delete itself — in one batch. These used to be a batch of
    // six followed by a SEPARATE `await db.delete(products)`: if that final
    // delete failed after the batch had already committed, every dependent
    // row (specs, reviews, cart/wishlist items) was gone while the product
    // row itself survived, orphaned and referencing rows that no longer
    // existed. One batch means both succeed or both roll back together.
    await batch((tx) => [
      tx.delete(campaigns).where(eq(campaigns.productId, productId)),
      tx.delete(wishlistItems).where(eq(wishlistItems.productId, productId)),
      tx.delete(cartItems).where(eq(cartItems.productId, productId)),
      tx.delete(reviews).where(eq(reviews.productId, productId)),
      tx.delete(specifications).where(eq(specifications.productId, productId)),
      tx.update(orderItems).set({ productId: null }).where(eq(orderItems.productId, productId)),
      tx.delete(products).where(eq(products.id, productId)),
    ]);

    // Stored images are only deleted once the DB delete has actually
    // committed — deleting them first meant a failed batch above left a
    // still-live product pointing at images that no longer exist (BAD-14's
    // same reasoning, applied to delete rather than update). Deferred via
    // after() and run in parallel.
    if (product.video) {
      const video = product.video;
      after(() => deleteVideoQuietly(video));
    }

    if (product.images.length > 0) {
      after(async () => {
        const results = await Promise.allSettled((await unusedMedia(product.images)).map((img) => deleteImageFromStorage(img)));
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("Failed to delete product image after product delete:", result.reason);
          }
        }
      });
    }

    invalidateFeed();
    setActivityMeta(c, { name: product.name });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return c.json({ error: "Failed to delete product" }, 500);
  }
});

app.patch('/bulk-feature', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "products", "write", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  try {
    const { ids, isFeatured } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: "No product IDs provided" }, 400);
    }

    await db.update(products)
      .set({ isFeatured: Boolean(isFeatured) })
      .where(inArray(products.id, ids));

    invalidateFeed();
    return c.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error("Error bulk updating feature status:", error);
    return c.json({ error: "Failed to update products" }, 500);
  }
});

// Lightweight JSON update — the main /update endpoint above takes multipart
// form-data (mirroring the admin form exactly, including new image file
// uploads), which is awkward for a programmatic caller like the MCP server.
// This covers every product field except new image *uploads*: images are
// accepted as an array of existing URLs (reorder/remove), category as its
// value/slug (resolved to an id), specifications as key/value pairs
// (replaces the full set).
app.patch(
  '/:id/details',
  sessionMiddleware,
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.number().min(0).optional(),
      stock: z.number().int().min(0).optional(),
      discount: z.number().min(0).max(100).optional(),
      isFeatured: z.boolean().optional(),
      sku: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      variants: z.array(z.object({ name: z.string(), price: z.number().nullable() })).optional(),
      addOns: z.array(z.object({ name: z.string(), price: z.number(), costPrice: z.number().optional() })).optional(),
      tags: z.array(z.string()).optional(),
      sizes: z.array(z.string()).optional(),
      features: z.array(z.string()).optional(),
      careInstruction: z.string().nullable().optional(),
      images: z.array(z.string().url()).optional(),
      specifications: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
      defaultVariantName: z.string().nullable().optional(),
      showLowestPriceAsDefault: z.boolean().optional(),
    })
  ),
  async (c) => {
    const user = c.get("user");
    if (!isAllowed(user, "products", "write", ["MODERATOR"])) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const id = c.req.param("id");
    const { category: categoryVal, specifications: specList, ...rest } = c.req.valid("json");

    if (Object.keys(rest).length === 0 && categoryVal === undefined && specList === undefined) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!existing) return c.json({ error: "Product not found" }, 404);

    let category: { id: string; label: string } | undefined;
    if (categoryVal !== undefined) {
      const found = await db.query.categories.findFirst({ where: eq(categories.value, categoryVal) });
      if (!found) return c.json({ error: "Category not found" }, 400);
      category = found;
    }

    const removedImages = rest.images !== undefined
      ? existing.images.filter((oldImg) => !rest.images!.includes(oldImg))
      : [];

    const [updated] = await db.update(products)
      .set({
        ...rest,
        // Rendered with dangerouslySetInnerHTML on the product page.
        ...(rest.description !== undefined
          ? { description: sanitizeRichText(rest.description) }
          : {}),
        ...(category ? { categoryId: category.id } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    // Deleted only after the DB row that stops referencing them has
    // actually committed (same reasoning as PUT /update above), deferred
    // via after() and run in parallel rather than one sequential await per
    // image (BAD-14, audit 2026-09-21 — this endpoint, used by the MCP
    // product-editing tool, was missed in the first pass at that fix).
    if (removedImages.length > 0) {
      after(async () => {
        const results = await Promise.allSettled(
          (await unusedMedia(removedImages)).map((img) => deleteImageFromStorage(img))
        );
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("Failed to delete replaced product image:", result.reason);
          }
        }
      });
    }

    let insertedSpecs: (typeof specifications.$inferSelect)[] | undefined;
    if (specList !== undefined) {
      await db.delete(specifications).where(eq(specifications.productId, id));
      insertedSpecs = specList.length > 0
        ? await db.insert(specifications).values(specList.map((spec) => ({ ...spec, productId: id }))).returning()
        : [];
    }

    invalidateFeed();

    const changes: ActivityChange[] = [];
    if (rest.name !== undefined && rest.name !== existing.name) changes.push({ label: "Name", from: existing.name, to: rest.name });
    if (rest.description !== undefined && sanitizeRichText(rest.description) !== existing.description) changes.push({ label: "Description", from: existing.description, to: sanitizeRichText(rest.description) });
    if (rest.price !== undefined && rest.price !== existing.price) changes.push({ label: "Price", from: existing.price, to: rest.price });
    if (rest.stock !== undefined && rest.stock !== existing.stock) changes.push({ label: "Stock", from: existing.stock, to: rest.stock });
    if (rest.discount !== undefined && rest.discount !== existing.discount) changes.push({ label: "Discount", from: existing.discount, to: rest.discount });
    if (rest.isFeatured !== undefined && rest.isFeatured !== existing.isFeatured) changes.push({ label: "Featured", from: existing.isFeatured, to: rest.isFeatured });
    if (category && category.id !== existing.categoryId) changes.push({ label: "Category", from: existing.categoryId, to: category.label });
    setActivityMeta(c, { name: updated.name, changes });

    return c.json({ success: true, product: { ...updated, ...(insertedSpecs !== undefined ? { specifications: insertedSpecs } : {}) } });
  }
);

export default app;
