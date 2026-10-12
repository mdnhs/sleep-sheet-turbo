/* eslint-disable @next/next/no-img-element */
"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/hooks/use-currency";
import {
  IconCashRegister,
  IconAlertTriangle,
  IconBox,
} from "@tabler/icons-react";
import {
  ShoppingCart,
  DollarSign,
  Package,
  Truck,
  Receipt,
  TrendingUp,
  Ban,
  RotateCcw,
  Users,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  useSalesOverview,
  useCustomerLifetimeValue,
  useInventoryTurnover,
  useCartAbandonment,
  useCohortRetention,
  useSpendingClusters,
  useCustomerAcquisition,
  useMostPurchased,
  useMostWishlisted,
  useRecentOrders,
  useLowStock,
} from "@/features/analytics/api/use-analytics";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import {
  LowStockTableSkeleton,
  ProductRankTableSkeleton,
  RecentOrdersTableSkeleton,
  type ProductRankListKey,
} from "./home-skeleton";
import { useRememberRows } from "@/hooks/use-skeleton-rows";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubTabs } from "@/hooks/use-sub-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CohortChart,
  CustomBarChart,
  RevenueAnalyticsBarChart,
} from "@/components/ui/charts";

interface TrendData {
  date: string;
  amount: number;
}

interface SpendingSegment {
  segment: string;
  customers: number;
}

type Period = "this-month" | "last-month" | "3-months" | "6-months" | "12-months" | "month" | "year";

const periodLabels: Record<string, string> = {
  "this-month": "This Month",
  "month": "This Month",
  "last-month": "Last Month",
  "3-months": "Last 3 Months",
  "6-months": "Last 6 Months",
  "12-months": "Last 12 Months",
  "year": "Last 12 Months",
};

export default function DashBoardClientPage() {
  const overviewTabs = useSubTabs("dashboard");
  const [overviewTabsValue, setOverviewTabsValue] = useState("sales");
  const { symbol: currencySymbol } = useCurrency();
  const [graphPeriod, setGraphPeriod] = useState<Period>("this-month");

  // Top KPI metric cards always show all-time totals, independent of the
  // graphPeriod selector below (which only drives the trend chart/breakdown).
  const { data: overview, isLoading: loadingOverview } =
    useSalesOverview("all");
  // Separate this-month fetch just for the % badge (this month vs last
  // month — computed server-side via getPreviousRange). Independent of the
  // all-time totals above.
  const { data: monthOverview } = useSalesOverview("this-month");
  // Revenue Analytics & Total Income graph query isolated to graphPeriod
  const { data: graphOverview, isLoading: loadingGraphOverview } =
    useSalesOverview(graphPeriod);

  const { data: clv, isLoading: loadingCLV } = useCustomerLifetimeValue();
  const { data: inventory, isLoading: loadingInventory } =
    useInventoryTurnover();
  const { data: abandonment, isLoading: loadingAbandonment } =
    useCartAbandonment();
  const { data: cohort, isLoading: loadingCohort } = useCohortRetention();
  const { data: segments, isLoading: loadingSegments } = useSpendingClusters();
  const { data: acquisition, isLoading: loadingAcquisition } =
    useCustomerAcquisition(graphPeriod);
  const { data: mostPurchased, isLoading: loadingPurchased } =
    useMostPurchased();
  const { data: mostWishlisted, isLoading: loadingWishlisted } =
    useMostWishlisted();
  const { data: recentOrders, isLoading: loadingRecentOrders } =
    useRecentOrders();
  const { data: lowStock, isLoading: loadingLowStock } = useLowStock();
  useRememberRows("home.recent-orders", loadingRecentOrders ? undefined : (recentOrders?.length ?? 0));
  useRememberRows("home.low-stock", loadingLowStock ? undefined : (lowStock?.length ?? 0));

  const formatGraphBucketDate = (iso: string) => {
    const d = new Date(iso);
    if (graphPeriod === "3-months" || graphPeriod === "6-months" || graphPeriod === "12-months" || graphPeriod === "year") {
      return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };

  const salesTrendData = (graphOverview?.trendData || []).map((t: TrendData) => ({
    name: formatGraphBucketDate(t.date),
    value: t.amount,
  }));

  const acquisitionData = (acquisition || []).map((a) => ({
    name: formatGraphBucketDate(a.date),
    value: a.count,
  }));

  // Sourced from monthOverview (this-month), not overview (all-time) — an
  // all-time total has no meaningful "previous period" to compare against.
  const changes = monthOverview?.changes;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
      <PageTitle title="Sales Overview" />
      <div className="hidden sm:flex items-center justify-end gap-2">
        <Link href="/dashboard/pos">
          <Button className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5">
            <IconCashRegister className="h-4 w-4" />
            POS
          </Button>
        </Link>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Total Gross Sale"
          value={overview?.grossSales}
          format="currency"
          currencySymbol={currencySymbol}
          change={changes?.grossSales}
          subtitle={
            typeof overview?.cancelledAmount === "number" && typeof overview?.returnedAmount === "number"
              ? `Cancel: ${currencySymbol}${overview.cancelledAmount.toLocaleString()} | Return: ${currencySymbol}${overview.returnedAmount.toLocaleString()}`
              : undefined
          }
          loading={loadingOverview}
          icon={<ShoppingCart className="h-4 w-4 text-slate-700 dark:text-slate-200" />}
          valueClassName="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Total Net Sale"
          value={overview?.totalRevenue}
          format="currency"
          currencySymbol={currencySymbol}
          change={changes?.revenue}
          subtitle="Net revenue after deductions"
          loading={loadingOverview}
          icon={<DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          title="Total Orders"
          value={overview?.totalOrders}
          change={changes?.orders}
          subtitle="Completed & active orders"
          loading={loadingOverview}
          icon={<Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
          valueClassName="text-indigo-600 dark:text-indigo-400"
        />
        <MetricCard
          title="Average Order Value"
          value={overview?.aov}
          format="currency"
          currencySymbol={currencySymbol}
          change={changes?.aov}
          subtitle="Average net sales per order"
          loading={loadingOverview}
          icon={<TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
          valueClassName="text-purple-600 dark:text-purple-400"
        />
        <MetricCard
          title="Website Sales"
          value={overview?.websiteSales}
          format="currency"
          currencySymbol={currencySymbol}
          change={changes?.websiteSales}
          subtitle="Direct online storefront sales"
          loading={loadingOverview}
          icon={<Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          title="POS Sales"
          value={overview?.posSales}
          format="currency"
          currencySymbol={currencySymbol}
          change={changes?.posSales}
          subtitle="POS & Facebook page channels"
          loading={loadingOverview}
          icon={<IconCashRegister className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
          valueClassName="text-orange-600 dark:text-orange-400"
        />
        <MetricCard
          title="Total Cancelled Orders"
          value={overview?.totalCancelledOrders}
          change={changes?.cancelledOrders}
          invertChangeColor
          subtitle={
            typeof overview?.cancelledAmount === "number"
              ? `Val: ${currencySymbol}${overview.cancelledAmount.toLocaleString()}`
              : undefined
          }
          loading={loadingOverview}
          icon={<Ban className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          valueClassName="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          title="Total Returned Orders"
          value={overview?.totalReturnedOrders}
          change={changes?.returnedOrders}
          invertChangeColor
          subtitle={
            typeof overview?.returnedAmount === "number"
              ? `Val: ${currencySymbol}${overview.returnedAmount.toLocaleString()}`
              : undefined
          }
          loading={loadingOverview}
          icon={<RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
          valueClassName="text-rose-600 dark:text-rose-400"
        />
      </div>

      {/* Operational Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Orders</h3>
            <Link
              href="/dashboard/orders"
              className="px-3.5 py-1 rounded-full border bg-slate-50 dark:bg-muted/40 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-muted transition-colors"
            >
              View all ➔
            </Link>
          </div>
          <div className="flex-1">
            {loadingRecentOrders ? (
              <RecentOrdersTableSkeleton />
            ) : !recentOrders?.length ? (
              <EmptyState message="No recent orders" />
            ) : (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                    <TableRow>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Order #</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Customer</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Channel</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Date</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/40">
                        <TableCell className="px-3 py-3 text-xs font-semibold whitespace-nowrap">
                          <Link href={`/dashboard/orders/${order.id}`} className="hover:underline hover:text-indigo-600">
                            {order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-xs truncate max-w-[85px] sm:max-w-[110px]" title={order.customerName}>
                          {order.customerName}
                        </TableCell>
                        <TableCell className="px-3 py-3 whitespace-nowrap">
                          {order.saleType === "POS" ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800">
                                POS
                              </Badge>
                              {order.reference && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5 max-w-[95px] truncate" title={order.reference}>
                                  <svg className="w-2 h-2 fill-[#1877F2] shrink-0" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                  </svg>
                                  <span className="truncate">{order.reference}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                              Website
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.createdAt), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <Badge 
                            variant={order.status === "DELIVERED" ? "default" : order.status === "CANCELLED" || order.status === "REFUNDED" ? "destructive" : "secondary"}
                            className="px-2 py-0.5 text-[10px] sm:text-xs font-medium whitespace-nowrap rounded-full"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-xs text-right font-bold tabular-nums whitespace-nowrap">
                          {currencySymbol}{Number(order.totalAmount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Low Stock Alerts</h3>
            </div>
          </div>
          <div className="flex-1">
            {loadingLowStock ? (
              <LowStockTableSkeleton />
            ) : !lowStock?.length ? (
              <div className="h-48 flex items-center justify-center rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                <p>All products are well stocked!</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                    <TableRow>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Product</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 text-right">Stock Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((product) => (
                      <TableRow key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/40">
                        <TableCell className="px-3 py-3 font-medium text-xs truncate max-w-[180px]">
                          <Link href={`/dashboard/products/${product.id}/edit`} className="hover:underline flex items-center gap-2">
                            {product.images && product.images[0] ? (
                              <img src={product.images[0]} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <IconBox className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="truncate">{product.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <Badge variant={product.stock === 0 ? "destructive" : "outline"} className={cn("px-2 py-0.5 text-[10px] sm:text-xs rounded-full", product.stock > 0 ? "text-amber-600 border-amber-600" : "")}>
                            {product.stock} left
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs value={overviewTabs.pick(overviewTabsValue)} onValueChange={(value) => setOverviewTabsValue(value as string)}>
        <TabsList className="grid grid-cols-2 w-full md:w-[400px] mb-4 bg-white dark:bg-card rounded-full p-1 shadow-none">
          <TabsTrigger value="sales" disabled={!overviewTabs.allowed("sales")} className="rounded-full text-xs font-semibold">Sales Overview</TabsTrigger>
          <TabsTrigger value="customers" disabled={!overviewTabs.allowed("customers")} className="rounded-full text-xs font-semibold">Customer Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <div className="col-span-1 lg:col-span-4 rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revenue analytics</h3>
                <Select
                  value={graphPeriod}
                  onValueChange={(val) => setGraphPeriod(val as Period)}
                >
                  <SelectTrigger size="sm" className="w-[140px] rounded-full bg-slate-50 dark:bg-muted/40 text-xs font-semibold border border-slate-200 dark:border-slate-800 shadow-none">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent align="end" className="rounded-2xl bg-white dark:bg-card border shadow-md">
                    <SelectItem value="this-month" className="rounded-xl text-xs font-medium cursor-pointer">This Month</SelectItem>
                    <SelectItem value="last-month" className="rounded-xl text-xs font-medium cursor-pointer">Last Month</SelectItem>
                    <SelectItem value="3-months" className="rounded-xl text-xs font-medium cursor-pointer">Last 3 Months</SelectItem>
                    <SelectItem value="6-months" className="rounded-xl text-xs font-medium cursor-pointer">Last 6 Months</SelectItem>
                    <SelectItem value="12-months" className="rounded-xl text-xs font-medium cursor-pointer">Last 12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-72">
                {loadingGraphOverview ? (
                  <Skeleton className="h-full w-full rounded-2xl" />
                ) : salesTrendData.length === 0 ? (
                  <EmptyState message="No sales in this period" />
                ) : (
                  <RevenueAnalyticsBarChart data={salesTrendData} currencySymbol={currencySymbol} />
                )}
              </div>
            </div>

            <div className="col-span-1 lg:col-span-3 rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sales by Channel</h3>
                  <Badge variant="outline" className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-slate-50 dark:bg-muted/40">
                    {periodLabels[graphPeriod] || "This Month"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 font-medium mb-4">
                  Breakdown by Website & Facebook POS pages
                </p>

                <div className="flex items-center justify-between text-xs font-bold mb-3 flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Total Net Revenue</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {currencySymbol}{Number(graphOverview?.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-60 pr-1 space-y-3 mt-1">
                {loadingGraphOverview ? (
                  <Skeleton className="h-full w-full min-h-[180px] rounded-2xl" />
                ) : !graphOverview?.channels || graphOverview.channels.length === 0 ? (
                  <EmptyState message="No sales data in this period" />
                ) : (
                  graphOverview.channels.map((ch: { channel: string; orders: number; revenue: number }) => {
                    const totalRev = Number(graphOverview?.totalRevenue || 0);
                    const pct = totalRev > 0 ? Math.round((ch.revenue / totalRev) * 100) : 0;
                    const isWebsite = ch.channel === "Website";

                    return (
                      <div key={ch.channel} className="space-y-1.5 p-2 rounded-2xl bg-slate-50/70 dark:bg-muted/20">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isWebsite ? (
                              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                                <Globe className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                                <svg className="w-3 h-3 fill-[#1877F2]" viewBox="0 0 24 24">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                              </div>
                            )}
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {ch.channel}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              ({ch.orders} {ch.orders === 1 ? "order" : "orders"})
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {currencySymbol}{Number(ch.revenue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1.5 font-medium">
                              ({pct}%)
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-slate-200/70 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-500",
                              isWebsite ? "bg-blue-600 dark:bg-blue-500" : "bg-orange-500 dark:bg-orange-400"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-2">
              <CardHeader>
                <CardTitle className="text-base font-bold">Customer Acquisition</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {loadingAcquisition ? (
                  <Skeleton className="h-full w-full rounded-2xl" />
                ) : acquisitionData.length === 0 ? (
                  <EmptyState message="No new customers in this period" />
                ) : (
                  <CustomBarChart data={acquisitionData} />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-2">
              <CardHeader>
                <CardTitle className="text-base font-bold">Spending Segments</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSegments ? (
                  <TableSkeleton rows={3} cols={2} />
                ) : !segments?.length ? (
                  <EmptyState message="No customer data yet" />
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                      <TableRow>
                        <TableHead className="h-9 px-3 text-xs font-bold">Segment</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-bold text-right">Customers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(segments as SpendingSegment[])?.map((segment) => (
                        <TableRow key={segment.segment}>
                          <TableCell className="px-3 py-3 text-xs font-semibold">{segment.segment}</TableCell>
                          <TableCell className="px-3 py-3 text-xs text-right font-bold">
                            {segment.customers?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Combined Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-full rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cohort Retention</h3>
          </div>
          <div className="h-80 flex-1">
            {loadingCohort ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : !cohort?.length ? (
              <EmptyState message="No cohort data yet" />
            ) : (
              <CohortChart
                data={(cohort || []).map((c) => ({
                  cohortMonth: c.cohortMonth,
                  totalUsers: c.totalUsers,
                  retentionRate: c.retentionRate,
                }))}
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <ProductRankCard
            listKey="home.most-purchased"
            title="Most Purchased Products"
            valueHeader="Units Sold"
            loading={loadingPurchased}
            rows={mostPurchased?.map((p) => ({
              id: p.productId,
              name: p.productName,
              image: p.productImages[0],
              value: p.totalSold,
            }))}
          />
          <ProductRankCard
            listKey="home.most-wishlisted"
            title="Most Wishlisted Products"
            valueHeader="Wishlists"
            loading={loadingWishlisted}
            rows={mostWishlisted?.map((p) => ({
              id: p.productId,
              name: p.productName,
              image: p.productImages[0],
              value: p.wishlistCount,
            }))}
          />
        </div>
      </div>

      {/* Bottom Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Customer Lifetime Value"
          value={clv?.averageCLV}
          format="currency"
          currencySymbol={currencySymbol}
          loading={loadingCLV}
          icon={<Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
        />
        <MetricCard
          title="Inventory Turnover"
          value={inventory?.turnoverRate}
          loading={loadingInventory}
          icon={<Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
        />
        <MetricCard
          title="Cart Abandonment"
          value={abandonment?.abandonmentRate}
          format="percentage"
          invertChangeColor
          loading={loadingAbandonment}
          icon={<ShoppingCart className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
        />
      </div>

    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-sm font-medium text-muted-foreground">
      {message}
    </div>
  );
}

interface ProductRankRow {
  id: string;
  name: string;
  image?: string;
  value: number;
}

function ProductRankCard({
  listKey,
  title,
  valueHeader,
  rows,
  loading,
}: {
  listKey: ProductRankListKey;
  title: string;
  valueHeader: string;
  rows?: ProductRankRow[];
  loading?: boolean;
}) {
  useRememberRows(listKey, loading ? undefined : (rows?.length ?? 0));
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div>
        {loading ? (
          <ProductRankTableSkeleton listKey={listKey} />
        ) : !rows?.length ? (
          <EmptyState message="No product data yet" />
        ) : (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                <TableRow>
                  <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Product</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 text-right">{valueHeader}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/40">
                    <TableCell className="px-3 py-2.5 font-medium">
                      <div className="flex items-center gap-2">
                        {row.image ? (
                          <img src={row.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <IconBox className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate max-w-[200px] text-xs font-semibold">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-bold text-xs">
                      {row.value?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value?: number;
  format?: "currency" | "percentage" | "number";
  currencySymbol?: string;
  change?: number | null;
  invertChangeColor?: boolean;
  subtitle?: string;
  loading?: boolean;
  className?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
}

function MetricCard({
  title,
  value,
  format = "number",
  currencySymbol = "$",
  change,
  invertChangeColor = false,
  subtitle,
  loading,
  className,
  valueClassName,
  icon,
}: MetricCardProps) {
  const formattedValue = () => {
    if (typeof value === "undefined" || value === null) return "-";
    switch (format) {
      case "currency":
        return `${currencySymbol}${value.toLocaleString(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })}`;
      case "percentage":
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  const hasChange = typeof change === "number";
  const isGood = hasChange && (invertChangeColor ? change! < 0 : change! > 0);

  return (
    <div className={cn("rounded-3xl bg-white dark:bg-card border-none p-4 sm:p-6 shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]", className)}>
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">{title}</span>
        {icon && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#F4F4F2] dark:bg-slate-800/80 flex items-center justify-center text-slate-800 dark:text-slate-200 shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2.5 mb-1 flex items-baseline flex-wrap gap-1.5 sm:gap-2.5">
        {loading ? (
          <Skeleton className="h-7 sm:h-8 w-24 sm:w-28 rounded-xl" />
        ) : (
          <>
            <span className={cn("text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white break-all", valueClassName)}>
              {formattedValue()}
            </span>
            {hasChange && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs sm:text-sm font-bold shrink-0",
                  isGood
                    ? "text-[#1E8A37] dark:text-emerald-400"
                    : "text-[#D92D20] dark:text-rose-400"
                )}
              >
                {change! >= 0 ? "▲" : "▼"} {Math.abs(change!)}%
              </span>
            )}
          </>
        )}
      </div>

      {subtitle && (
        <div className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
}
