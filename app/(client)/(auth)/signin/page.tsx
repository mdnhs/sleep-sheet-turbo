import SignInCard from "@/features/auth/components/sign-in-card";
import { SignInSkeleton } from "@/features/auth/components/sign-in-skeleton";
import { getCurrentUser } from "@/lib/is-authenticated";
import { landingPath } from "@/lib/permissions";
import { redirect } from "next/navigation";
import React from "react";

async function SignInPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(landingPath(user) ?? "/");
  }

  return (
    <React.Suspense fallback={<SignInSkeleton />}>
      <SignInCard />
    </React.Suspense>
  );
}

export default SignInPage;
