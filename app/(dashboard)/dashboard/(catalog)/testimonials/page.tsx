import React, { Suspense } from "react";
import TestimonialsClientPage from "./testimonials-client";
import { TestimonialsPageSkeleton } from "./testimonials-skeleton";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";

async function TestimonialsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "MODERATOR" && !can(user, "testimonials", "read"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<TestimonialsPageSkeleton />}>
      <TestimonialsClientPage />
    </Suspense>
  );
}

export default TestimonialsPage;
