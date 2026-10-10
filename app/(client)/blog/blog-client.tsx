'use client';
import { useGetPosts } from '@/features/blog/api/use-get-posts';
import Link from 'next/link';
import { format } from 'date-fns';
import { useQueryState } from 'nuqs';
import { X } from 'lucide-react';
import { extractTags } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { BlogGridSkeleton } from './blog-list-fallback';
import FallbackImage from "@/components/ui/fallback-image";

type PostsData = NonNullable<ReturnType<typeof useGetPosts>['data']>;
export type BlogPost = PostsData['data'][number];

interface BlogClientPageProps {
  initialPosts?: BlogPost[];
}

export default function BlogClientPage({ initialPosts }: BlogClientPageProps = {}) {
  const { t } = useLanguage();
  const { data: postsData, isLoading } = useGetPosts(undefined, {
    initialData: initialPosts
      ? {
          data: initialPosts,
          total: initialPosts.length,
          totalPages: 1,
          hasNextPage: false,
        }
      : undefined,
  });
  const [activeTag, setActiveTag] = useQueryState('tag', { defaultValue: '' });

  const fetchedPosts = postsData?.data?.filter((p) => p.isPublished) || [];
  const publishedPosts = fetchedPosts.length > 0 ? fetchedPosts : (initialPosts || []);

  // Match against the same derived tags the post page renders, so a tag chip always
  // finds at least the post it was clicked from. Tags come from extractTags(), not
  // a DB column, so this can't be pushed into the query.
  const visiblePosts = activeTag
    ? publishedPosts.filter((p) =>
        extractTags(p.title, p.content).some(
          (t: string) => t.toLowerCase() === activeTag.toLowerCase()
        )
      )
    : publishedPosts;

  return (
    <div className="container mx-auto py-12 px-4 min-h-[80vh]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-6 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">{t("blogBreadcrumbLabel")}</span>
      </nav>

      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{t("blogHeading")}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("blogSubtitle")}</p>
      </div>

      {activeTag && (
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className="text-sm text-muted-foreground">
            {t("blogShowingPrefix")} {visiblePosts.length}{' '}
            {visiblePosts.length === 1 ? t("blogPostSingular") : t("blogPostPlural")} {t("blogTaggedSuffix")}
          </span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            title="Clear tag filter"
          >
            #{activeTag}
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        </div>
      )}

      {isLoading && publishedPosts.length === 0 ? (
        <BlogGridSkeleton />
      ) : visiblePosts.length === 0 ? (
        <div className="text-center py-20">
          {activeTag ? (
            <>
              <h3 className="text-2xl font-semibold">{t("blogNoPostsTagged")} #{activeTag}</h3>
              <p className="text-muted-foreground mt-1">{t("blogTryAllArticles")}</p>
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t("blogViewAllPosts")}
              </button>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-semibold">{t("blogNoPostsYet")}</h3>
              <p className="text-muted-foreground">{t("blogCheckBackLater")}</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {visiblePosts.map((post) => (
            <Link href={`/blog/${post.slug}`} key={post.id} className="group flex flex-col gap-4 rounded-3xl bg-white dark:bg-slate-900 p-3">
              <div className="overflow-hidden rounded-2xl aspect-[1200/630] bg-muted relative">
                <FallbackImage
                  src={post.coverImage}
                  alt={post.coverImage ? post.title : ""}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {format(new Date(post.createdAt), 'MMMM d, yyyy')} • {post.author?.name || t("blogAdminFallback")}
                </p>
                <h3 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h3>
                {post.summary && (
                  <p className="text-muted-foreground mt-2 line-clamp-3">{post.summary}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
