"use client";

import React, { Suspense } from "react";
import { ConfirmDialog } from "@/components/conform-dialouge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrderMutations } from "@/features/order/api/use-mutation";
import { useOrders } from "@/features/order/api/use-order";
import { useGetProducts } from "@/features/product/api/use-get-products";
import { OrderActivityDialog } from "@/components/order/order-activity-dialog";
import {
  useBlockedIps,
  useBlockIpMutations,
} from "@/features/blocked-ips/api/use-blocked-ips";
import type { Order } from "@/features/order/types";
import type { PlacedOrder, ShippingInfo } from "@/features/checkout/types";
import {
  useBookCourier,
  useSteadfastBalance,
  useSyncBatchOrderStatus,
  useTrackSingleOrder,
} from "@/features/steadfast/api/use-steadfast";
import { FraudCheckDialog } from "@/features/fraud-checker/components/fraud-check-dialog";
import { BookCourierDialog } from "@/features/steadfast/components/book-courier-dialog";
import { BulkBookCourierDialog } from "@/features/steadfast/components/bulk-book-courier-dialog";
import { useBookToSheet, useBulkBookToSheet } from "@/features/google-sheets/api/use-google-sheets";
import { useCurrency } from "@/hooks/use-currency";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useCurrent } from "@/features/auth/api/use-current";
import { can } from "@/lib/permissions";
import { LANDING_SOURCE_LABELS, type LandingSource } from "@/lib/traffic-source";
import { useRouter } from "next/navigation";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { useSettings } from "@/features/settings/api/use-settings";
import { businessRulesFromSettings } from "@/lib/settings/business-rules";
import { useStoreProfile } from "@/hooks/use-store-profile";
import { cn, formatDate, calculateItemAddOnCost, colorHasAddOn } from "@/lib/utils";
import { orderBoughtPrice, orderDiscount, orderProfit, totalAfterSubtotalChange } from "@/lib/order-totals";
import { useQueryClient } from "@tanstack/react-query";
import { ColumnDef, PaginationState, RowSelectionState, Updater } from "@tanstack/react-table";
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  FileText,
  FilterX,
  History,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Pointer,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash,
  Trash2,
  UserSearch,
  Truck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe,
  Smartphone,
  Laptop,
  ShieldBan,
  ShieldCheck,
  Sheet as SheetIcon,
  Plus,
  Minus,
  User,
  Phone,
  MapPin,
  Sparkles,
  Megaphone,
  PlayCircle,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ShippingOrder = Order & {
  shippingMethod?: { name: string; duration: string } | null;
};

interface EditingItem {
  id?: string;
  productId: string;
  productName: string;
  productSku?: string;
  productImage?: string;
  quantity: number;
  price: number;
  costPrice: string;
  addOnCostPrice: string;
  size: string;
  selectedVariant: string;
  selectedAddOns: Record<string, number>;
  availableVariants: Array<{ name: string; price: number | null }>;
  availableSizes: string[];
  availableAddOns: Array<{ name: string; price: number; costPrice?: number }>;
  basePrice: number;
}

function normalizeProductVariants(variants: unknown): Array<{ name: string; price: number | null }> {
  if (!Array.isArray(variants)) return [];
  return variants.map((v: unknown) => {
    if (typeof v === "string") return { name: v, price: null };
    if (v && typeof v === "object" && "name" in v) {
      const price = "price" in v ? v.price : undefined;
      return { name: String(v.name), price: typeof price === "number" ? price : null };
    }
    return { name: String(v), price: null };
  });
}

function parseAddOnsFromColor(
  color: string | null | undefined,
  availableAddOns: Array<{ name: string; price: number; costPrice?: number }>
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!color || !availableAddOns || availableAddOns.length === 0) return result;

  for (const addOn of availableAddOns) {
    if (!addOn.name) continue;
    const escaped = addOn.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s+x(\\d+)`);
    const match = color.match(regex);
    if (match && match[1]) {
      const qty = parseInt(match[1], 10);
      if (!isNaN(qty) && qty > 0) {
        result[addOn.name] = qty;
      }
    }
  }
  return result;
}

function parseBaseVariantFromColor(color: string | null | undefined): string {
  if (!color) return "";
  if (color.includes(" (+ ")) {
    return color.split(" (+ ")[0].trim();
  }
  if (color.trim().startsWith("Add-ons:")) {
    return "";
  }
  return color.trim();
}

// Once an order reaches one of these, Steadfast will never move it again
// (mapSteadfastStatus can't produce REFUNDED, and DELIVERED/CANCELLED are
// dead ends) — so polling or refreshing its courier status is pure waste.
// Keep these orders out of the auto-poll and bulk refresh/sync calls.
const TERMINAL_ORDER_STATUSES = new Set<Order["status"]>(["DELIVERED", "CANCELLED", "REFUNDED"]);
const isTrackable = (o: ShippingOrder) => !!o.trackingNumber && !TERMINAL_ORDER_STATUSES.has(o.status);

// Icon + colour for the source badge in the "Type" column and the order detail dialog.
// lucide-react dropped its brand icons a while back (Facebook/YouTube no
// longer exist there), so these are generic shapes coloured to match the
// platform rather than a logo.
const LANDING_SOURCE_DISPLAY: Record<LandingSource, { icon: typeof Megaphone; className: string }> = {
  facebook_ad: { icon: Megaphone, className: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  facebook_organic: { icon: Megaphone, className: "bg-blue-500/10 text-blue-600/80 dark:text-blue-400/70" },
  youtube_ad: { icon: PlayCircle, className: "bg-red-500/20 text-red-700 dark:text-red-400" },
  youtube_organic: { icon: PlayCircle, className: "bg-red-500/10 text-red-600/80 dark:text-red-400/70" },
  google_ad: { icon: Search, className: "bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  other_ad: { icon: Megaphone, className: "bg-violet-500/20 text-violet-700 dark:text-violet-400" },
  organic_search: { icon: Search, className: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
  direct: { icon: Globe, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  referral: { icon: Globe, className: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

const STATUS_COLORS: Record<Order["status"], string> = {
  PENDING: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  PROCESSING: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  SHIPPED: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  DELIVERED: "bg-green-500/20 text-green-700 dark:text-green-400",
  CANCELLED: "bg-red-500/20 text-red-700 dark:text-red-400",
  REFUNDED: "bg-rose-500/20 text-rose-700 dark:text-rose-400",
};

const STATUS_DOTS: Record<Order["status"], React.ReactNode> = {
  PENDING: <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />,
  PROCESSING: (
    <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
  ),
  SHIPPED: <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" />,
  DELIVERED: (
    <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
  ),
  CANCELLED: <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />,
  REFUNDED: <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />,
};

const STEADFAST_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Pickup",
  in_review: "In Review",
  hold: "On Hold",
  cancelled: "Cancelled",
  cancelled_approval_pending: "Cancellation Pending",
  delivered: "Delivered",
  partial_delivered: "Partially Delivered",
  delivered_approval_pending: "Delivery Confirmed",
  partial_delivered_approval_pending: "Partial Delivery Confirmed",
  not_delivered: "Not Delivered",
  returned: "Returned",
  "fast-track": "Fast Track",
  "hub-transfer": "Hub Transfer",
  "office-delivery": "Out for Delivery",
  "partial-return": "Partial Return",
  "partial-not-delivered": "Partial Not Delivered",
};

const STEADFAST_STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
  in_review:
    "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700",
  hold: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700",
  cancelled:
    "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
  cancelled_approval_pending:
    "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
  delivered:
    "bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
  partial_delivered:
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
  delivered_approval_pending:
    "bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
  partial_delivered_approval_pending:
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
  not_delivered:
    "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
  returned:
    "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
  "fast-track":
    "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700",
  "hub-transfer":
    "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700",
  "office-delivery":
    "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700",
};

type StatusFilter =
  | "ALL"
  | "TODAY"
  | "PENDING"
  | "CONFIRMED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

interface ComboboxProduct {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  stock: number;
  images?: string[];
}

interface ProductComboboxProps {
  products: ComboboxProduct[];
  selectedProductId?: string;
  fallbackProduct?: {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[];
    price?: number;
  };
  onSelectProduct: (productId: string) => void;
  currencySymbol?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function ProductCombobox({
  products,
  selectedProductId,
  fallbackProduct,
  onSelectProduct,
  currencySymbol = "৳",
  placeholder = "Select product...",
  disabled = false,
  className,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) ||
    (fallbackProduct && fallbackProduct.id === selectedProductId
      ? fallbackProduct
      : undefined);

  const displayList = React.useMemo(() => {
    const list: ComboboxProduct[] = [...products];
    if (
      fallbackProduct &&
      fallbackProduct.id &&
      !list.some((p) => p.id === fallbackProduct.id)
    ) {
      list.unshift({
        id: fallbackProduct.id,
        name: fallbackProduct.name,
        sku: fallbackProduct.sku || null,
        price: fallbackProduct.price || 0,
        stock: 0,
        images: fallbackProduct.images,
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
      return Boolean(nameMatch || skuMatch);
    });
  }, [products, fallbackProduct, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-left",
              className
            )}
          />
        }
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedProduct?.images?.[0] ? (
            <div className="w-5 h-5 rounded overflow-hidden relative shrink-0 border bg-muted">
              <Image
                src={selectedProduct.images[0]}
                alt={selectedProduct.name}
                fill
                sizes="20px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-5 h-5 rounded border bg-muted flex items-center justify-center shrink-0">
              <Package className="w-3 h-3 text-muted-foreground" />
            </div>
          )}
          <span className="truncate font-medium text-foreground">
            {selectedProduct ? selectedProduct.name : placeholder}
          </span>
          {selectedProduct?.sku && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-3.5 font-mono shrink-0 hidden sm:inline-flex"
            >
              {selectedProduct.sku}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-1.5">
          {selectedProduct && selectedProduct.price !== undefined && (
            <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              {currencySymbol} {selectedProduct.price}
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-60 shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        positionerClassName="z-[100]"
        className="w-[300px] sm:w-[360px] p-2 bg-popover text-popover-foreground shadow-2xl border rounded-xl z-[100]"
        align="start"
        sideOffset={4}
      >
        {/* Search header */}
        <div className="flex items-center border-b pb-1.5 px-1 gap-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product or SKU..."
            className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground py-0.5"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground text-[11px] px-1 rounded hover:bg-muted"
            >
              ✕
            </button>
          )}
        </div>

        {/* Product list */}
        <div className="max-h-56 overflow-y-auto mt-1 space-y-0.5 divide-y divide-border/20">
          {displayList.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No products found
            </div>
          ) : (
            displayList.map((prod) => {
              const isSelected = prod.id === selectedProductId;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    onSelectProduct(prod.id);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-1.5 rounded-md text-left transition-colors text-xs gap-2 group hover:bg-accent/70",
                    isSelected && "bg-accent/80 font-medium"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {prod.images?.[0] ? (
                      <div className="w-7 h-7 rounded overflow-hidden relative shrink-0 border bg-muted">
                        <Image
                          src={prod.images[0]}
                          alt={prod.name}
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded border bg-muted flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          {prod.name}
                        </span>
                        {prod.sku && (
                          <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 rounded shrink-0">
                            {prod.sku}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span
                          className={cn(
                            prod.stock > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          )}
                        >
                          Stock: {prod.stock}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-foreground">
                      {currencySymbol} {prod.price}
                    </span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 stroke-[2.5]" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrdersPageContent() {
  const mounted = useHasMounted();

  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );
  const [fromStr, setFromStr] = useQueryState(
    "from",
    parseAsString.withDefault("")
  );
  const [toStr, setToStr] = useQueryState(
    "to",
    parseAsString.withDefault("")
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringEnum<StatusFilter>([
      "ALL",
      "TODAY",
      "PENDING",
      "CONFIRMED",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
    ]).withDefault("PENDING")
  );

  const dateRange: DateRange | undefined = React.useMemo(() => {
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

  const setDateRange = (range: DateRange | undefined) => {
    setFromStr(range?.from ? format(range.from, "yyyy-MM-dd") : null);
    setToStr(range?.to ? format(range.to, "yyyy-MM-dd") : null);
  };
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // Raw UTM/click-id/referrer details stay hidden until the admin clicks the
  // source badge — most orders' badge alone (e.g. "YouTube Ad") is all
  // anyone needs, and the raw values are long enough to dominate the panel.
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [logDetailsOrder, setLogDetailsOrder] = useState<ShippingOrder | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [showAllOrderItems, setShowAllOrderItems] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [courierOrder, setCourierOrder] = useState<ShippingOrder | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  // The bulk actions need whole orders, not ids: two of them build their PDF
  // in the browser from the items and product names. With one page in memory
  // at a time, a row selected on page 1 would otherwise be unreachable from
  // page 2, so each selected row is kept here as it is ticked.
  const [selectedById, setSelectedById] = useState<Record<string, ShippingOrder>>({});
  const [isBulkBooking, setIsBulkBooking] = useState(false);
  const [isBulkBookDialogOpen, setIsBulkBookDialogOpen] = useState(false);
  const [isBulkSheetBookOpen, setIsBulkSheetBookOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isGeneratingPackingList, setIsGeneratingPackingList] = useState(false);
  const { data: allProductsData } = useGetProducts({ admin: "true", limit: "100" });
  const productsResponse = allProductsData as { data?: unknown[]; products?: unknown[] } | undefined;
  const storeProducts = (((productsResponse?.data || productsResponse?.products || []) as unknown) as Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    sku: string;
    variants?: unknown;
    colors?: Array<{ name: string; price: number | null }>;
    addOns?: Array<{ name: string; price: number; costPrice?: number }>;
    sizes?: string[];
    images?: string[];
    defaultVariantName?: string | null;
  }>).map((p) => ({
    ...p,
    variants: p.variants || p.colors,
  }));

  const [editingOrder, setEditingOrder] = useState<ShippingOrder | null>(null);
  const [newTotalAmount, setNewTotalAmount] = useState("");
  const [newShippingCost, setNewShippingCost] = useState("");
  const lastSubtotalRef = React.useRef<number | null>(null);
  const [editGuestName, setEditGuestName] = useState("");
  const [editGuestPhone, setEditGuestPhone] = useState("");
  const [editShippingAddress, setEditShippingAddress] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editingItems, setEditingItems] = useState<EditingItem[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);
  const [profitBreakdownOrder, setProfitBreakdownOrder] =
    useState<ShippingOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ShippingOrder | null>(null);
  const [refundTarget, setRefundTarget] = useState<ShippingOrder | null>(null);
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundRestock, setRefundRestock] = useState(true);
  // IP blocking (fraud control) targets, driven from the order action menu.
  const [blockIpTarget, setBlockIpTarget] = useState<ShippingOrder | null>(null);
  const [unblockIpTarget, setUnblockIpTarget] = useState<ShippingOrder | null>(null);

  const queryClient = useQueryClient();
  const bookCourier = useBookCourier();
  const bookToSheet = useBookToSheet();
  const bulkBookToSheet = useBulkBookToSheet();

  useEffect(() => {
    if (showBalance) {
      queryClient.invalidateQueries({ queryKey: ["steadfast-balance"] });
    }
  }, [showBalance, queryClient]);

  const rangeFilter = React.useMemo(() => {
    if (!fromStr) return undefined;
    try {
      const fromDate = parseISO(fromStr);
      const toDate = toStr ? parseISO(toStr) : fromDate;
      if (isNaN(fromDate.getTime())) return undefined;
      const validToDate = !isNaN(toDate.getTime()) ? toDate : fromDate;
      return {
        from: startOfDay(fromDate).toISOString(),
        to: endOfDay(validToDate).toISOString(),
      };
    } catch {
      return undefined;
    }
  }, [fromStr, toStr]);

  // Permission gates. ADMIN/MODERATOR keep full access (matches server routes);
  // otherwise fall back to the granular order permissions.
  const router = useRouter();
  const { data: cachedUser, isLoading: isUserLoading } = useCurrent();
  // The browser query cache can already hold the user when this Suspense subtree hydrates; the server never does.
  const hasMounted = useHasMounted();
  const currentUser = hasMounted ? cachedUser : undefined;
  const privileged =
    currentUser?.role === "ADMIN" || currentUser?.role === "MODERATOR";
  const permRead = privileged || can(currentUser ?? null, "orders", "read");
  const permWrite = privileged || can(currentUser ?? null, "orders", "write");
  const permCancel = privileged || can(currentUser ?? null, "orders", "cancel");
  const permRefund = privileged || can(currentUser ?? null, "orders", "refund");
  const permDelete = privileged || can(currentUser ?? null, "orders", "delete");
  const permBalance = privileged || can(currentUser ?? null, "orders", "balance");
  const permBlockIp = privileged || can(currentUser ?? null, "orders", "block_ip");

  // No read access → bounce to the dashboard instead of showing a broken
  // page that only fires 401s.
  React.useEffect(() => {
    if (!isUserLoading && currentUser && !permRead) {
      router.replace("/dashboard");
    }
  }, [isUserLoading, currentUser, permRead, router]);

  // Each distinct search value is its own React Query key, and the query
  // behind it scans the orders and users tables in full — an ILIKE on a
  // substring can never use an index. Typing a customer's name straight
  // through therefore fired one complete round trip per character. The input
  // below stays bound to `search` so it still responds instantly; only the
  // fetch waits for typing to pause. Seeded from `search` so a link arriving
  // with ?search= still queries on the first render rather than 300ms late.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Server-side paging. The table only ever holds one page now, which is why
  // everything below that used to reason over "all orders" — the bucket
  // filter, the tab counts, the bulk selection — had to move or be rebuilt.
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Any change to what is being filtered invalidates the page number: page 4
  // of the confirmed orders is rarely a page at all once you switch to
  // pending, and an out-of-range offset just returns nothing. Adjusted during
  // render against the previous filter rather than in an effect — React
  // re-runs this render before committing, where an effect would paint the
  // stale page first and then a second time to correct it.
  const filterKey = `${debouncedSearch}|${statusFilter}|${fromStr}|${toStr}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    if (pagination.pageIndex !== 0) setPagination({ ...pagination, pageIndex: 0 });
  }

  const { data: ordersResult, isLoading } = useOrders(debouncedSearch, rangeFilter, {
    enabled: permRead,
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    // The bucket is now resolved by the API, so this decides which rows come
    // back rather than which of them get shown.
    status: statusFilter,
  });
  const rawOrders = ordersResult?.orders;
  const totalOrders = ordersResult?.total ?? 0;
  const bucketCounts = ordersResult?.counts;
  const pageCount = Math.max(1, Math.ceil(totalOrders / pagination.pageSize));
  const { symbol: currencySymbol, formatAmount } = useCurrency();
  const { siteName, logoUrl, footerPhone } = useWebsiteSettings();
  const { data: settings } = useSettings();
  const { invoiceLanguage } = businessRulesFromSettings(settings);
  const { timezone } = useStoreProfile();

  // Read once into a local so the memo's dependency is exactly what it uses.
  const fbPagesSetting = settings?.pos_facebook_pages;
  const configuredFbPages: { id: string; name: string }[] = React.useMemo(() => {
    if (!fbPagesSetting) return [{ id: "default", name: siteName }];
    try {
      const parsed = JSON.parse(fbPagesSetting);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: "default", name: siteName }];
    } catch {
      return [{ id: "default", name: siteName }];
    }
  }, [fbPagesSetting, siteName]);

  const availableFacebookPages = React.useMemo(() => {
    const pageSet = new Set<string>();
    configuredFbPages.forEach((p) => {
      if (p.name?.trim()) pageSet.add(p.name.trim());
    });
    if (editReference && editReference.trim()) {
      pageSet.add(editReference.trim());
    }
    return Array.from(pageSet);
  }, [configuredFbPages, editReference]);

  const { updateOrder, cancelOrder, refundOrder, deleteOrder, bulkDeleteOrders } =
    useOrderMutations();
  const handleOpenEditOrder = (order: ShippingOrder) => {
    setEditingOrder(order);
    setEditGuestName(order.guestName || order.user?.name || "");
    setEditGuestPhone(order.guestPhone || order.user?.phone || "");
    setEditShippingAddress(order.shippingAddress || "");
    setEditReference(order.reference || "");
    setNewShippingCost(order.shippingCost.toString());
    setNewTotalAmount(order.totalAmount.toString());
    lastSubtotalRef.current = null;
    setSelectedProductToAdd("");

    const parsedItems: EditingItem[] = (order.items || []).map((item) => {
      const itemProductId = item.productId || item.product?.id;
      const catalogProduct = storeProducts.find((p) => p.id === itemProductId) || item.product;
      const availableVariants = normalizeProductVariants(catalogProduct?.variants);
      const availableSizes = catalogProduct?.sizes || [];
      const availableAddOns = catalogProduct?.addOns || [];
      const basePrice = catalogProduct?.price ?? item.price;

      const baseVariant = parseBaseVariantFromColor(item.color);
      const addOns = parseAddOnsFromColor(item.color, availableAddOns);
      const suggestedAddOnCost = calculateItemAddOnCost(item.color, availableAddOns);

      let itemBaseCost = "";
      if (item.costPrice !== null && item.costPrice !== undefined) {
        const remaining = Math.max(0, item.costPrice - suggestedAddOnCost);
        itemBaseCost = remaining > 0 ? remaining.toString() : (suggestedAddOnCost === 0 && item.costPrice > 0 ? item.costPrice.toString() : "");
      }

      return {
        id: item.id,
        productId: itemProductId,
        productName: catalogProduct?.name || item.product?.name || "Product",
        productSku: catalogProduct?.sku || item.product?.sku || "",
        productImage: catalogProduct?.images?.[0] || item.product?.images?.[0] || "",
        quantity: item.quantity || 1,
        price: item.price,
        costPrice: itemBaseCost,
        addOnCostPrice: suggestedAddOnCost > 0 ? suggestedAddOnCost.toString() : "",
        size: item.size || (availableSizes[0] || ""),
        selectedVariant: baseVariant || (availableVariants[0]?.name || ""),
        selectedAddOns: addOns,
        availableVariants,
        availableSizes,
        availableAddOns,
        basePrice,
      };
    });

    setEditingItems(parsedItems);
  };

  const handleItemProductChange = (index: number, newProductId: string) => {
    const newProduct = storeProducts.find((p) => p.id === newProductId);
    if (!newProduct) return;

    const availableVariants = normalizeProductVariants(newProduct.variants);
    const availableSizes = newProduct.sizes || [];
    const availableAddOns = newProduct.addOns || [];
    const basePrice = newProduct.price;

    const defaultVariant = newProduct.defaultVariantName || availableVariants[0]?.name || "";
    const matchedVariant = availableVariants.find((v) => v.name === defaultVariant);
    const initPrice = matchedVariant?.price ?? basePrice;

    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: newProduct.id,
        productName: newProduct.name,
        productSku: newProduct.sku,
        productImage: newProduct.images?.[0] || "",
        availableVariants,
        availableSizes,
        availableAddOns,
        basePrice,
        selectedVariant: defaultVariant,
        size: availableSizes[0] || "",
        selectedAddOns: {},
        price: initPrice,
        costPrice: "",
        addOnCostPrice: "",
      };
      return copy;
    });
  };

  const handleItemVariantChange = (index: number, variantName: string) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const matched = item.availableVariants.find((v) => v.name === variantName);
      const variantBasePrice = matched?.price ?? item.basePrice;

      const addOnsTotal = Object.entries(item.selectedAddOns).reduce((sum, [name, qty]) => {
        const a = item.availableAddOns.find((x) => x.name === name);
        return sum + (a ? a.price * qty : 0);
      }, 0);

      copy[index] = {
        ...item,
        selectedVariant: variantName,
        price: variantBasePrice + addOnsTotal,
      };
      return copy;
    });
  };

  const handleItemSizeChange = (index: number, newSize: string) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], size: newSize };
      return copy;
    });
  };

  const handleItemAddOnDelta = (index: number, addOnName: string, delta: number) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const currentCount = item.selectedAddOns[addOnName] || 0;
      const nextCount = Math.max(0, currentCount + delta);

      const nextAddOns = { ...item.selectedAddOns };
      if (nextCount > 0) {
        nextAddOns[addOnName] = nextCount;
      } else {
        delete nextAddOns[addOnName];
      }

      const matchedVariant = item.availableVariants.find((v) => v.name === item.selectedVariant);
      const variantBasePrice = matchedVariant?.price ?? item.basePrice;

      const addOnsTotal = Object.entries(nextAddOns).reduce((sum, [name, qty]) => {
        const a = item.availableAddOns.find((x) => x.name === name);
        return sum + (a ? a.price * qty : 0);
      }, 0);

      const suggestedAddOnCost = Object.entries(nextAddOns).reduce((sum, [name, qty]) => {
        const a = item.availableAddOns.find((x) => x.name === name);
        return sum + (a?.costPrice ? a.costPrice * qty : 0);
      }, 0);

      copy[index] = {
        ...item,
        selectedAddOns: nextAddOns,
        price: variantBasePrice + addOnsTotal,
        addOnCostPrice: suggestedAddOnCost > 0 ? suggestedAddOnCost.toString() : (item.addOnCostPrice || ""),
      };
      return copy;
    });
  };

  const handleItemQuantityDelta = (index: number, delta: number) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantity: Math.max(1, copy[index].quantity + delta),
      };
      return copy;
    });
  };

  const handleItemQuantitySet = (index: number, quantity: number) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantity: Math.max(1, quantity),
      };
      return copy;
    });
  };

  const handleItemPriceChange = (index: number, price: number) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], price: Math.max(0, price) };
      return copy;
    });
  };

  const handleItemCostChange = (index: number, costPrice: string) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], costPrice };
      return copy;
    });
  };

  const handleItemAddOnCostChange = (index: number, addOnCostPrice: string) => {
    setEditingItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], addOnCostPrice };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (editingItems.length <= 1) {
      toast.error("Order must contain at least one item");
      return;
    }
    setEditingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNewProduct = (productId: string) => {
    const newProduct = storeProducts.find((p) => p.id === productId);
    if (!newProduct) return;

    const availableVariants = normalizeProductVariants(newProduct.variants);
    const availableSizes = newProduct.sizes || [];
    const availableAddOns = newProduct.addOns || [];
    const basePrice = newProduct.price;

    const defaultVariant = newProduct.defaultVariantName || availableVariants[0]?.name || "";
    const matchedVariant = availableVariants.find((v) => v.name === defaultVariant);
    const initPrice = matchedVariant?.price ?? basePrice;

    const newItem: EditingItem = {
      productId: newProduct.id,
      productName: newProduct.name,
      productSku: newProduct.sku,
      productImage: newProduct.images?.[0] || "",
      quantity: 1,
      price: initPrice,
      costPrice: "",
      addOnCostPrice: "",
      size: availableSizes[0] || "",
      selectedVariant: defaultVariant,
      selectedAddOns: {},
      availableVariants,
      availableSizes,
      availableAddOns,
      basePrice,
    };

    setEditingItems((prev) => [...prev, newItem]);
    setSelectedProductToAdd("");
  };

  const editingSubtotal = React.useMemo(() => {
    return editingItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  }, [editingItems]);

  // Item edits must reach the saved total; delivery charge edits are the admin's cost and must not.
  React.useEffect(() => {
    if (!editingOrder) return;
    const prev = lastSubtotalRef.current;
    lastSubtotalRef.current = editingSubtotal;
    if (prev === null || prev === editingSubtotal) return;
    setNewTotalAmount((t) =>
      totalAfterSubtotalChange(parseFloat(t) || 0, prev, editingSubtotal).toString(),
    );
  }, [editingOrder, editingSubtotal]);

  const editingPayable = editingSubtotal + (editingOrder?.deliveryCharge ?? 0);

  const handleRecalculateTotal = () => {
    setNewTotalAmount(editingPayable.toString());
  };

  const handleSaveEditOrder = async () => {
    if (!editingOrder) return;

    if (editingItems.length === 0) {
      toast.error("Order must contain at least one item");
      return;
    }

    const totalAmount = parseFloat(newTotalAmount);
    if (isNaN(totalAmount) || totalAmount < 0) {
      toast.error("Please enter a valid total amount");
      return;
    }
    const shippingCost = parseFloat(newShippingCost);
    if (isNaN(shippingCost) || shippingCost < 0) {
      toast.error("Please enter a valid shipping cost");
      return;
    }

    if (!editShippingAddress.trim()) {
      toast.error("Shipping address is required");
      return;
    }

    const itemsToUpdate = editingItems.map((item) => {
      const selectedAddOnsSummary = Object.entries(item.selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([name, qty]) => {
          const addOn = item.availableAddOns.find((a) => a.name === name);
          return addOn ? `${name} x${qty} (${addOn.price} TK)` : `${name} x${qty}`;
        })
        .join(", ");

      let finalColor: string | null = null;
      if (item.selectedVariant) {
        finalColor = selectedAddOnsSummary ? `${item.selectedVariant} (+ ${selectedAddOnsSummary})` : item.selectedVariant;
      } else if (selectedAddOnsSummary) {
        finalColor = `Add-ons: ${selectedAddOnsSummary}`;
      }

      const parsedCost = (parseFloat(item.costPrice || "0") || 0) + (parseFloat(item.addOnCostPrice || "0") || 0);
      const finalCostPrice = item.costPrice !== "" || item.addOnCostPrice !== "" ? parsedCost : null;

      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        costPrice: finalCostPrice,
        size: item.size || null,
        color: finalColor,
      };
    });

    try {
      await updateOrder.mutateAsync({
        id: editingOrder.id,
        guestName: editGuestName.trim() || undefined,
        guestPhone: editGuestPhone.trim() || undefined,
        shippingAddress: editShippingAddress.trim(),
        reference: editReference.trim() || null,
        totalAmount,
        shippingCost,
        items: itemsToUpdate,
      });
      toast.success("Order updated successfully");
      setEditingOrder(null);
      setEditReference("");
    } catch (error) {
      toast.error("Failed to update order");
    }
  };

  // Blocked IPs decide whether an order's menu offers "Block" or "Unblock".
  const { data: blockedIpList } = useBlockedIps(permRead);
  const blockedIpSet = React.useMemo(
    () => new Set((blockedIpList ?? []).map((b) => b.ipAddress)),
    [blockedIpList],
  );
  const { blockIp, unblockIp } = useBlockIpMutations();
  const { data: balanceData, isLoading: isBalanceLoading } =
    useSteadfastBalance(showBalance && permBalance);
  const syncBatch = useSyncBatchOrderStatus();
  const trackSingleOrder = useTrackSingleOrder();
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  // Lives here, not in the table cell: a cell remounts on every table
  // re-render, which would close the dialog.
  const [fraudCheckPhone, setFraudCheckPhone] = useState<string | null>(null);
  const [isRefetchingSteadfast, setIsRefetchingSteadfast] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    orderNumber: false,
    reference: false,
    trackingNumber: false,
  });

  const handleRefreshAllSteadfast = async () => {
    setIsRefetchingSteadfast(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["steadfast-balance"] }),
      ]);
      const trackedOrders = orders?.filter(isTrackable) ?? [];
      if (trackedOrders.length > 0) {
        // The mutation's own onSuccess toast reports how many orders actually
        // changed, which is more useful than a blanket "done" message here.
        await syncBatch.mutateAsync(trackedOrders.map((o) => o.id));
      } else {
        toast.success("Steadfast statuses re-fetched successfully");
      }
    } catch (err) {
      toast.error("Failed to re-fetch status");
    } finally {
      setIsRefetchingSteadfast(false);
    }
  };

  const orders = rawOrders as ShippingOrder[] | undefined;

  // The courier's status now comes off the order row, recorded at the last
  // sync, instead of being refetched from Steadfast every time this page
  // loads — that fan-out was one API call per tracked, unfinished order, 47 of
  // them on the current data, to re-learn what had almost never changed.
  // "Refresh Steadfast" still fetches live on demand.
  //
  // Scoped exactly as the old fetch was: isTrackable decided which orders it
  // asked about, so anything outside it had no courier status then and must
  // have none now. The server reads the column under the same condition, so
  // the buckets below agree with the ones the API already filtered on.
  const courierStatusOf = (o: ShippingOrder) =>
    isTrackable(o) ? o.courierStatus ?? undefined : undefined;

  const handlePrint = async (
    order: Order,
    action: "print" | "download" = "print",
  ) => {
    try {
      // Load the PDF renderer on demand — it is far too heavy to ship in the
      // page bundle for a click-only feature.
      const [{ pdf }, { InvoicePDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/checkout/components/invoice-pdf"),
      ]);
      const consignmentId =
        (order.trackingNumber && /^\d+$/.test(order.trackingNumber)
          ? Number(order.trackingNumber)
          : null);

      const itemsSubtotal = (order.items || []).reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const placedOrderData: PlacedOrder = {
        orderNumber: order.orderNumber,
        subtotal: itemsSubtotal > 0 ? itemsSubtotal : order.subtotal,
        shippingCost: order.deliveryCharge,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod || "COD",
        trackingNumber: order.trackingNumber || null,
        consignmentId: consignmentId,
        items: order.items.map((i) => ({
          name: i.product.name,
          price: i.price,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          image: i.product.images?.[0] || null,
        })),
      };

      const shippingInfoData: ShippingInfo = {
        fullName: order.user?.name || order.guestName || "Customer",
        phone: order.user?.phone || order.guestPhone || "",
        email: order.user?.email || order.guestEmail || "",
        address: [
          order.shippingAddress,
          order.shippingCity,
          order.shippingState,
          order.shippingPostalCode,
          order.shippingCountry,
        ]
          .filter(Boolean)
          .join(", "),
        shippingZone: "inside_dhaka",
        notes: order.note ?? undefined,
      };

      const doc = (
        <InvoicePDF
          order={placedOrderData}
          shippingInfo={shippingInfoData}
          siteName={siteName}
          language={invoiceLanguage}
          timeZone={timezone}
          logoUrl={logoUrl}
          phoneNumber={footerPhone}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);

      if (action === "download") {
        const link = document.createElement("a");
        link.href = url;
        link.download = `Invoice-${order.orderNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Invoice downloaded successfully");
      } else {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
        };
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate invoice");
    }
  };

  const handleBulkPrint = async (action: "print" | "download" = "print") => {
    if (selectedOrders.length === 0) return;
    setIsBulkPrinting(true);
    try {
      const [{ pdf }, { BulkInvoicePDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/checkout/components/invoice-pdf"),
      ]);
      const ordersData = selectedOrders.map((order) => {
        const consignmentId =
          (order.trackingNumber && /^\d+$/.test(order.trackingNumber)
            ? Number(order.trackingNumber)
            : null);

        const itemsSubtotal = (order.items || []).reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const placedOrderData: PlacedOrder = {
          orderNumber: order.orderNumber,
          subtotal: itemsSubtotal > 0 ? itemsSubtotal : order.subtotal,
          shippingCost: order.deliveryCharge,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod || "COD",
          trackingNumber: order.trackingNumber || null,
          consignmentId: consignmentId,
          items: order.items.map((i) => ({
            name: i.product.name,
            price: i.price,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
            image: i.product.images?.[0] || null,
          })),
        };

        const shippingInfoData: ShippingInfo = {
          fullName: order.user?.name || order.guestName || "Customer",
          phone: order.user?.phone || order.guestPhone || "",
          email: order.user?.email || order.guestEmail || "",
          address: [
            order.shippingAddress,
            order.shippingCity,
            order.shippingState,
            order.shippingPostalCode,
            order.shippingCountry,
          ]
            .filter(Boolean)
            .join(", "),
          shippingZone: "inside_dhaka",
          notes: order.note ?? undefined,
        };

        return {
          order: placedOrderData,
          shippingInfo: shippingInfoData,
        };
      });

      const doc = (
        <BulkInvoicePDF
          orders={ordersData}
          siteName={siteName}
          language={invoiceLanguage}
          timeZone={timezone}
          logoUrl={logoUrl}
          phoneNumber={footerPhone}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);

      if (action === "download") {
        const link = document.createElement("a");
        link.href = url;
        // eslint-disable-next-line react-hooks/purity -- inside a click handler (handleBulkPrint), not render; Date.now() here just makes the downloaded filename unique.
        link.download = `Invoices-Bulk-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Bulk invoices downloaded successfully");
      } else {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
        };
      }
    } catch (error) {
      console.error("Bulk PDF generation failed:", error);
      toast.error("Failed to generate bulk invoices");
    } finally {
      setIsBulkPrinting(false);
    }
  };

  // Aggregates selected orders' items down to one row per unique product
  // (quantities summed across every selected order) so warehouse staff get a
  // single pick-list instead of working order-by-order.
  const handleDownloadPackingList = async () => {
    if (selectedOrders.length === 0) return;
    setIsGeneratingPackingList(true);
    try {
      const [{ pdf }, { PackingListPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/checkout/components/invoice-pdf"),
      ]);

      const quantityByProduct = new Map<
        string,
        { name: string; image: string | null; quantity: number }
      >();
      selectedOrders.forEach((order) => {
        order.items.forEach((item) => {
          const key = item.product?.id ?? "unknown";
          const existing = quantityByProduct.get(key);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            quantityByProduct.set(key, {
              name: item.product?.name || "Unknown Product",
              image: item.product?.images?.[0] || null,
              quantity: item.quantity,
            });
          }
        });
      });

      const items = Array.from(quantityByProduct.values()).sort(
        (a, b) => b.quantity - a.quantity,
      );

      const doc = (
        <PackingListPDF
          items={items}
          siteName={siteName}
          logoUrl={logoUrl}
          orderCount={selectedOrders.length}
          filterLabel={statusFilter === "TODAY" ? "Today Confirmed" : "Pending"}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Packing-List-${statusFilter}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Packing list downloaded successfully");
    } catch (error) {
      console.error("Packing list PDF generation failed:", error);
      toast.error("Failed to generate packing list");
    } finally {
      setIsGeneratingPackingList(false);
    }
  };

  const handleBulkDelete = () => {
    const ids = selectedOrders.map((o) => o.id);
    bulkDeleteOrders.mutate(ids, {
      onSuccess: () => {
        toast.success("Successfully deleted selected orders");
        clearSelection();
        setConfirmBulkDelete(false);
      },
      onError: (err: Error) => {
        toast.error(err.message || "Failed to delete selected orders");
      },
    });
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success("Phone number copied");
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const openOrderDetails = (order: ShippingOrder) => {
    setShowSourceDetails(false);
    setSelectedOrder({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        images: item.product.images || [],
      })),
      payment:
        order.payment === null
          ? undefined
          : {
            transactionId: order.payment?.transactionId ?? undefined,
            last4Digits: order.payment?.last4Digits ?? undefined,
          },
    });
  };

  const handleQuickTrack = (order: ShippingOrder) => {
    trackSingleOrder.mutate(order.id);
  };

  const getSteadfastDisplay = (order: ShippingOrder) => {
    if (!order.trackingNumber) return null;
    const sfStatus = courierStatusOf(order);
    if (!sfStatus) return null;
    return {
      status: sfStatus,
      label: STEADFAST_STATUS_LABELS[sfStatus] ?? sfStatus,
      color:
        STEADFAST_STATUS_COLORS[sfStatus] ??
        "bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700",
    };
  };

  const getPhone = (order: ShippingOrder) =>
    (order.user?.phone ?? order.guestPhone ?? "").replace(/\D/g, "");

  const isCancelled = (o: ShippingOrder) => {
    const sfStatus = courierStatusOf(o);
    return (
      o.status === "CANCELLED" ||
      sfStatus === "cancelled" ||
      sfStatus === "cancelled_approval_pending"
    );
  };

  const isReturned = (o: ShippingOrder) => {
    const sfStatus = courierStatusOf(o);
    return (
      o.status === "REFUNDED" ||
      (o.refundedAmount ?? 0) > 0 ||
      sfStatus === "returned" ||
      sfStatus === "partial-return" ||
      sfStatus === "not_delivered" ||
      sfStatus === "partial-not-delivered"
    );
  };

  const isDelivered = (o: ShippingOrder) => {
    if (isCancelled(o) || isReturned(o) || !hasBoughtPrice(o)) return false;
    const sfStatus = courierStatusOf(o);
    return (
      o.status === "DELIVERED" ||
      sfStatus === "delivered" ||
      sfStatus === "partial_delivered" ||
      sfStatus === "delivered_approval_pending" ||
      sfStatus === "partial_delivered_approval_pending"
    );
  };

  const hasBoughtPrice = (o: ShippingOrder) =>
    Boolean(o.items?.some((i) => i.costPrice !== null && i.costPrice !== undefined && Number(i.costPrice) > 0));

  const isConfirmed = (o: ShippingOrder) => {
    if (isCancelled(o) || isReturned(o)) return false;

    const isPosShowroom =
      o.saleType === "POS" &&
      (o.status === "DELIVERED" || o.shippingAddress?.includes("In-store pickup"));

    if (isPosShowroom) return true;

    // An order without Bought Price is not confirmed
    if (!hasBoughtPrice(o)) return false;

    if (o.confirmedAt) return true;

    const sfStatus = courierStatusOf(o);
    const isBookedInSteadfast = Boolean(o.trackingNumber);
    const isProcessingOrShipped =
      o.status === "PROCESSING" || o.status === "SHIPPED";
    const hasActiveSteadfastStatus = Boolean(
      sfStatus &&
      [
        "pending",
        "in_review",
        "hold",
        "fast-track",
        "hub-transfer",
        "office-delivery",
      ].includes(sfStatus),
    );

    return isBookedInSteadfast || isProcessingOrShipped || hasActiveSteadfastStatus;
  };

  const isPending = (o: ShippingOrder) => {
    if (isCancelled(o) || isReturned(o)) return false;
    return !hasBoughtPrice(o);
  };

  // The rows on screen are exactly what the API returned: it now resolves the
  // status buckets itself, so filtering again here would only shrink the page
  // below its own size.
  const filtered = orders;

  const selectedOrders = Object.values(selectedById);

  // Mirrors rowSelection exactly — anything unticked is dropped rather than
  // left behind to be acted on later — while filling in rows from the page in
  // view. Selections made on earlier pages survive because their orders are
  // already in the map.
  const handleRowSelectionChange = (updater: Updater<RowSelectionState>) => {
    const next = typeof updater === "function" ? updater(rowSelection) : updater;
    setRowSelection(next);
    setSelectedById((prev) => {
      const out: Record<string, ShippingOrder> = {};
      for (const [id, picked] of Object.entries(next)) {
        if (!picked) continue;
        const known = prev[id] ?? orders?.find((o) => o.id === id);
        if (known) out[id] = known;
      }
      return out;
    });
  };

  const clearSelection = () => {
    setRowSelection({});
    setSelectedById({});
  };

  const handleBulkBook = () => {
    if (selectedOrders.length === 0) return;
    setIsBulkBookDialogOpen(true);
  };

  const handleConfirmBulkBook = async (
    costPrices: { orderItemId: string; costPrice: number }[],
    shippingCosts: { orderId: string; shippingCost: number }[],
  ) => {
    setIsBulkBooking(true);
    setIsBulkBookDialogOpen(false);
    try {
      let successCount = 0;
      for (const order of selectedOrders) {
        if (order.trackingNumber) continue;
        const phone = (order.user?.phone ?? order.guestPhone ?? "")
          .replace(/\D/g, "")
          .slice(0, 11);
        if (phone.length === 11) {
          // If this order's shipping cost was edited, update it in the DB first!
          const orderShipCostObj = shippingCosts.find(
            (s) => s.orderId === order.id,
          );
          if (
            orderShipCostObj &&
            orderShipCostObj.shippingCost !== order.shippingCost
          ) {
            await updateOrder.mutateAsync({
              id: order.id,
              shippingCost: orderShipCostObj.shippingCost,
            });
          }

          // filter the costPrices for this specific order
          const orderItemIds = order.items.map((i) => i.id);
          const orderCostPrices = costPrices.filter((c) =>
            orderItemIds.includes(c.orderItemId),
          );

          await bookCourier.mutateAsync({
            orderId: order.id,
            recipient_phone: phone,
            costPrices:
              orderCostPrices.length > 0 ? orderCostPrices : undefined,
          });
          successCount++;
        }
      }
      if (successCount > 0) {
        toast.success(`Successfully booked ${successCount} orders`);
        clearSelection();
      } else {
        toast.error(
          "No selected orders could be booked (invalid phone or already booked)",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete booking for some orders",
      );
    } finally {
      setIsBulkBooking(false);
    }
  };

  const handleBulkBookToSheet = () => {
    setIsBulkSheetBookOpen(false);
    // Always (re-)book everything selected, even orders already marked
    // sheetBookedAt — the sheet is an external file the admin can edit or
    // delete rows from at any time, so that flag can't be trusted to mean
    // "still present in the sheet." Blocking on it just traps the admin
    // when they need to restore a manually-deleted row.
    const orderIds = selectedOrders.map((o) => o.id);
    bulkBookToSheet.mutate(
      { orderIds },
      {
        onSuccess: () => {
          toast.success(`Booked ${orderIds.length} orders to Google Sheet`);
          clearSelection();
        },
        onError: (err: Error) => {
          toast.error(err.message || "Failed to book to Google Sheet");
        },
      },
    );
  };

  // Counted by the database across the whole search, not by the browser across
  // one page — otherwise every tab would report the size of whatever page you
  // happened to be looking at.
  const todayCount = bucketCounts?.today ?? 0;
  const pendingCount = bucketCounts?.pending ?? 0;
  const confirmedCount = bucketCounts?.confirmed ?? 0;
  const deliveredCount = bucketCounts?.delivered ?? 0;
  const cancelledCount = bucketCounts?.cancelled ?? 0;
  const returnedCount = bucketCounts?.returned ?? 0;
  const allCount =
    bucketCounts?.all != null && Number(bucketCounts.all) > 0
      ? Number(bucketCounts.all)
      : (pendingCount + confirmedCount + deliveredCount + cancelledCount + returnedCount) ||
      (statusFilter === "ALL" ? totalOrders : 0);

  const columns: ColumnDef<ShippingOrder>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(value) =>
            table.toggleAllPageRowsSelected(!!value.target.checked)
          }
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={row.getIsSelected()}
          onChange={(value) => row.toggleSelected(!!value.target.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          {row.original.orderNumber}
        </span>
      ),
      enableHiding: true,
    },
    {
      id: "saleType",
      header: "Type",
      cell: ({ row }) => {
        const order = row.original;
        const type = order.saleType;
        // Landing-source attribution only makes sense for a website order —
        // a POS sale has no browser landing to attribute.
        const isWebsiteOrder = type !== "POS";
        const source = order.landingSource as LandingSource | null | undefined;
        const sourceDisplay = isWebsiteOrder && source ? LANDING_SOURCE_DISPLAY[source] : undefined;

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge
              variant="outline"
              className={
                type === "POS"
                  ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
              }
            >
              {type || "WEBSITE"}
            </Badge>
            {type === "POS" && order.reference && (
              <span
                className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1 max-w-[130px] truncate"
                title={order.reference}
              >
                <svg className="w-2.5 h-2.5 fill-[#1877F2] shrink-0" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="truncate">{order.reference}</span>
              </span>
            )}
            {sourceDisplay && (
              <Badge variant="outline" className={cn("w-fit text-xs border-none", sourceDisplay.className)}>
                <sourceDisplay.icon className="h-3 w-3 mr-1 shrink-0" />
                {LANDING_SOURCE_LABELS[source as LandingSource]}
              </Badge>
            )}
            {order.paymentMethod === "BKASH" && (
              <Image
                src="/bkash-logo.png"
                alt="bKash"
                title="bKash"
                width={20}
                height={20}
                className="h-5 w-5 rounded"
              />
            )}
          </div>
        );
      },
    },
    {
      id: "reference",
      header: "Facebook Page",
      cell: ({ row }) => {
        const ref = row.original.reference;
        return ref ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
            {ref}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      enableHiding: true,
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const order = row.original;
        const phone = getPhone(order);
        const hasNotes = !!order.note;
        const isWebsiteOrder = order.saleType !== "POS";
        const orderIsCancelled = isCancelled(order);
        const orderIsReturned = isReturned(order);

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {order.user?.name ?? order.guestName ?? "Guest"}
              </span>
              {hasNotes && (
                <span title={order.note ?? ""}>
                  <FileText className="h-3 w-3 text-muted-foreground" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{order.user?.email ?? order.guestPhone ?? "-"}</span>
              {phone && phone.length >= 11 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPhone(phone);
                  }}
                  className="ml-0.5 hover:text-foreground transition-colors"
                  title="Copy phone number"
                >
                  {copiedPhone === phone ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
            {(permRefund || permDelete || permBlockIp || !!phone) && (
              <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                {!!phone && (
                  <Button
                    type="button"
                    onClick={() => setFraudCheckPhone(phone)}
                    className="h-7 w-7 p-0 shrink-0 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-none transition-transform active:scale-95"
                    title="Fraud check — courier delivery history"
                  >
                    <UserSearch className="h-3.5 w-3.5" />
                  </Button>
                )}
                {permRefund && (
                  <Button
                    type="button"
                    onClick={() => handleOpenEditOrder(order)}
                    className="h-7 w-7 p-0 shrink-0 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-none transition-transform active:scale-95"
                    title="Edit Order"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {permDelete && (
                  <Button
                    type="button"
                    onClick={() => setDeleteOrderId(order.id)}
                    disabled={deleteOrder.isPending && deleteOrderId === order.id}
                    className="h-7 w-7 p-0 shrink-0 rounded-md bg-rose-600 hover:bg-rose-700 text-white shadow-none transition-transform active:scale-95"
                    title="Delete Order"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {permBlockIp && !!order.ipAddress && (
                  blockedIpSet.has(order.ipAddress) ? (
                    <Button
                      type="button"
                      onClick={() => setUnblockIpTarget(order)}
                      className="h-7 w-7 p-0 shrink-0 rounded-md bg-amber-600 hover:bg-amber-700 text-white shadow-none transition-transform active:scale-95"
                      title="Unblock Customer IP"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setBlockIpTarget(order)}
                      className="h-7 w-7 p-0 shrink-0 rounded-md bg-slate-700 hover:bg-slate-800 text-white shadow-none transition-transform active:scale-95"
                      title="Block Customer IP"
                    >
                      <ShieldBan className="h-3.5 w-3.5" />
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => {
        const confirmedAt = row.original.confirmedAt;
        return (
          <div className="whitespace-nowrap">
            <div className="text-sm font-medium">
              {new Date(row.original.createdAt)
                .toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", year: "2-digit", month: "2-digit", day: "2-digit" })
                .replace(/\//g, "-")}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(row.original.createdAt).toLocaleTimeString("en-US", {
                timeZone: "Asia/Dhaka",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
            {confirmedAt && (
              <div
                className="mt-1 pt-0.5 border-t border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                title={`Confirmed: ${new Date(confirmedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}`}
              >
                <div className="text-xs font-semibold flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {new Date(confirmedAt)
                    .toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", year: "2-digit", month: "2-digit", day: "2-digit" })
                    .replace(/\//g, "-")}
                </div>
                <div className="text-[10px] pl-2.5 text-emerald-600/80 dark:text-emerald-400/80">
                  {new Date(confirmedAt).toLocaleTimeString("en-US", {
                    timeZone: "Asia/Dhaka",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => <span>{formatAmount(row.original.totalAmount)}</span>,
    },
    {
      id: "boughtPrice",
      header: "Bought Price",
      cell: ({ row }) => {
        const order = row.original;
        const hasCostData = order.items.some(
          (i) => i.costPrice !== null && i.costPrice !== undefined,
        );
        if (!hasCostData) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return <span>{formatAmount(orderBoughtPrice(order))}</span>;
      },
    },
    {
      accessorKey: "shippingCost",
      header: "Charge",
      cell: ({ row }) => <span>{formatAmount(row.original.shippingCost)}</span>,
    },
    {
      id: "profit",
      header: "Profit",
      cell: ({ row }) => {
        const order = row.original;
        const profit = orderProfit(order);
        const hasCostData = order.items.some(
          (i) => i.costPrice !== null && i.costPrice !== undefined,
        );
        if (!hasCostData) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setProfitBreakdownOrder(order);
            }}
            className={cn(
              "font-medium text-sm hover:underline cursor-pointer",
              profit >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {profit >= 0 ? "+" : ""}
            {formatAmount(profit)}
          </button>
        );
      },
    },
    {
      accessorKey: "trackingNumber",
      header: "Tracking #",
      enableHiding: true,
      cell: ({ row }) => {
        const order = row.original;
        const trk = order.trackingNumber;
        if (!trk) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <a
            href={`https://steadfast.com.bd/t/${trk}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-sm text-green-600 dark:text-green-400 hover:underline"
            title="Open Steadfast tracking page"
          >
            {trk}
          </a>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const order = row.original;
        const sfDisplay = getSteadfastDisplay(order);
        if (sfDisplay) {
          return (
            <Badge
              variant="outline"
              className={cn("w-fit text-xs border", sfDisplay.color)}
            >
              <Truck className="h-3 w-3 mr-1 shrink-0" />
              {sfDisplay.label}
            </Badge>
          );
        }
        return (
          <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const order = row.original;
        const orderIsCancelled = isCancelled(order);
        const orderIsReturned = isReturned(order);
        const orderIsDelivered = isDelivered(order);
        const orderIsConfirmed = isConfirmed(order);
        const orderIsPending = isPending(order);

        const canBook =
          statusFilter !== "TODAY" &&
          !order.trackingNumber &&
          orderIsPending &&
          !(
            order.saleType === "POS" &&
            order.shippingAddress?.includes("In-store pickup")
          );

        const canCancel =
          !orderIsCancelled && !orderIsReturned && !orderIsDelivered;

        const canRefund =
          orderIsDelivered &&
          (order.refundedAmount ?? 0) < order.totalAmount;

        const isWebsiteOrder = order.saleType !== "POS";

        return (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handlePrint(order)}
              className="gap-2"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openOrderDetails(order)}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handlePrint(order, "download")}
                >
                  Download Invoice
                </DropdownMenuItem>
                {canBook && permWrite && (
                  <DropdownMenuItem onClick={() => setCourierOrder(order)}>
                    Book Courier (Steadfast)
                  </DropdownMenuItem>
                )}
                {permWrite && (
                  <DropdownMenuItem
                    onClick={() =>
                      bookToSheet.mutate(
                        { orderId: order.id },
                        {
                          onSuccess: () =>
                            toast.success(
                              `${order.orderNumber} booked to Google Sheet`,
                            ),
                          onError: (err: Error) => {
                            toast.error(
                              err.message || "Failed to book to Google Sheet",
                            );
                          },
                        },
                      )
                    }
                  >
                    {order.sheetBookedAt ? "Re-book to Google Sheet" : "Book to Google Sheet"}
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => setLogDetailsOrder(order)}>
                  <History className="h-4 w-4 mr-2" />
                  Log Details
                </DropdownMenuItem>
                {order.note && (
                  <DropdownMenuItem
                    onClick={() => {
                      toast.info(order.note ?? "No notes", {
                        description: `Note for ${order.orderNumber}`,
                      });
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Note
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {canCancel && permCancel && (
                  <DropdownMenuItem
                    onClick={() => setCancelTarget(order)}
                    className="text-orange-600 focus:text-orange-600"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel Order
                  </DropdownMenuItem>
                )}
                {canRefund && permRefund && (
                  <DropdownMenuItem onClick={() => openRefundDialog(order)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {(order.refundedAmount ?? 0) > 0
                      ? "Refund More"
                      : "Refund Order"}
                  </DropdownMenuItem>
                )}

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelOrder.mutate(
      { id: cancelTarget.id, restock: true },
      {
        onSuccess: () => {
          toast.success("Order cancelled and items restocked");
          setCancelTarget(null);
        },
        onError: (err: Error) => {
          toast.error(err.message || "Failed to cancel order");
        },
      },
    );
  };

  const handleBlockIp = () => {
    const target = blockIpTarget;
    if (!target?.ipAddress) return;
    blockIp.mutate(
      {
        ipAddress: target.ipAddress,
        reason: `Fake order ${target.orderNumber}`,
        orderId: target.id,
      },
      {
        onSuccess: () => {
          toast.success(`IP ${target.ipAddress} blocked from placing orders`);
          setBlockIpTarget(null);
        },
        onError: (err: Error) => toast.error(err.message || "Failed to block IP"),
      },
    );
  };

  const handleUnblockIp = () => {
    const target = unblockIpTarget;
    if (!target?.ipAddress) return;
    unblockIp.mutate(target.ipAddress, {
      onSuccess: () => {
        toast.success(`IP ${target.ipAddress} unblocked`);
        setUnblockIpTarget(null);
      },
      onError: (err: Error) => toast.error(err.message || "Failed to unblock IP"),
    });
  };

  const refundRemaining = (order: ShippingOrder) =>
    Math.round((order.totalAmount - (order.refundedAmount ?? 0)) * 100) / 100;

  const openRefundDialog = (order: ShippingOrder) => {
    setRefundTarget(order);
    setRefundMode("full");
    setRefundAmount(refundRemaining(order).toString());
    setRefundReason("");
    setRefundRestock(true);
  };

  const handleRefund = () => {
    if (!refundTarget) return;
    const remaining = refundRemaining(refundTarget);
    const amount =
      refundMode === "full" ? remaining : parseFloat(refundAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    if (amount > remaining + 0.005) {
      toast.error(`Refund cannot exceed ${formatAmount(remaining)}`);
      return;
    }

    refundOrder.mutate(
      {
        id: refundTarget.id,
        amount,
        reason: refundReason.trim() || undefined,
        restock: refundRestock,
      },
      {
        onSuccess: () => {
          toast.success("Refund processed successfully");
          setRefundTarget(null);
        },
        onError: (err: Error) => {
          toast.error(err.message || "Failed to process refund");
        },
      },
    );
  };

  if (!mounted) {
    return (
      <div className="flex-1 space-y-1.5 sm:space-y-4 p-1.5 sm:p-4 md:p-8 pt-1.5 sm:pt-4 md:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 w-36 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-10 w-full max-w-xl bg-muted animate-pulse rounded-full" />
        <div className="h-96 w-full bg-muted animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-1.5 sm:space-y-4 p-1.5 sm:p-4 md:p-8 pt-1.5 sm:pt-4 md:pt-6 animate-in fade-in duration-300">
      <div className="flex flex-col items-end sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="hidden sm:block text-2xl font-bold">Order Management</h1>

        {permBalance && (
          <div
            onClick={() => setShowBalance(!showBalance)}
            className="relative flex items-center h-9 w-[150px] sm:h-10 sm:w-[180px] lg:h-12 rounded-full border border-[#00bfa5] bg-white dark:bg-slate-900 select-none cursor-pointer transition-all duration-200 overflow-hidden"
          >
            {/* Sliding indicator */}
            <div
              className={cn(
                "absolute top-[3px] left-[3px] h-[30px] w-[30px] sm:top-[3px] sm:left-[3px] sm:h-[34px] sm:w-[34px] lg:top-[4px] lg:left-[4px] lg:h-[38px] lg:w-[38px] rounded-full bg-white dark:bg-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center transition-all duration-300 ease-out z-10",
                showBalance ? "translate-x-[114px] sm:translate-x-[178px] lg:translate-x-[254px]" : "translate-x-0",
              )}
            >
              <Pointer className="h-[14px] w-[14px] sm:h-[16px] sm:w-[16px] lg:h-[18px] lg:w-[18px] text-[#00bfa5] -rotate-[15deg]" />
            </div>

            {/* Balance Amount (Slide in from left) */}
            <div
              className={cn(
                "absolute left-[12px] sm:left-[14px] lg:left-[16px] transition-all duration-300 ease-out pr-[40px] sm:pr-[44px] lg:pr-[50px] truncate",
                showBalance
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-4 pointer-events-none",
              )}
            >
              {isBalanceLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#00bfa5]" />
              ) : (
                <span className="text-xs sm:text-sm font-semibold text-[#00bfa5] tracking-wide whitespace-nowrap">
                  {currencySymbol}
                  {balanceData
                    ? Number(balanceData.current_balance).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )
                    : "0.00"}
                </span>
              )}
            </div>

            {/* "Check Balance" label */}
            <div
              className={cn(
                "absolute right-[18px] sm:right-[20px] lg:right-[24px] transition-all duration-300 ease-out",
                showBalance
                  ? "opacity-0 translate-x-4 pointer-events-none"
                  : "opacity-100 translate-x-0",
              )}
            >
              <span className="text-xs sm:text-sm font-semibold text-[#00bfa5] tracking-wide whitespace-nowrap">
                Check Balance
              </span>
            </div>
          </div>
        )}
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        className="w-full"
      >
        <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
          <TabsList className="inline-flex flex-nowrap items-center h-10 w-max sm:w-fit gap-1 bg-slate-200 dark:bg-card p-1 rounded-full border-none shadow-none">
            <TabsTrigger
              value="ALL"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
            >
              All ({allCount})
            </TabsTrigger>
            <TabsTrigger
              value="TODAY"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
            >
              Today Confirmed ({todayCount})
            </TabsTrigger>
            <TabsTrigger
              value="PENDING"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none flex items-center gap-1.5"
            >
              {STATUS_DOTS.PENDING}
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger
              value="CONFIRMED"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none flex items-center gap-1.5"
            >
              {STATUS_DOTS.PROCESSING}
              Confirmed ({confirmedCount})
            </TabsTrigger>
            <TabsTrigger
              value="DELIVERED"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none flex items-center gap-1.5"
            >
              {STATUS_DOTS.DELIVERED}
              Delivered ({deliveredCount})
            </TabsTrigger>
            <TabsTrigger
              value="CANCELLED"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none flex items-center gap-1.5"
            >
              {STATUS_DOTS.CANCELLED}
              Cancelled ({cancelledCount})
            </TabsTrigger>
            <TabsTrigger
              value="RETURNED"
              className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none flex items-center gap-1.5"
            >
              {STATUS_DOTS.REFUNDED}
              Returned ({returnedCount})
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      <div className="rounded-3xl bg-white dark:bg-card p-1.5 sm:p-6 border-none shadow-none space-y-1.5 sm:space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {/* Row 1 (mobile): Search + mobile-only refresh icon */}
          <div className="flex items-center gap-2 sm:contents">
            <div className="relative flex-1 min-w-[140px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-full text-xs font-semibold"
              />
            </div>
            {permWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshAllSteadfast}
                disabled={isRefetchingSteadfast}
                className="sm:hidden rounded-full p-2 shrink-0 text-xs font-semibold border bg-slate-50 dark:bg-muted/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                title="Refresh Steadfast"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefetchingSteadfast && "animate-spin")} />
              </Button>
            )}
          </div>
          {/* Row 2 (mobile): filters + date + columns + bulk actions */}
          <div className="flex items-center justify-end gap-2 flex-wrap sm:contents">
            {(statusFilter !== "ALL" || search !== "" || dateRange !== undefined) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearch("");
                  setDateRange(undefined);
                }}
                className="hidden sm:inline-flex shrink-0 gap-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border-none"
              >
                <FilterX className="h-3.5 w-3.5" />
                Clear filter
              </Button>
            )}
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
            {permWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshAllSteadfast}
                disabled={isRefetchingSteadfast}
                className="hidden sm:inline-flex rounded-full gap-2 shrink-0 text-xs font-semibold border bg-slate-50 dark:bg-muted/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                title="Refresh Steadfast"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefetchingSteadfast && "animate-spin")} />
                <span className="hidden sm:inline">Refresh Steadfast</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 rounded-full text-xs font-semibold h-8 px-3 bg-slate-50 dark:bg-muted/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 shrink-0"
              >
                Columns <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                {Object.keys(columnVisibility).map((colId) => (
                  <DropdownMenuCheckboxItem
                    key={colId}
                    className="capitalize text-xs font-medium"
                    checked={!columnVisibility[colId]}
                    onCheckedChange={(value) =>
                      setColumnVisibility((prev) => ({ ...prev, [colId]: !value }))
                    }
                  >
                    {colId === "reference"
                      ? "Facebook Page"
                      : colId === "orderNumber"
                      ? "Order Number"
                      : colId === "trackingNumber"
                      ? "Tracking Number"
                      : colId}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {permWrite &&
              statusFilter === "PENDING" &&
              selectedOrders.length > 0 && (
                <Button
                  type="button"
                  onClick={handleBulkBook}
                  disabled={isBulkBooking}
                  className="gap-2 shrink-0 rounded-full text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700"
                >
                  {isBulkBooking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Truck className="h-3.5 w-3.5" />
                  )}
                  Book ({selectedOrders.length})
                </Button>
              )}
            {selectedOrders.length > 0 && (
              <Button
                type="button"
                onClick={() => handleBulkPrint("print")}
                disabled={isBulkPrinting}
                className="gap-2 shrink-0 rounded-full text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600"
              >
                {isBulkPrinting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                Print ({selectedOrders.length})
              </Button>
            )}
            {permWrite && selectedOrders.length > 0 && (
              <Button
                type="button"
                onClick={() => setIsBulkSheetBookOpen(true)}
                disabled={bulkBookToSheet.isPending}
                className="gap-2 shrink-0 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {bulkBookToSheet.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SheetIcon className="h-3.5 w-3.5" />
                )}
                Sheet ({selectedOrders.length})
              </Button>
            )}
            {statusFilter === "PENDING" &&
              selectedOrders.length > 0 && (
                <Button
                  type="button"
                  onClick={handleDownloadPackingList}
                  disabled={isGeneratingPackingList}
                  className="gap-2 shrink-0 rounded-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
                >
                  {isGeneratingPackingList ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Package className="h-3.5 w-3.5" />
                  )}
                  Package ({selectedOrders.length})
                </Button>
              )}
            {permDelete && statusFilter !== "TODAY" && selectedOrders.length > 0 && (
              <Button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                disabled={bulkDeleteOrders.isPending}
                className="gap-2 shrink-0 rounded-full text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
              >
                {bulkDeleteOrders.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash className="h-3.5 w-3.5" />
                )}
                Delete ({selectedOrders.length})
              </Button>
            )}
            {statusFilter !== "TODAY" && selectedOrders.filter(isTrackable).length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tracked = selectedOrders.filter(isTrackable);
                  syncBatch.mutate(tracked.map((o) => o.id));
                }}
                disabled={syncBatch.isPending}
                className="rounded-full gap-1 shrink-0 text-xs font-semibold border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
              >
                {syncBatch.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sync Tracked (
                {selectedOrders.filter(isTrackable).length})
              </Button>
            )}
          </div>
        </div>


        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered || []}
            onRowClick={openOrderDetails}
            hideToolbar
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={(updater) => {
              setColumnVisibility((prev) =>
                typeof updater === "function" ? updater(prev) : updater
              );
            }}
            rowSelection={rowSelection}
            onRowSelectionChange={handleRowSelectionChange}
            getRowId={(order) => order.id}
            manualPagination
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
          />
        )}
      </div>

      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setShowAllOrderItems(false);
            setActivityOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-border/60 pr-8">
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Order Details - {selectedOrder.orderNumber}
                </DialogTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActivityOpen(true)}
                  className="gap-2 text-xs h-8 shadow-xs font-medium cursor-pointer shrink-0"
                >
                  <History className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Activity Log
                </Button>
              </DialogHeader>

              <div className="space-y-6 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Shipping Information</h3>
                    <div className="text-sm space-y-0.5">
                      <p className="font-medium">
                        {selectedOrder.user?.name ??
                          selectedOrder.guestName ??
                          "Guest"}
                      </p>
                      {(selectedOrder.user?.phone ??
                        selectedOrder.guestPhone) && (
                          <p className="text-muted-foreground">
                            {selectedOrder.user?.phone ??
                              selectedOrder.guestPhone}
                          </p>
                        )}
                      <p className="text-slate-600 dark:text-slate-400">{selectedOrder.shippingAddress}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Payment Information</h3>
                    <div className="text-sm space-y-0.5">
                      <p><span className="text-muted-foreground">Method:</span> <span className="font-medium">{selectedOrder.paymentMethod}</span></p>
                      <p><span className="text-muted-foreground">Status:</span> <span className="font-medium">{selectedOrder.paymentStatus}</span></p>
                      {selectedOrder.payment?.transactionId && (
                        <p className="text-muted-foreground truncate" title={selectedOrder.payment.transactionId}>
                          TxID: {selectedOrder.payment.transactionId}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Device & Network Info
                    </h3>
                    <div className="text-sm space-y-1">
                      <p className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span className="text-muted-foreground font-normal">IP:</span>{" "}
                        <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{selectedOrder.ipAddress || "N/A"}</span>
                      </p>
                      <p className="flex items-center gap-1">
                        <span className="text-muted-foreground font-normal">OS:</span>{" "}
                        <span className="font-medium">{selectedOrder.deviceOs || "Unknown OS"}</span>
                      </p>
                      <p className="flex items-center gap-1">
                        <span className="text-muted-foreground font-normal">Browser:</span>{" "}
                        <span className="font-medium">{selectedOrder.browserName || "Unknown Browser"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      Traffic Source
                    </h3>
                    <div className="text-sm space-y-1">
                      {selectedOrder.saleType === "POS" ? (
                        <Badge
                          variant="outline"
                          className="w-fit text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400"
                        >
                          POS Sale
                        </Badge>
                      ) : selectedOrder.landingSource &&
                        LANDING_SOURCE_DISPLAY[selectedOrder.landingSource as LandingSource] ? (
                        (() => {
                          const source = selectedOrder.landingSource as LandingSource;
                          const { icon: Icon, className } = LANDING_SOURCE_DISPLAY[source];
                          const hasDetails = !!(selectedOrder.utmSource || selectedOrder.utmMedium || selectedOrder.utmCampaign || selectedOrder.gclid || selectedOrder.fbc || selectedOrder.landingReferrer);
                          return (
                            <button
                              type="button"
                              onClick={() => hasDetails && setShowSourceDetails((v) => !v)}
                              disabled={!hasDetails}
                              className="inline-flex"
                              title={hasDetails ? "Click for source details" : undefined}
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-fit text-xs border-none",
                                  className,
                                  hasDetails && "cursor-pointer hover:opacity-80",
                                )}
                              >
                                <Icon className="h-3 w-3 mr-1 shrink-0" />
                                {LANDING_SOURCE_LABELS[source]}
                                {hasDetails && (
                                  showSourceDetails
                                    ? <ChevronUp className="h-3 w-3 ml-1 shrink-0" />
                                    : <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                                )}
                              </Badge>
                            </button>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          No data (order placed before tracking was added)
                        </span>
                      )}

                      {showSourceDetails && (selectedOrder.utmSource || selectedOrder.utmMedium || selectedOrder.utmCampaign || selectedOrder.gclid || selectedOrder.fbc || selectedOrder.landingReferrer) && (
                        <div className="mt-1.5 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs space-y-1">
                          {selectedOrder.utmSource && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-muted-foreground shrink-0 w-24">UTM Source:</span>
                              <span className="font-medium break-all">{selectedOrder.utmSource}</span>
                            </div>
                          )}
                          {selectedOrder.utmMedium && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-muted-foreground shrink-0 w-24">UTM Medium:</span>
                              <span className="font-medium break-all">{selectedOrder.utmMedium}</span>
                            </div>
                          )}
                          {selectedOrder.utmCampaign && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-muted-foreground shrink-0 w-24">UTM Campaign:</span>
                              <span className="font-medium break-all">{selectedOrder.utmCampaign}</span>
                            </div>
                          )}
                          {selectedOrder.gclid && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-muted-foreground shrink-0 w-24">Google Click ID:</span>
                              <span className="font-mono break-all">{selectedOrder.gclid}</span>
                            </div>
                          )}
                          {selectedOrder.fbc && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-muted-foreground shrink-0 w-24">Meta Click ID:</span>
                              <span className="font-mono break-all">{selectedOrder.fbc}</span>
                            </div>
                          )}
                          {selectedOrder.landingReferrer && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-muted-foreground shrink-0 w-24">Referrer:</span>
                              <a
                                href={selectedOrder.landingReferrer}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                              >
                                {selectedOrder.landingReferrer}
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedOrder.trackingNumber && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <Truck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">Steadfast Tracking: </span>
                      <span className="font-mono">
                        {selectedOrder.trackingNumber}
                      </span>
                    </div>
                    {courierStatusOf(selectedOrder) && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto text-xs border",
                          STEADFAST_STATUS_COLORS[courierStatusOf(selectedOrder)!] ?? "",
                        )}
                      >
                        {STEADFAST_STATUS_LABELS[courierStatusOf(selectedOrder)!] ??
                          courierStatusOf(selectedOrder)}
                      </Badge>
                    )}
                  </div>
                )}

                {selectedOrder.note && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <FileText className="h-4 w-4" />
                      Note
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.note}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-4">
                  Order Items ({selectedOrder.items.length})
                </h3>
                <div className="space-y-2">
                  {(showAllOrderItems
                    ? selectedOrder.items
                    : selectedOrder.items.slice(0, 1)
                  ).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-muted/25 rounded-xl text-xs"
                    >
                      {item.product.images?.[0] && (
                        <Image
                          src={item.product.images[0]}
                          alt={item.product.name}
                          width={48}
                          height={48}
                          className="rounded-lg object-cover border shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" title={item.product.name}>
                          {item.product.name}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          Qty: {item.quantity} &times; {formatAmount(item.price)}
                          {item.size && ` · Size: ${item.size}`}
                          {item.color && ` · Color: ${item.color}`}
                        </p>
                      </div>
                      <div className="font-bold text-sm">
                        {formatAmount(item.quantity * item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.items.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowAllOrderItems((prev) => !prev)}
                >
                  {showAllOrderItems ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show {selectedOrder.items.length - 1} more{" "}
                      {selectedOrder.items.length - 1 === 1 ? "item" : "items"}
                    </>
                  )}
                </Button>
              )}

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatAmount(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charge:</span>
                  <span>{formatAmount(selectedOrder.deliveryCharge)}</span>
                </div>
                {orderDiscount(selectedOrder) !== 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>{orderDiscount(selectedOrder) > 0 ? "Discount:" : "Extra Charge:"}</span>
                    <span>
                      {orderDiscount(selectedOrder) > 0 ? "-" : "+"}
                      {formatAmount(Math.abs(orderDiscount(selectedOrder)))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{formatAmount(selectedOrder.totalAmount)}</span>
                </div>
                {(selectedOrder.refundedAmount ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>
                        Refunded
                        {selectedOrder.refundReason
                          ? ` — ${selectedOrder.refundReason}`
                          : ""}
                        :
                      </span>
                      <span>
                        -{formatAmount(selectedOrder.refundedAmount ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t">
                      <span>Net received:</span>
                      <span>
                        {formatAmount(
                          selectedOrder.totalAmount -
                          (selectedOrder.refundedAmount ?? 0),
                        )}
                      </span>
                    </div>
                  </>
                )}
                {(() => {
                  const profit = orderProfit(selectedOrder);
                  const hasCostData = selectedOrder.items.some(
                    (i) => i.costPrice !== null && i.costPrice !== undefined,
                  );
                  if (!hasCostData) return null;
                  return (
                    <>
                      <div className="flex justify-between text-muted-foreground pt-1 border-t">
                        <span>Total Bought Price:</span>
                        <span>{formatAmount(orderBoughtPrice(selectedOrder))}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Delivery Charge:</span>
                        <span>{formatAmount(selectedOrder.shippingCost)}</span>
                      </div>
                      <div
                        className={cn(
                          "flex justify-between font-medium pt-1 border-t",
                          profit >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400",
                        )}
                      >
                        <span>Profit:</span>
                        <span>
                          {profit >= 0 ? "+" : ""}
                          {formatAmount(profit)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {selectedOrder && (() => {
                const target = selectedOrder as ShippingOrder;
                const orderIsCancelled = isCancelled(target);
                const orderIsReturned = isReturned(target);
                const orderIsDelivered = isDelivered(target);

                const canRefund =
                  permRefund &&
                  orderIsDelivered &&
                  (target.refundedAmount ?? 0) < target.totalAmount;

                return (
                  <div className="flex gap-2 pt-2">
                    {canRefund && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        onClick={() => {
                          setSelectedOrder(null);
                          setShowAllOrderItems(false);
                          openRefundDialog(target);
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {(target.refundedAmount ?? 0) > 0
                          ? "Refund More"
                          : "Refund Order"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => {
                        setSelectedOrder(null);
                        setShowAllOrderItems(false);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      <OrderActivityDialog
        orderNumber={selectedOrder?.orderNumber ?? ""}
        open={activityOpen}
        onOpenChange={setActivityOpen}
      />

      {courierOrder && (
        <BookCourierDialog
          order={courierOrder}
          open={!!courierOrder}
          onOpenChange={(open) => !open && setCourierOrder(null)}
        />
      )}

      <FraudCheckDialog
        phone={fraudCheckPhone}
        onOpenChange={(open) => !open && setFraudCheckPhone(null)}
      />

      <ConfirmDialog
        open={!!deleteOrderId}
        onOpenChange={() => !deleteOrder.isPending && setDeleteOrderId(null)}
        onConfirm={() => {
          if (deleteOrderId) {
            deleteOrder.mutate(deleteOrderId, {
              onSuccess: () => {
                toast.success("Order deleted successfully");
                setDeleteOrderId(null);
              },
              onError: (err: Error) => {
                toast.error(err.message || "Failed to delete order");
              },
            });
          }
        }}
        isLoading={deleteOrder.isPending}
        confirmVariant="destructive"
        confirmText="Delete"
        title="Delete Order"
        description="Are you sure you want to delete this order? This action cannot be undone."
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Order"
        description={`Cancel order ${cancelTarget?.orderNumber ?? ""}? All items will be restocked to inventory. This action cannot be undone.`}
      />

      <AlertDialog
        open={!!blockIpTarget}
        onOpenChange={(open) => !blockIp.isPending && !open && setBlockIpTarget(null)}
      >
        <AlertDialogContent overlayClassName="z-[190]" className="z-[200] max-w-sm rounded-2xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Block Customer IP
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Block IP{" "}
              <span className="font-semibold text-foreground">{blockIpTarget?.ipAddress ?? ""}</span>{" "}
              (from order {blockIpTarget?.orderNumber ?? ""})? Future checkouts from this IP will be
              rejected. Existing orders are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              disabled={blockIp.isPending}
              onClick={() => setBlockIpTarget(null)}
              className="h-8 text-xs rounded-lg cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={blockIp.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleBlockIp();
              }}
              className="h-8 text-xs rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              {blockIp.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Block IP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!unblockIpTarget}
        onOpenChange={(open) => !unblockIp.isPending && !open && setUnblockIpTarget(null)}
      >
        <AlertDialogContent overlayClassName="z-[190]" className="z-[200] max-w-sm rounded-2xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Unblock Customer IP
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Unblock IP{" "}
              <span className="font-semibold text-foreground">{unblockIpTarget?.ipAddress ?? ""}</span>?
              Orders from this IP will be accepted again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              disabled={unblockIp.isPending}
              onClick={() => setUnblockIpTarget(null)}
              className="h-8 text-xs rounded-lg cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unblockIp.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleUnblockIp();
              }}
              className="h-8 text-xs rounded-lg cursor-pointer"
            >
              {unblockIp.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Unblock IP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Orders"
        description={`Are you sure you want to delete ${selectedOrders.length} selected orders? This action cannot be undone.`}
      />

      <BulkBookCourierDialog
        open={isBulkBookDialogOpen}
        onOpenChange={setIsBulkBookDialogOpen}
        orders={selectedOrders}
        onConfirm={handleConfirmBulkBook}
        isBooking={isBulkBooking}
      />
      <ConfirmDialog
        open={isBulkSheetBookOpen}
        onOpenChange={setIsBulkSheetBookOpen}
        onConfirm={handleBulkBookToSheet}
        title="Book to Google Sheet"
        description={(() => {
          const alreadyBooked = selectedOrders.filter((o) => o.sheetBookedAt).length;
          return alreadyBooked > 0
            ? `Append ${selectedOrders.length} order(s) as rows in the Google Sheet order log? ${alreadyBooked} of them were booked before and will be appended again as a new row.`
            : `Append ${selectedOrders.length} order(s) as rows in the Google Sheet order log?`;
        })()}
      />
      <Dialog
        open={!!editingOrder}
        onOpenChange={(open) => {
          if (!open && !updateOrder.isPending) {
            setEditingOrder(null);
            setItemToDeleteIndex(null);
            setEditReference("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
          <DialogHeader className="px-6 py-4 border-b bg-muted/20">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Order
              {editingOrder && (
                <Badge variant="outline" className="font-mono text-xs font-semibold">
                  #{editingOrder.orderNumber}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              প্রোডাক্ট বা কাস্টমার ইনফো ট্যাব সিলেক্ট করে তথ্য আপডেট করুন।
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="products" className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 pt-3 pb-2 border-b bg-muted/10">
              <TabsList className="grid grid-cols-2 w-full max-w-sm h-9">
                <TabsTrigger value="products" className="flex items-center justify-center gap-2 text-xs font-semibold">
                  <Package className="w-3.5 h-3.5" />
                  Product Management ({editingItems.length})
                </TabsTrigger>
                <TabsTrigger value="customer" className="flex items-center justify-center gap-2 text-xs font-semibold">
                  <User className="w-3.5 h-3.5" />
                  Customer Info
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: PRODUCT MANAGEMENT */}
            <TabsContent value="products" className="flex-1 overflow-y-auto px-5 py-3 space-y-3 m-0 focus-visible:outline-none">
              {/* Order Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Package className="w-3.5 h-3.5 text-primary" />
                    Order Items ({editingItems.length})
                  </div>
                  {editingItems.length === 1 && (
                    <span className="text-[11px] text-muted-foreground">
                      কমপক্ষে ১টি আইটেম থাকা আবশ্যক
                    </span>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {editingItems.map((item, idx) => (
                    <div
                      key={item.id || `new-item-${idx}`}
                      className="rounded-lg border p-3 bg-card/70 hover:border-border/90 transition-colors space-y-2.5 text-xs shadow-xs"
                    >
                      {/* Product (Col 1) & Variant/Size (Col 2) in the SAME ROW (2 columns) */}
                      {(() => {
                        const hasVariantsOrSizes = item.availableVariants.length > 0 || item.availableSizes.length > 0;

                        return (
                          <div className="flex items-start gap-2">
                            <div className={cn(
                              "grid gap-2.5 flex-1 min-w-0",
                              hasVariantsOrSizes ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                            )}>
                              {/* Col 1: Product Selector */}
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 h-5">
                                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0 border border-primary/20 leading-none">
                                    #{idx + 1}
                                  </span>
                                  <label className="text-[11px] font-medium text-muted-foreground block truncate">
                                    Product (প্রোডাক্ট)
                                  </label>
                                </div>
                                <ProductCombobox
                                  products={storeProducts}
                                  selectedProductId={item.productId}
                                  fallbackProduct={{
                                    id: item.productId,
                                    name: item.productName,
                                    sku: item.productSku,
                                    images: item.productImage ? [item.productImage] : [],
                                    price: item.price,
                                  }}
                                  onSelectProduct={(newId) => handleItemProductChange(idx, newId)}
                                  currencySymbol={currencySymbol}
                                  placeholder="Select product..."
                                />
                              </div>

                              {/* Col 2: Variant / Size */}
                              {hasVariantsOrSizes && (
                                <div className={cn(
                                  "grid gap-2 min-w-0",
                                  item.availableVariants.length > 0 && item.availableSizes.length > 0
                                    ? "grid-cols-2"
                                    : "grid-cols-1"
                                )}>
                                  {item.availableVariants.length > 0 && (
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center h-5">
                                        <label className="text-[11px] font-medium text-muted-foreground block truncate">
                                          Variant (কালার/ভেরিয়েন্ট)
                                        </label>
                                      </div>
                                      <Select
                                        value={item.selectedVariant || "__none__"}
                                        onValueChange={(val) => {
                                          const nextVal = val === "__none__" ? "" : (val ?? "");
                                          handleItemVariantChange(idx, nextVal);
                                        }}
                                      >
                                        <SelectTrigger
                                          size="sm"
                                          className="w-full h-8 px-2.5 text-xs rounded-md border border-input bg-background text-foreground shadow-xs hover:bg-accent/30 transition-colors"
                                        >
                                          <SelectValue placeholder="Select variant" />
                                        </SelectTrigger>
                                        <SelectContent
                                          positionerClassName="z-[150]"
                                          alignItemWithTrigger={false}
                                          align="start"
                                          className="rounded-xl border bg-popover text-popover-foreground shadow-2xl p-1 z-[150] min-w-[200px]"
                                        >
                                          <SelectItem value="__none__" className="text-xs rounded-lg cursor-pointer">
                                            None / Default
                                          </SelectItem>
                                          {item.availableVariants.map((v) => (
                                            <SelectItem key={v.name} value={v.name} className="text-xs rounded-lg cursor-pointer">
                                              {v.name} {v.price !== null ? `(${currencySymbol} ${v.price})` : ""}
                                            </SelectItem>
                                          ))}
                                          {item.selectedVariant && !item.availableVariants.some((v) => v.name === item.selectedVariant) && (
                                            <SelectItem value={item.selectedVariant} className="text-xs rounded-lg cursor-pointer">
                                              {item.selectedVariant}
                                            </SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {item.availableSizes.length > 0 && (
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center h-5">
                                        <label className="text-[11px] font-medium text-muted-foreground block truncate">
                                          Size (সাইজ)
                                        </label>
                                      </div>
                                      <Select
                                        value={item.size || "__none__"}
                                        onValueChange={(val) => {
                                          const nextVal = val === "__none__" ? "" : (val ?? "");
                                          handleItemSizeChange(idx, nextVal);
                                        }}
                                      >
                                        <SelectTrigger
                                          size="sm"
                                          className="w-full h-8 px-2.5 text-xs rounded-md border border-input bg-background text-foreground shadow-xs hover:bg-accent/30 transition-colors"
                                        >
                                          <SelectValue placeholder="Select size" />
                                        </SelectTrigger>
                                        <SelectContent
                                          positionerClassName="z-[150]"
                                          alignItemWithTrigger={false}
                                          align="start"
                                          className="rounded-xl border bg-popover text-popover-foreground shadow-2xl p-1 z-[150] min-w-[140px]"
                                        >
                                          <SelectItem value="__none__" className="text-xs rounded-lg cursor-pointer">
                                            None
                                          </SelectItem>
                                          {item.availableSizes.map((s) => (
                                            <SelectItem key={s} value={s} className="text-xs rounded-lg cursor-pointer">
                                              {s}
                                            </SelectItem>
                                          ))}
                                          {item.size && !item.availableSizes.includes(item.size) && (
                                            <SelectItem value={item.size} className="text-xs rounded-lg cursor-pointer">
                                              {item.size}
                                            </SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Delete item button with matching vertical alignment */}
                            {editingItems.length > 1 && (
                              <div className="space-y-1 shrink-0">
                                <div className="h-5" />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setItemToDeleteIndex(idx)}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Dedicated & Crystal Clear Add-ons Section */}
                      {item.availableAddOns.length > 0 && (() => {
                        const totalSelectedCount = Object.values(item.selectedAddOns).reduce((sum, q) => sum + q, 0);
                        const totalAddOnsPrice = Object.entries(item.selectedAddOns).reduce((sum, [name, qty]) => {
                          const a = item.availableAddOns.find((x) => x.name === name);
                          return sum + (a ? a.price * qty : 0);
                        }, 0);

                        return (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-2.5 space-y-2">
                            {/* Section Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Add-ons (সংযোজনী সিলেক্ট করুন):</span>
                              </div>
                              {totalSelectedCount > 0 ? (
                                <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200">
                                  Selected: {totalSelectedCount} pcs (+{currencySymbol}{totalAddOnsPrice})
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  (ঐচ্ছিক)
                                </span>
                              )}
                            </div>

                            {/* Grid of Add-ons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {item.availableAddOns.map((addOn) => {
                                const count = item.selectedAddOns[addOn.name] || 0;
                                const isSelected = count > 0;

                                return (
                                  <div
                                    key={addOn.name}
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-lg border transition-all text-xs",
                                      isSelected
                                        ? "bg-white dark:bg-card border-amber-500/80 shadow-xs ring-1 ring-amber-500/25"
                                        : "bg-white dark:bg-card border-border hover:border-amber-500/50 hover:shadow-xs"
                                    )}
                                  >
                                    {/* Left: Checkbox + Name + Price per pc */}
                                    <div
                                      className="flex items-center gap-2 min-w-0 flex-1 mr-2 cursor-pointer select-none"
                                      onClick={() => {
                                        if (isSelected) {
                                          handleItemAddOnDelta(idx, addOn.name, -count);
                                        } else {
                                          handleItemAddOnDelta(idx, addOn.name, 1);
                                        }
                                      }}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            handleItemAddOnDelta(idx, addOn.name, 1);
                                          } else {
                                            handleItemAddOnDelta(idx, addOn.name, -count);
                                          }
                                        }}
                                        className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <span className="font-semibold text-foreground block truncate">
                                          {addOn.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground block font-medium">
                                          +{currencySymbol}{addOn.price} / piece
                                        </span>
                                      </div>
                                    </div>

                                    {/* Right: Stepper (when selected) or "+ Add" Button */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      {isSelected ? (
                                        <div className="flex items-center border border-amber-500/30 rounded-md bg-white dark:bg-zinc-800 h-7 shadow-2xs">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleItemAddOnDelta(idx, addOn.name, -1);
                                            }}
                                            className="px-2 h-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-amber-500/10 rounded-l-md transition-colors flex items-center justify-center"
                                            title="Decrease"
                                          >
                                            −
                                          </button>
                                          <span className="px-2 text-xs font-bold text-amber-900 dark:text-amber-100 min-w-[20px] text-center">
                                            {count}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleItemAddOnDelta(idx, addOn.name, 1);
                                            }}
                                            className="px-2 h-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-amber-500/10 rounded-r-md transition-colors flex items-center justify-center"
                                            title="Increase"
                                          >
                                            +
                                          </button>
                                        </div>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleItemAddOnDelta(idx, addOn.name, 1);
                                          }}
                                          className="h-7 px-2.5 text-xs bg-white dark:bg-zinc-800 text-muted-foreground hover:text-foreground hover:border-amber-500/60 font-medium shadow-2xs"
                                        >
                                          <Plus className="w-3 h-3 mr-1 text-primary" />
                                          Add
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Add-on Unit Cost (In Context) */}
                            {totalSelectedCount > 0 && (
                              <div className="flex items-center justify-between pt-1.5 border-t border-amber-500/20 text-xs">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                                    Add-on Unit Cost (সংযোজনী কেনা দাম প্রতি পিস):
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    অর্ডারের সঠিক প্রফিট হিসাবের জন্য প্রয়োজন
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] font-semibold text-muted-foreground">{currencySymbol}</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.addOnCostPrice}
                                    onChange={(e) => handleItemAddOnCostChange(idx, e.target.value)}
                                    placeholder="0"
                                    className="h-7 w-24 text-xs bg-white dark:bg-card text-right font-semibold"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Quantity, Unit Selling Price, Unit Cost, Line Total */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t items-end">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground block">
                            Qty (পরিমাণ)
                          </label>
                          <div className="flex items-center border rounded-md h-7.5 bg-background shadow-2xs">
                            <button
                              type="button"
                              disabled={item.quantity <= 1}
                              onClick={() => handleItemQuantityDelta(idx, -1)}
                              className="px-2.5 h-full hover:bg-muted text-muted-foreground disabled:opacity-25 transition-colors font-bold text-xs"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemQuantitySet(idx, parseInt(e.target.value, 10) || 1)
                              }
                              className="w-full text-center text-xs font-semibold bg-transparent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleItemQuantityDelta(idx, 1)}
                              className="px-2.5 h-full hover:bg-muted text-muted-foreground transition-colors font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground block">
                            Selling Price (বিক্রয়)
                          </label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) =>
                                handleItemPriceChange(idx, parseFloat(e.target.value) || 0)
                              }
                              className="h-7.5 text-xs font-semibold bg-background pr-2 pl-5 shadow-2xs"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                              {currencySymbol}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground block">
                            Unit Cost (কেনা)
                          </label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              value={item.costPrice}
                              onChange={(e) => handleItemCostChange(idx, e.target.value)}
                              placeholder="Cost"
                              className="h-7.5 text-xs bg-background pr-2 pl-5 shadow-2xs"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                              {currencySymbol}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 text-right sm:text-right">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Line Total:</span>
                            <span className="text-[10px]">({item.quantity} × {currencySymbol}{item.price})</span>
                          </div>
                          <div className="h-7.5 flex items-center justify-end font-bold text-xs text-foreground px-2.5 bg-muted/30 rounded-md border border-border/50 shadow-2xs">
                            {currencySymbol} {formatAmount(item.price * item.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Product to Order (Compact Combobox) */}
                <div className="rounded-lg border border-dashed p-2.5 bg-muted/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    Add Product to Order (নতুন প্রোডাক্ট যোগ করুন)
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <ProductCombobox
                        products={storeProducts}
                        selectedProductId={selectedProductToAdd}
                        onSelectProduct={(id) => setSelectedProductToAdd(id)}
                        currencySymbol={currencySymbol}
                        placeholder="Search & select product to add..."
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!selectedProductToAdd}
                      onClick={() => handleAddNewProduct(selectedProductToAdd)}
                      className="h-8 text-xs font-semibold shrink-0 gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Pricing & Shipping Cost (Compact) */}
              <div className="space-y-2.5 rounded-lg border p-3 bg-muted/20 text-xs">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Order Summary & Delivery</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRecalculateTotal}
                    className="h-6.5 text-[11px] px-2 text-primary hover:bg-primary/10 gap-1 font-medium"
                    title="Reset Total to Subtotal + Customer Delivery Charge"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Auto-Calculate Total
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Total Delivery Charge (মোট ডেলিভারি খরচ)
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        value={newShippingCost}
                        onChange={(e) => setNewShippingCost(e.target.value)}
                        placeholder="0"
                        className="h-8 text-xs bg-background pl-5 shadow-2xs"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                        {currencySymbol}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Total Amount (মোট প্রদেয়)
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        value={newTotalAmount}
                        onChange={(e) => setNewTotalAmount(e.target.value)}
                        placeholder="0"
                        className="h-8 text-xs bg-background font-bold text-foreground pl-5 shadow-2xs"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground pointer-events-none">
                        {currencySymbol}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Items Subtotal (পণ্য মূল্য):</span>
                    <span className="font-semibold text-foreground">
                      {currencySymbol} {formatAmount(editingSubtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Customer Delivery Charge (কাস্টমার ডেলিভারি চার্জ):</span>
                    <span className="font-semibold text-foreground">
                      {currencySymbol} {formatAmount(editingOrder?.deliveryCharge ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Calculated Payable (পণ্য + ডেলিভারি):</span>
                    <span className="font-semibold text-foreground">
                      {currencySymbol} {formatAmount(editingPayable)}
                    </span>
                  </div>
                  {parseFloat(newTotalAmount) !== editingPayable && (
                    <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/30 mt-1">
                      <span>Custom Adjustment / Discount:</span>
                      <span>
                        {parseFloat(newTotalAmount) < editingPayable ? "Discount: -" : "Extra: +"}
                        {currencySymbol}{" "}
                        {formatAmount(
                          Math.abs(
                            parseFloat(newTotalAmount || "0") - editingPayable
                          )
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CUSTOMER INFO */}
            <TabsContent value="customer" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 m-0 focus-visible:outline-none">
              <div className="rounded-lg border p-4 bg-card space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Customer Information (গ্রাহকের বিবরণ)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" /> Customer Name
                    </label>
                    <Input
                      value={editGuestName}
                      onChange={(e) => setEditGuestName(e.target.value)}
                      placeholder="Customer Name"
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-3 h-3" /> Phone Number
                    </label>
                    <Input
                      value={editGuestPhone}
                      onChange={(e) => setEditGuestPhone(e.target.value)}
                      placeholder="017xxxxxxxx"
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                    <svg className="w-3.5 h-3.5 fill-[#1877F2] shrink-0" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span>Facebook Page (ফেসবুক পেজ)</span>
                  </label>
                  <Select
                    value={editReference || "none"}
                    onValueChange={(val) => setEditReference(val && val !== "none" ? val : "")}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Select Facebook Page" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs text-muted-foreground">
                        None (Website / Direct)
                      </SelectItem>
                      {availableFacebookPages.map((page) => (
                        <SelectItem key={page} value={page} className="text-xs font-medium">
                          {page}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" /> Delivery Address
                  </label>
                  <Textarea
                    value={editShippingAddress}
                    onChange={(e) => setEditShippingAddress(e.target.value)}
                    placeholder="Full Delivery Address"
                    rows={3}
                    className="text-xs resize-none bg-background leading-relaxed"
                  />
                </div>
              </div>

              {editingOrder && (
                <div className="rounded-lg border p-4 bg-muted/15 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Order Overview & Details
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Order Number</span>
                      <span className="font-mono font-semibold text-foreground">#{editingOrder.orderNumber}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Status</span>
                      <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase", STATUS_COLORS[editingOrder.status])}>
                        {editingOrder.status}
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Payment Status</span>
                      <span className="font-semibold capitalize text-foreground">{editingOrder.paymentStatus.toLowerCase()}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Payment Method</span>
                      <span className="font-medium text-foreground">{editingOrder.paymentMethod || "COD"}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Order Date</span>
                      <span className="text-muted-foreground">{formatDate(editingOrder.createdAt)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Channel</span>
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {editingOrder.saleType || "WEBSITE"}
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground block">Facebook Page</span>
                      <span className="font-semibold text-foreground">
                        {editReference ? (
                          <span className="inline-flex items-center gap-1 text-[#1877F2]">
                            {editReference}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None (Website)</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-3 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
            <div className="text-left">
              {(() => {
                const discountDiff = editingPayable - (parseFloat(newTotalAmount) || 0);
                if (Math.abs(discountDiff) > 0.01) {
                  return (
                    <div className="text-[11px] font-semibold mb-0.5">
                      {discountDiff > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          Discount (ছাড়): -{currencySymbol} {formatAmount(discountDiff)}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          Extra (চার্জ): +{currencySymbol} {formatAmount(Math.abs(discountDiff))}
                        </span>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Total Payable:</span>
              <span className="text-base font-bold text-primary">
                {currencySymbol} {formatAmount(parseFloat(newTotalAmount) || 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={updateOrder.isPending}
                onClick={() => {
                  setEditingOrder(null);
                  setItemToDeleteIndex(null);
                  setEditReference("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditOrder}
                disabled={updateOrder.isPending}
                className="gap-2"
              >
                {updateOrder.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for confirming product removal from order */}
      <AlertDialog
        open={itemToDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setItemToDeleteIndex(null);
        }}
      >
        <AlertDialogContent
          overlayClassName="z-[190]"
          className="z-[200] max-w-sm rounded-2xl p-5"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              প্রোডাক্টটি মুছে ফেলতে চান?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              {itemToDeleteIndex !== null && editingItems[itemToDeleteIndex] ? (
                <>
                  আপনি কি নিশ্চিত যে{" "}
                  <span className="font-semibold text-foreground">
                    &quot;{editingItems[itemToDeleteIndex].productName || "এই প্রোডাক্টটি"}&quot;
                  </span>{" "}
                  অর্ডার থেকে মুছে ফেলতে চান? এটি অর্ডার তালিকা থেকে বাদ দেওয়া হবে।
                </>
              ) : (
                "আপনি কি নিশ্চিত যে এই প্রোডাক্টটি অর্ডার থেকে মুছে ফেলতে চান?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              onClick={() => setItemToDeleteIndex(null)}
              className="h-8 text-xs rounded-lg cursor-pointer"
            >
              বাতিল (Cancel)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDeleteIndex !== null) {
                  handleRemoveItem(itemToDeleteIndex);
                  setItemToDeleteIndex(null);
                }
              }}
              className="h-8 text-xs rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              মুছে ফেলুন (Remove)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!profitBreakdownOrder}
        onOpenChange={(open) => !open && setProfitBreakdownOrder(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0 bg-background">
          <DialogHeader className="px-6 py-5 border-b bg-muted/20">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              Profit Breakdown Invoice
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {profitBreakdownOrder &&
              (() => {
                const order = profitBreakdownOrder;
                const refundedAmount = order.refundedAmount ?? 0;
                const netRevenue = (order.totalAmount ?? 0) - refundedAmount;
                const itemsCost = orderBoughtPrice(order);
                const shippingCost = order.shippingCost ?? 0;
                const profit = orderProfit(order);
                const priceAdjustment = -orderDiscount(order);

                return (
                  <div className="p-6">
                    <div className="rounded-lg border shadow-sm overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-medium h-10">
                              Product
                            </TableHead>
                            <TableHead className="text-right font-medium h-10">
                              Qty
                            </TableHead>
                            <TableHead className="text-right font-medium h-10">
                              Revenue
                            </TableHead>
                            <TableHead className="text-right font-medium h-10">
                              Bought Price
                            </TableHead>
                            <TableHead className="text-right font-medium h-10">
                              Profit
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item) => {
                            const revenue = item.price * item.quantity;
                            const cost = (item.costPrice ?? 0) * item.quantity;
                            const itemProfit = revenue - cost;
                            const productImage =
                              item.images?.[0] || item.product.images?.[0];
                            const addOnCost = calculateItemAddOnCost(item.color, item.product?.addOns);
                            return (
                              <TableRow key={item.id} className="group">
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    {productImage ? (
                                      <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                        <Image
                                          src={productImage}
                                          alt={item.product.name}
                                          width={48}
                                          height={48}
                                          className="object-cover w-full h-full"
                                        />
                                      </div>
                                    ) : (
                                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs text-muted-foreground">
                                          No img
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex flex-col max-w-[220px] sm:max-w-[300px]">
                                      <span
                                        className="font-medium leading-tight truncate"
                                        title={item.product.name}
                                      >
                                        {item.product.name}
                                      </span>
                                      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                        {item.size && <div>Size: {item.size}</div>}
                                        {(() => {
                                          if (!item.color) return null;
                                          const base = parseBaseVariantFromColor(item.color);
                                          let addOns = "";
                                          if (item.color.includes(" (+ ")) {
                                            addOns = item.color.split(" (+ ")[1]?.replace(/\)$/, "") || "";
                                          } else if (item.color.startsWith("Add-ons: ")) {
                                            addOns = item.color.replace(/^Add-ons:\s*/, "");
                                          }
                                          return (
                                            <>
                                              {base && <div>Variant: {base}</div>}
                                              {addOns && <div className="text-amber-600 dark:text-amber-400 font-medium">Add-ons: {addOns}</div>}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right py-4 align-middle tabular-nums">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="text-right py-4 align-middle tabular-nums">
                                  <span className="font-medium">{formatAmount(revenue)}</span>
                                  {item.quantity > 1 && (
                                    <div className="text-[11px] text-muted-foreground font-normal">
                                      ({formatAmount(item.price)}/pc)
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right py-4 align-middle tabular-nums text-red-600 dark:text-red-400">
                                  {item.costPrice != null ? (
                                    <>
                                      <span className="font-medium">{formatAmount(cost)}</span>
                                      {item.quantity > 1 && (
                                        <div className="text-[11px] text-muted-foreground font-normal">
                                          ({formatAmount(item.costPrice)}/pc)
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                  {addOnCost > 0 && (
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal normal-case">
                                      + add-on {formatAmount(addOnCost * item.quantity)}?
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right py-4 align-middle">
                                  <span
                                    className={cn(
                                      "font-semibold tabular-nums block",
                                      itemProfit >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-red-600 dark:text-red-400",
                                    )}
                                  >
                                    {itemProfit >= 0 ? "+" : ""}
                                    {formatAmount(itemProfit)}
                                  </span>
                                  {item.quantity > 1 && (
                                    <div className="text-[11px] text-muted-foreground font-normal tabular-nums">
                                      ({itemProfit >= 0 ? "+" : ""}{formatAmount(Math.round(itemProfit / item.quantity))}/pc)
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter className="bg-muted/10 border-t-2 border-border">
                          <TableRow className="hover:bg-transparent border-0">
                            <TableCell
                              colSpan={4}
                              className="text-right font-medium text-muted-foreground pt-6"
                            >
                              Delivery Charge (Customer)
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium pt-6">
                              +{formatAmount(order.deliveryCharge)}
                            </TableCell>
                          </TableRow>
                          {refundedAmount > 0 && (
                            <TableRow className="hover:bg-transparent border-0">
                              <TableCell
                                colSpan={4}
                                className="text-right font-medium text-muted-foreground"
                              >
                                Refunded
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                                -{formatAmount(refundedAmount)}
                              </TableCell>
                            </TableRow>
                          )}
                          {priceAdjustment !== 0 && (
                            <TableRow className="hover:bg-transparent border-0">
                              <TableCell
                                colSpan={4}
                                className={cn(
                                  "text-right font-semibold",
                                  priceAdjustment < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                                )}
                              >
                                {priceAdjustment > 0
                                  ? "Order Price Adjustment / Extra Charge:"
                                  : "Discount (ডিসকাউন্ট / ছাড়):"}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums font-semibold",
                                  priceAdjustment < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                                )}
                              >
                                {priceAdjustment > 0 ? "+" : ""}
                                {formatAmount(priceAdjustment)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="hover:bg-transparent border-0">
                            <TableCell
                              colSpan={4}
                              className="text-right font-medium text-muted-foreground"
                            >
                              Total Received
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatAmount(netRevenue)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="hover:bg-transparent border-0">
                            <TableCell
                              colSpan={4}
                              className="text-right font-medium text-muted-foreground"
                            >
                              Product Cost (Bought Price)
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                              -{formatAmount(itemsCost)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="hover:bg-transparent border-0">
                            <TableCell
                              colSpan={4}
                              className="text-right font-medium text-muted-foreground pb-4"
                            >
                              Total Delivery Charge
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-red-600 dark:text-red-400 pb-4">
                              -{formatAmount(shippingCost)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="hover:bg-transparent border-t bg-muted/30">
                            <TableCell
                              colSpan={4}
                              className="text-right font-bold text-base py-4"
                            >
                              Net Profit
                            </TableCell>
                            <TableCell className="text-right py-4">
                              <span
                                className={cn(
                                  "text-lg font-bold tracking-tight tabular-nums",
                                  profit >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400",
                                )}
                              >
                                {profit >= 0 ? "+" : ""}
                                {formatAmount(profit)}
                              </span>
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                );
              })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Refund Order</DialogTitle>
          </DialogHeader>
          {refundTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono font-medium">
                    {refundTarget.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order total</span>
                  <span>{formatAmount(refundTarget.totalAmount)}</span>
                </div>
                {(refundTarget.refundedAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Already refunded</span>
                    <span>-{formatAmount(refundTarget.refundedAmount ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Refundable now</span>
                  <span>{formatAmount(refundRemaining(refundTarget))}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={refundMode === "full" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setRefundMode("full");
                    setRefundAmount(refundRemaining(refundTarget).toString());
                  }}
                >
                  Full refund
                </Button>
                <Button
                  type="button"
                  variant={refundMode === "partial" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRefundMode("partial")}
                >
                  Partial
                </Button>
              </div>

              {refundMode === "partial" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Refund amount ({currencySymbol})
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    max={refundRemaining(refundTarget)}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="Enter amount"
                    autoFocus
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Reason (optional)</Label>
                <Textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Customer returned the item"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={refundRestock}
                  onCheckedChange={(v) => setRefundRestock(v === true)}
                />
                <span>
                  Restock items
                  <span className="text-muted-foreground">
                    {" "}
                    (applied when the order becomes fully refunded)
                  </span>
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setRefundTarget(null)}
                  disabled={refundOrder.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRefund}
                  disabled={refundOrder.isPending}
                  className="gap-2"
                >
                  {refundOrder.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Process Refund
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <OrderActivityDialog
        orderNumber={logDetailsOrder?.orderNumber ?? ""}
        open={!!logDetailsOrder}
        onOpenChange={(open) => !open && setLogDetailsOrder(null)}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
          <div className="h-64 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-3xl" />
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
