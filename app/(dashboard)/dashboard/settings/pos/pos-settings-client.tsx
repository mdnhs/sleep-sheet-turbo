"use client";

import { PosFacebookPages } from "@/features/settings/components/pos-facebook-pages";
import { PosPaymentMethods } from "@/features/settings/components/pos-payment-methods";
import { Store, Share2 } from "lucide-react";

export function PosSettingsClient() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">POS Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure Facebook page sales channels, default page selection, and POS payment methods
        </p>
      </div>

      <div className="space-y-6">
        {/* Facebook Pages (Sales Channels) */}
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <div>
            <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Facebook Pages (Sales Channels)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              These pages appear in the POS &quot;Facebook page&quot; reference dropdown. Set a default page to automatically pre-select it when opening a new POS sale.
            </p>
          </div>
          <PosFacebookPages />
        </div>

        {/* POS Payment Methods */}
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <div>
            <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              POS Payment Methods
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cash is always available. Toggle Card and Due on/off, or add custom payment methods for point of sale.
            </p>
          </div>
          <PosPaymentMethods />
        </div>
      </div>
    </div>
  );
}
