"use client";

import { SettingsFieldsForm } from "@/features/settings/components/settings-fields-form";
import { BUSINESS_RULE_SECTIONS } from "@/features/settings/settings-fields";
import { PageTitle } from "@/components/dashboard-page-title";

export function BusinessRulesSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="Business Rules" description="Order numbering, invoices and stock alerts" />
      <SettingsFieldsForm sections={BUSINESS_RULE_SECTIONS} submitLabel="Save Business Rules" />
    </div>
  );
}
