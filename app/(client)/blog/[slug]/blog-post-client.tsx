'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  Heart,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import {
  IconBrandFacebook,
  IconBrandX,
  IconBrandLinkedin,
  IconBrandInstagram,
  IconLink,
  IconCheck,
} from '@tabler/icons-react';
import { useGetPost } from '@/features/blog/api/use-get-post';
import { useGetPosts } from '@/features/blog/api/use-get-posts';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { getOptimizedImageUrl, extractTags } from '@/lib/utils';
import { proseTableClasses } from '@/lib/prose-table-classes';
import { useStoreProfile } from '@/hooks/use-store-profile';
import { seoConfig, articleSchema, breadcrumbSchema, structuredDataScript } from '@/lib/seo';
import type { BlogPost } from '@/app/(client)/blog/blog-client';
import FallbackImage from "@/components/ui/fallback-image";

const TAGS = [
  'Sleep Quality',
  'Bedding Guide',
  'Comforter Care',
  'Home Comfort',
  'Healthy Sleep',
  'Decor & Styling',
];

export default function BlogPostClient({ slug, initialPost }: { slug: string; initialPost?: BlogPost }) {
  const store = useStoreProfile();
  const { data: fetchedPost, isLoading } = useGetPost(slug);
  const { data: allPostsData } = useGetPosts({ limit: '5' });
  const [isLiked, setIsLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  const post = fetchedPost || initialPost;

  const relatedPosts =
    allPostsData?.data?.filter(
      (p) => p.slug !== slug && p.id !== post?.id && p.isPublished !== false
    ).slice(0, 3) || [];

  if (isLoading && !post) {
    // Same shell as the real article below (pt-4/sm:pt-6, px-3/sm:px-4,
    // gap-6/sm:gap-8/lg:gap-12, space-y-4/sm:space-y-6) and the same box
    // sizes for the breadcrumb, title, meta pills, cover and sidebar cards.
    return (
      <article className="min-h-screen bg-[#F4F4F4] dark:bg-gray-800 pb-16 pt-4 sm:pt-6" aria-hidden="true">
        <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 pt-1 sm:pt-2">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-6">
              <div className="flex h-6 items-center">
                <Skeleton className="h-3 w-48 rounded-full" />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <Skeleton className="h-6 sm:h-[34px] md:h-[41px] lg:h-14 w-5/6 rounded-2xl" />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                    <Skeleton className="h-6 sm:h-7 w-32 rounded-full" />
                    <Skeleton className="h-6 sm:h-7 w-24 rounded-full" />
                    <Skeleton className="h-6 sm:h-7 w-28 rounded-full hidden sm:block" />
                  </div>
                  <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full" />
                </div>
              </div>
              <Skeleton className="aspect-[16/9] w-full rounded-2xl sm:rounded-[2.5rem]" />
              <div className="space-y-3 pt-2">
                <Skeleton className="h-5 w-full rounded-lg" />
                <Skeleton className="h-5 w-full rounded-lg" />
                <Skeleton className="h-5 w-4/5 rounded-lg" />
                <Skeleton className="h-5 w-11/12 rounded-lg" />
                <Skeleton className="h-5 w-3/4 rounded-lg" />
              </div>
            </div>

            {/* Right Sidebar Skeleton */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6">
              <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-3">
                <Skeleton className="h-4 w-36 rounded-full" />
                <div className="flex gap-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-9 rounded-full" />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-3">
                <Skeleton className="h-4 w-24 rounded-full" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-32 rounded-full" />
                </div>
              </div>

              <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-4">
                <Skeleton className="h-4 w-28 rounded-full" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <Skeleton className="h-14 w-16 rounded-xl shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-3 w-20 rounded-full" />
                        <Skeleton className="h-4 w-full rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (!post || !post.isPublished) {
    return (
      <div className="container mx-auto py-20 px-4 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <h1 className="text-3xl font-extrabold mb-4">Post not found</h1>
        <p className="text-muted-foreground text-sm mb-6">
          The article you are looking for might have been moved or removed.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Blog
        </Link>
      </div>
    );
  }

  // Calculate estimated reading time
  const plainText = (post.content || '').replace(/<[^>]*>/g, '');
  const wordCount = plainText.trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const postUrl = `${seoConfig.siteUrl}/blog/${slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const blogBreadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Our Blogs', url: '/blog' },
    { name: post.title, url: `/blog/${slug}` },
  ];

  return (
    <article className="min-h-screen bg-[#F4F4F4] dark:bg-gray-800 pb-16 pt-4 sm:pt-6">
      {structuredDataScript(
        'article',
        articleSchema({
          id: slug,
          title: post.title,
          excerpt: post.summary || post.title,
          slug,
          content: post.content,
          author: post.author ? { name: post.author.name } : undefined,
          coverImage: post.coverImage || undefined,
          publishedAt: post.createdAt,
          updatedAt: post.createdAt,
          url: postUrl,
        }, store)
      )}
      {structuredDataScript('breadcrumbs', breadcrumbSchema(blogBreadcrumbs))}

      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 pt-1 sm:pt-2">
          {/* Left Column: Breadcrumbs + Title + Meta + Cover Image + Content */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-muted-foreground overflow-x-auto py-1">
              <Link href="/" className="hover:text-foreground transition-colors shrink-0">
                Home
              </Link>
              <span>•</span>
              <Link href="/blog" className="hover:text-foreground transition-colors shrink-0">
                Our Blogs
              </Link>
              <span>•</span>
              <span className="text-foreground font-semibold truncate max-w-[150px] sm:max-w-md">
                {post.title}
              </span>
            </nav>

            {/* Header Section */}
            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.2] sm:leading-[1.15]">
                {post.title}
              </h1>

              {/* Meta Info Bar */}
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap sm:flex-nowrap">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs">
                  {/* Author Badge */}
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 sm:px-3 sm:py-1.5 font-semibold text-foreground">
                    <Avatar className="h-4 w-4 sm:h-5 sm:w-5 border border-white/20">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${
                          post.author?.name || 'Admin'
                        }`}
                      />
                      <AvatarFallback>{(post.author?.name || 'A')[0]}</AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[110px] sm:max-w-none">{post.author?.name || 'Editorial Team'}</span>
                  </div>

                  {/* Reading Time */}
                  <div className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 sm:px-3 sm:py-1.5 text-muted-foreground font-medium">
                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>{readTime} min read</span>
                  </div>

                  {/* Date */}
                  {post.createdAt && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 sm:px-3 sm:py-1.5 text-muted-foreground font-medium">
                      <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span>{format(new Date(post.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                </div>

                {/* Like/Bookmark Button */}
                <button
                  onClick={() => {
                    setIsLiked(!isLiked);
                    toast.success(isLiked ? 'Removed from favorites' : 'Saved to favorites');
                  }}
                  className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                    isLiked
                      ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title="Bookmark Article"
                >
                  <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>

            {/* Hero Cover Image */}
            {post.coverImage ? (
              <div className="w-full rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-slate-100 dark:bg-muted shadow-md border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <img
                  src={getOptimizedImageUrl(post.coverImage, 1200)}
                  alt={post.title}
                  className="w-full h-auto object-contain rounded-2xl sm:rounded-[2.5rem] block"
                  onError={(e) => {
                    if (!e.currentTarget.src.endsWith("/placeholder.jpg")) e.currentTarget.src = "/placeholder.jpg";
                  }}
                />
              </div>
            ) : null}

            {/* Article Summary Quote */}
            {post.summary && (
              <p className="text-sm sm:text-lg font-medium text-slate-700 dark:text-slate-300 leading-relaxed border-l-4 border-indigo-500 pl-3 sm:pl-4 py-1 italic bg-indigo-50/40 dark:bg-indigo-950/20 rounded-r-xl sm:rounded-r-2xl">
                {post.summary}
              </p>
            )}

            {/* Article Content */}
            <div
              className={`prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none text-foreground leading-relaxed prose-headings:font-extrabold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-img:rounded-2xl sm:prose-img:rounded-3xl ${proseTableClasses}`}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>

          {/* Right Sidebar Column */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            {/* Share Section */}
            <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Share on Social Media
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="h-9 w-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Copy link"
                >
                  {copied ? <IconCheck className="h-4 w-4 text-emerald-500" /> : <IconLink className="h-4 w-4" />}
                </button>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Share on Facebook"
                >
                  <IconBrandFacebook className="h-4 w-4" />
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Share on X"
                >
                  <IconBrandX className="h-4 w-4" />
                </a>
                <a
                  href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Share on LinkedIn"
                >
                  <IconBrandLinkedin className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Auto-Generated Article Tags */}
            <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                All Tags
              </h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {extractTags(post.title, post.content, `${store.name} Bangladesh`).map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Related Blogs */}
            {relatedPosts.length > 0 && (
              <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Related Blogs
                </h3>
                <div className="space-y-3">
                  {relatedPosts.map((relPost) => (
                    <Link
                      key={relPost.id}
                      href={`/blog/${relPost.slug || relPost.id}`}
                      className="group flex gap-3 items-start p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="relative h-14 w-16 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                        <FallbackImage
                          src={relPost.coverImage ? getOptimizedImageUrl(relPost.coverImage, 120) : null}
                          alt={relPost.title}
                          fill
                          sizes="64px"
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        {relPost.createdAt && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>{format(new Date(relPost.createdAt), 'dd MMM yyyy')}</span>
                          </div>
                        )}
                        <h4 className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 leading-snug">
                          {relPost.title}
                        </h4>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
