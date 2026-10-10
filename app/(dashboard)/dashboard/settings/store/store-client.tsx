"use client";

import { SettingsFieldsForm } from "@/features/settings/components/settings-fields-form";
import { STORE_PROFILE_SECTIONS } from "@/features/settings/settings-fields";

export function StoreProfileSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Store Profile</h1>
        <p className="text-muted-foreground text-sm">
          Legal and registration details, location and locale. Name, logo, contact details and social links are on the
          Website page.
        </p>
      </div>
      <SettingsFieldsForm sections={STORE_PROFILE_SECTIONS} submitLabel="Save Store Profile" />
    </div>
  );
}
