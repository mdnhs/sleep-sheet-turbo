"use client";

import { CreditCard, Eye, MapPin, PackageCheck, Phone, ShoppingCart, User, Users, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaFunnel, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent } from "../lib/format";
import { useWaT, type WaKey } from "../lib/i18n";
import type { Funnel } from "../lib/types";

const STEPS: { key: keyof Funnel; labelKey: WaKey; icon: LucideIcon }[] = [
  { key: "visited", labelKey: "stepVisited", icon: Users },
  { key: "viewedProduct", labelKey: "stepViewedProduct", icon: Eye },
  { key: "addedToCart", labelKey: "stepAddedToCart", icon: ShoppingCart },
  { key: "startedCheckout", labelKey: "stepStartedCheckout", icon: CreditCard },
  { key: "enteredName", labelKey: "stepEnteredName", icon: User },
  { key: "enteredPhone", labelKey: "stepEnteredPhone", icon: Phone },
  { key: "enteredAddress", labelKey: "stepEnteredAddress", icon: MapPin },
  { key: "ordered", labelKey: "stepOrdered", icon: PackageCheck },
];

export function FunnelCard({ q }: { q: WaQuery }) {
  const { data, isLoading } = useWaFunnel(q);
  const t = useWaT();
  const top = data?.visited ?? 0;

  return (
    <Card className="ring-0">
      <CardHeader>
        <CardTitle className="text-base">{t("funnelTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ol className="space-y-5">
            {STEPS.map((step, i) => {
              const value = data?.[step.key] ?? 0;
              const prev = i === 0 ? value : (data?.[STEPS[i - 1].key] ?? 0);
              return (
                <li key={step.key}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <step.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{t(step.labelKey)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-semibold">{formatCount(value)}</span> <span className="text-muted-foreground">{t("people")}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${top ? Math.min(100, (value / top) * 100) : 0}%` }} />
                  </div>
                  {i > 0 && (
                    <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums">
                      <span className="text-muted-foreground">
                        {formatPercent(prev ? Math.min(1, value / prev) : 0)} {t("ofPrevious")}
                      </span>
                      <span className="text-destructive">
                        {formatCount(Math.max(0, prev - value))} {t("people")} {t("dropped")}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
