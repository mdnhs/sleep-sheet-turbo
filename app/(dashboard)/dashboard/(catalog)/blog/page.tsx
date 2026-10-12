import React, { Suspense } from 'react';
import BlogClientPage from './blog-client';
import { BlogPageSkeleton } from './blog-skeleton';

export const metadata = {
  title: 'Manage Blog',
  description: 'Manage your blog posts',
};

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogPageSkeleton />}>
      <BlogClientPage />
    </Suspense>
  );
}
