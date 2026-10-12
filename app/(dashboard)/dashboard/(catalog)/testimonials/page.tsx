import React, { Suspense } from "react";
import TestimonialsClientPage from "./testimonials-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";

function TestimonialsSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

async function TestimonialsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "MODERATOR" && !can(user, "testimonials", "read"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<TestimonialsSkeleton />}>
      <TestimonialsClientPage />
    </Suspense>
  );
}

export default TestimonialsPage;
