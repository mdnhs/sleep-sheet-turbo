"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWaProducts, type WaQuery } from "../api/use-web-analytics";
import { getOptimizedImageUrl } from "@/lib/utils";
import { formatCount, formatPercent } from "../lib/format";
import { useWaT } from "../lib/i18n";
import { CardPager, usePage } from "./card-pager";
import { ProductsTableRowsSkeleton } from "./wa-skeletons";

export function ProductsTable({ q }: { q: WaQuery }) {
  const [page, setPage] = usePage(JSON.stringify(q));
  const { data, isLoading, isPlaceholderData } = useWaProducts(q, page);
  const t = useWaT();
  const rows = data?.rows ?? [];

  return (
    <Card className="ring-0">
      <CardHeader>
        <CardTitle className="text-base">{t("productsTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <ProductsTableRowsSkeleton />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noProductViews")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colProduct")}</TableHead>
                <TableHead className="text-right">{t("colViews")}</TableHead>
                <TableHead className="text-right">{t("colAddToCart")}</TableHead>
                <TableHead className="text-right">{t("colOrders")}</TableHead>
                <TableHead className="text-right">{t("colViewToOrder")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell className="max-w-64">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is already resized by getOptimizedImageUrl. */}
                      <img
                        src={row.image ? getOptimizedImageUrl(row.image, 64) : "/placeholder.jpg"}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        className="size-8 shrink-0 rounded object-cover"
                      />
                      <span className="truncate">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.addedToCart)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(row.views ? row.orders / row.views : 0)}
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
