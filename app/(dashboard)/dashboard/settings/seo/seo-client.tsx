"use client";

import { Search } from "lucide-react";
import { SeoForm } from "@/features/seo/components/seo-form";
import { PageTitle } from "@/components/dashboard-page-title";

export function SeoClient() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="SEO Settings" description="Manage search engine optimization, social sharing, and crawler settings" />
      <SeoForm />
    </div>
  );
}
