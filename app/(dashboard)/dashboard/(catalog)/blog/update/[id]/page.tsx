import React from 'react';
import UpdateBlogClient from './update-blog-client';

export const metadata = {
  title: 'Update Blog Post',
};

export default async function UpdateBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UpdateBlogClient id={id} />;
}
