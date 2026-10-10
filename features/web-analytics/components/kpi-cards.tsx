"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { useWaOverview, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent, kpiValue, METRIC_LABELS, METRICS, trendPercent, type Metric } from "../lib/format";

const LOWER_IS_BETTER: ReadonlySet<Metric> = new Set<Metric>(["bounceRate"]);

export function KpiCards({ q, metric, onSelect }: { q: WaQuery; metric: Metric; onSelect: (metric: Metric) => void }) {
  const { data, isLoading } = useWaOverview(q);
  const { formatAmount } = useCurrency();

  const format = (m: Metric, value: number) =>
    m === "revenue" ? formatAmount(value) : m === "bounceRate" || m === "conversionRate" ? formatPercent(value) : formatCount(value);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {METRICS.map((m) => {
        const value = data ? kpiValue(data.kpis, m) : 0;
        const trend = data ? trendPercent(value, kpiValue(data.previous, m)) : null;
        const good = trend !== null && (LOWER_IS_BETTER.has(m) ? trend < 0 : trend > 0);
        return (
          <button key={m} type="button" onClick={() => onSelect(m)} className="text-left">
            <Card className={cn("gap-1 p-4 ring-0 transition-colors", metric === m ? "bg-primary/10" : "hover:bg-muted/50")}>
              <span className="text-xs text-muted-foreground">{METRIC_LABELS[m]}</span>
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
