import React, { Suspense } from "react";
import { Metadata } from "next";
import ImagesClientPage from "./images-client";
import { ImagesPageSkeleton } from "./images-skeleton";

export const metadata: Metadata = {
  title: "Images - Dashboard",
  description: "Product images and their URLs by category",
};

export default function ImagesPage() {
  return (
    <Suspense fallback={<ImagesPageSkeleton />}>
      <ImagesClientPage />
    </Suspense>
  );
}
