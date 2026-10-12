"use client";

import { SettingsFieldsForm } from "@/features/settings/components/settings-fields-form";
import { STORE_PROFILE_SECTIONS } from "@/features/settings/settings-fields";
import { PageTitle } from "@/components/dashboard-page-title";

export function StoreProfileSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="Store Profile" description="Legal and registration details, location and locale. Name, logo, contact details and social links are on the Website page." />
      <SettingsFieldsForm sections={STORE_PROFILE_SECTIONS} submitLabel="Save Store Profile" />
    </div>
  );
}
