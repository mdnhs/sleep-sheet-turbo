"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActivityLogs } from "@/features/activity/api/use-activity-logs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  History,
  User,
  AlertCircle,
  ArrowRight,
  Clock,
  Activity,
} from "lucide-react";

export interface OrderActivityDialogProps {
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActivityChangeItem {
  label: string;
  from?: string | number | null;
  to?: string | number | null;
}

interface ActivityLogItem {
  id: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  targetName?: string | null;
  path: string;
  method: string;
  status: number;
  ip?: string | null;
  changes?: ActivityChangeItem[] | null;
  createdAt: string;
}

function formatActivityTimestamp(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function OrderActivityDialog({
  orderNumber,
  open,
  onOpenChange,
}: OrderActivityDialogProps) {
  const cleanOrderNumber = React.useMemo(() => {
    return orderNumber ? orderNumber.replace(/^#/, "").trim() : "";
  }, [orderNumber]);

  const { data: logsData, isLoading } = useActivityLogs(
    cleanOrderNumber && open
      ? { search: cleanOrderNumber, limit: "50" }
      : undefined,
    { enabled: !!(cleanOrderNumber && open) }
  );

  const logs = (logsData?.data || []) as ActivityLogItem[];

  // Ensure newest entries appear first
  const sortedLogs = React.useMemo(() => {
    return [...logs].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [logs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[70]"
        className="z-[70] sm:max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl gap-4"
      >
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Activity Log — #{cleanOrderNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px]">
          {isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Activity className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No activity found for this order
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Activity events are automatically logged when this order is created, modified, or updated.
              </p>
            </div>
          ) : (
            <div className="relative pl-3 border-l-2 border-slate-200 dark:border-slate-800 ml-2.5 space-y-4 py-1">
              {sortedLogs.map((log) => {
                const actor = log.userName || log.userEmail || "System";
                const isError = typeof log.status === "number" && log.status >= 400;
                const formattedDate = formatActivityTimestamp(log.createdAt);

                return (
                  <div
                    key={log.id}
                    className="relative group"
                  >
                    {/* Timeline Node Icon */}
                    <div
                      className={cn(
                        "absolute -left-[19px] top-3.5 h-3 w-3 rounded-full border-2 bg-background ring-4 ring-background",
                        isError
                          ? "border-red-500 bg-red-500"
                          : "border-indigo-600 dark:border-indigo-400"
                      )}
                    />

                    {/* Card Body */}
                    <div
                      className={cn(
                        "rounded-xl border p-3.5 text-xs transition-colors shadow-xs",
                        isError
                          ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
                          : "border-border/60 bg-card hover:bg-muted/30"
                      )}
                    >
                      {/* Top Row: Actor + Timestamp + Status */}
                      <div className="flex items-center justify-between gap-2 pb-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                              isError
                                ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                            )}
                          >
                            <User className="h-3 w-3" />
                          </div>
                          <span
                            className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-[220px]"
                            title={actor}
                          >
                            {actor}
                          </span>
                          {log.userName && log.userEmail && (
                            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                              ({log.userEmail})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isError ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                              <AlertCircle className="h-3 w-3" />
                              Failed ({log.status})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {log.method} {log.status}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      {/* Action Description */}
                      <div className="mt-1">
                        <p
                          className={cn(
                            "text-xs leading-relaxed",
                            isError
                              ? "text-red-700 dark:text-red-300 font-semibold"
                              : "text-foreground font-medium"
                          )}
                        >
                          {log.action}
                        </p>
                      </div>

                      {/* Diff / Changes List if Present */}
                      {Array.isArray(log.changes) && log.changes.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Changes
                          </p>
                          <div className="space-y-1">
                            {log.changes.map((change, idx) => (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center gap-1.5 text-[11px] bg-muted/50 dark:bg-muted/30 px-2.5 py-1 rounded-md border border-border/40 font-mono"
                              >
                                <span className="font-semibold text-foreground">
                                  {change.label}:
                                </span>
                                {change.from !== undefined &&
                                  change.from !== null &&
                                  change.from !== "" && (
                                    <span className="line-through text-red-500 dark:text-red-400">
                                      {String(change.from)}
                                    </span>
                                  )}
                                {change.from !== undefined &&
                                  change.to !== undefined && (
                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )}
                                {change.to !== undefined &&
                                  change.to !== null &&
                                  change.to !== "" && (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      {String(change.to)}
                                    </span>
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OrderActivityDialog;
