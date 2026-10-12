'use client';
import { PageTitle } from "@/components/dashboard-page-title";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/features/dashboard/components/file-upload';
import { useCreatePost } from '@/features/blog/api/use-create-post';
import { TiptapEditor } from '@/components/tiptap-editor';
import { toast } from 'sonner';
import { generateSlug } from '@/lib/utils';

export default function CreateBlogClient() {
  const router = useRouter();
  const { mutate: createPost, isPending } = useCreatePost();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<string | undefined>('');
  const [coverImage, setCoverImage] = useState<File | string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

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

    createPost({
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

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <PageTitle title="Create Blog Post" description="Publish new article or announcement" />

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
              {isUploading ? 'Uploading...' : isPending ? 'Saving...' : 'Save Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
