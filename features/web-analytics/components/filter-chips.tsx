"use client";

import { X } from "lucide-react";
import { activeFilters, type Dimension, type Filters } from "../lib/dimensions";
import { DIMENSION_LABELS, filterValueLabel } from "../lib/format";

export function FilterChips({ filters, onRemove }: { filters: Filters; onRemove: (dim: Dimension) => void }) {
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
          <span className="text-muted-foreground">{DIMENSION_LABELS[dim]}:</span>
          <span className="font-medium">{filterValueLabel(dim, value)}</span>
          <X className="h-3 w-3" aria-label="Remove filter" />
        </button>
      ))}
    </div>
  );
}
