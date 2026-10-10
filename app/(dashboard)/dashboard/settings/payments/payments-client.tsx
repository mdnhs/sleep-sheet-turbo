"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentsForm } from "@/features/settings/components/payments-form";
import { BkashForm } from "@/features/settings/components/bkash-form";
import { PosPaymentMethods } from "@/features/settings/components/pos-payment-methods";
import { CreditCard, Store } from "lucide-react";

export function PaymentsSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Methods</h1>
        <p className="text-muted-foreground text-sm">
          Enable or disable payment options at checkout and point of sale
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <h2 className="text-base font-bold tracking-tight">Checkout Payment Methods</h2>
          <PaymentsForm />
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">bKash Payment Gateway</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Accept online bKash payments at checkout. All credentials are stored here — nothing is read from environment variables.
            </p>
          </div>
          <BkashForm />
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <div>
            <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              POS Payment Methods
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cash is always available. Toggle Card and Due on/off. Add custom methods like BKash, Nagad, etc.
            </p>
          </div>
          <PosPaymentMethods />
        </div>
      </div>
    </div>
  );
}
