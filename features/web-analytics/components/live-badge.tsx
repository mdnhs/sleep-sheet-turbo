"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useWaLive } from "../api/use-web-analytics";
import { useWaT } from "../lib/i18n";

export function LiveBadge() {
  const { data } = useWaLive();
  const t = useWaT();
  const online = data?.online ?? 0;

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
        <span className={cn("h-2 w-2 rounded-full", online > 0 ? "bg-emerald-500" : "bg-muted-foreground/40")} />
        <span className="tabular-nums">{online}</span> {t("online")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-sm font-medium">{t("activeLast5")}</p>
        {data?.pages.length ? (
          <ul className="space-y-1 text-sm">
            {data.pages.map((page) => (
              <li key={page.path} className="flex justify-between gap-2">
                <span className="truncate">{page.path}</span>
                <span className="tabular-nums text-muted-foreground">{page.visitors}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("nobodyNow")}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
