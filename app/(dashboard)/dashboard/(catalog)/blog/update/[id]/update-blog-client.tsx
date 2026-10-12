'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FileUpload } from '@/features/dashboard/components/file-upload';
import { useGetPost } from '@/features/blog/api/use-get-post';
import { useGetPosts } from '@/features/blog/api/use-get-posts';
import { useUpdatePost } from '@/features/blog/api/use-update-post';
import { TiptapEditor } from '@/components/tiptap-editor';
import { toast } from 'sonner';
import { generateSlug } from '@/lib/utils';

export default function UpdateBlogClient({ id }: { id: string }) {
  const router = useRouter();
  const { data: singlePost, isLoading: isLoadingSingle } = useGetPost(id);
  const { data: postsData, isLoading: isLoadingAll } = useGetPosts({ limit: '100' });
  const { mutate: updatePost, isPending } = useUpdatePost(id);

  const isLoading = isLoadingSingle && (!postsData?.data || postsData.data.length === 0);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<string | undefined>('');
  const [coverImage, setCoverImage] = useState<File | string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    const post = singlePost || postsData?.data?.find((p) => p.id === id || p.slug === id);
    if (post) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding editable form fields once the post arrives from the async query; the fields must stay independently editable afterward, so they can't be derived during render.
      setTitle(post.title || '');
      setSlug(post.slug || '');
      setSummary(post.summary || '');
      setContent(post.content || '');
      setCoverImage(post.coverImage || '');
      setIsPublished(post.isPublished || false);
    }
  }, [singlePost, postsData, id]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSlug(generateSlug(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalImage = coverImage as string;
    if (coverImage instanceof File) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', coverImage);
      const res = await fetch('/api/blog/upload-image', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to upload image');
        setIsUploading(false);
        return;
      }
      const { url } = await res.json();
      finalImage = url;
      setIsUploading(false);
    }

    updatePost({
      title,
      slug: slug || generateSlug(title),
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

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-5xl mx-auto">
        <div>
          <Skeleton className="h-8 w-48 rounded-xl mb-2" />
          <Skeleton className="h-4 w-64 rounded-xl" />
        </div>
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Update Blog Post</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">Edit post content and settings</p>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Title</label>
            <Input
              placeholder="e.g. 10 Tips for Better Sleep Quality"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              className="rounded-full bg-slate-50 dark:bg-muted/40 border-none shadow-none text-xs font-semibold h-10 px-4"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL Slug</label>
            <Input
              placeholder="10-tips-for-better-sleep-quality"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className="rounded-full bg-slate-50 dark:bg-muted/40 border-none shadow-none text-xs font-mono h-10 px-4"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Summary (Optional)</label>
            <Input
              placeholder="Brief overview of the article..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="rounded-full bg-slate-50 dark:bg-muted/40 border-none shadow-none text-xs font-semibold h-10 px-4"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cover Image</label>
            <FileUpload 
              value={coverImage ? [coverImage] : []}
              onChange={(urls) => setCoverImage(urls[0] || '')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Content</label>
            <TiptapEditor value={content || ''} onChange={setContent} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isPublished"
              checked={isPublished}
              onChange={e => setIsPublished(e.target.checked)}
              className="rounded border-input h-4 w-4"
            />
            <label htmlFor="isPublished" className="text-xs font-semibold cursor-pointer select-none">
              Publish immediately
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/blog')}
              className="rounded-full text-xs font-semibold px-5 h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || isUploading}
              className="rounded-full text-xs font-semibold px-6 h-9 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              {isUploading ? 'Uploading...' : isPending ? 'Saving...' : 'Update Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
