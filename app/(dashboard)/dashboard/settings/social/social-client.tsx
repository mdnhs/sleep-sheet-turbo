"use client";

import { SocialManagerForm } from "@/features/settings/components/social-manager-form";

export function SocialSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Social Manager</h1>
        <p className="text-muted-foreground text-sm">
          Link the self-hosted social media scheduler (Postiz) so the Social entry in the sidebar opens it
        </p>
      </div>
      <SocialManagerForm />
    </div>
  );
}
