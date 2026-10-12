"use client";

import { Globe } from "lucide-react";
import { WebsiteForm } from "@/features/settings/components/website-form";
import { PageTitle } from "@/components/dashboard-page-title";

export function WebsiteClient() {
  return (
    <div className="space-y-6">
      <PageTitle title="Website Settings" description="Configure homepage hero, features, newsletter, footer, and site-wide content" />
      <WebsiteForm />
    </div>
  );
}
