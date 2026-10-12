"use client";

import { Image } from "lucide-react";
import { CdnForm } from "@/features/settings/components/cdn-form";
import { PageTitle } from "@/components/dashboard-page-title";

export function CdnClient() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="CDN Settings" description="Manage Cloudinary API credentials for image uploads and storage" />
      <CdnForm />
    </div>
  );
}
