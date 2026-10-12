"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyForm } from "@/features/settings/components/currency-form";
import { DollarSign } from "lucide-react";
import { PageTitle } from "@/components/dashboard-page-title";

export function CurrencySettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="Currency" description="Applied across all prices, orders, and receipts" />
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <h2 className="text-base font-bold tracking-tight">Store Currency</h2>
        <CurrencyForm />
      </div>
    </div>
  );
}
