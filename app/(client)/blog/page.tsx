// A day, like the rest of the storefront. The list is read through a cached
// helper tagged "blog", and every write route now invalidates that tag, so
// an edit shows up immediately — the timer is only the fallback for changes
// that bypass those routes.
export const revalidate = 86400;

import React, { Suspense } from 'react';
import BlogClientPage from './blog-client';
import BlogListFallback from './blog-list-fallback';
import { seoConfig, generateMetadata, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";

export const metadata = generateMetadata({
  title: "Blog",
  description: `Read our latest stories, sleep tips, product guides, and news from ${seoConfig.siteName}.`,
  canonical: `${seoConfig.siteUrl}/blog`,
})

import { getPublicBlogPosts } from "@/lib/prefetch-home";

export default async function BlogPage() {
  const postsRes = await getPublicBlogPosts().catch(() => null);
  const posts = postsRes?.data || [];

  return (
    <>
      {structuredDataScript("blog-listing", webpageSchema(
        "Blog | " + seoConfig.siteName,
        "Read our latest stories, sleep tips, product guides, and news.",
        `${seoConfig.siteUrl}/blog`,
      ))}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
        ]),
      )}
      <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
        <Suspense fallback={<BlogListFallback posts={posts} />}>
          <BlogClientPage initialPosts={posts} />
        </Suspense>
      </div>
    </>
  );
}
