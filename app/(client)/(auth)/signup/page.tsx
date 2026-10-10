import SignUpCard from "@/features/auth/components/sign-up-card";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import React from "react";

async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }
  return <SignUpCard />;
}

export default SignUpPage;
