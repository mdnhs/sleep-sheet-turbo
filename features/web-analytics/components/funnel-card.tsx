"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaFunnel, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent } from "../lib/format";
import type { Funnel } from "../lib/types";

const STEPS: { key: keyof Funnel; label: string }[] = [
  { key: "visited", label: "Visited" },
  { key: "viewedProduct", label: "Viewed a product" },
  { key: "addedToCart", label: "Added to cart / Buy now" },
  { key: "startedCheckout", label: "Started checkout" },
  { key: "ordered", label: "Placed an order" },
];

export function FunnelCard({ q }: { q: WaQuery }) {
  const { data, isLoading } = useWaFunnel(q);
  const top = data?.visited ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversion funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const value = data?.[step.key] ?? 0;
              const prev = i === 0 ? value : (data?.[STEPS[i - 1].key] ?? 0);
              return (
                <li key={step.key}>
                  <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-sm">
                    <span>{step.label}</span>
                    <span className="tabular-nums">
                      <span className="font-medium">{formatCount(value)}</span>
                      {i > 0 && (
                        <span className="ml-2 text-muted-foreground">
                          {formatPercent(prev ? Math.min(1, value / prev) : 0)} of previous · {formatCount(Math.max(0, prev - value))} dropped
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${top ? Math.min(100, (value / top) * 100) : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
