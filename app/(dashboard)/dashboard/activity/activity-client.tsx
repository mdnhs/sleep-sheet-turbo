"use client";

import { useState } from "react";
import { useQueryState, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import type { ColumnDef, PaginationState, Updater } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  CircleCheck,
  CircleX,
  Eye,
  History,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useActivityLogs } from "@/features/activity/api/use-activity-logs";
import { cn } from "@/lib/utils";

interface ActivityChangeRow {
  label: string;
  from?: string | null;
  to?: string | null;
}

interface ActivityLogRow {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  action: string;
  method: string;
  path: string;
  status: number;
  ip: string;
  targetName: string | null;
  changes: ActivityChangeRow[] | null;
  createdAt: string;
}

type EventKind = "create" | "update" | "delete" | "view" | "error";

// The `action` sentence is already composed server-side ("Created product",
// "Updated order", "Deleted category", ...) — its leading verb tells us what
// kind of event this was, which drives the icon/color so a non-technical
// admin can scan the log by shape and color instead of reading HTTP verbs.
function getEventKind(action: string, status: number): EventKind {
  if (status >= 400) return "error";
  if (action.startsWith("Created")) return "create";
  if (action.startsWith("Updated")) return "update";
  if (action.startsWith("Deleted")) return "delete";
  if (action.startsWith("Viewed")) return "view";
  return "update";
}

const EVENT_STYLES: Record<
  EventKind,
  { icon: typeof PlusCircle; iconClass: string; bgClass: string }
> = {
  create: { icon: PlusCircle, iconClass: "text-green-600 dark:text-green-400", bgClass: "bg-green-50 dark:bg-green-950/40" },
  update: { icon: Pencil, iconClass: "text-blue-600 dark:text-blue-400", bgClass: "bg-blue-50 dark:bg-blue-950/40" },
  delete: { icon: Trash2, iconClass: "text-red-600 dark:text-red-400", bgClass: "bg-red-50 dark:bg-red-950/40" },
  view: { icon: Eye, iconClass: "text-slate-500 dark:text-slate-400", bgClass: "bg-slate-100 dark:bg-slate-900/40" },
  error: { icon: AlertTriangle, iconClass: "text-red-600 dark:text-red-400", bgClass: "bg-red-50 dark:bg-red-950/40" },
};

function EventIcon({ kind }: { kind: EventKind }) {
  const { icon: Icon, iconClass, bgClass } = EVENT_STYLES[kind];
  return (
    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", bgClass)}>
      <Icon className={cn("h-4 w-4", iconClass)} />
    </div>
  );
}

// Compact "Status: Pending → Delivered, Payment: Pending → Completed" preview
// shown under the action in the table, so an admin can see what actually
// changed without opening the row.
function ChangesPreview({ changes }: { changes: ActivityChangeRow[] | null }) {
  if (!changes || changes.length === 0) return null;
  const MAX = 2;
  const shown = changes.slice(0, MAX);
  const extra = changes.length - shown.length;
  return (
    <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
      {shown.map((ch, i) => (
        <span key={i}>
          {i > 0 && ", "}
          <span className="font-medium">{ch.label}</span>
          {ch.from != null && ch.to != null ? (
            <>: {ch.from} → {ch.to}</>
          ) : ch.to != null ? (
            <>: {ch.to}</>
          ) : null}
        </span>
      ))}
      {extra > 0 && <span> and {extra} more change{extra > 1 ? "s" : ""}</span>}
    </div>
  );
}

// Order routes (update/cancel/refund/delete) attach these `to`-only entries
// alongside any real field diffs so the activity dialog can show who/what/
// where an order action touched — the only place that survives for a
// deleted order, since the row itself is gone by the time anyone reads the
// log. Split out of `changes` here so they render as their own "Order
// details" section instead of mixing with genuine before → after diffs.
const ORDER_CONTEXT_LABELS = ["Customer", "Phone", "Address", "Products"];

function splitOrderContext(changes: ActivityChangeRow[] | null): {
  orderContext: ActivityChangeRow[];
  otherChanges: ActivityChangeRow[];
} {
  if (!changes) return { orderContext: [], otherChanges: [] };
  const orderContext = changes.filter((ch) => ORDER_CONTEXT_LABELS.includes(ch.label));
  const otherChanges = changes.filter((ch) => !ORDER_CONTEXT_LABELS.includes(ch.label));
  return { orderContext, otherChanges };
}

// "Customer" + "Phone" side by side, "Address" and "Products" each full
// width (an address or a multi-item product list wraps, and shouldn't be
// squeezed into half the dialog).
function OrderContextCard({ context }: { context: ActivityChangeRow[] }) {
  const byLabel = new Map(context.map((ch) => [ch.label, ch.to]));
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-3">
        {byLabel.has("Customer") && (
          <div>
            <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wide mb-0.5">Customer</div>
            <div className="font-semibold text-foreground">{byLabel.get("Customer")}</div>
          </div>
        )}
        {byLabel.has("Phone") && (
          <div>
            <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wide mb-0.5">Phone</div>
            <div className="font-semibold text-foreground">{byLabel.get("Phone")}</div>
          </div>
        )}
      </div>
      {byLabel.has("Address") && (
        <div>
          <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wide mb-0.5">Address</div>
          <div className="text-foreground">{byLabel.get("Address")}</div>
        </div>
      )}
      {byLabel.has("Products") && (
        <div>
          <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wide mb-0.5">Products</div>
          <div className="text-foreground">{byLabel.get("Products")}</div>
        </div>
      )}
    </div>
  );
}

// Full before → after list for the detail dialog.
function ChangesList({ changes }: { changes: ActivityChangeRow[] }) {
  return (
    <div className="space-y-2">
      {changes.map((ch, i) => (
        <div key={i} className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
            {ch.label}
          </div>
          {ch.from != null && ch.to != null ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="line-through text-muted-foreground">{ch.from}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">{ch.to}</span>
            </div>
          ) : (
            <span className="font-semibold text-foreground">{ch.to ?? "—"}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <div className="whitespace-nowrap" title={format(date, "MMM d, yyyy 'at' h:mm:ss a")}>
      <div className="font-medium">{formatDistanceToNowStrict(date, { addSuffix: true })}</div>
      <div className="text-xs text-muted-foreground">{format(date, "MMM d, h:mm a")}</div>
    </div>
  );
}

const columns: ColumnDef<ActivityLogRow>[] = [
  {
    accessorKey: "action",
    header: "What happened",
    cell: ({ row }) => {
      const kind = getEventKind(row.original.action, row.original.status);
      return (
        <div className="flex items-start gap-3 min-w-0">
          <EventIcon kind={kind} />
          <div className="min-w-0">
            <div className={cn("font-semibold text-sm truncate", kind === "error" && "text-red-600 dark:text-red-400")}>
              {row.original.action}
            </div>
            <ChangesPreview changes={row.original.changes} />
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "userName",
    header: "Done by",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.userName}</div>
        <div className="text-xs text-muted-foreground">{row.original.userEmail}</div>
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "When",
    cell: ({ row }) => <RelativeTime iso={row.original.createdAt} />,
  },
  {
    accessorKey: "status",
    header: "Result",
    cell: ({ row }) => {
      const ok = row.original.status >= 200 && row.original.status < 400;
      return ok ? (
        <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 text-sm font-medium">
          <CircleCheck className="h-4 w-4" /> Success
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm font-medium">
          <CircleX className="h-4 w-4" /> Failed
        </span>
      );
    },
  },
];

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400 border-slate-200/40",
  POST: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200/40",
  PUT: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200/40",
  PATCH: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200/40",
  DELETE: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200/40",
};

export function ActivityClient() {
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [statusFilter, setStatusFilter] = useQueryState("status", parseAsStringEnum(["ALL", "ERROR"]).withDefault("ALL"));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(20));

  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const pagination: PaginationState = {
    pageIndex: Math.max(0, page - 1),
    pageSize: limit,
  };

  const { data, isLoading } = useActivityLogs({
    page: String(page),
    limit: String(limit),
    search: search || undefined,
    status: statusFilter === "ERROR" ? "error" : undefined,
  });

  const logs = (data && "data" in data ? data.data : []) as ActivityLogRow[];
  const totalPages = data && "totalPages" in data ? data.totalPages : 0;
  const total = data && "total" in data ? data.total : 0;
  const errorTotal = data && "errorTotal" in data ? data.errorTotal : 0;

  const handlePaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    setPage(next.pageIndex + 1);
    setLimit(next.pageSize);
  };

  const selectedKind = selectedLog ? getEventKind(selectedLog.action, selectedLog.status) : null;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            A plain-English history of what was created, changed, or deleted in the dashboard — and by whom
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2">
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
              Total Events
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 shrink-0">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-2.5 mb-1">
            <p className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight">{total.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
              Things That Went Wrong
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-950/40 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="mt-2.5 mb-1">
            <p className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400">{errorTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Tabs
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as "ALL" | "ERROR");
              setPage(1);
            }}
            className="w-fit"
          >
            <TabsList className="flex flex-nowrap items-center h-9 w-max sm:w-fit gap-1 bg-slate-100 dark:bg-muted/40 p-1 rounded-full">
              <TabsTrigger
                value="ALL"
                className="shrink-0 rounded-full px-3.5 h-7 text-xs font-semibold cursor-pointer transition-colors data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Everything
              </TabsTrigger>
              <TabsTrigger
                value="ERROR"
                className="shrink-0 rounded-full px-3.5 h-7 text-xs font-semibold cursor-pointer transition-colors data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Failed ({errorTotal})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, person, or item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value || null);
                setPage(1);
              }}
              className="pl-9 w-full rounded-full text-xs font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            manualPagination
            pageCount={totalPages}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
            onRowClick={(row) => {
              setShowTechnical(false);
              setSelectedLog(row);
            }}
          />
        )}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedLog && selectedKind && (() => {
            const { orderContext, otherChanges } = splitOrderContext(selectedLog.changes);
            return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <EventIcon kind={selectedKind} />
                  <span className={selectedLog.status >= 400 ? "text-red-600 dark:text-red-400" : ""}>
                    {selectedLog.action}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Done by</div>
                    <div className="font-medium">{selectedLog.userName}</div>
                    <div className="text-muted-foreground text-xs">{selectedLog.userEmail}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">When</div>
                    <div>{format(new Date(selectedLog.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}</div>
                  </div>
                </div>

                {orderContext.length > 0 && (
                  <div>
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Order details</div>
                    <OrderContextCard context={orderContext} />
                  </div>
                )}

                {otherChanges.length > 0 && (
                  <div>
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">What changed</div>
                    <ChangesList changes={otherChanges} />
                  </div>
                )}

                {selectedLog.status >= 400 && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/40 px-3 py-2 flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">This action didn&apos;t go through — something failed on the server.</span>
                  </div>
                )}

                <Collapsible open={showTechnical} onOpenChange={setShowTechnical}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showTechnical && "rotate-180")} />
                    Technical details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Status code</div>
                        <Badge
                          variant="outline"
                          className={
                            selectedLog.status < 400
                              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200/40"
                              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200/40"
                          }
                        >
                          {selectedLog.status}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">IP Address</div>
                        <div className="font-mono">{selectedLog.ip}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Request</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={METHOD_STYLES[selectedLog.method] ?? ""}>
                          {selectedLog.method}
                        </Badge>
                        <span className="font-mono text-xs break-all">{selectedLog.path}</span>
                      </div>
                    </div>
                    {selectedLog.userId && (
                      <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">User ID</div>
                        <div className="font-mono text-xs">{selectedLog.userId}</div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
