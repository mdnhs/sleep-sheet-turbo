"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWaProducts, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent } from "../lib/format";

export function ProductsTable({ q }: { q: WaQuery }) {
  const { data, isLoading } = useWaProducts(q);
  const rows = data?.rows ?? [];

  return (
    <Card className="ring-0">
      <CardHeader>
        <CardTitle className="text-base">Products</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No product views in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Add to cart</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">View→Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell className="max-w-56 truncate">{row.name}</TableCell>
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
      </CardContent>
    </Card>
  );
}
