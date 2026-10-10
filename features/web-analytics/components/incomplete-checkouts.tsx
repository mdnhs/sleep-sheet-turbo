"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/hooks/use-currency";
import { useDismissDraft, useWaDrafts } from "../api/use-web-analytics";
import type { CheckoutDraftRow } from "../lib/types";
import { formatCount } from "../lib/format";
import { CardPager, usePage } from "./card-pager";

function itemsSummary(items: CheckoutDraftRow["items"]): string {
  return items
    .map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(" / ");
      return `${item.quantity}× ${item.name}${variant ? ` (${variant})` : ""}`;
    })
    .join(", ");
}

const iconLink = buttonVariants({ variant: "ghost", size: "icon", className: "size-7" });

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
  const { formatAmount } = useCurrency();

  if (data === null) return null;
  const rows = data?.rows ?? [];

  return (
    <Card className="ring-0">
      <CardHeader>
        <CardTitle className="text-base">Incomplete checkouts</CardTitle>
        <CardDescription>
          {data
            ? `${formatCount(data.summary.open)} open · ${formatAmount(data.summary.value)} in carts`
            : "Customers who entered a phone number at checkout but didn't order."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No incomplete checkouts.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Cart</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Last active</TableHead>
                <TableHead className="w-24" />
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
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground" title={row.address ?? undefined}>
                    {row.address || "—"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-xs" title={itemsSummary(row.items)}>
                    {itemsSummary(row.items)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(row.value)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <a href={`tel:${row.phone}`} aria-label={`Call ${row.phone}`} className={iconLink}>
                        <Phone className="size-4" />
                      </a>
                      <a
                        href={whatsappLink(row.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp"
                        className={iconLink}
                      >
                        <MessageCircle className="size-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Dismiss"
                        disabled={dismiss.isPending}
                        onClick={() =>
                          dismiss.mutate(row.id, { onError: () => toast.error("Couldn't dismiss, try again") })
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <CardPager page={page} hasMore={data?.hasMore ?? false} loading={isPlaceholderData} onChange={setPage} />
      </CardContent>
    </Card>
  );
}
