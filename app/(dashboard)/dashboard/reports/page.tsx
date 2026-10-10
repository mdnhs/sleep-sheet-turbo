"use client";

import { useState } from "react";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import Image from "next/image";
import { useGetReports } from "@/features/reports/api/use-get-reports";
import { useGetMonthlyReports } from "@/features/reports/api/use-get-monthly-reports";
import { useGetOrderByID } from "@/features/order/api/use-get-order-via-id";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Package, Receipt, Truck, ChevronLeft, ChevronRight, ShoppingBag, Globe } from "lucide-react";
import { subDays, subMonths, startOfDay, endOfDay, startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/dashboard/skeletons";

type FilterType = "all" | "today" | "week" | "month" | "last_month" | "custom";

function PaginatedTable<T>({
  data,
  renderHeader,
  renderRow,
  pageSize = 10,
}: {
  data: T[];
  renderHeader: () => React.ReactNode;
  renderRow: (item: T, index: number) => React.ReactNode;
  pageSize?: number;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / pageSize);

  const startIndex = (currentPage - 1) * pageSize;
  const currentData = data.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>{renderHeader()}</TableHeader>
          <TableBody>
            {currentData.map((item, index) => (
              <React.Fragment key={index}>{renderRow(item, startIndex + index)}</React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} ({data.length} total)
          </p>
          <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full overflow-y-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg h-8 px-2.5 text-xs"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            {(() => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push("...");

                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);

                for (let i = start; i <= end; i++) {
                  if (!pages.includes(i)) pages.push(i);
                }

                if (currentPage < totalPages - 2) pages.push("...");
                pages.push(totalPages);
              }

              return pages.map((p, idx) =>
                typeof p === "number" ? (
                  <Button
                    key={idx}
                    variant={currentPage === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      "rounded-lg h-8 w-8 p-0 text-xs font-semibold shrink-0",
                      currentPage === p && "pointer-events-none"
                    )}
                  >
                    {p}
                  </Button>
                ) : (
                  <span key={idx} className="px-1 text-xs text-muted-foreground shrink-0">
                    {p}
                  </span>
                )
              );
            })()}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg h-8 px-2.5 text-xs"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsContent() {
  const { formatAmount } = useCurrency();
  const [activeFilter, setActiveFilter] = useQueryState("filter", parseAsStringEnum<FilterType>(["all", "today", "week", "month", "last_month", "custom"]).withDefault("today"));
  const [fromStr, setFromStr] = useQueryState("from", parseAsString.withDefault(""));
  const [toStr, setToStr] = useQueryState("to", parseAsString.withDefault(""));

  const customRange = React.useMemo<DateRange | undefined>(() => {
    if (!fromStr) return undefined;
    try {
      const fromDate = parseISO(fromStr);
      const toDate = toStr ? parseISO(toStr) : undefined;
      if (isNaN(fromDate.getTime())) return undefined;
      return {
        from: fromDate,
        to: toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
      };
    } catch {
      return undefined;
    }
  }, [fromStr, toStr]);

  const dateRange = React.useMemo<{ from?: string; to?: string }>(() => {
    const today = new Date();
    switch (activeFilter) {
      case "all":
        return {};
      case "today":
        return {
          from: startOfDay(today).toISOString(),
          to: endOfDay(today).toISOString(),
        };
      case "week":
        return {
          from: startOfDay(subDays(today, 6)).toISOString(),
          to: endOfDay(today).toISOString(),
        };
      case "month":
        return {
          from: startOfMonth(today).toISOString(),
          to: endOfMonth(today).toISOString(),
        };
      case "last_month": {
        const lastMonth = subMonths(today, 1);
        return {
          from: startOfMonth(lastMonth).toISOString(),
          to: endOfMonth(lastMonth).toISOString(),
        };
      }
      case "custom": {
        if (!fromStr) return {};
        try {
          const fromDate = parseISO(fromStr);
          const toDate = toStr ? parseISO(toStr) : fromDate;
          if (isNaN(fromDate.getTime())) return {};
          const validToDate = !isNaN(toDate.getTime()) ? toDate : fromDate;
          return {
            from: startOfDay(fromDate).toISOString(),
            to: endOfDay(validToDate).toISOString(),
          };
        } catch {
          return {};
        }
      }
      default:
        return {
          from: startOfDay(today).toISOString(),
          to: endOfDay(today).toISOString(),
        };
    }
  }, [activeFilter, fromStr, toStr]);

  const [showProductCostBreakdown, setShowProductCostBreakdown] = useState(false);
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);
  const [showShippingBreakdown, setShowShippingBreakdown] = useState(false);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data, isLoading } = useGetReports(dateRange);
  const { data: monthlyReportsData, isLoading: isMonthlyLoading } = useGetMonthlyReports();

  const handleFilter = (type: FilterType) => {
    setActiveFilter(type);
    setFromStr(null);
    setToStr(null);
  };

  const handleCustomRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setActiveFilter("custom");
      setFromStr(format(range.from, "yyyy-MM-dd"));
      setToStr(format(range.to, "yyyy-MM-dd"));
    } else if (range?.from) {
      setActiveFilter("custom");
      setFromStr(format(range.from, "yyyy-MM-dd"));
      setToStr(format(range.from, "yyyy-MM-dd"));
    } else {
      setActiveFilter("all");
      setFromStr(null);
      setToStr(null);
    }
  };

  const filterButtons: { type: FilterType; label: string }[] = [
    { type: "all", label: "All Time" },
    { type: "today", label: "Today" },
    { type: "week", label: "Last 7 Days" },
    { type: "month", label: "This Month" },
    { type: "last_month", label: "Last Month" },
  ];

  const profitMargin =
    data && data.totalRevenue > 0
      ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1)
      : null;

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Reports & Profit/Loss</h2>
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleFilter(type)}
                className={cn(
                  "rounded-full text-xs font-semibold px-3.5 h-8 transition-colors cursor-pointer flex items-center justify-center select-none",
                  activeFilter === type
                    ? "bg-slate-900 text-white hover:bg-slate-800 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:hover:text-slate-900"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
            <DateRangePicker value={customRange} onChange={handleCustomRangeChange} />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-6">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
            <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
              <Skeleton className="h-6 w-48 rounded-xl" />
              <TableSkeleton rows={12} cols={6} />
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-6">
              <div
                className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[136px] cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/40 transition-all"
                onClick={() => setShowProductCostBreakdown(true)}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">Total Items/Products</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#EEF2FF] dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <div className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400 truncate">
                    {data.totalItemsSold}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">
                    Across {data.orderCount} order{data.orderCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div
                className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[136px] cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/40 transition-all"
                onClick={() => setShowRevenueBreakdown(true)}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">Total Net Sale</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#EBF7EE] dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <div className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                    {formatAmount(data.totalRevenue)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">
                    Gross ({formatAmount(data.grossSales || 0)}) - Cancel ({formatAmount(data.cancelledAmount || 0)})
                  </p>
                </div>
              </div>

              <div
                className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[136px] cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/40 transition-all"
                onClick={() => setShowProductCostBreakdown(true)}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">Product Bought Cost</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#F3EFEF] dark:bg-purple-950/40 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <div className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-purple-600 dark:text-purple-400 truncate">
                    {formatAmount(data.totalCost)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">
                    Gross ({formatAmount(data.grossCost || 0)}) - Cancel ({formatAmount(data.cancelledCost || 0)})
                  </p>
                </div>
              </div>

              <div
                className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[136px] cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/40 transition-all"
                onClick={() => setShowShippingBreakdown(true)}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">Delivery Charge</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#EFF6FF] dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                    <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <div className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 truncate">
                    {formatAmount(data.totalShippingCost)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">Courier shipping costs</p>
                </div>
              </div>

              <div
                className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[136px] cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/40 transition-all"
                onClick={() => setShowExpenseBreakdown(true)}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">Total Expense</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FFF7ED] dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                    <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <div className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-orange-600 dark:text-orange-400 truncate">
                    {formatAmount(data.totalExpense || 0)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">Operating expenses</p>
                </div>
              </div>

              <div className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[136px]">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">Net Profit / Loss</span>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${data.netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40"} flex items-center justify-center shrink-0`}>
                    {data.netProfit >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 dark:text-rose-400" />
                    )}
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <div className={`text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight ${data.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} truncate`}>
                    {formatAmount(data.netProfit)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">
                    {profitMargin !== null ? `${profitMargin}% margin · ` : ""}Net Sales - Costs
                  </p>
                </div>
              </div>
            </div>

            {/* Page-wise Breakdown (Facebook Pages / Channels) */}
            <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Page-wise Breakdown
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Orders, sales, costs, and profit broken down by Facebook page & sales channel
                  </p>
                </div>
              </div>

              <div>
                {!data?.pageWiseBreakdown || data.pageWiseBreakdown.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-2xl">
                    No page-wise sales data found for the selected period.
                  </div>
                ) : (
                  (() => {
                    const pageList = data.pageWiseBreakdown;
                    const pageTotals = pageList.reduce(
                      (acc, p) => ({
                        orderCount: acc.orderCount + p.orderCount,
                        itemsSold: acc.itemsSold + p.itemsSold,
                        revenue: acc.revenue + p.revenue,
                        cost: acc.cost + p.cost,
                        shippingCost: acc.shippingCost + p.shippingCost,
                        profit: acc.profit + p.profit,
                        cancelledCount: acc.cancelledCount + p.cancelledCount,
                        cancelledAmount: acc.cancelledAmount + p.cancelledAmount,
                      }),
                      { orderCount: 0, itemsSold: 0, revenue: 0, cost: 0, shippingCost: 0, profit: 0, cancelledCount: 0, cancelledAmount: 0 }
                    );
                    const totalMargin = pageTotals.revenue > 0 ? Math.round((pageTotals.profit / pageTotals.revenue) * 100) : 0;

                    return (
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <Table>
                          <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                            <TableRow>
                              <TableHead className="font-bold text-slate-700 dark:text-slate-300 min-w-[200px]">
                                Page / Channel
                              </TableHead>
                              <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">
                                Orders
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">
                                Sales (Net)
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">
                                Costs (Product + Delivery)
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">
                                Net Profit/Loss
                              </TableHead>
                              <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">
                                Margin
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">
                                Cancelled
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageList.map((p) => {
                              const isDirect = p.page === "Website" || p.page === "Website / Direct";
                              return (
                                <TableRow key={p.page} className="hover:bg-slate-50/50 dark:hover:bg-muted/40">
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2.5">
                                      {isDirect ? (
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                          <Globe className="w-4 h-4" />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1877F2] flex items-center justify-center shrink-0">
                                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                          </svg>
                                        </div>
                                      )}
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                          {p.page}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                          {isDirect ? "Website / Storefront" : "POS Facebook Channel"}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-semibold">
                                    <span className="tabular-nums">{p.orderCount}</span>
                                    <div className="text-[10px] text-muted-foreground font-normal">
                                      {p.itemsSold} pcs
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                                    {formatAmount(p.revenue)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground font-semibold tabular-nums">
                                    {formatAmount(p.cost + p.shippingCost)}
                                    <div className="text-[10px] text-slate-400 font-normal">
                                      P: {formatAmount(p.cost)} · D: {formatAmount(p.shippingCost)}
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className={`text-right font-bold tabular-nums ${
                                      p.profit >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {formatAmount(p.profit)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span
                                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                                        p.margin >= 0
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                      }`}
                                    >
                                      {p.margin}%
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                                    {p.cancelledCount > 0 ? (
                                      <div>
                                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                          {p.cancelledCount}
                                        </span>
                                        <div className="text-[10px] text-slate-400">
                                          {formatAmount(p.cancelledAmount)}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-slate-50 dark:bg-muted/30 font-bold border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-center tabular-nums">
                                {pageTotals.orderCount}
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {pageTotals.itemsSold} pcs
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatAmount(pageTotals.revenue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground tabular-nums">
                                {formatAmount(pageTotals.cost + pageTotals.shippingCost)}
                                <div className="text-[10px] text-slate-400 font-normal">
                                  P: {formatAmount(pageTotals.cost)} · D: {formatAmount(pageTotals.shippingCost)}
                                </div>
                              </TableCell>
                              <TableCell
                                className={`text-right tabular-nums ${
                                  pageTotals.profit >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {formatAmount(pageTotals.profit)}
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                                    totalMargin >= 0
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                  }`}
                                >
                                  {totalMargin}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                                {pageTotals.cancelledCount > 0 ? (
                                  <div>
                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                      {pageTotals.cancelledCount}
                                    </span>
                                    <div className="text-[10px] text-slate-400">
                                      {formatAmount(pageTotals.cancelledAmount)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Month-wise Breakdown</h3>
              <div>
                {isMonthlyLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !monthlyReportsData?.monthlyData || monthlyReportsData.monthlyData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No monthly data available.</div>
                ) : (
                  (() => {
                    const monthlyList = monthlyReportsData.monthlyData;
                    const monthlyTotals = monthlyList.reduce(
                      (acc, m) => ({
                        revenue: acc.revenue + m.revenue,
                        cost: acc.cost + m.cost,
                        shippingCost: acc.shippingCost + m.shippingCost,
                        expense: acc.expense + m.expense,
                        profit: acc.profit + m.profit,
                      }),
                      { revenue: 0, cost: 0, shippingCost: 0, expense: 0, profit: 0 }
                    );

                    return (
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <Table>
                          <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                            <TableRow>
                              <TableHead className="font-bold text-slate-700 dark:text-slate-300">Month</TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Sales (Net)</TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Costs (Product + Delivery)</TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Expenses</TableHead>
                              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Net Profit/Loss</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyList.map((m) => (
                              <TableRow key={m.month} className="hover:bg-slate-50/50 dark:hover:bg-muted/40">
                                <TableCell className="font-medium">
                                  {format(parseISO(`${m.month}-01`), "MMMM yyyy")}
                                </TableCell>
                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {formatAmount(m.revenue)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground font-semibold">
                                  {formatAmount(m.cost + m.shippingCost)}
                                </TableCell>
                                <TableCell className="text-right text-orange-600 dark:text-orange-400 font-semibold">
                                  {formatAmount(m.expense)}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${m.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {formatAmount(m.profit)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-slate-50 dark:bg-muted/30 font-bold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                {formatAmount(monthlyTotals.revenue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatAmount(monthlyTotals.cost + monthlyTotals.shippingCost)}
                              </TableCell>
                              <TableCell className="text-right text-orange-600 dark:text-orange-400">
                                {formatAmount(monthlyTotals.expense)}
                              </TableCell>
                              <TableCell className={`text-right ${monthlyTotals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {formatAmount(monthlyTotals.profit)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Product Cost Breakdown Dialog */}
            <Dialog open={showProductCostBreakdown} onOpenChange={setShowProductCostBreakdown}>
              <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0 bg-background">
                <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                    <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                    Product Bought Cost Breakdown
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {!data.productCostBreakdown || data.productCostBreakdown.length === 0 ? (
                      <div className="text-sm text-muted-foreground flex items-center justify-center h-24 bg-muted/20 rounded-lg border border-dashed">
                        No product costs found for this period.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.breakdownTruncated && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm rounded-lg border border-amber-200 dark:border-amber-800">
                            Showing the <span className="font-semibold">{data.productCostBreakdown.length}</span> most recent entries. Narrow the date range to see older ones.
                          </div>
                        )}
                        <PaginatedTable
                          data={data.productCostBreakdown}
                          renderHeader={() => (
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-medium h-10 w-[120px]">Date</TableHead>
                              <TableHead className="font-medium h-10 w-[120px]">Order #</TableHead>
                              <TableHead className="font-medium h-10">Customer</TableHead>
                              <TableHead className="text-right font-medium h-10">Qty</TableHead>
                              <TableHead className="text-right font-medium h-10">Bought Cost</TableHead>
                              <TableHead className="text-right font-medium h-10">Total Cost</TableHead>
                            </TableRow>
                          )}
                          renderRow={(item, i: number) => (
                            <TableRow
                              key={`${item.orderId}-${i}`}
                              onClick={() => setSelectedOrderId(item.orderId)}
                              className="group cursor-pointer hover:bg-slate-100/80 dark:hover:bg-muted/60 transition-colors"
                            >
                              <TableCell className="py-3 text-muted-foreground align-middle">
                                {format(new Date(item.date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="py-3 font-semibold align-middle text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                {item.orderNumber}
                              </TableCell>
                              <TableCell className="py-3 font-medium align-middle text-slate-700 dark:text-slate-300">
                                {item.customerName || "Guest"}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle tabular-nums">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle tabular-nums text-muted-foreground">
                                {formatAmount(item.costPrice)}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle font-medium tabular-nums text-red-600 dark:text-red-400">
                                {formatAmount(item.totalItemCost)}
                              </TableCell>
                            </TableRow>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Revenue Breakdown Dialog */}
            <Dialog open={showRevenueBreakdown} onOpenChange={setShowRevenueBreakdown}>
              <DialogContent className="sm:max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0 bg-background">
                <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-500" />
                    Net Revenue Breakdown
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {!data.revenueBreakdown || data.revenueBreakdown.length === 0 ? (
                      <div className="text-sm text-muted-foreground flex items-center justify-center h-24 bg-muted/20 rounded-lg border border-dashed">
                        No revenue found for this period.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.breakdownTruncated && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm rounded-lg border border-amber-200 dark:border-amber-800">
                            Showing the <span className="font-semibold">{data.revenueBreakdown.length}</span> most recent entries.
                          </div>
                        )}
                        <PaginatedTable
                          data={data.revenueBreakdown}
                          renderHeader={() => (
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-medium h-10 w-[120px]">Date</TableHead>
                              <TableHead className="font-medium h-10 w-[120px]">Order #</TableHead>
                              <TableHead className="font-medium h-10">Customer</TableHead>
                              <TableHead className="text-right font-medium h-10">Net Sale Amount</TableHead>
                            </TableRow>
                          )}
                          renderRow={(item, i: number) => (
                            <TableRow
                              key={`rev-${item.orderId}-${i}`}
                              onClick={() => setSelectedOrderId(item.orderId)}
                              className="group cursor-pointer hover:bg-slate-100/80 dark:hover:bg-muted/60 transition-colors"
                            >
                              <TableCell className="py-3 text-muted-foreground align-middle">
                                {format(new Date(item.date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="py-3 font-semibold align-middle text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                {item.orderNumber}
                              </TableCell>
                              <TableCell className="py-3 font-medium align-middle text-slate-700 dark:text-slate-300">
                                {item.customerName || "Guest"}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle font-medium tabular-nums text-green-600 dark:text-green-400">
                                {formatAmount(item.totalAmount)}
                              </TableCell>
                            </TableRow>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Shipping Breakdown Dialog */}
            <Dialog open={showShippingBreakdown} onOpenChange={setShowShippingBreakdown}>
              <DialogContent className="sm:max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0 bg-background">
                <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                    <Truck className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                    Delivery Charge Breakdown
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {!data.shippingBreakdown || data.shippingBreakdown.length === 0 ? (
                      <div className="text-sm text-muted-foreground flex items-center justify-center h-24 bg-muted/20 rounded-lg border border-dashed">
                        No delivery charges found for this period.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.breakdownTruncated && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm rounded-lg border border-amber-200 dark:border-amber-800">
                            Showing the <span className="font-semibold">{data.shippingBreakdown.length}</span> most recent entries.
                          </div>
                        )}
                        <PaginatedTable
                          data={data.shippingBreakdown}
                          renderHeader={() => (
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-medium h-10 w-[120px]">Date</TableHead>
                              <TableHead className="font-medium h-10 w-[120px]">Order #</TableHead>
                              <TableHead className="font-medium h-10">Customer</TableHead>
                              <TableHead className="text-right font-medium h-10">Qty</TableHead>
                              <TableHead className="text-right font-medium h-10">Delivery Charge</TableHead>
                            </TableRow>
                          )}
                          renderRow={(item, i: number) => (
                            <TableRow
                              key={`ship-${item.orderId}-${i}`}
                              onClick={() => setSelectedOrderId(item.orderId)}
                              className="group cursor-pointer hover:bg-slate-100/80 dark:hover:bg-muted/60 transition-colors"
                            >
                              <TableCell className="py-3 text-muted-foreground align-middle">
                                {format(new Date(item.date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="py-3 font-semibold align-middle text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                {item.orderNumber}
                              </TableCell>
                              <TableCell className="py-3 font-medium align-middle text-slate-700 dark:text-slate-300">
                                {item.customerName || "Guest"}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle tabular-nums">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle font-medium tabular-nums text-red-600 dark:text-red-400">
                                {formatAmount(item.shippingCost)}
                              </TableCell>
                            </TableRow>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Expense Breakdown Dialog */}
            <Dialog open={showExpenseBreakdown} onOpenChange={setShowExpenseBreakdown}>
              <DialogContent className="sm:max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0 bg-background">
                <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                    <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                    Expense Breakdown
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {!data.expenseBreakdown || data.expenseBreakdown.length === 0 ? (
                      <div className="text-sm text-muted-foreground flex items-center justify-center h-24 bg-muted/20 rounded-lg border border-dashed">
                        No expenses found for this period.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.breakdownTruncated && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm rounded-lg border border-amber-200 dark:border-amber-800">
                            Showing the <span className="font-semibold">{data.expenseBreakdown.length}</span> most recent entries.
                          </div>
                        )}
                        <PaginatedTable
                          data={data.expenseBreakdown}
                          renderHeader={() => (
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-medium h-10 w-[120px]">Date</TableHead>
                              <TableHead className="font-medium h-10 w-[150px]">Category</TableHead>
                              <TableHead className="font-medium h-10">Description</TableHead>
                              <TableHead className="text-right font-medium h-10">Amount</TableHead>
                            </TableRow>
                          )}
                          renderRow={(item, i: number) => (
                            <TableRow key={`exp-${item.id}-${i}`} className="group">
                              <TableCell className="py-3 text-muted-foreground align-middle">
                                {format(new Date(item.date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="py-3 font-medium align-middle">
                                {item.category}
                              </TableCell>
                              <TableCell className="py-3 align-middle text-muted-foreground max-w-[200px] truncate" title={item.description || ""}>
                                {item.description || "—"}
                              </TableCell>
                              <TableCell className="text-right py-3 align-middle font-medium tabular-nums text-red-600 dark:text-red-400">
                                {formatAmount(item.amount)}
                              </TableCell>
                            </TableRow>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <OrderDetailDialog
              orderId={selectedOrderId}
              open={!!selectedOrderId}
              onOpenChange={(open) => !open && setSelectedOrderId(null)}
            />

          </div>
        ) : (
          <div>Failed to load reports.</div>
        )}
      </div>
    </div>
  );
}

function OrderDetailDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { formatAmount } = useCurrency();
  const { data: orderData, isLoading } = useGetOrderByID(orderId || "");
  const order = orderData?.order;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6 rounded-3xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center justify-between gap-2 text-lg font-bold">
            <span>Order Details — #{order?.orderNumber || "..."}</span>
            {order && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-slate-50 dark:bg-muted/40 capitalize">
                {order.status}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
          {isLoading ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : !order ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-medium">
              Failed to load order details.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-muted/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Shipping & Customer Info
                  </h4>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {order.user?.name ?? order.guestName ?? "Guest"}
                  </p>
                  {(order.user?.phone || order.guestPhone) && (
                    <p className="text-muted-foreground">
                      {order.user?.phone || order.guestPhone}
                    </p>
                  )}
                  <p className="text-slate-600 dark:text-slate-400">
                    {order.shippingAddress}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Payment & Order Info
                  </h4>
                  <p>
                    <span className="text-muted-foreground">Payment Method:</span>{" "}
                    <span className="font-semibold">{order.paymentMethod || "COD"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Payment Status:</span>{" "}
                    <span className="font-semibold">{order.paymentStatus}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Order Date:</span>{" "}
                    <span className="font-semibold">
                      {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}
                    </span>
                  </p>
                  {order.trackingNumber && (
                    <p>
                      <span className="text-muted-foreground">Tracking Code:</span>{" "}
                      <span className="font-mono font-semibold">{order.trackingNumber}</span>
                    </p>
                  )}
                </div>
              </div>

              {order.note && (
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200">Note: </span>
                  <span className="text-amber-800 dark:text-amber-300">{order.note}</span>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Order Items ({order.items?.length || 0})
                </h4>
                <div className="space-y-2">
                  {order.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-slate-50/60 dark:bg-card border border-slate-100 dark:border-slate-800 rounded-xl text-xs"
                    >
                      {item.product?.images?.[0] && (
                        <Image
                          src={item.product.images[0]}
                          alt={item.product.name}
                          width={48}
                          height={48}
                          className="rounded-lg object-cover border shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {item.product?.name}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          Qty: {item.quantity} &times; {formatAmount(item.price)}
                          {item.size && ` · Size: ${item.size}`}
                          {item.color && ` · Color: ${item.color}`}
                        </p>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {formatAmount(item.quantity * item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatAmount(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping Cost</span>
                  <span>{formatAmount(order.shippingCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-slate-100 pt-1">
                  <span>Total Amount</span>
                  <span>{formatAmount(order.totalAmount)}</span>
                </div>
                {(order.refundedAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
                    <span>Refunded Amount</span>
                    <span>-{formatAmount(order.refundedAmount)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPage() {
  return (
    <React.Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full rounded-3xl" /></div>}>
      <ReportsContent />
    </React.Suspense>
  );
}
