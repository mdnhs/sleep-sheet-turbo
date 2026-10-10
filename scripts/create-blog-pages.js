import fs from 'fs';
import path from 'path';

const dir = 'app/(dashboard)/dashboard/blog';
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(dir, 'create'), { recursive: true });
fs.mkdirSync(path.join(dir, 'update/[id]'), { recursive: true });

fs.writeFileSync(path.join(dir, 'page.tsx'), `import React from 'react';
import BlogClientPage from './blog-client';

export const metadata = {
  title: 'Manage Blog',
  description: 'Manage your blog posts',
};

export default function BlogPage() {
  return <BlogClientPage />;
}
`);

fs.writeFileSync(path.join(dir, 'blog-client.tsx'), `'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetPosts } from '@/features/blog/api/use-get-posts';
import { useDeletePost } from '@/features/blog/api/use-delete-post';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteAlertMessage } from '@/components/DeleteAlertMessage';
import { Plus, Edit, Trash } from 'lucide-react';
import Link from 'next/link';

export default function BlogClientPage() {
  const { data: posts, isLoading } = useGetPosts();
  const { mutate: deletePost, isPending: isDeleting } = useDeletePost();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center pb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Blog Posts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your blog posts</p>
        </div>
        <Link href="/dashboard/blog/create">
          <Button><Plus className="mr-2 h-4 w-4" /> Create Post</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !posts || posts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No blog posts found.</p>
          ) : (
            <div className="space-y-2">
              {posts.map((post: any) => (
                <div key={post.id} className="flex items-center justify-between rounded-lg p-4 border transition-all hover:bg-accent bg-card">
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground">Status: {post.isPublished ? 'Published' : 'Draft'} | /{post.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={\`/dashboard/blog/update/\${post.id}\`}>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteAlertMessage
                      description="This will permanently delete this blog post."
                      loading={isDeleting}
                      onConfirm={() => deletePost(post.id)}
                    >
                      <Button variant="destructive" size="icon" className="h-8 w-8">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </DeleteAlertMessage>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
`);

fs.writeFileSync(path.join(dir, 'create/page.tsx'), `import React from 'react';
import CreateBlogClient from './create-blog-client';

export const metadata = {
  title: 'Create Blog Post',
};

export default function CreateBlogPage() {
  return <CreateBlogClient />;
}
`);

fs.writeFileSync(path.join(dir, 'create/create-blog-client.tsx'), `'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/features/dashboard/components/file-upload';
import { useCreatePost } from '@/features/blog/api/use-create-post';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export default function CreateBlogClient() {
  const router = useRouter();
  const { mutate: createPost, isPending } = useCreatePost();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<string | undefined>('');
  const [coverImage, setCoverImage] = useState<File | string>('');
  const [isPublished, setIsPublished] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalImage = coverImage as string;
    if (coverImage instanceof File) {
      const reader = new FileReader();
      reader.readAsDataURL(coverImage);
      await new Promise((resolve) => (reader.onload = resolve));
      finalImage = reader.result as string;
    }

    createPost({
      title,
      slug,
      summary,
      content: content || '',
      coverImage: finalImage,
      isPublished
    }, {
      onSuccess: () => {
        router.push('/dashboard/blog');
      }
    });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Create Blog Post</h1>
      <Card>
        <CardHeader>
          <CardTitle>Post Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Slug</label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Summary</label>
              <Input value={summary} onChange={e => setSummary(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Cover Image</label>
              <FileUpload 
                value={coverImage ? [coverImage] : []}
                onChange={(urls) => setCoverImage(urls[0] || '')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Content (Markdown)</label>
              <div data-color-mode="light">
                <MDEditor value={content} onChange={setContent} height={400} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
              <label className="text-sm font-semibold">Publish immediately</label>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/blog')}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Post'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
`);

fs.writeFileSync(path.join(dir, 'update/[id]/page.tsx'), `import React from 'react';
import UpdateBlogClient from './update-blog-client';

export const metadata = {
  title: 'Update Blog Post',
};

export default function UpdateBlogPage({ params }: { params: { id: string } }) {
  return <UpdateBlogClient id={params.id} />;
}
`);

fs.writeFileSync(path.join(dir, 'update/[id]/update-blog-client.tsx'), `'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/features/dashboard/components/file-upload';
import { useGetPosts } from '@/features/blog/api/use-get-posts';
import { useUpdatePost } from '@/features/blog/api/use-update-post';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export default function UpdateBlogClient({ id }: { id: string }) {
  const router = useRouter();
  const { data: posts, isLoading } = useGetPosts();
  const { mutate: updatePost, isPending } = useUpdatePost(id);
  
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<string | undefined>('');
  const [coverImage, setCoverImage] = useState<File | string>('');
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (posts) {
      const post = posts.find((p: any) => p.id === id);
      if (post) {
        setTitle(post.title || '');
        setSlug(post.slug || '');
        setSummary(post.summary || '');
        setContent(post.content || '');
        setCoverImage(post.coverImage || '');
        setIsPublished(post.isPublished || false);
      }
    }
  }, [posts, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalImage = coverImage as string;
    if (coverImage instanceof File) {
      const reader = new FileReader();
      reader.readAsDataURL(coverImage);
      await new Promise((resolve) => (reader.onload = resolve));
      finalImage = reader.result as string;
    }

    updatePost({
      title,
      slug,
      summary,
      content: content || '',
      coverImage: finalImage,
      isPublished
    }, {
      onSuccess: () => {
        router.push('/dashboard/blog');
      }
    });
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Update Blog Post</h1>
      <Card>
        <CardHeader>
          <CardTitle>Post Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Slug</label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Summary</label>
              <Input value={summary} onChange={e => setSummary(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Cover Image</label>
              <FileUpload 
                value={coverImage ? [coverImage] : []}
                onChange={(urls) => setCoverImage(urls[0] || '')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Content (Markdown)</label>
              <div data-color-mode="light">
                <MDEditor value={content} onChange={setContent} height={400} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
              <label className="text-sm font-semibold">Publish</label>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/blog')}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Update Post'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
`);
