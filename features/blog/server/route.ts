import { Hono } from 'hono';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { eq, desc, ilike, or, sql, and, inArray, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sessionMiddleware } from '@/lib/session-middleware';
import { uploadImage } from '@/lib/media';
import { validateImageFile } from '@/lib/validate-image-upload';
import { can } from "@/lib/permissions";
import { zRichText } from '@/lib/sanitize';
import { invalidateBlog } from '@/lib/content-cache';
import { setActivityMeta, summarizeNames, type ActivityChange } from "@/features/activity/server/log-activity";

const app = new Hono()

// Get all posts (Client & Admin)
.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 100)
    const search = c.req.query('search')

    const filterConditions: SQL[] = []

    if (search) {
      filterConditions.push(
        or(
          ilike(posts.title, `%${search}%`),
          ilike(posts.summary, `%${search}%`),
        )!
      )
    }

    const [countResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(posts)
      .where(filterConditions.length > 0 ? and(...filterConditions) : undefined)

    const totalCount = Number(countResult?.count || 0)

    const list = await db.select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      summary: posts.summary,
      content: posts.content,
      coverImage: posts.coverImage,
      isPublished: posts.isPublished,
      createdAt: posts.createdAt,
      author: {
        id: users.id,
        name: users.name,
      }
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(filterConditions.length > 0 ? and(...filterConditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)

    // Public storefront content — let the CDN serve repeat visitors so a
    // browsing spike never turns into database queries.
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return c.json({
      data: list,
      total: totalCount,
      hasNextPage: page * limit < totalCount,
      totalPages: Math.ceil(totalCount / limit),
    })
  } catch (error) {
    console.error("Fetch posts error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, message: 'Failed to fetch posts', error: errorMessage }, 500);
  }
})

// Get single post by slug
.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const postData = await db.select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      summary: posts.summary,
      content: posts.content,
      coverImage: posts.coverImage,
      isPublished: posts.isPublished,
      createdAt: posts.createdAt,
      author: {
        id: users.id,
        name: users.name,
      }
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(or(eq(posts.slug, slug), eq(posts.id, slug)))
    .limit(1);

    if (!postData.length) {
      return c.json({ success: false, message: 'Post not found' }, 404);
    }

    // Public storefront content — let the CDN serve repeat visitors so a
    // browsing spike never turns into database queries.
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return c.json({ success: true, post: postData[0] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, message: 'Failed to fetch post', error: errorMessage }, 500);
  }
})

// Create post
.post(
  '/',
  sessionMiddleware,
  zValidator(
    'json',
    z.object({
      title: z.string().min(1, 'Title is required'),
      slug: z.string().min(1, 'Slug is required'),
      summary: z.string().optional(),
      content: zRichText('Content is required'),
      coverImage: z.string().optional(),
      isPublished: z.boolean().default(false),
    })
  ),
  async (c) => {
    try {
      const user = c.get("user");
      if (!user || !can(user, "blog", "write")) {
        return c.json({ success: false, error: 'Unauthorized' }, 403);
      }

      const data = c.req.valid('json');
      
      const newPost = await db.insert(posts).values({
        ...data,
        authorId: user.id,
      }).returning();

      setActivityMeta(c, { name: newPost[0].title });

      invalidateBlog();
      return c.json({ success: true, post: newPost[0] }, 201);
    } catch (error) {
      console.error("Create post error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ success: false, message: 'Failed to create post', error: errorMessage }, 500);
    }
  }
)

// Upload image
.post('/upload-image', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !can(user, "blog", "write")) {
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

    const url = await uploadImage(file, "blog")
    return c.json({ url })
  } catch (error) {
    console.error("Failed to upload image", error)
    return c.json({ error: "Failed to upload image" }, 500)
  }
})

// Update post
.put(
  '/:id',
  sessionMiddleware,
  zValidator(
    'json',
    z.object({
      title: z.string().min(1, 'Title is required'),
      slug: z.string().min(1, 'Slug is required'),
      summary: z.string().optional(),
      content: zRichText('Content is required'),
      coverImage: z.string().optional(),
      isPublished: z.boolean().default(false),
    })
  ),
  async (c) => {
    try {
      const user = c.get("user");
      if (!user || !can(user, "blog", "write")) {
        return c.json({ success: false, error: 'Unauthorized' }, 403);
      }

      const id = c.req.param('id');
      const data = c.req.valid('json');

      const before = await db.query.posts.findFirst({ where: eq(posts.id, id) });

      const updatedPost = await db.update(posts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning();

      if (!updatedPost.length) {
        return c.json({ success: false, message: 'Post not found' }, 404);
      }

      if (before) {
        const changes: ActivityChange[] = [];
        if (before.title !== data.title) changes.push({ label: "Title", from: before.title, to: data.title });
        if (before.isPublished !== data.isPublished) {
          changes.push({ label: "Published", from: before.isPublished, to: data.isPublished });
        }
        setActivityMeta(c, { name: data.title, changes });
      }

      invalidateBlog();
      return c.json({ success: true, post: updatedPost[0] });
    } catch (error) {
      console.error("Update post error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ success: false, message: 'Failed to update post', error: errorMessage }, 500);
    }
  }
)

// Toggle publish status
// Deliberately separate from PUT /:id — a status flip should not require (and must
// not rewrite) the post body, which would let a stale list row clobber newer content.
.patch(
  '/:id/publish',
  sessionMiddleware,
  zValidator('json', z.object({ isPublished: z.boolean() })),
  async (c) => {
    try {
      const user = c.get("user");
      if (!user || !can(user, "blog", "write")) {
        return c.json({ success: false, error: 'Unauthorized' }, 403);
      }

      const id = c.req.param('id');
      const { isPublished } = c.req.valid('json');

      const before = await db.query.posts.findFirst({ where: eq(posts.id, id), columns: { title: true, isPublished: true } });

      const updatedPost = await db.update(posts)
        .set({ isPublished, updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning({ id: posts.id, isPublished: posts.isPublished });

      if (!updatedPost.length) {
        return c.json({ success: false, message: 'Post not found' }, 404);
      }

      if (before) {
        setActivityMeta(c, {
          name: before.title,
          changes: [{ label: "Published", from: before.isPublished, to: isPublished }],
        });
      }

      invalidateBlog();
      return c.json({ success: true, post: updatedPost[0] });
    } catch (error) {
      console.error("Toggle publish error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ success: false, message: 'Failed to update publish status', error: errorMessage }, 500);
    }
  }
)

// Bulk delete posts
.post('/bulk-delete', sessionMiddleware, zValidator('json', z.object({ ids: z.array(z.string()) })), async (c) => {
  try {
    const user = c.get("user");
    if (!user || !can(user, "blog", "write")) {
      return c.json({ success: false, error: 'Unauthorized' }, 403);
    }

    const { ids } = c.req.valid('json')

    if (ids.length === 0) {
      return c.json({ error: 'No IDs provided' }, 400)
    }

    const toDelete = await db.select({ title: posts.title }).from(posts).where(inArray(posts.id, ids))

    const result = await db.delete(posts)
      .where(inArray(posts.id, ids))
      .returning({ id: posts.id })

    setActivityMeta(c, {
      name: `${result.length} blog posts: ${summarizeNames(toDelete.map((p) => p.title))}`,
    });

    invalidateBlog();
    return c.json({ deleted: result.length })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: errorMessage }, 500)
  }
})

// Delete post
.delete(
  '/:id',
  sessionMiddleware,
  async (c) => {
    try {
      const user = c.get("user");
      if (!user || !can(user, "blog", "write")) {
        return c.json({ success: false, error: 'Unauthorized' }, 403);
      }

      const id = c.req.param('id');
      
      const deletedPost = await db.delete(posts)
        .where(eq(posts.id, id))
        .returning();

      if (!deletedPost.length) {
        return c.json({ success: false, message: 'Post not found' }, 404);
      }

      setActivityMeta(c, { name: deletedPost[0].title });

      invalidateBlog();
      return c.json({ success: true, post: deletedPost[0] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ success: false, message: 'Failed to delete post', error: errorMessage }, 500);
    }
  }
);

export default app;
