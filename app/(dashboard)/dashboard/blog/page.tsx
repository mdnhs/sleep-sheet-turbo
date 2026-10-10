import React, { Suspense } from 'react';
import BlogClientPage from './blog-client';
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: 'Manage Blog',
  description: 'Manage your blog posts',
};

function BlogSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogSkeleton />}>
      <BlogClientPage />
    </Suspense>
  );
}
