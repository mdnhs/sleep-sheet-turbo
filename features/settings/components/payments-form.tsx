"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";

export function PaymentsForm() {
  const { data, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();

  const codEnabled = data ? data.payment_method_cod !== "false" : true;


  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Credit / Debit Card</span>
          <span className="text-xs text-muted-foreground">
            Unavailable — no payment gateway is integrated yet. Enabling this
            has no effect until one is wired up.
          </span>
        </div>
        <Switch checked={false} disabled />
      </div>
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Cash on Delivery</span>
          <span className="text-xs text-muted-foreground">Pay when order arrives</span>
        </div>
        <Switch
          checked={codEnabled}
          disabled={isPending}
          onCheckedChange={(checked) =>
            mutate({ payment_method_cod: checked ? "true" : "false" })
          }
        />
      </div>
    </div>
  );
}
