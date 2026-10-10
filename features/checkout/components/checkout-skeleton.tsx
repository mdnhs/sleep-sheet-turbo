import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// These mirror shipping-information-card.tsx and order-summery-card.tsx class
// for class (Card padding/gap, header margin, FormItem space-y-1 with a 15px
// label line, h-10 inputs, 44px textarea, 2-col delivery-zone radios, the COD
// payment row, and the h-11/lg:h-14 submit button). Keep them in sync.
function Field({ label, control }: { label: string; control: string }) {
  return (
    <div className="space-y-1">
      <div className="flex h-[15px] items-center">
        <Skeleton className={`h-2.5 ${label} rounded`} />
      </div>
      <Skeleton className={`${control} w-full rounded-xl`} />
    </div>
  );
}

export function ShippingInformationSkeleton() {
  return (
    <div className="w-full" aria-hidden="true">
      <div className="space-y-3">
        <Card className="bg-card rounded-2xl gap-3 p-3.5 sm:p-5 w-full ring-0">
          <CardHeader className="p-0 mb-2.5">
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-24 sm:w-28 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="p-0 w-full space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="w-20" control="h-10" />
              <Field label="w-16" control="h-10" />
            </div>
            <Field label="w-14" control="h-10" />
            <Field label="w-24" control="h-[44px]" />
            <div className="pt-0.5 space-y-1">
              <div className="flex h-[15px] items-center">
                <Skeleton className="h-2.5 w-28 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border-2 border-border/50 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                      <div className="space-y-0.5">
                        <div className="flex h-5 items-center">
                          <Skeleton className="h-3.5 w-20 rounded" />
                        </div>
                        <div className="mt-0.5 flex h-4 items-center">
                          <Skeleton className="h-3 w-12 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-2xl gap-3 p-3.5 sm:p-5 w-full ring-0">
          <CardHeader className="p-0 mb-2.5">
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-24 sm:w-28 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-xl border-2 border-border/40 p-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Skeleton className="w-full h-11 lg:h-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function OrderSummarySkeleton() {
  return (
    <Card className="w-full bg-card rounded-xl lg:rounded-2xl overflow-hidden gap-3 py-3 ring-0" aria-hidden="true">
      <CardHeader className="py-2.5 px-3 lg:pt-4 lg:pb-3 lg:px-4 border-b border-border/40 !pb-2.5 lg:!pb-3">
        <div className="flex h-5 items-center lg:h-6">
          <Skeleton className="h-3.5 lg:h-4 w-28 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 lg:space-y-3 p-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-2 lg:gap-3 items-center">
            <Skeleton className="h-10 w-10 lg:h-14 lg:w-14 shrink-0 rounded-lg lg:rounded-xl" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <Skeleton className="h-3 lg:h-3.5 w-32 sm:w-40 rounded" />
                <Skeleton className="h-3 lg:h-3.5 w-12 rounded" />
              </div>
              <div className="mt-0.5 flex items-center">
                <Skeleton className="h-2 lg:h-2.5 w-24 rounded" />
              </div>
            </div>
          </div>
        ))}

        <div className="border-t border-border/40 pt-2 lg:pt-3 space-y-1.5 lg:space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
          <div className="flex justify-between items-end pt-1.5 lg:pt-2 border-t border-border/40">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-6 lg:h-7 w-20 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto px-3 pb-4 pt-1 max-w-5xl">
        <div className="flex flex-col lg:flex-row items-start gap-4 mt-2">
          <div className="w-full lg:w-3/5 order-1">
            <ShippingInformationSkeleton />
          </div>
          <div className="w-full lg:w-2/5 order-2 lg:sticky lg:top-20">
            <OrderSummarySkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSkeleton;
