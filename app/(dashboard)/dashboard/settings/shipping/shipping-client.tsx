"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShippingForm } from "@/features/settings/components/shipping-form";
import { CourierForm } from "@/features/settings/components/courier-form";
import { BdCourierForm } from "@/features/settings/components/bdcourier-form";
import { GoogleSheetsForm } from "@/features/settings/components/google-sheets-form";
import { Truck } from "lucide-react";

export function ShippingSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shipping & Courier</h1>
        <p className="text-muted-foreground text-sm">
          Configure shipping costs and courier API credentials
        </p>
      </div>
      <div className="space-y-6">
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <h2 className="text-base font-bold tracking-tight">Shipping Costs</h2>
          <ShippingForm />
        </div>
        <CourierForm />
        <BdCourierForm />
        <GoogleSheetsForm />
      </div>
    </div>
  );
}
