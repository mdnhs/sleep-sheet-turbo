"use client";

import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale/bn";
import { useState } from "react";
import { Check, MessageCircle, Phone, Trash2, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { FraudCheckDialog } from "@/features/fraud-checker/components/fraud-check-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";
import { useRememberRows } from "@/hooks/use-skeleton-rows";
import { getOptimizedImageUrl } from "@/lib/utils";
import { type DraftView, type WaQuery, useDismissDraft, useRecoverDraft, useWaDrafts } from "../api/use-web-analytics";
import type { CheckoutDraftRow, DraftSummary } from "../lib/types";
import { formatCount, formatPercent } from "../lib/format";
import { useLanguage } from "@/hooks/use-language";
import { useWaT } from "../lib/i18n";
import { CardPager, usePage } from "./card-pager";
import { DraftStatsSkeleton, DraftsTableSkeleton } from "./wa-skeletons";

function itemsSummary(items: CheckoutDraftRow["items"]): string {
  return items
    .map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(" / ");
      return `${item.quantity}× ${item.name}${variant ? ` (${variant})` : ""}`;
    })
    .join(", ");
}

const iconButton =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-white transition-transform active:scale-95";

/** 01XXXXXXXXX → 8801XXXXXXXXX for wa.me links. */
function whatsappLink(phone: string): string {
  return `https://wa.me/88${phone}`;
}

type PendingAction = { kind: "recover" | "dismiss"; id: number };

/** All-time total, completion rate, and what's still sitting in open carts. The completed count is on its tab. */
function DraftStats({ summary }: { summary: DraftSummary }) {
  const t = useWaT();
  const { formatAmount } = useCurrency();
  const stats = [
    { label: t("statTotal"), value: formatCount(summary.total) },
    { label: t("statRate"), value: formatPercent(summary.total ? summary.recovered / summary.total : 0) },
    { label: t("statOpenValue"), value: formatAmount(summary.value) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border px-3 py-2">
          <div className="text-xs text-muted-foreground">{stat.label}</div>
          <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Checkout forms customers filled in (with a valid phone) but never
 * submitted, newest first, and the ones staff completed since on a call /
 * WhatsApp. Not tied to the
 * dashboard range: these are leads to call. Hidden for staff who can't read
 * orders.
 */
export function IncompleteCheckouts({ q }: { q: WaQuery }) {
  const [view, setView] = useState<DraftView>("open");
  const [page, setPage] = usePage(`drafts-${view}-${q.from}-${q.to}`);
  const { data, isLoading, isPlaceholderData } = useWaDrafts(q, view, page);
  const dismiss = useDismissDraft();
  const recover = useRecoverDraft();
  // Kept after the dialog closes so its text doesn't flip during the exit animation.
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fraudCheckPhone, setFraudCheckPhone] = useState<string | null>(null);
  const { formatAmount } = useCurrency();
  const t = useWaT();
  const { language } = useLanguage();
  // Lets DraftsTableSkeleton draw as many rows as this table showed (not a placeholder page's).
  useRememberRows("analytics.drafts", isPlaceholderData ? undefined : data?.rows.length);

  if (data === null) return null;
  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const busy = (id: number) => (dismiss.isPending || recover.isPending) && pending?.id === id;
  const ask = (action: PendingAction) => {
    setPending(action);
    setDialogOpen(true);
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "recover") {
      recover.mutate(pending.id, {
        onSuccess: () => toast.success(t("recoverDone")),
        onError: () => toast.error(t("recoverFailed")),
      });
    } else {
      dismiss.mutate(pending.id, { onError: () => toast.error(t("dismissFailed")) });
    }
    setDialogOpen(false);
  };

  return (
    // Stretches to the grid row, so it's never shorter than the funnel card beside it.
    <Card className="ring-0 self-stretch">
      <CardContent className="flex flex-col gap-4">
        {summary ? <DraftStats summary={summary} /> : <DraftStatsSkeleton />}
        <Tabs value={view} onValueChange={(value) => setView(value as DraftView)}>
          <TabsList variant="line">
            <TabsTrigger value="open">
              {t("tabIncomplete")}
              {summary && <span className="tabular-nums text-muted-foreground">({formatCount(summary.open)})</span>}
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t("tabCompleted")}
              {summary && (
                <span className="tabular-nums text-muted-foreground">({formatCount(summary.recovered)})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {/* Page 0 placeholder is the other tab's list: show a skeleton, not the wrong rows. */}
        {(isLoading && !data) || (isPlaceholderData && page === 0) ? (
          <DraftsTableSkeleton />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {view === "open" ? t("noIncomplete") : t("noCompleted")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colCustomer")}</TableHead>
                <TableHead>{view === "open" ? t("colLastActive") : t("colCompletedAt")}</TableHead>
                <TableHead>{t("colAddress")}</TableHead>
                <TableHead>{t("colCart")}</TableHead>
                <TableHead className="text-right">{t("colValue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.fullName || "—"}</div>
                    <a href={`tel:${row.phone}`} className="text-xs text-muted-foreground tabular-nums hover:underline">
                      {row.phone}
                    </a>
                    <div className="mt-2 flex items-center gap-2">
                      <a href={`tel:${row.phone}`} aria-label={`${t("call")} ${row.phone}`} className={`${iconButton} bg-sky-600 hover:bg-sky-700`}>
                        <Phone className="size-3.5" />
                      </a>
                      <a
                        href={whatsappLink(row.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("whatsapp")}
                        className={`${iconButton} bg-green-600 hover:bg-green-700`}
                      >
                        <MessageCircle className="size-3.5" />
                      </a>
                      <Button
                        type="button"
                        onClick={() => setFraudCheckPhone(row.phone)}
                        className={`${iconButton} h-7 w-7 bg-indigo-600 p-0 shadow-none hover:bg-indigo-700`}
                        title="ফ্রড চেক — কুরিয়ার ডেলিভারি হিস্ট্রি"
                        aria-label="ফ্রড চেক"
                      >
                        <UserSearch className="size-3.5" />
                      </Button>
                      {view === "open" && (
                        <>
                          <Button
                            type="button"
                            className={`${iconButton} h-7 w-7 bg-emerald-600 p-0 shadow-none hover:bg-emerald-700`}
                            aria-label={t("markCompleted")}
                            title={t("markCompleted")}
                            disabled={busy(row.id)}
                            onClick={() => ask({ kind: "recover", id: row.id })}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            className={`${iconButton} h-7 w-7 bg-rose-600 p-0 shadow-none hover:bg-rose-700`}
                            aria-label={t("dismiss")}
                            title={t("dismiss")}
                            disabled={busy(row.id)}
                            onClick={() => ask({ kind: "dismiss", id: row.id })}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true, locale: language === "bn" ? bn : undefined })}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground" title={row.address ?? undefined}>
                    {row.address || "—"}
                  </TableCell>
                  <TableCell className="max-w-64">
                    <div className="flex items-center gap-2" title={itemsSummary(row.items)}>
                      <div className="flex shrink-0 -space-x-2">
                        {row.items.slice(0, 3).map((item, i) => (
                          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is already resized by getOptimizedImageUrl.
                          <img
                            key={`${item.productId}-${i}`}
                            src={item.image ? getOptimizedImageUrl(item.image, 48) : "/placeholder.jpg"}
                            alt=""
                            width={24}
                            height={24}
                            loading="lazy"
                            className="size-6 rounded border border-background object-cover"
                          />
                        ))}
                      </div>
                      <span className="truncate text-xs">
                        {row.items.length > 3 && `+${row.items.length - 3} · `}
                        {itemsSummary(row.items)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(row.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pending?.kind === "recover" ? t("recoverConfirmTitle") : t("dismissConfirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pending?.kind === "recover" ? t("recoverConfirmDesc") : t("dismissConfirmDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction variant={pending?.kind === "recover" ? "default" : "destructive"} onClick={confirm}>
                {pending?.kind === "recover" ? t("confirm") : t("dismiss")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <FraudCheckDialog
          phone={fraudCheckPhone}
          onOpenChange={(open) => !open && setFraudCheckPhone(null)}
        />
        <CardPager page={page} hasMore={data?.hasMore ?? false} loading={isPlaceholderData} onChange={setPage} />
      </CardContent>
    </Card>
  );
}
