"use client";

import { useSearchParams } from "next/navigation";
import { METRICS, type Metric } from "../lib/format";
import { KpiCardsSkeleton } from "./wa-skeletons";

/** KpiCardsSkeleton with the card of the `?metric=` in the URL highlighted (default visitors). */
export function KpiCardsUrlSkeleton() {
  const metric = useSearchParams().get("metric");
  const active = METRICS.indexOf(metric as Metric);
  return <KpiCardsSkeleton active={active < 0 ? 0 : active} />;
}
