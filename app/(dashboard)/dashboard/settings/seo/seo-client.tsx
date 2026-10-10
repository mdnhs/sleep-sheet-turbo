"use client";

import { Search } from "lucide-react";
import { SeoForm } from "@/features/seo/components/seo-form";

export function SeoClient() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SEO Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage search engine optimization, social sharing, and crawler settings
        </p>
      </div>
      <SeoForm />
    </div>
  );
}
