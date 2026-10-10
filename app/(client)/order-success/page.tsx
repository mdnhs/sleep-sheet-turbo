"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, ShoppingBag, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/use-language";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { trackEvent } from "@/lib/traffic-tracker";
import { trackGtmPurchase, splitFullName, hashIdentifiers } from "@/lib/gtm";
import { getCapturedFbc } from "@/lib/meta-fbc";
import { OrderSuccessSkeleton } from "./order-success-skeleton";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { clearCheckoutIdempotencyKey } from "@/lib/checkout-idempotency";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  product: { id: string; name: string; images?: string[] };
}

interface Order {
  id: string;
  orderNumber: string;
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  createdAt: string;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  userId?: string | null;
  shippingAddress: string;
  items: OrderItem[];
}

function OrderSuccessContent() {
  const router = useRouter();
  const [orderId] = useQueryState("orderId");
  const [phone] = useQueryState("phone");
  const { t, language } = useLanguage();
  const { siteName, logoUrl, footerPhone } = useWebsiteSettings();

  const [order, setOrder] = useState<Order | null>(() => {
    if (typeof window === "undefined" || !orderId) return null;
    try {
      const cached = sessionStorage.getItem(`ss_order_data_${orderId}`);
      if (cached) return JSON.parse(cached) as Order;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !order);

  useEffect(() => {
    if (!orderId) {
      router.replace("/");
      return;
    }
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error("Failed to fetch order");
        const data = await res.json();
        setOrder(data.order);
      } catch (error) {
        console.error("Error fetching order:", error);
        if (!order) {
          toast.error("Failed to load order details.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, router]);

  // A bKash order is only a real, paid order once bKash confirmed it. The
  // checkout deliberately left the cart and idempotency key alone while the
  // customer was on bKash's page; retire them now that the money is in.
  const awaitingPayment = order?.paymentMethod === "BKASH" && order.paymentStatus !== "COMPLETED";
  const settledBkash = order?.paymentMethod === "BKASH" && order.paymentStatus === "COMPLETED";
  const clearCart = useCartStore((state) => state.clearCart);
  const clearGuestCart = useCartStore((state) => state.clearGuestCart);
  useEffect(() => {
    if (!settledBkash) return;
    clearCart();
    clearGuestCart();
    try { localStorage.removeItem("guest-cart"); } catch { /* ignore */ }
    clearCheckoutIdempotencyKey();
  }, [settledBkash, clearCart, clearGuestCart]);

  // Push the ecommerce `purchase` to the dataLayer for every order. GTM fans it
  // out to GA4, Google Ads and Meta (browser Pixel + server CAPI, deduplicated
  // by the shared event_id), with a guard so a reload does not count it twice.
  useEffect(() => {
    // Never report a purchase for an unpaid bKash order.
    if (!order || !orderId || awaitingPayment) return;

    const { first_name, last_name } = splitFullName(order.guestName);
    const rawVal = Number(order.totalAmount);
    const purchaseVal = !isNaN(rawVal) && rawVal > 0 ? Number(rawVal.toFixed(2)) : 0.01;

    // Hashing is async (Web Crypto), so the push waits on it. `cancelled`
    // covers the order changing or the component unmounting before the digest
    // resolves; a reload is already covered by trackGtmPurchase's own guard.
    let cancelled = false;

    void (async () => {
      const { email_sha256, phone_sha256 } = await hashIdentifiers({
        email: order.guestEmail,
        phone: order.guestPhone,
      });
      if (cancelled) return;

      // Track standard GA4, Google Ads & Meta Pixel (via GTM) purchase event
      trackGtmPurchase({
        transaction_id: order.orderNumber || order.id,
        order_id: order.id,
        value: purchaseVal,
        currency: "BDT",
        shipping: Number(order.shippingCost) || 0,
        tax: 0,
        user_data: {
          email: order.guestEmail || undefined,
          phone_number: order.guestPhone || undefined,
          external_id: order.userId || undefined,
          address: {
            first_name,
            last_name,
            street: order.shippingAddress,
            country: "BD",
          },
          fbc: getCapturedFbc(),
          email_sha256,
          phone_sha256,
        },
        items: order.items.map((item, idx) => ({
          item_id: item.product?.id || item.id,
          item_name: item.product?.name || "Product",
          price: Number(item.price) || 0,
          quantity: item.quantity,
          item_variant: [item.size, item.color].filter(Boolean).join(" / ") || undefined,
          index: idx + 1,
        })),
      });
    })();

    const orderGuardKey = `traffic_order_tracked_${orderId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(orderGuardKey)) {
      trackEvent("order_complete", `/order-success?orderId=${orderId}`, orderId, {
        orderId,
        totalAmount: order.totalAmount,
      });
      sessionStorage.setItem(orderGuardKey, "1");
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, orderId]);

  const handleDownloadInvoice = async () => {
    if (!order) {
      toast.error("Invoice details not found.");
      return;
    }
    try {
      // Load the PDF renderer on demand — it is far too heavy to ship in the
      // page bundle for a click-only feature.
      const [{ pdf }, { InvoicePDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/checkout/components/invoice-pdf"),
      ]);
      const items = order.items.map((item) => ({
        name: item.product.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size || null,
        color: item.color || null,
        image: item.product.images?.[0] || null,
      }));
      const placedOrderData = {
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        items,
      };
      const shippingInfoData = {
        fullName: order.guestName || "Customer",
        phone: order.guestPhone || phone || "",
        address: order.shippingAddress,
        shippingZone: "inside_dhaka" as const,
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
      toast.success("Invoice downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  if (loading) {
    return <OrderSuccessSkeleton />;
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-lg font-bold text-destructive mb-4">Order not found.</p>
        <Link href="/">
          <Button>Go to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-16">
      <Card className="bg-background border border-border/40 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-500"></div>
        <CardContent className="flex flex-col items-center justify-center text-center p-6 sm:p-10 pt-10">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-green-500/10 scale-150 animate-ping duration-1000"></div>
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20 relative z-10">
              <CheckCircle2 className="h-9 w-9 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-2">
            {t("thankYou")}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mb-6 leading-relaxed">
            {t("orderSuccessDesc")}
          </p>
          <div className="w-full bg-muted/40 border border-border/40 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-left">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("trackPhone")}
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {order.guestPhone || phone || "N/A"}
              </p>
            </div>
            <ShoppingBag className="h-5 w-5 text-muted-foreground/60" />
          </div>

          {/* A bKash order bKash has already confirmed needs no WhatsApp confirmation */}
          {!settledBkash && (
            <a
              href={`https://wa.me/${footerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `আসসালামু আলাইকুম Sleep Sheet! আমি একটি নতুন অর্ডার করেছি।\n\nঅর্ডার নম্বর: #${order.orderNumber}\nনাম: ${order.guestName || "Customer"}\nমোট টাকা: ৳${order.totalAmount}\nঠিকানা: ${order.shippingAddress}\n\nদয়া করে অর্ডারটি কনফার্ম করুন।`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mb-4"
            >
              <Button className="w-full h-12 rounded-full font-bold text-sm bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {language === "bn" ? "হোয়াটসঅ্যাপে অর্ডার কনফার্ম করুন" : "Confirm Order on WhatsApp"}
              </Button>
            </a>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
            <Link href={`/track-order?phone=${encodeURIComponent(order.guestPhone || phone || "")}`} className="flex-1">
              <Button variant="outline" className="w-full h-11 rounded-full font-bold text-sm border-border/60 hover:bg-muted/40">
                {t("trackMyOrder")}
              </Button>
            </Link>
            <div className="flex-1">
              <Button onClick={handleDownloadInvoice} className="w-full h-11 rounded-full font-bold text-sm bg-foreground text-background hover:bg-foreground/90 shadow-md cursor-pointer">
                {t("downloadInvoice")}
              </Button>
            </div>
          </div>
          <div className="w-full border-t border-border/40 pt-6">
            <Link href="/" className="text-sm font-bold text-foreground/80 hover:text-foreground flex items-center justify-center gap-1">
              {t("continueShopping")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <React.Suspense fallback={<OrderSuccessSkeleton />}>
      <OrderSuccessContent />
    </React.Suspense>
  );
}
