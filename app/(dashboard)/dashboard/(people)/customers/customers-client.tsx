"use client";

import { useState, useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Users, ShoppingBag, UserPlus, KeyRound } from "lucide-react";
import { format, startOfMonth } from "date-fns";

import { useGetCustomers } from "@/features/users/api/use-get-customers";
import { useCurrency } from "@/hooks/use-currency";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export function CustomersClient() {
  const { data: customers, isLoading } = useGetCustomers();
  const { formatAmount } = useCurrency();

  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""));
  const [resetPasswordCustomer, setResetPasswordCustomer] = useState<{ id: string; name: string } | null>(null);

  const safeCustomers = useMemo(
    () => (customers ?? []) as CustomerRow[],
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return safeCustomers;
    const q = searchQuery.toLowerCase();
    return safeCustomers.filter(
      (cust) =>
        cust.name.toLowerCase().includes(q) ||
        cust.email.toLowerCase().includes(q) ||
        (cust.phone ?? "").toLowerCase().includes(q)
    );
  }, [safeCustomers, searchQuery]);

  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    return {
      total: safeCustomers.length,
      buyers: safeCustomers.filter((cust) => cust.orderCount > 0).length,
      newThisMonth: safeCustomers.filter(
        (cust) => new Date(cust.createdAt) >= monthStart
      ).length,
    };
  }, [safeCustomers]);

  const columns: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => <span className="text-xs">{row.original.phone || <span className="text-muted-foreground">-</span>}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) => <span className="text-xs whitespace-nowrap">{format(new Date(row.original.createdAt), "MMM d, yyyy")}</span>,
    },
    {
      accessorKey: "orderCount",
      header: "Orders",
      cell: ({ row }) =>
        row.original.orderCount > 0 ? (
          <Badge variant="secondary" className="rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none">{row.original.orderCount}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">0</span>
        ),
    },
    {
      accessorKey: "totalSpent",
      header: "Total Spent",
      cell: ({ row }) => (
        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">{formatAmount(row.original.totalSpent)}</span>
      ),
    },
    {
      accessorKey: "lastOrderAt",
      header: "Last Order",
      cell: ({ row }) =>
        row.original.lastOrderAt ? (
          <span className="text-xs whitespace-nowrap">{format(new Date(row.original.lastOrderAt), "MMM d, yyyy")}</span>
        ) : (
          <span className="text-muted-foreground text-xs">Never</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs font-semibold h-8"
          onClick={() => setResetPasswordCustomer({ id: row.original.id, name: row.original.name })}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Reset Password
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        <div>
          <Skeleton className="h-8 w-40 rounded-xl mb-2" />
          <Skeleton className="h-4 w-64 rounded-xl" />
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl col-span-2 lg:col-span-1" />
        </div>
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
          <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
          <TableSkeleton rows={10} cols={7} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Customers</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Shoppers who registered on your storefront
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
              Total Customers
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 shrink-0">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-2.5 mb-1">
            <p className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight">{stats.total.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
              Made a Purchase
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-green-50 dark:bg-green-950/40 shrink-0">
              <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-2.5 mb-1">
            <p className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight">{stats.buyers.toLocaleString()}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">
              {stats.total > 0 ? `${((stats.buyers / stats.total) * 100).toFixed(0)}% of customers` : "No customers yet"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px] col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
              New This Month
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-purple-50 dark:bg-purple-950/40 shrink-0">
              <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-2.5 mb-1">
            <p className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight">{stats.newThisMonth.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <DataTable
          columns={columns}
          data={filteredCustomers}
          searchSlot={
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                className="pl-9 w-full rounded-full text-xs font-semibold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value || null)}
              />
            </div>
          }
        />
      </div>

      {resetPasswordCustomer && (
        <ResetPasswordDialog
          open={!!resetPasswordCustomer}
          onOpenChange={(open) => { if (!open) setResetPasswordCustomer(null); }}
          userId={resetPasswordCustomer.id}
          userName={resetPasswordCustomer.name}
        />
      )}
    </div>
  );
}
