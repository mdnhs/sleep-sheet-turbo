// A day, like the rest of the storefront. The post is read through a cached
// helper tagged "blog", and every write route now calls invalidateBlog(), so
// an edit drops this entry immediately — the timer is only the fallback for
// changes that bypass those routes.
export const revalidate = 86400;

import BlogPostClient from './blog-post-client';
import type { BlogPost } from '@/app/(client)/blog/blog-client';
import { seoConfig } from "@/lib/seo";
import { getStoreProfile } from "@/lib/settings/store";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractTags } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { cacheTag } from "@/lib/cache-tag";

// Tagged "blog" so the write routes' invalidateBlog() reaches this page.
// Without a tag the route-level `revalidate` above would be the only way a
// published edit ever appeared, which is why it used to sit at 30 minutes —
// 48 lazy revalidations a day, each able to wake a sleeping Neon compute that
// bills a five-minute minimum, for content that changes a few times a month.
const getCachedPost = unstable_cache(
  async (slug: string) => {
    const [dbPost] = await db
      .select({
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
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.slug, slug))
      .limit(1);
    return dbPost ? { ...dbPost, createdAt: dbPost.createdAt.toISOString() } : undefined;
  },
  ["blog-post-by-slug"],
  { revalidate: 86400, tags: [cacheTag("blog")] },
);

type Props = { params: Promise<{ slug: string }> };

// `revalidate` alone left this route rendering on every request: a dynamic
// segment only becomes ISR once it exports generateStaticParams. An empty list
// prerenders nothing at build — each post renders on its first visit and is
// served from the cache after that, until invalidateBlog() or the timer.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const store = await getStoreProfile();

  try {
    // The same cached, "blog"-tagged read as the page body (it carries every
    // field used here), rather than a second, uncached query per render.
    const post = await getCachedPost(slug);

    if (post) {
      const cleanSummary = post.summary || post.content.replace(/<[^>]*>/g, "").slice(0, 160).trim();
      const description = cleanSummary.length > 155 ? `${cleanSummary.slice(0, 155)}...` : cleanSummary;
      const tags = extractTags(post.title, post.content, `${store.name} Bangladesh`);

      return {
        // The root layout's title template already appends the store name.
        title: post.title,
        description,
        keywords: tags.join(", "),
        openGraph: {
          title: post.title,
          description,
          type: "article",
          url: `${seoConfig.siteUrl}/blog/${slug}`,
          images: [{ url: post.coverImage || seoConfig.defaultImage }],
        },
        twitter: {
          card: "summary_large_image",
          title: post.title,
          description,
          images: [post.coverImage || seoConfig.defaultImage],
        },
        alternates: {
          canonical: `${seoConfig.siteUrl}/blog/${slug}`,
        },
      };
    }
  } catch {}

  const fallbackTitle = slug.replace(/-/g, " ");
  return {
    title: `${fallbackTitle} | Blog`,
    description: `Read ${fallbackTitle} on ${store.name}`,
    alternates: {
      canonical: `${seoConfig.siteUrl}/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  let post: BlogPost | undefined;

  try {
    post = await getCachedPost(slug);
  } catch {}

  return <BlogPostClient slug={slug} initialPost={post} />;
}
