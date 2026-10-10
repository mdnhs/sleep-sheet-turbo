import fs from 'fs';
import path from 'path';

const dir = 'app/(client)/blog';
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(dir, '[slug]'), { recursive: true });

fs.writeFileSync(path.join(dir, 'page.tsx'), `import React from 'react';
import BlogClientPage from './blog-client';

export const metadata = {
  title: 'Blog',
  description: 'Read our latest stories and news.',
};

export default function BlogPage() {
  return <BlogClientPage />;
}
`);

fs.writeFileSync(path.join(dir, 'blog-client.tsx'), `'use client';
import { useGetPosts } from '@/features/blog/api/use-get-posts';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { format } from 'date-fns';

export default function BlogClientPage() {
  const { data: posts, isLoading } = useGetPosts();

  const publishedPosts = posts?.filter((p: any) => p.isPublished) || [];

  return (
    <div className="container mx-auto py-12 px-4 min-h-[80vh]">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Our Blog</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Read our latest stories, news, and insights.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : publishedPosts.length === 0 ? (
        <div className="text-center py-20">
          <h3 className="text-2xl font-semibold">No posts yet</h3>
          <p className="text-muted-foreground">Check back later for new content!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {publishedPosts.map((post: any) => (
            <Link href={\`/blog/\${post.slug}\`} key={post.id} className="group flex flex-col gap-4">
              <div className="overflow-hidden rounded-2xl aspect-video bg-muted relative">
                {post.coverImage ? (
                  <img src={post.coverImage} alt={post.title} className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {format(new Date(post.createdAt), 'MMMM d, yyyy')} • {post.author?.name || 'Admin'}
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
`);

fs.writeFileSync(path.join(dir, '[slug]/page.tsx'), `import React from 'react';
import BlogPostClient from './blog-post-client';

export const metadata = {
  title: 'Blog Post',
};

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  return <BlogPostClient slug={params.slug} />;
}
`);

fs.writeFileSync(path.join(dir, '[slug]/blog-post-client.tsx'), `'use client';
import { useGetPost } from '@/features/blog/api/use-get-post';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import '@uiw/react-markdown-preview/markdown.css';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false });

export default function BlogPostClient({ slug }: { slug: string }) {
  const { data: post, isLoading } = useGetPost(slug);

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-3xl min-h-[80vh]">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-6 w-1/3 mb-8" />
        <Skeleton className="aspect-video w-full rounded-2xl mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (!post || !post.isPublished) {
    return (
      <div className="container mx-auto py-20 px-4 text-center min-h-[80vh]">
        <h1 className="text-3xl font-bold mb-4">Post not found</h1>
        <Link href="/blog" className="text-primary hover:underline">Return to blog</Link>
      </div>
    );
  }

  return (
    <article className="container mx-auto py-12 px-4 max-w-4xl min-h-[80vh]">
      <Link href="/blog" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to blog
      </Link>
      
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
          {post.title}
        </h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span>{format(new Date(post.createdAt), 'MMMM d, yyyy')}</span>
          <span>•</span>
          <span>{post.author?.name || 'Admin'}</span>
        </div>
      </div>

      {post.coverImage && (
        <div className="aspect-video w-full rounded-3xl overflow-hidden mb-12 shadow-lg">
          <img src={post.coverImage} alt={post.title} className="object-cover w-full h-full" />
        </div>
      )}

      <div className="prose prose-lg dark:prose-invert max-w-3xl mx-auto" data-color-mode="light">
        <MarkdownPreview source={post.content} style={{ backgroundColor: 'transparent' }} />
      </div>
    </article>
  );
}
`);
