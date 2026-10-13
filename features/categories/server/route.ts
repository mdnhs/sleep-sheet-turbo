import { Hono } from 'hono';
import { after } from 'next/server';
import { db } from '@/db';
import { categories, products } from '@/db/schema';
import { eq, count, inArray } from 'drizzle-orm';
import { sessionMiddleware } from '@/lib/session-middleware';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import cuid from 'cuid';
import { uploadImage, deleteImage } from '@/lib/media';
import { validateImageFile } from '@/lib/validate-image-upload';
import { can } from "@/lib/permissions";
import { setActivityMeta, summarizeNames, type ActivityChange } from "@/features/activity/server/log-activity";
import { invalidateFeed } from "@/lib/meta-catalog/cache";

const app = new Hono()
.get("/", async(c)=>{
   try{
      const [categoriesList, productCounts] = await Promise.all([
        db.select({
          id: categories.id,
          label: categories.label,
          value: categories.value,
          parentId: categories.parentId,
          image: categories.image,
          order: categories.order,
          seoTitle: categories.seoTitle,
          seoDescription: categories.seoDescription,
          seoContent: categories.seoContent,
        }).from(categories),
        db.select({ categoryId: products.categoryId, count: count() })
          .from(products)
          .groupBy(products.categoryId),
      ]);

      const countByCategoryId = new Map(productCounts.map((r) => [r.categoryId, Number(r.count)]));
      const categoriesWithCounts = categoriesList.map((category) => ({
        ...category,
        productCount: countByCategoryId.get(category.id) || 0,
      }));

      c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      return c.json(categoriesWithCounts);
   }catch(error){
     console.error("Failed to fetch Categories",error);
     return c.json({error: "failed to fetch Categories"},500)
   }
})
.post("/create",sessionMiddleware,zValidator('json',
   z.object({
      label:z.string().min(2).max(50),
      value:z.string().min(2).max(50),
      parentId: z.string().optional().nullable(),
      image: z.string().url().optional().nullable(),
      order: z.number().int().min(0).optional().nullable(),
      seoTitle: z.string().max(70).optional().nullable(),
      seoDescription: z.string().max(160).optional().nullable(),
      seoContent: z.string().max(8000).optional().nullable(),
   })
), async(c)=>{
   try{
      const user = c.get("user");
      const {label,value,parentId,image,order,seoTitle,seoDescription,seoContent}=c.req.valid("json");

      if(!user || !can(user, "products", "write")){
         return c.json({ success: false, error: 'Unauthorized' }, 403);
       }

       if (parentId) {
         const parentExists = await db.query.categories.findFirst({ where: eq(categories.id, parentId) });
         if (!parentExists) return c.json({ error: "Parent category not found" }, 404);
         if (parentExists.parentId) return c.json({ error: "Only one level of nesting allowed" }, 400);
       }

       const existingCategory = await db.query.categories.findFirst({
         where: eq(categories.value, value)
       });
       if (existingCategory) {
         return c.json({ error: "Category value already exists" }, 409);
       }

       const newCategoryId = cuid();
       await db.insert(categories).values({
         id: newCategoryId,
         label,
         value,
         parentId: parentId ?? null,
         image: image ?? null,
          order: order ?? null,
          seoTitle: seoTitle ?? null,
          seoDescription: seoDescription ?? null,
          seoContent: seoContent ?? null,
        });

        invalidateFeed();
        setActivityMeta(c, { name: label });

        return c.json({
          label,
          value,
          parentId: parentId ?? null,
          image: image ?? null,
          order: order ?? null,
         seoTitle: seoTitle ?? null,
         seoDescription: seoDescription ?? null,
         seoContent: seoContent ?? null,
       }, 201);
      } catch (error) {
         console.error("Failed to create category", error);
         return c.json({ error: "Failed to create category" }, 500);
       }
})
.post("/reorder", sessionMiddleware, zValidator("json",
  z.object({
    orders: z.array(z.object({
      value: z.string().min(2).max(50),
      order: z.number().int().min(0),
    })).min(1),
  })
), async (c) => {
  const user = c.get("user");
  if (!user || user.role !== "ADMIN") {
    return c.json({ success: false, error: "Unauthorized" }, 403);
  }

  const { orders } = c.req.valid("json");
  try {
    await Promise.all(orders.map(({ value, order }) =>
      db.update(categories)
        .set({ order, updatedAt: new Date() })
        .where(eq(categories.value, value))
    ));
    invalidateFeed();
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder categories", error);
    return c.json({ error: "Failed to reorder categories" }, 500);
  }
})
.patch("/:value", sessionMiddleware, zValidator('json',
   z.object({
      label: z.string().min(2).max(50).optional(),
      value: z.string().min(2).max(50).optional(),
      parentId: z.string().optional().nullable(),
      image: z.string().url().optional().nullable(),
      order: z.number().int().min(0).optional().nullable(),
      seoTitle: z.string().max(70).optional().nullable(),
      seoDescription: z.string().max(160).optional().nullable(),
      seoContent: z.string().max(8000).optional().nullable(),
   })
), async (c) => {
   const user = c.get("user");
   if (!user || user.role !== "ADMIN") {
     return c.json({ success: false, error: "Unauthorized" }, 403);
   }

   const currentValue = c.req.param("value");
   const body = c.req.valid("json");

   try {
     const existing = await db.query.categories.findFirst({
       where: eq(categories.value, currentValue),
     });
     if (!existing) return c.json({ error: "Category not found" }, 404);

     if (body.parentId) {
       const parentExists = await db.query.categories.findFirst({ where: eq(categories.id, body.parentId) });
       if (!parentExists) return c.json({ error: "Parent category not found" }, 404);
       if (parentExists.parentId) return c.json({ error: "Only one level of nesting allowed" }, 400);
       if (body.parentId === existing.id) return c.json({ error: "Cannot set self as parent" }, 400);
     }

     if (body.value && body.value !== currentValue) {
       const slugExists = await db.query.categories.findFirst({ where: eq(categories.value, body.value) });
       if (slugExists) return c.json({ error: "Category value already exists" }, 409);
     }

     const updates: Record<string, unknown> = {}
     if (body.label !== undefined) updates.label = body.label
     if (body.value !== undefined) updates.value = body.value
     if (body.parentId !== undefined) updates.parentId = body.parentId
     const replacedImage = body.image !== undefined && existing.image && existing.image !== body.image
       ? existing.image
       : null;
     if (body.image !== undefined) {
       updates.image = body.image
     }
      if (body.order !== undefined) updates.order = body.order
     if (body.seoTitle !== undefined) updates.seoTitle = body.seoTitle
     if (body.seoDescription !== undefined) updates.seoDescription = body.seoDescription
     if (body.seoContent !== undefined) updates.seoContent = body.seoContent
     updates.updatedAt = new Date()

     await db.update(categories).set(updates).where(eq(categories.value, currentValue))

     // The old image is deleted only after the row that stopped referencing
     // it has actually committed — deleting it first (the previous
     // behavior) meant a failed write below could leave the category still
     // pointing at an image that no longer existed in Cloudinary (BAD-14's
     // same reasoning, audit 2026-09-21). Deferred via after().
     if (replacedImage) {
       after(() => deleteImage(replacedImage).catch((err) => {
         console.error("Failed to delete replaced category image:", err);
       }));
     }

     const changes: ActivityChange[] = [];
     if (body.label !== undefined && body.label !== existing.label) {
       changes.push({ label: "Name", from: existing.label, to: body.label });
     }
     if (body.value !== undefined && body.value !== existing.value) {
       changes.push({ label: "URL slug", from: existing.value, to: body.value });
     }
     if (body.order !== undefined && body.order !== existing.order) {
       changes.push({ label: "Sort order", from: existing.order, to: body.order });
     }
     invalidateFeed();
     setActivityMeta(c, { name: body.label ?? existing.label, changes });

     return c.json({ success: true })
   } catch (error) {
     console.error("Failed to update category", error)
     return c.json({ error: "Failed to update category" }, 500)
   }
})
.post("/upload-image", sessionMiddleware, async (c) => {
   const user = c.get("user");
   if (!user || user.role !== "ADMIN") {
     return c.json({ success: false, error: "Unauthorized" }, 403);
   }

   try {
     const formData = await c.req.formData()
     const file = formData.get("image")
     if (!file || !(file instanceof File)) {
       return c.json({ error: "No image file provided" }, 400)
     }
     const validation = validateImageFile(file)
     if (!validation.ok) {
       return c.json({ error: validation.error }, 400)
     }

     const url = await uploadImage(file, "categories")
     return c.json({ url })
   } catch (error) {
     console.error("Failed to upload image", error)
     return c.json({ error: "Failed to upload image" }, 500)
   }
})
.post("/bulk-delete", sessionMiddleware, async (c) => {
   const user = c.get("user");
   if (!user || user.role !== "ADMIN") {
     return c.json({ success: false, error: "Unauthorized" }, 403);
   }

   try {
     const { values } = await c.req.json<{ values: string[] }>();
     if (!values || values.length === 0) {
       return c.json({ error: "No category values provided" }, 400);
     }

     // Load every requested category (and whether it has children) in one
     // query, then delete the eligible ones in one statement. This used to be
     // two round trips per category.
     const found = await db.query.categories.findMany({
       where: inArray(categories.value, values),
       with: { children: { columns: { id: true } } },
     });

     const deletable = found.filter((category) => category.children.length === 0);
     const deletedLabels = deletable.map((category) => category.label);

     if (deletable.length > 0) {
       await db.delete(categories).where(
         inArray(categories.value, deletable.map((category) => category.value))
       );
     }

     invalidateFeed();
     setActivityMeta(c, { name: `${deletedLabels.length} categories: ${summarizeNames(deletedLabels)}` });
     return c.json({ success: true });
   } catch (error) {
     console.error("Failed to bulk delete categories", error);
     return c.json({ error: "Failed to delete categories" }, 500);
   }
})
.delete("/delete/:value", sessionMiddleware, async (c) => {
   const user = c.get("user");
   const { value } = c.req.param();

   if (!user || user.role !== "ADMIN") {
     return c.json({ success: false, error: "Unauthorized" }, 403);
   }

   try {
     const category = await db.query.categories.findFirst({
       where: eq(categories.value, value),
       with: {
         children: {
           columns: { id: true }
         }
       },
     });

     if (!category) return c.json({ success: false, error: "Category not found" }, 404);

     if (category.children.length > 0) {
       return c.json({ success: false, error: "Cannot delete category with subcategories. Delete subcategories first." }, 409);
     }

      await db.delete(categories).where(eq(categories.value, value));

      // Deleted only after the category row is actually gone (BAD-14's
      // same reasoning, audit 2026-09-21) — deferred via after().
      if (category.image) {
        after(() => deleteImage(category.image!).catch((err) => {
          console.error("Failed to delete category image after delete:", err);
        }));
      }

      invalidateFeed();
      setActivityMeta(c, { name: category.label });

      return c.json({ success: true, message: "Category deleted" }, 200);
   } catch (error) {
     console.error("Failed to delete category", error);
     return c.json({ success: false, error: "Failed to delete category" }, 500);
   }
 })
 .get('/category', async (c) => {
   const categoriesList = await db.query.categories.findMany({
     with: {
       products: {
         with: {
           reviews: {
             columns: { rating: true }
           }
         }
       },
       children: {
         with: {
           products: {
             with: {
               reviews: {
                 columns: { rating: true }
               }
             }
           }
         }
       }
     }
   });

   const categoriesWithImages = categoriesList
      .map((category) => {
        // Products live on the leaf categories, so a parent's productCount must
        // roll up its children's totals (one level of nesting is enforced by
        // the create/patch guards). Its representative image is picked from the
        // same pool, otherwise parents with no direct products fall back to
        // null and get dropped entirely.
        const allProducts = [
          ...category.products,
          ...category.children.flatMap((child) => child.products),
        ];
        const validProducts = allProducts.filter(p => p.images && p.images.length > 0);
        
        let productImage = null;
        if (validProducts.length > 0) {
          const bestProduct = validProducts
            .map((p) => {
              const avgRating =
                p.reviews.length > 0
                  ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length
                  : 0;
              return { ...p, avgRating };
            })
            .sort((a, b) => b.avgRating - a.avgRating)[0];
          productImage = bestProduct?.images?.[0] ?? null;
        }

        const image = category.image || productImage;
        if (!image) return null;

        return {
          label: category.label,
          value: category.value,
          image,
          productCount: allProducts.length,
          _order: category.order,
          _sortWeight: validProducts.length,
        };
      })
      .filter((c): c is { label: string; value: string; image: string; productCount: number; _order: number | null; _sortWeight: number } => !!c)
     .sort((a, b) => {
        if (a._order !== null && b._order !== null) return a._order - b._order;
        if (a._order !== null) return -1;
        if (b._order !== null) return 1;
        return b._sortWeight - a._sortWeight;
      })
      .map(({ _order, _sortWeight, ...rest }) => rest);

   c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
   return c.json({ success: true, categories: categoriesWithImages });
});

export default app;
