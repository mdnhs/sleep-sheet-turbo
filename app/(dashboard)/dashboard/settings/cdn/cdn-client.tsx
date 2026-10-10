"use client";

import { Image } from "lucide-react";
import { CdnForm } from "@/features/settings/components/cdn-form";

export function CdnClient() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CDN Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage Cloudinary API credentials for image uploads and storage
        </p>
      </div>
      <CdnForm />
    </div>
  );
}
