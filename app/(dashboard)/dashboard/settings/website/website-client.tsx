"use client";

import { Globe } from "lucide-react";
import { WebsiteForm } from "@/features/settings/components/website-form";

export function WebsiteClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure homepage hero, features, newsletter, footer, and site-wide content
        </p>
      </div>
      <WebsiteForm />
    </div>
  );
}
