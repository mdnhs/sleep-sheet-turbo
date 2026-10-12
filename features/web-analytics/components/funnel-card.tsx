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
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const value = data?.[step.key] ?? 0;
              const prev = i === 0 ? value : (data?.[STEPS[i - 1].key] ?? 0);
              return (
                <li key={step.key}>
                  <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-sm">
                    <span className="flex items-center gap-2">
                      <step.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {t(step.labelKey)}
                    </span>
                    <span className="tabular-nums">
                      <span className="font-medium">{formatCount(value)}</span>
                      {i > 0 && (
                        <span className="ml-2 text-muted-foreground">
                          {formatPercent(prev ? Math.min(1, value / prev) : 0)} {t("ofPrevious")} · {formatCount(Math.max(0, prev - value))} {t("dropped")}
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
