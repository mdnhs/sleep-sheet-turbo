"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";
import { useWaBreakdown, type WaQuery } from "../api/use-web-analytics";
import { NONE, type Dimension } from "../lib/dimensions";
import { formatCount, keyLabel } from "../lib/format";
import { useWaT, type WaKey } from "../lib/i18n";
import { CardPager, usePage } from "./card-pager";
import { RowIcon } from "./row-icon";
import { BreakdownRowsSkeleton } from "./wa-skeletons";

export interface BreakdownTab {
  dim: Dimension;
  labelKey: WaKey;
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
  const [page, setPage] = usePage(`${active}|${JSON.stringify(q)}`);
  const { data, isLoading, isPlaceholderData } = useWaBreakdown(q, active, page);
  const { formatAmount } = useCurrency();
  const t = useWaT();
  const rows = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((row) => row.visitors));
  const activeLabel = t(tabs.find((tab) => tab.dim === active)?.labelKey ?? "path");

  return (
    <Card className="ring-0">
      <CardHeader className="pb-2">
        {tabs.length > 1 ? (
          <Tabs value={active} onValueChange={(value) => setActive(value as Dimension)}>
            <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.dim} value={tab.dim}>
                    {t(tab.labelKey)}
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
                <span className="w-10 text-right">{t("colOrders")}</span>
                <span className="w-20 text-right">{t("colRevenue")}</span>
              </>
            )}
            <span className="w-12 text-right">{t("colVisitors")}</span>
          </span>
        </div>
        {isLoading && !data ? (
          <BreakdownRowsSkeleton showOrders={showOrders} />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noDataRange")}</p>
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
                  <span className="relative flex min-w-0 items-center gap-2">
                    <RowIcon dim={active} rowKey={row.key} />
                    <span className="truncate">{keyLabel(active, row.key, t)}</span>
                  </span>
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
        <CardPager page={page} hasMore={data?.hasMore ?? false} loading={isPlaceholderData} onChange={setPage} />
      </CardContent>
    </Card>
  );
}
