"use client";

import { Banknote, Eye, LogOut, Percent, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { useWaT } from "../lib/i18n";
import { useWaOverview, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent, kpiValue, METRICS, trendPercent, type Metric } from "../lib/format";

const METRIC_ICONS: Record<Metric, LucideIcon> = {
  visitors: Users,
  pageViews: Eye,
  bounceRate: LogOut,
  orders: ShoppingBag,
  revenue: Banknote,
  conversionRate: Percent,
};

const LOWER_IS_BETTER: ReadonlySet<Metric> = new Set<Metric>(["bounceRate"]);

export function KpiCards({ q, metric, onSelect }: { q: WaQuery; metric: Metric; onSelect: (metric: Metric) => void }) {
  const { data, isLoading } = useWaOverview(q);
  const { formatAmount } = useCurrency();
  const t = useWaT();

  const format = (m: Metric, value: number) =>
    m === "revenue" ? formatAmount(value) : m === "bounceRate" || m === "conversionRate" ? formatPercent(value) : formatCount(value);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {METRICS.map((m) => {
        const value = data ? kpiValue(data.kpis, m) : 0;
        const trend = data ? trendPercent(value, kpiValue(data.previous, m)) : null;
        const Icon = METRIC_ICONS[m];
        const good = trend !== null && (LOWER_IS_BETTER.has(m) ? trend < 0 : trend > 0);
        return (
          <button key={m} type="button" onClick={() => onSelect(m)} className="text-left">
            <Card className={cn("gap-1 p-4 ring-0 transition-colors", metric === m ? "bg-primary/10" : "hover:bg-muted/50")}>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
                {t(m)}
              </span>
              {isLoading && !data ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{format(m, value)}</span>
                  {trend !== null && trend !== 0 && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-xs font-medium",
                        good ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600",
                      )}
                    >
                      {trend > 0 ? "+" : ""}
                      {Math.round(trend)}%
                    </span>
                  )}
                </div>
              )}
            </Card>
          </button>
        );
      })}
    </div>
  );
}
