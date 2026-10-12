import React, { Suspense } from "react";
import { Metadata } from "next";
import ImagesClientPage from "./images-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Images - Dashboard",
  description: "Product images and Cloudinary URLs by category",
};

function ImagesSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

export default function ImagesPage() {
  return (
    <Suspense fallback={<ImagesSkeleton />}>
      <ImagesClientPage />
    </Suspense>
  );
}
