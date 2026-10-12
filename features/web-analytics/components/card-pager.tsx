"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWaT } from "../lib/i18n";

/** Page index that falls back to 0 whenever `resetKey` changes (new tab, range or filter). */
export function usePage(resetKey: string): [number, (page: number) => void] {
  const [state, setState] = React.useState({ key: resetKey, page: 0 });
  const page = state.key === resetKey ? state.page : 0;
  const setPage = React.useCallback((next: number) => setState({ key: resetKey, page: next }), [resetKey]);
  return [page, setPage];
}

/** Prev/next footer for a card list; hidden while everything fits on one page. */
export function CardPager({
  page,
  hasMore,
  loading,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  loading?: boolean;
  onChange: (page: number) => void;
}) {
  const t = useWaT();
  if (page === 0 && !hasMore) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-1 text-xs text-muted-foreground">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={page === 0 || loading}
        onClick={() => onChange(page - 1)}
        aria-label={t("previousPage")}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-12 text-center tabular-nums">{t("page")} {page + 1}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!hasMore || loading}
        onClick={() => onChange(page + 1)}
        aria-label={t("nextPage")}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
