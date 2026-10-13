import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/is-authenticated";
import { canAccessTab } from "@/lib/tab-access";
import MediaClientPage from "./media-client";
import { MediaPageSkeleton } from "./media-skeleton";

export const metadata: Metadata = {
  title: "Media - Dashboard",
};

export default async function MediaPage() {
  const user = await getCurrentUser();
  if (!user || !(user.role === "MODERATOR" || canAccessTab(user, "media"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<MediaPageSkeleton />}>
      <MediaClientPage />
    </Suspense>
  );
}
