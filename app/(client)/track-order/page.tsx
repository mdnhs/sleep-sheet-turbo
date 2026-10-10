"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Search, Calendar, Phone, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/use-language";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { TrackOrderSkeleton } from "./track-order-skeleton";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  product: { id?: string; name: string; images: string[] } | null;
}

// A phone number alone returns a summary (no order number, name, address,
// note or tracking). Phone + order number returns the full order, so those
// fields are optional and present only when the lookup is `verified`.
interface Order {
  orderNumber?: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  subtotal?: number;
  shippingCost?: number;
  shippingAddress?: string;
  guestPhone?: string | null;
  createdAt: string;
  guestName?: string | null;
  note?: string | null;
  items: OrderItem[];
  trackingNumber?: string | null;
}

// Keyed by translation key, not a literal label, so STATUS_LABELS can stay
// a module-level const while the rendered text still switches with the
// site's bn/en toggle (t() is looked up per-render where this is used).
const STATUS_LABELS: Record<string, { labelKey: "statusPending" | "statusProcessing" | "statusShipped" | "statusDelivered" | "statusCancelled" | "statusRefunded"; color: string }> = {
  PENDING: { labelKey: "statusPending", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 border border-yellow-200/30" },
  PROCESSING: { labelKey: "statusProcessing", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200/30" },
  SHIPPED: { labelKey: "statusShipped", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200/30" },
  DELIVERED: { labelKey: "statusDelivered", color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 border border-green-200/30" },
  CANCELLED: { labelKey: "statusCancelled", color: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200/30" },
  REFUNDED: { labelKey: "statusRefunded", color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200/30" },
};

interface TrackOrderContentProps {
  initialOrders?: Order[];
  initialPhone?: string;
}

function TrackOrderContent({ initialOrders, initialPhone }: TrackOrderContentProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const phoneParam = searchParams.get("phone") || initialPhone || "";
  const orderParam = searchParams.get("order") || "";
  const { t, language } = useLanguage();

  const [phone, setPhone] = useState(phoneParam);
  const [orderNo, setOrderNo] = useState(orderParam);
  const [verified, setVerified] = useState(false);
  const [orders, setOrders] = useState<Order[]>(initialOrders || []);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initialOrders && initialOrders.length > 0));
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const { formatAmount } = useCurrency();
  const { siteName, logoUrl, footerPhone } = useWebsiteSettings();

  const performSearch = async (phoneNumber: string, orderNumber: string) => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError("");
    setSearched(false);
    setCurrentPage(1);

    try {
      const query = new URLSearchParams({ phone: phoneNumber.trim() });
      if (orderNumber.trim()) query.set("order", orderNumber.trim());
      const res = await fetch(`/api/orders/by-phone?${query}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorFetchOrders"));
        setOrders([]);
        setVerified(false);
      } else {
        setOrders(data.orders || []);
        setVerified(Boolean(data.verified));
      }
    } catch {
      setError(t("errorSomethingWentWrong"));
      setOrders([]);
      setVerified(false);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  useEffect(() => {
    if (phoneParam && (!initialOrders || initialOrders.length === 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the editable inputs from the URL params this effect already has to run for (performSearch is a required side effect, not derivable during render).
      setPhone(phoneParam);
      setOrderNo(orderParam);
      performSearch(phoneParam, orderParam);
    }
  }, [phoneParam, orderParam]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    const query = new URLSearchParams({ phone: phone.trim() });
    if (orderNo.trim()) query.set("order", orderNo.trim());
    router.push(`/track-order?${query}`);
  };

  const handleDownloadInvoice = async (order: Order) => {
    // Only a verified (phone + order number) lookup carries what the invoice needs.
    if (!order.orderNumber || order.shippingAddress == null || order.subtotal == null || order.shippingCost == null) return;
    try {
      // Load the PDF renderer on demand — it is far too heavy to ship in the
      // page bundle for a click-only feature.
      const [{ pdf }, { InvoicePDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/checkout/components/invoice-pdf"),
      ]);
      const items = order.items.map((item) => ({
        id: item.product?.id ?? item.id,
        name: item.product?.name ?? "",
        quantity: item.quantity,
        price: item.price,
        size: item.size || undefined,
        color: item.color || undefined,
        image: item.product?.images?.[0] || undefined,
      }));
      const placedOrderData = {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        items,
        trackingNumber: order.trackingNumber,
      };
      const shippingInfoData = {
        fullName: order.guestName || t("accCustomerFallback"),
        phone: order.guestPhone || phone || "",
        address: order.shippingAddress,
        shippingZone: "inside_dhaka" as const,
        notes: order.note ?? undefined,
      };
      const doc = (
        <InvoicePDF
          order={placedOrderData}
          shippingInfo={shippingInfoData}
          siteName={siteName}
          logoUrl={logoUrl || ""}
          language={language}
          phoneNumber={footerPhone}
        />
      );
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t("invoiceDownloadedSuccess"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("errorGeneratePdf"));
    }
  };

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto px-4 py-8 sm:py-16 max-w-5xl">
      <Card className="bg-card rounded-3xl overflow-hidden mb-8 relative max-w-2xl mx-auto ring-0">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60"></div>
        <CardHeader className="text-center pb-4 pt-8">
          <div className="relative mx-auto mb-6 w-fit mt-2">
            <div className="absolute inset-0 rounded-full bg-primary/10 scale-150 animate-ping duration-1000"></div>
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center relative z-10 text-primary">
              <Package className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            {t("trackYourOrder")}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground max-w-md mx-auto mt-1.5">
            {t("trackYourOrderDesc")}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-6 pb-8 pt-2">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Input
                type="tel"
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 bg-background/50 backdrop-blur-sm border-border/50 rounded-2xl px-5 pl-12 text-base focus-visible:ring-2 focus-visible:ring-primary/50 shadow-inner"
                required
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
            </div>
            <div className="relative sm:w-48">
              <Input
                type="text"
                placeholder={t("orderNumberOptional")}
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                className="h-14 bg-background/50 backdrop-blur-sm border-border/50 rounded-2xl px-5 text-base focus-visible:ring-2 focus-visible:ring-primary/50 shadow-inner"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-14 px-8 rounded-2xl font-bold text-base bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-all">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                  {t("searching")}
                </div>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {t("search")}
                </>
              )}
            </Button>
          </form>

          {error && (
            <p className="text-destructive text-sm font-medium text-center mt-4">{error}</p>
          )}
        </CardContent>
      </Card>

      {searched && !error && orders.length === 0 && (
        <Card className="bg-card rounded-3xl p-8 text-center text-muted-foreground max-w-2xl mx-auto ring-0">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30 text-foreground" />
          <p className="text-sm font-medium">{t("noOrdersFound")}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order, index) => {
          const statusInfo = STATUS_LABELS[order.status] || { labelKey: undefined, color: "" };
          return (
            <Card key={order.orderNumber ?? `${order.createdAt}-${index}`} className="bg-card rounded-3xl p-5 sm:p-7 hover:-translate-y-1 transition-all duration-300 ring-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4 mb-4">
                <div>
                  {order.orderNumber && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("orderNumberLabel2")}
                      </span>
                      <span className="text-sm font-black text-foreground">{order.orderNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(order.createdAt).toLocaleString("en-BD", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                </div>
                <div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusInfo.color}`}>
                    {statusInfo.labelKey ? t(statusInfo.labelKey) : order.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 py-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.product?.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground font-medium">
                        <span>{t("qty")}: {item.quantity}</span>
                        {item.size && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-border"></span>
                            <span>{item.size}</span>
                          </>
                        )}
                        {item.color && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-border"></span>
                            <span>{item.color}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-foreground shrink-0">{formatAmount(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 mt-2 border-t border-border/40 gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {order.paymentMethod === "COD" ? t("cashOnDelivery") : order.paymentMethod === "BKASH" ? t("bkashPayment") : t("cardPayment")}
                  </span>
                  <span className="text-lg font-black text-foreground tracking-tight">{formatAmount(order.totalAmount)}</span>
                </div>
                {verified ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(order)}
                    className="rounded-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    {t("downloadInvoice")}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground max-w-[14rem]">{t("enterOrderNumberForDetails")}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {Math.ceil(orders.length / itemsPerPage) > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-full"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("previous")}
          </Button>

          {(() => {
            const totalPages = Math.ceil(orders.length / itemsPerPage);
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
                  className="rounded-full h-8 w-8 p-0 text-xs font-semibold shrink-0"
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
            onClick={() => setCurrentPage((p) => Math.min(Math.ceil(orders.length / itemsPerPage), p + 1))}
            disabled={currentPage === Math.ceil(orders.length / itemsPerPage)}
            className="rounded-full"
          >
            {t("next")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <React.Suspense fallback={<TrackOrderSkeleton />}>
      <TrackOrderContent />
    </React.Suspense>
  );
}
