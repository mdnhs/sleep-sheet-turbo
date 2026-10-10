"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";
import { useWaBreakdown, type WaQuery } from "../api/use-web-analytics";
import { NONE, type Dimension } from "../lib/dimensions";
import { formatCount, keyLabel } from "../lib/format";

export interface BreakdownTab {
  dim: Dimension;
  label: string;
}

export function BreakdownPanel({
  q,
  tabs,
  showOrders = false,
  onSelect,
}: {
  q: WaQuery;
  tabs: BreakdownTab[];
  showOrders?: boolean;
  onSelect: (dim: Dimension, value: string) => void;
}) {
  const [active, setActive] = React.useState<Dimension>(tabs[0].dim);
  const { data, isLoading } = useWaBreakdown(q, active);
  const { formatAmount } = useCurrency();
  const rows = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((row) => row.visitors));
  const activeLabel = tabs.find((tab) => tab.dim === active)?.label ?? "";

  return (
    <Card>
      <CardHeader className="pb-2">
        {tabs.length > 1 ? (
          <Tabs value={active} onValueChange={(value) => setActive(value as Dimension)}>
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.dim} value={tab.dim}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        ) : (
          <span className="text-sm font-medium">{activeLabel}</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex justify-between px-3 text-xs uppercase text-muted-foreground">
          <span>{activeLabel}</span>
          <span className="flex gap-6">
            {showOrders && (
              <>
                <span className="w-10 text-right">Orders</span>
                <span className="w-20 text-right">Revenue</span>
              </>
            )}
            <span className="w-12 text-right">Visitors</span>
          </span>
        </div>
        {isLoading && !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.key ?? NONE}>
                <button
                  type="button"
                  onClick={() => onSelect(active, row.key ?? NONE)}
                  className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-primary/10"
                    style={{ width: `${(row.visitors / max) * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative truncate">{keyLabel(active, row.key)}</span>
                  <span className="relative flex shrink-0 gap-6 tabular-nums">
                    {showOrders && (
                      <>
                        <span className="w-10 text-right">{formatCount(row.orders)}</span>
                        <span className="w-20 text-right">{formatAmount(row.revenue)}</span>
                      </>
                    )}
                    <span className="w-12 text-right font-medium">{formatCount(row.visitors)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
