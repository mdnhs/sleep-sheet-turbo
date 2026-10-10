import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/is-authenticated";
import React from "react";

import { redirect } from "next/navigation";
import AccountClientPage from "./account-client";

// Private, per-user page — never indexable.
export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signup");
  }
  return <AccountClientPage name={user.name} />;
}

export default AccountPage;
