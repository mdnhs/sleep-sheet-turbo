"use client";

import React from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from "nuqs";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { WaQuery } from "../api/use-web-analytics";
import { DIMENSION_KEYS, type Dimension, type Filters } from "../lib/dimensions";
import { METRICS, RANGE_PRESETS, presetRange, type Metric, type RangePreset } from "../lib/format";
import { BreakdownPanel } from "./breakdown-panel";
import { FilterChips } from "./filter-chips";
import { FunnelCard } from "./funnel-card";
import { KpiCards } from "./kpi-cards";
import { LiveBadge } from "./live-badge";
import { ProductsTable } from "./products-table";
import { TrackingOffBanner, TrackingToggle } from "./tracking-toggle";
import { TrendChart } from "./trend-chart";

const filterParsers = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, parseAsString])) as Record<
  Dimension,
  typeof parseAsString
>;

export function WebAnalyticsDashboard() {
  const [preset, setPreset] = useQueryState(
    "range",
    parseAsStringEnum<RangePreset>(["today", "7d", "30d", "90d", "custom"]).withDefault("7d"),
  );
  const [fromStr, setFromStr] = useQueryState("from", parseAsString.withDefault(""));
  const [toStr, setToStr] = useQueryState("to", parseAsString.withDefault(""));
  const [metric, setMetric] = useQueryState("metric", parseAsStringEnum<Metric>([...METRICS]).withDefault("visitors"));
  const [filterValues, setFilterValues] = useQueryStates(filterParsers);

  const filters = React.useMemo<Filters>(() => {
    const out: Filters = {};
    for (const key of DIMENSION_KEYS) {
      const value = filterValues[key];
      if (value) out[key] = value;
    }
    return out;
  }, [filterValues]);

  const range = React.useMemo(() => {
    if (preset === "custom" && fromStr) {
      const from = parseISO(fromStr);
      const to = toStr ? parseISO(toStr) : from;
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        return { from: startOfDay(from).toISOString(), to: endOfDay(to).toISOString() };
      }
    }
    return presetRange(preset === "custom" ? "7d" : preset, new Date());
  }, [preset, fromStr, toStr]);

  const q: WaQuery = { from: range.from, to: range.to, filters };

  const customValue: DateRange | undefined =
    preset === "custom" && fromStr ? { from: parseISO(fromStr), to: toStr ? parseISO(toStr) : undefined } : undefined;

  const choosePreset = (value: Exclude<RangePreset, "custom">) => {
    void setPreset(value);
    void setFromStr(null);
    void setToStr(null);
  };

  const chooseCustom = (value: DateRange | undefined) => {
    if (!value?.from) return choosePreset("7d");
    void setPreset("custom");
    void setFromStr(format(value.from, "yyyy-MM-dd"));
    void setToStr(value.to ? format(value.to, "yyyy-MM-dd") : null);
  };

  // A computed key widens to an index signature; the cast restores the
  // per-dimension shape useQueryStates expects.
  type FilterPatch = Partial<Record<Dimension, string | null>>;
  const addFilter = (dim: Dimension, value: string) => void setFilterValues({ [dim]: value } as FilterPatch);
  const removeFilter = (dim: Dimension) => void setFilterValues({ [dim]: null } as FilterPatch);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((p) => (
          <Button key={p.value} size="sm" variant={preset === p.value ? "default" : "outline"} onClick={() => choosePreset(p.value)}>
            {p.label}
          </Button>
        ))}
        <DateRangePicker value={customValue} onChange={chooseCustom} />
        <div className="ml-auto flex items-center gap-3">
          <LiveBadge />
          <TrackingToggle />
        </div>
      </div>
      <TrackingOffBanner />
      <FilterChips filters={filters} onRemove={removeFilter} />
      <KpiCards q={q} metric={metric} onSelect={(m) => void setMetric(m)} />
      <TrendChart q={q} metric={metric} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownPanel
          q={q}
          tabs={[
            { dim: "path", label: "Pages" },
            { dim: "route", label: "Routes" },
            { dim: "hostname", label: "Hostnames" },
          ]}
          onSelect={addFilter}
        />
        <BreakdownPanel
          q={q}
          tabs={[
            { dim: "referrer", label: "Referrers" },
            { dim: "utmSource", label: "UTM Source" },
            { dim: "utmMedium", label: "Medium" },
            { dim: "utmCampaign", label: "Campaign" },
          ]}
          showOrders
          onSelect={addFilter}
        />
        <BreakdownPanel q={q} tabs={[{ dim: "country", label: "Countries" }]} onSelect={addFilter} />
        <BreakdownPanel
          q={q}
          tabs={[
            { dim: "device", label: "Devices" },
            { dim: "browser", label: "Browsers" },
            { dim: "os", label: "OS" },
          ]}
          onSelect={addFilter}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelCard q={q} />
        <ProductsTable q={q} />
      </div>
    </div>
  );
}
