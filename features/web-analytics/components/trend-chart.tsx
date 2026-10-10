"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaOverview, type WaQuery } from "../api/use-web-analytics";
import { bucketLabel, METRIC_LABELS, pointValue, type Metric } from "../lib/format";

const IS_RATE: ReadonlySet<Metric> = new Set<Metric>(["bounceRate", "conversionRate"]);

export function TrendChart({ q, metric }: { q: WaQuery; metric: Metric }) {
  const { data, isLoading } = useWaOverview(q);
  const config = { value: { label: METRIC_LABELS[metric], color: "var(--chart-1)" } } satisfies ChartConfig;
  const points = (data?.series ?? []).map((point) => {
    const value = pointValue(point, metric);
    // Rates are charted as percentages, one decimal.
    return { label: bucketLabel(point.bucket, data!.unit), value: IS_RATE.has(metric) ? Math.round(value * 1000) / 10 : value };
  });

  return (
    <Card className="ring-0">
      <CardHeader>
        <CardTitle className="text-base">
          {METRIC_LABELS[metric]}
          {IS_RATE.has(metric) ? " (%)" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <AreaChart data={points} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="value"
                type="monotone"
                fill="var(--color-value)"
                fillOpacity={0.15}
                stroke="var(--color-value)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
