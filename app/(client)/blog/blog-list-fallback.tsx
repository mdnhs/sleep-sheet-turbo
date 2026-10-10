import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import FallbackImage from '@/components/ui/fallback-image';
import { getOptimizedImageUrl } from '@/lib/utils';

interface FallbackPost {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverImage?: string | null;
  createdAt: string | Date;
  isPublished?: boolean;
}

const postDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dhaka' });

// Same box model as a post card in blog-client.tsx: gap-4 column, aspect-[1200/630]
// image, then date line (text-sm + mb-2), 2-line text-xl title, and a mt-2
// 3-line summary. Keep in sync with that file.
export function BlogGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-3xl bg-white dark:bg-slate-900 p-3">
          <Skeleton className="aspect-[1200/630] w-full rounded-2xl" />
          <div>
            <div className="mb-2 flex h-5 items-center">
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
            <div className="flex h-14 flex-col justify-center gap-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <div className="mt-2 flex h-[72px] flex-col justify-center gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Prerendered placeholder for the Suspense boundary around BlogClientPage.
 * Mirrors that component's own layout (breadcrumb, centered heading, grid) so
 * hydration doesn't shift layout.
 */
export default function BlogListFallback({ posts }: { posts?: FallbackPost[] }) {
  const published = (posts ?? []).filter((p) => p.slug && p.isPublished !== false);
  return (
    <div className="container mx-auto py-12 px-4 min-h-[80vh]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-6 text-xs text-muted-foreground font-medium">
        <span>Home</span>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">Blog</span>
      </nav>

      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Our Blog</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Read our latest stories, news, and insights.
        </p>
      </div>

      {published.length > 0 ? (
        // Real post links in the server HTML: BlogClientPage reads the URL
        // (?tag=) through nuqs, so Next renders only this fallback on the
        // server — which used to be a skeleton with no links to any post.
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 list-none p-0 m-0">
          {published.map((post) => (
            <li key={post.id} className="flex">
              <Link href={`/blog/${post.slug}`} className="flex w-full flex-col gap-4 rounded-3xl bg-white dark:bg-slate-900 p-3">
                <div className="relative aspect-[1200/630] overflow-hidden rounded-2xl bg-muted">
                  <FallbackImage
                    src={post.coverImage ? getOptimizedImageUrl(post.coverImage, 800) : ''}
                    alt={post.coverImage ? post.title : ''}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{postDate(post.createdAt)}</p>
                  <h3 className="text-xl font-semibold line-clamp-2">{post.title}</h3>
                  {post.summary && <p className="text-muted-foreground mt-2 line-clamp-3">{post.summary}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <BlogGridSkeleton />
      )}
    </div>
  );
}
