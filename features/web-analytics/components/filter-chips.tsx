"use client";

import { X } from "lucide-react";
import { activeFilters, NONE, type Dimension, type Filters } from "../lib/dimensions";
import { filterValueLabel } from "../lib/format";
import { useWaT } from "../lib/i18n";
import { RowIcon } from "./row-icon";

export function FilterChips({ filters, onRemove }: { filters: Filters; onRemove: (dim: Dimension) => void }) {
  const t = useWaT();
  const active = activeFilters(filters);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([dim, value]) => (
        <button
          key={dim}
          type="button"
          onClick={() => onRemove(dim)}
          className="flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs"
        >
          <span className="text-muted-foreground">{t(dim)}:</span>
          <RowIcon dim={dim} rowKey={value === NONE ? null : value} />
          <span className="font-medium">{filterValueLabel(dim, value, t)}</span>
          <X className="h-3 w-3" aria-label={t("removeFilter")} />
        </button>
      ))}
    </div>
  );
}
