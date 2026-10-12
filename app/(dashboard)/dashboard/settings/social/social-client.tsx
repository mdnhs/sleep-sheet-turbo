"use client";

import { SocialManagerForm } from "@/features/settings/components/social-manager-form";
import { PageTitle } from "@/components/dashboard-page-title";

export function SocialSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="Social Manager" description="Link the self-hosted social media scheduler (Postiz) so the Social entry in the sidebar opens it" />
      <SocialManagerForm />
    </div>
  );
}
