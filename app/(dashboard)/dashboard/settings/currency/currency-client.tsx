"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyForm } from "@/features/settings/components/currency-form";
import { DollarSign } from "lucide-react";

export function CurrencySettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Currency</h1>
        <p className="text-muted-foreground text-sm">
          Applied across all prices, orders, and receipts
        </p>
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <h2 className="text-base font-bold tracking-tight">Store Currency</h2>
        <CurrencyForm />
      </div>
    </div>
  );
}
