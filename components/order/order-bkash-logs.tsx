"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Order, PaymentLog } from "@/features/order/types";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Copy,
  Check,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Code2,
  ChevronDown,
  ChevronUp,
  Globe,
  Hash,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface OrderBkashLogsProps {
  order: Order;
  initialLogs?: PaymentLog[];
}

function formatLogTimestamp(dateInput: string | Date | undefined): string {
  if (!dateInput) return "N/A";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateInput);
  }
}

export function OrderBkashLogs({ order, initialLogs }: OrderBkashLogsProps) {
  const [refetchedLogs, setRefetchedLogs] = useState<PaymentLog[] | null>(null);
  const [prevOrderId, setPrevOrderId] = useState(order.id);
  if (prevOrderId !== order.id) {
    setPrevOrderId(order.id);
    setRefetchedLogs(null);
  }

  const logs = refetchedLogs ?? initialLogs ?? order.paymentLogs ?? [];
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [activeJsonTab, setActiveJsonTab] = useState<Record<string, "response" | "request">>({});

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const setTab = (logId: string, tab: "response" | "request") => {
    setActiveJsonTab((prev) => ({
      ...prev,
      [logId]: tab,
    }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/payment-logs`);
      if (!res.ok) {
        throw new Error(`Failed to fetch logs (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        setRefetchedLogs(data.logs);
        toast.success(`bKash logs updated (${data.logs.length} events)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh bKash logs");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Find latest trxId / paymentId across order & logs
  const latestTrxId =
    logs.find((l) => l.trxId)?.trxId ||
    order.payment?.transactionId ||
    null;
  const latestPaymentId =
    logs.find((l) => l.paymentId)?.paymentId ||
    (order.reference?.includes("TR") ? order.reference : null);

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="rounded-xl border border-pink-500/20 bg-gradient-to-r from-pink-500/5 via-pink-500/10 to-transparent p-4 dark:border-pink-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pink-500/15">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#E2136E] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              ৳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-foreground">bKash Payment Gateway</h4>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold border px-2 py-0.5",
                    order.paymentStatus === "COMPLETED"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                      : order.paymentStatus === "FAILED"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                  )}
                >
                  {order.paymentStatus}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Order #{order.orderNumber} · Total: ৳{order.totalAmount}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-pink-600")} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Logs"}</span>
          </Button>
        </div>

        {/* TrxID & PaymentID Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/60">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                bKash TrxID
              </span>
              <span className="font-mono font-semibold text-foreground truncate block">
                {latestTrxId || "Not assigned"}
              </span>
            </div>
            {latestTrxId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(latestTrxId, "trxId", "TrxID")}
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy TrxID"
              >
                {copiedKey === "trxId" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/60">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Payment ID
              </span>
              <span className="font-mono font-semibold text-foreground truncate block">
                {latestPaymentId || "Not assigned"}
              </span>
            </div>
            {latestPaymentId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(latestPaymentId, "paymentId", "Payment ID")}
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy Payment ID"
              >
                {copiedKey === "paymentId" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Transaction Activity History ({logs.length})
          </h5>
          <span className="text-[11px] text-muted-foreground">
            {logs.length === 0 ? "No recorded events" : "Newest events first"}
          </span>
        </div>

        {logs.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-pink-500/10 text-pink-600 flex items-center justify-center">
                <CreditCard className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No Raw API Logs Recorded Yet
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                This bKash order was either created before logging was activated, or checkout was initiated without completing the gateway callback. Future transactions will display detailed API request and response data here.
              </p>
              {latestTrxId && (
                <div className="mt-2 text-xs font-mono bg-background px-2.5 py-1 rounded border border-border">
                  Saved TrxID: {latestTrxId}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log, index) => {
              const isExpanded = !!expandedLogIds[log.id];
              const activeTab = activeJsonTab[log.id] || "response";
              const hasResponse = log.response !== null && log.response !== undefined;
              const hasRequest = log.request !== null && log.request !== undefined;
              const formattedDate = formatLogTimestamp(log.createdAt);

              const responseStr = hasResponse
                ? JSON.stringify(log.response, null, 2)
                : "";
              const requestStr = hasRequest
                ? JSON.stringify(log.request, null, 2)
                : "";

              return (
                <div
                  key={log.id}
                  className={cn(
                    "rounded-xl border transition-all text-xs overflow-hidden shadow-xs",
                    log.isSuccess
                      ? "border-emerald-500/30 bg-card hover:border-emerald-500/50"
                      : "border-rose-500/30 bg-card hover:border-rose-500/50"
                  )}
                >
                  {/* Item Header */}
                  <div
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition-colors"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {log.isSuccess ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-foreground">
                            {log.endpoint}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-mono px-1.5 py-0 h-4 border",
                              log.isSuccess
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800"
                            )}
                          >
                            {log.statusCode || (log.isSuccess ? "200" : "ERROR")}
                          </Badge>
                          {log.statusMessage && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-[280px]">
                              {log.statusMessage}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formattedDate}
                          </span>
                          {log.trxId && (
                            <span className="font-mono">TrxID: {log.trxId}</span>
                          )}
                          {log.clientIp && (
                            <span className="font-mono hidden sm:inline">IP: {log.clientIp}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                      >
                        <Code2 className="h-3.5 w-3.5" />
                        <span>{isExpanded ? "Hide JSON" : "View JSON"}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="p-3 border-t border-border/60 bg-slate-950 text-slate-100 dark:bg-black/80 space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        {/* Tab Switcher */}
                        <div className="flex items-center gap-1.5">
                          {hasResponse && (
                            <button
                              type="button"
                              onClick={() => setTab(log.id, "response")}
                              className={cn(
                                "px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                                activeTab === "response"
                                  ? "bg-pink-600 text-white font-semibold"
                                  : "text-slate-400 hover:text-white hover:bg-slate-800"
                              )}
                            >
                              bKash Response
                            </button>
                          )}
                          {hasRequest && (
                            <button
                              type="button"
                              onClick={() => setTab(log.id, "request")}
                              className={cn(
                                "px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                                activeTab === "request"
                                  ? "bg-pink-600 text-white font-semibold"
                                  : "text-slate-400 hover:text-white hover:bg-slate-800"
                              )}
                            >
                              Request Payload
                            </button>
                          )}
                        </div>

                        {/* Copy Current JSON Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const textToCopy =
                              activeTab === "response" ? responseStr : requestStr;
                            handleCopy(
                              textToCopy,
                              `json-${log.id}-${activeTab}`,
                              activeTab === "response" ? "Response JSON" : "Request JSON"
                            );
                          }}
                          className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800 gap-1 cursor-pointer"
                        >
                          {copiedKey === `json-${log.id}-${activeTab}` ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Code Block */}
                      <pre className="font-mono text-[11px] leading-relaxed p-2.5 overflow-x-auto max-h-72 rounded bg-slate-900/90 text-slate-200 border border-slate-800">
                        {activeTab === "response"
                          ? responseStr || "// No response payload recorded"
                          : requestStr || "// No request payload recorded"}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderBkashLogs;
