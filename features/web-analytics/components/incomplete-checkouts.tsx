"use client";

import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale/bn";
import { useState } from "react";
import { MessageCircle, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/hooks/use-currency";
import { getOptimizedImageUrl } from "@/lib/utils";
import { useDismissDraft, useWaDrafts } from "../api/use-web-analytics";
import type { CheckoutDraftRow } from "../lib/types";
import { formatCount } from "../lib/format";
import { useLanguage } from "@/hooks/use-language";
import { useWaT } from "../lib/i18n";
import { CardPager, usePage } from "./card-pager";

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

/**
 * Checkout forms customers filled in (with a valid phone) but never
 * submitted, newest first. Not tied to the dashboard range: these are open
 * leads to call. Hidden for staff who can't read orders.
 */
export function IncompleteCheckouts() {
  const [page, setPage] = usePage("drafts");
  const { data, isLoading, isPlaceholderData } = useWaDrafts(page);
  const dismiss = useDismissDraft();
  const [dismissId, setDismissId] = useState<number | null>(null);
  const { formatAmount } = useCurrency();
  const t = useWaT();
  const { language } = useLanguage();

  if (data === null) return null;
  const rows = data?.rows ?? [];

  return (
    <Card className="ring-0">
      <CardHeader>
        <CardTitle className="text-base">{t("incompleteTitle")}</CardTitle>
        <CardDescription>
          {data
            ? `${formatCount(data.summary.open)} ${t("open")} · ${formatAmount(data.summary.value)} ${t("inCarts")}`
            : t("incompleteDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noIncomplete")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colCustomer")}</TableHead>
                <TableHead>{t("colAddress")}</TableHead>
                <TableHead>{t("colCart")}</TableHead>
                <TableHead className="text-right">{t("colValue")}</TableHead>
                <TableHead className="text-right">{t("colLastActive")}</TableHead>
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
                        className={`${iconButton} h-7 w-7 bg-rose-600 p-0 shadow-none hover:bg-rose-700`}
                        aria-label={t("dismiss")}
                        title={t("dismiss")}
                        disabled={dismiss.isPending && dismissId === row.id}
                        onClick={() => setDismissId(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
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
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true, locale: language === "bn" ? bn : undefined })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AlertDialog open={dismissId !== null} onOpenChange={(open) => !open && setDismissId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dismissConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("dismissConfirmDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (dismissId !== null) dismiss.mutate(dismissId, { onError: () => toast.error(t("dismissFailed")) });
                  setDismissId(null);
                }}
              >
                {t("dismiss")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <CardPager page={page} hasMore={data?.hasMore ?? false} loading={isPlaceholderData} onChange={setPage} />
      </CardContent>
    </Card>
  );
}
