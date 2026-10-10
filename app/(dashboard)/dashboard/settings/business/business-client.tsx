"use client";

import { SettingsFieldsForm } from "@/features/settings/components/settings-fields-form";
import { BUSINESS_RULE_SECTIONS } from "@/features/settings/settings-fields";

export function BusinessRulesSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Rules</h1>
        <p className="text-muted-foreground text-sm">Order numbering, invoices and stock alerts</p>
      </div>
      <SettingsFieldsForm sections={BUSINESS_RULE_SECTIONS} submitLabel="Save Business Rules" />
    </div>
  );
}
