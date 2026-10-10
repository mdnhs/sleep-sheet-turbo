"use client";

import { Button } from "@/components/ui/button";
import { useWishlistToggle } from "@/lib/helpers";
import { Product } from "@/lib/types";
import {
  Heart,
  ShoppingBag,
  Phone,
  MessageCircle,
  ShoppingCart,
  Zap,
  CheckCircle2,
  Truck,
  Eye,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { useCurrent } from "@/features/auth/api/use-current";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackEvent } from "@/lib/traffic-tracker";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { seoConfig } from "@/lib/seo";
import { trackGtmAddToCart, trackGtmBeginCheckout } from "@/lib/gtm";
import { floorToNearest50 } from "@/lib/utils";
import FallbackImage from "@/components/ui/fallback-image";
import { triggerHaptic } from "@/lib/haptics";
import { afterNextPaint } from "@/lib/after-next-paint";

interface ProductPickerProps {
  product: Product;
}

function ProductPicker({ product }: ProductPickerProps) {
  const { t, language } = useLanguage();
  const isColorAvailable = (product.colors?.length ?? 0) > 0;
  const isSizeAvailable = (product.sizes?.length ?? 0) > 0;
  const isInStock = product.stock > 0;

  const addToCart = useCartStore((state) => state.addToCart);
  const { data: user } = useCurrent();
  const router = useRouter();
  const { formatAmount } = useCurrency();
  // Same number as the floating WhatsApp button (footer_phone site setting).
  const { footerPhone } = useWebsiteSettings();
  // Prefill the WhatsApp chat with the product name and link so the seller
  // immediately knows which product the customer wants to order.
  const whatsappOrderHref = `https://wa.me/${footerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `${t("whatsappOrderMessage")}\n${product.name}\n${seoConfig.siteUrl}/shop/${product.slug}`,
  )}`;

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState(product.defaultVariantName || "");
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [showStickyBar, setShowStickyBar] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"cart" | "buy" | null>(null);
  
  const mainCtaRef = React.useRef<HTMLDivElement>(null);
  const [isMainCtaVisible, setIsMainCtaVisible] = useState(false);
  
  const hasVariants = isColorAvailable || isSizeAvailable || (product.addOns?.length ?? 0) > 0;
  
  const [highlightVariant, setHighlightVariant] = useState(false);
  const { isInWishlist, isAdding, isRemoving, handleWishlistToggle } =
    useWishlistToggle({ productId: product.id });

  const currentVariant = product.colors?.find(c => c.name === selectedColor);
  const baseDisplayPrice = (currentVariant?.price ?? product.price) ?? 0;

  const addOnsTotalPerUnit = Object.entries(selectedAddOns).reduce((sum, [name, qty]) => {
    const addOn = product.addOns?.find((a) => a.name === name);
    return sum + (addOn ? addOn.price * qty : 0);
  }, 0);

  const displayPrice = baseDisplayPrice + addOnsTotalPerUnit;

  const selectedAddOnsSummary = Object.entries(selectedAddOns)
    .filter(([_, qty]) => qty > 0)
    .map(([name, qty]) => {
      const addOn = product.addOns?.find((a) => a.name === name);
      const label = name.includes("কুচি") && !name.includes("পর্দা") ? `${name} পর্দা` : name;
      return addOn ? `${label} x${qty} (${formatAmount(addOn.price)})` : `${label} x${qty}`;
    })
    .join(", ");

  const colorWithAddOns = selectedColor
    ? (selectedAddOnsSummary ? `${selectedColor} (+ ${selectedAddOnsSummary})` : selectedColor)
    : (selectedAddOnsSummary ? `Add-ons: ${selectedAddOnsSummary}` : "");

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity > 0 && newQuantity <= product.stock) {
      triggerHaptic("light");
      setQuantity(newQuantity);
    }
  };

  // Order Now goes to /checkout, and nothing on a phone's product page
  // prefetched it, so the tap waited on the route's payload and JS. Warm it
  // once the browser is idle: /checkout is static and edge-cached, so this
  // costs a little data and no server work.
  React.useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const id = window.setTimeout(() => router.prefetch("/checkout"), 3000);
      return () => window.clearTimeout(id);
    }
    const id = window.requestIdleCallback(() => router.prefetch("/checkout"), { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }, [router]);

  React.useEffect(() => {
    const el = mainCtaRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainCtaVisible(entry.isIntersecting);
      },
      {
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const updateStickyVisibility = () => {
      const isMobile = window.innerWidth < 1024;
      if (!isMobile) {
        // Desktop uses sticky sidebar - never show bottom sticky bar on desktop
        setShowStickyBar(false);
        return;
      }

      // On mobile: show sticky bar ONLY when main in-page button is not in view
      setShowStickyBar(!isMainCtaVisible);
    };
    
    updateStickyVisibility();
    window.addEventListener("scroll", updateStickyVisibility, { passive: true });
    window.addEventListener("resize", updateStickyVisibility, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateStickyVisibility);
      window.removeEventListener("resize", updateStickyVisibility);
    };
  }, [isMainCtaVisible]);

  // components/ProductCard.tsx
  const handleAddToCart = () => {
    if (
      (!selectedSize && isSizeAvailable) ||
      (!selectedColor && isColorAvailable)
    ) {
      triggerHaptic("error");
      if (!selectedColor && isColorAvailable) {
        setHighlightVariant(true);
        setTimeout(() => setHighlightVariant(false), 2000);
      }
      toast.error("Please select options before adding to cart");
      return;
    }

    triggerHaptic("medium");

    const finalColor = colorWithAddOns || selectedColor;

    addToCart({
      productId: product.id,
      quantity: quantity,
      size: selectedSize,
      color: finalColor,
      isAuthenticated: !!user?.id,
      guestProduct: {
        id: `guest-${product.id}-${selectedSize}-${finalColor}-${Date.now()}`,
        productId: product.id,
        slug: product.slug,
        quantity,
        size: selectedSize || undefined,
        color: finalColor || undefined,
        name: product.name,
        price: displayPrice,
        image: product.images[0] ?? "",
        description: product.description,
      },
    });

    trackGtmAddToCart({
      currency: "BDT",
      value: displayPrice * quantity,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          price: displayPrice,
          quantity,
          item_variant: [selectedSize, finalColor].filter(Boolean).join(" / ") || undefined,
        },
      ],
    });
    trackEvent("add_to_cart", `/shop/${product.slug}`, product.name, {
      productId: product.id,
      quantity,
      price: displayPrice,
    });
  };

  const handleBuyNow = () => {
    if (
      (!selectedSize && isSizeAvailable) ||
      (!selectedColor && isColorAvailable)
    ) {
      triggerHaptic("error");
      if (!selectedColor && isColorAvailable) {
        setHighlightVariant(true);
        setTimeout(() => setHighlightVariant(false), 2000);
      }
      toast.error("Please select options before proceeding to checkout");
      return;
    }

    triggerHaptic("medium");

    const finalColor = colorWithAddOns || selectedColor;

    addToCart({
      productId: product.id,
      quantity: quantity,
      size: selectedSize,
      color: finalColor,
      isAuthenticated: !!user?.id,
      guestProduct: {
        id: `guest-${product.id}-${selectedSize}-${finalColor}-${Date.now()}`,
        productId: product.id,
        slug: product.slug,
        quantity,
        size: selectedSize || undefined,
        color: finalColor || undefined,
        name: product.name,
        price: displayPrice,
        image: product.images[0] ?? "",
        description: product.description,
      },
    });

    trackGtmAddToCart({
      currency: "BDT",
      value: displayPrice * quantity,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          price: displayPrice,
          quantity,
          item_variant: [selectedSize, finalColor].filter(Boolean).join(" / ") || undefined,
        },
      ],
    });
    trackEvent("add_to_cart", `/shop/${product.slug}`, product.name, {
      productId: product.id,
      quantity,
      price: displayPrice,
    });

    trackGtmBeginCheckout({
      currency: "BDT",
      value: displayPrice * quantity,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          price: displayPrice,
          quantity,
          item_variant: [selectedSize, finalColor].filter(Boolean).join(" / ") || undefined,
        },
      ],
    });
    trackEvent("buy_now", `/shop/${product.slug}`, product.name, {
      productId: product.id,
      quantity,
      price: displayPrice,
    });

    // Through the same after-paint queue as the tracking pushes above, so
    // they reach GTM first — while the URL is still this product's. A
    // prefetched /checkout could otherwise commit (and change the URL) before
    // they flush, reporting add_to_cart/begin_checkout as /checkout.
    afterNextPaint(() => router.push("/checkout"));
  };

  return (
    <>
      {/* Dialog for Variants */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("selectOption")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {isSizeAvailable && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Size</span>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        selectedSize === size
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isColorAvailable && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t("variants")}</span>
                <div className="flex flex-wrap gap-2">
                  {product.colors?.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color.name)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        selectedColor === color.name
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {color.name} ({formatAmount(color.price ?? product.price ?? 0)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.addOns && product.addOns.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-2 border-t pt-3 border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t("addOns")}
                </span>
                <div className="flex flex-col gap-2">
                  {product.addOns.map((addOn) => {
                    const qty = selectedAddOns[addOn.name] || 0;
                    return (
                      <div
                        key={addOn.name}
                        // Same selected-state treatment as the variant pills
                        // above (border-primary bg-primary/10) once an add-on
                        // has been added, instead of always looking unselected.
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          qty > 0
                            ? "border-primary bg-primary/10"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex flex-col justify-center min-w-0 pr-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {addOn.name} ({formatAmount(addOn.price * (qty > 0 ? qty : 1))})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shrink-0">
                          <button
                            type="button"
                            className={`h-7 w-7 flex items-center justify-center rounded-full text-sm font-bold bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white shadow-xs transition-all ${
                              qty > 0
                                ? "opacity-100 hover:brightness-110 active:scale-95 cursor-pointer"
                                : "opacity-30 cursor-not-allowed"
                            }`}
                            onClick={() =>
                              setSelectedAddOns((prev) => ({
                                ...prev,
                                [addOn.name]: Math.max(0, qty - 1),
                              }))
                            }
                            disabled={qty <= 0}
                          >
                            −
                          </button>
                          <span className="px-1.5 text-center text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {qty} {t("piece")}
                          </span>
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center rounded-full text-sm font-bold bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white hover:brightness-110 active:scale-95 transition-all shadow-xs cursor-pointer"
                            onClick={() =>
                              setSelectedAddOns((prev) => ({
                                ...prev,
                                [addOn.name]: qty + 1,
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 w-full mt-4">
            {dialogAction === "cart" && (
              <Button
                className="flex-1 h-12 rounded-xl text-sm font-semibold tracking-wide border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background transition-all"
                onClick={() => {
                  if ((isSizeAvailable && !selectedSize) || (isColorAvailable && !selectedColor)) {
                    toast.error("Please select options before adding to cart");
                    return;
                  }
                  handleAddToCart();
                  setIsDialogOpen(false);
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-2" fill="currentColor" />
                {t("addToCart")}
              </Button>
            )}
            {dialogAction === "buy" && (
              <Button
                className="animate-cta-wiggle flex-1 h-12 rounded-xl text-sm font-semibold tracking-wide bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] hover:brightness-110 text-white shadow-lg shadow-[#B8245A]/25 transition-all"
                onClick={() => {
                  if ((isSizeAvailable && !selectedSize) || (isColorAvailable && !selectedColor)) {
                    toast.error("Please select options before proceeding to checkout");
                    return;
                  }
                  handleBuyNow();
                  setIsDialogOpen(false);
                }}
              >
                <Zap className="h-4 w-4 mr-2" fill="currentColor" />
                {t("buyNow")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2 sm:gap-3 lg:gap-4">
        {/* 5-Piece Complete Set Contents */}
        {(product.category === "comforter-set" ||
          product.name.toLowerCase().includes("comforter") ||
          product.name.includes("কমফোর্টার")) && (
          <div className="bg-gradient-to-r from-rose-50/80 to-pink-50/80 dark:from-rose-950/25 dark:to-pink-950/25 border border-rose-200/70 dark:border-rose-900/40 rounded-2xl p-2 sm:p-2.5 mb-0.5 shadow-xs">
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-foreground/90 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>১টি কিং সাইজ কমফোর্টার</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>১টি ম্যাচিং বিছানার চাদর</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>২টি ম্যাচিং বালিশের কভার</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>১টি কোলবালিশের কভার</span>
              </div>
            </div>
          </div>
        )}

        {/* In-Line Variant Selection */}
        {isColorAvailable && (
          <div className="flex flex-col gap-1.5 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {language === "bn" ? "ধরন সিলেক্ট করুন:" : "Select Type:"}
              </span>
              {selectedColor && (
                <span className="text-xs font-bold text-primary">{selectedColor}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.colors?.map((color) => {
                const isSelected = selectedColor === color.name;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setSelectedColor(color.name);
                    }}
                    className={`px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <span>{color.name}</span>
                    <span className="text-[11px] opacity-80 font-semibold">
                      ({formatAmount(color.price ?? product.price ?? 0)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* In-Line Size Selection */}
        {isSizeAvailable && (
          <div className="flex flex-col gap-1.5 mb-1">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              সাইজ:
            </span>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => {
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setSelectedSize(size);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary text-white shadow-xs"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* In-Line Add-ons (Matching Curtains / পর্দা) */}
        {product.addOns && product.addOns.length > 0 && (
          <div className="flex flex-col gap-2 mb-1 p-2.5 sm:p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>ম্যাচিং পর্দা যুক্ত করুন</span>
                <span className="text-[10px] text-muted-foreground font-normal lowercase">(ঐচ্ছিক)</span>
              </span>
              {addOnsTotalPerUnit > 0 && (
                <span className="text-xs font-bold text-primary">
                  + {formatAmount(addOnsTotalPerUnit)}
                </span>
              )}
            </div>
            <div className={`grid ${product.addOns.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
              {product.addOns.map((addOn) => {
                const qty = selectedAddOns[addOn.name] || 0;
                return (
                  <div
                    key={addOn.name}
                    className={`flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border transition-all ${
                      qty > 0
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 mb-2">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {addOn.name} {addOn.name.includes("কুচি") && !addOn.name.includes("পর্দা") ? "পর্দা" : ""}
                        </span>
                        <span className={`text-[11px] sm:text-xs font-bold shrink-0 ${
                          qty > 0 ? "text-primary font-extrabold" : "text-slate-600 dark:text-slate-400"
                        }`}>
                          ({formatAmount(addOn.price * (qty > 0 ? qty : 1))})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1 py-0.5">
                      <button
                        type="button"
                        aria-label={`Decrease ${addOn.name}`}
                        className={`h-7 w-7 flex items-center justify-center rounded-full text-sm font-bold bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white shadow-xs transition-all ${
                          qty > 0
                            ? "opacity-100 hover:brightness-110 active:scale-95 cursor-pointer"
                            : "opacity-30 cursor-not-allowed"
                        }`}
                        onClick={() => {
                          triggerHaptic("light");
                          setSelectedAddOns((prev) => ({
                            ...prev,
                            [addOn.name]: Math.max(0, qty - 1),
                          }));
                        }}
                        disabled={qty <= 0}
                      >
                        −
                      </button>
                      <span className="px-1.5 text-center text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {qty} পিস
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${addOn.name}`}
                        className="h-7 w-7 flex items-center justify-center rounded-full text-sm font-bold bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white opacity-100 hover:brightness-110 active:scale-95 transition-all shadow-xs cursor-pointer"
                        onClick={() => {
                          triggerHaptic("light");
                          setSelectedAddOns((prev) => ({
                            ...prev,
                            [addOn.name]: qty + 1,
                          }));
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Row: Quantity & Wishlist */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-full px-1.5 h-12 lg:h-14 w-32 lg:w-36 shrink-0 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <button
              className={`h-9 w-9 lg:h-11 lg:w-11 flex items-center justify-center rounded-full text-lg font-bold transition-all ${
                quantity > 1
                  ? "bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white hover:brightness-110 active:scale-95 shadow-xs cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-40 cursor-not-allowed"
              }`}
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
            >
              −
            </button>
            <span className="w-8 text-center font-bold text-[15px] text-foreground">{quantity}</span>
            <button
              className="h-9 w-9 lg:h-11 lg:w-11 flex items-center justify-center rounded-full text-lg font-bold bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white hover:brightness-110 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-40"
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= product.stock}
            >
              +
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center leading-tight">
            <span className="text-[10px] lg:text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total Price</span>
            <div className="flex items-baseline gap-2">
              {product.discount > 0 && (
                <span className="text-sm line-through text-muted-foreground font-medium">
                  {formatAmount(floorToNearest50((displayPrice / (1 - product.discount / 100)) * quantity))}
                </span>
              )}
              <span className="font-bold text-lg lg:text-xl text-foreground">
                {formatAmount(displayPrice * quantity)}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            disabled={isAdding || isRemoving}
            className="h-12 w-12 lg:h-14 lg:w-14 shrink-0 rounded-full border-border bg-background hover:bg-secondary/50 transition-colors ml-auto"
            onClick={(e) => {
              triggerHaptic("selection");
              handleWishlistToggle(e);
            }}
          >
            <Heart
              className={`h-5 w-5 transition-all duration-300 ${
                isInWishlist ? "fill-foreground text-foreground" : "stroke-foreground"
              }`}
            />
          </Button>
        </div>

        {/* Main Actions: Add to Cart & Buy Now */}
        <div ref={mainCtaRef} className="grid grid-cols-2 gap-2 lg:gap-3">
          <Button
            variant="outline"
            className="h-12 lg:h-14 rounded-full text-sm lg:text-base font-semibold tracking-wide border-2 border-foreground bg-white dark:bg-slate-900 text-foreground hover:bg-foreground hover:text-background transition-all"
            disabled={!isInStock}
            onClick={() => {
              if (
                (!selectedSize && isSizeAvailable) ||
                (!selectedColor && isColorAvailable)
              ) {
                setDialogAction("cart");
                setIsDialogOpen(true);
              } else {
                handleAddToCart();
              }
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" fill="currentColor" />
            {isInStock ? t("addToCart") : t("outOfStock")}
          </Button>

          <Button
            className="animate-cta-wiggle h-12 lg:h-14 rounded-full text-sm lg:text-base font-semibold tracking-wide bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] hover:brightness-110 text-white shadow-lg shadow-[#B8245A]/25 transition-all"
            disabled={!isInStock}
            onClick={() => {
              if (
                (!selectedSize && isSizeAvailable) ||
                (!selectedColor && isColorAvailable)
              ) {
                setDialogAction("buy");
                setIsDialogOpen(true);
              } else {
                handleBuyNow();
              }
            }}
          >
            <Zap className="h-4 w-4 mr-2" fill="currentColor" />
            {t("buyNow")}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <a
            href={`tel:${footerPhone.replace(/[^0-9+]/g, "")}`}
            className="flex items-center justify-center h-12 rounded-full font-medium border border-border bg-background hover:bg-secondary/50 transition-colors text-sm"
          >
            <Phone className="mr-2 h-4 w-4" fill="currentColor" />
            {t("phoneOrder")}
          </a>
          <a
            href={whatsappOrderHref}
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center h-12 rounded-full font-medium border border-green-500 bg-white dark:bg-slate-900 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors text-sm"
          >
            <MessageCircle className="mr-2 h-4 w-4" fill="currentColor" />
            {t("whatsappOrder")}
          </a>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl text-center mt-1 border-none! shadow-none! ring-0!">
          <div className="flex flex-col items-center justify-center p-1">
            <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-1" />
            <span className="text-[11px] sm:text-xs font-bold text-foreground leading-tight">ক্যাশ অন ডেলিভারি</span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">পণ্য পেয়ে টাকা দিন</span>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-border/60 p-1">
            <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-1" />
            <span className="text-[11px] sm:text-xs font-bold text-foreground leading-tight">দেখে নেওয়ার সুযোগ</span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">খুলে চেক করে নিন</span>
          </div>
          <div className="flex flex-col items-center justify-center p-1">
            <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-1" />
            <span className="text-[11px] sm:text-xs font-bold text-foreground leading-tight">সহজ রিপ্লেসমেন্ট</span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">৭ দিনের গ্যারান্টি</span>
          </div>
        </div>
      </div>

      {/* Smart Sticky Bottom Bar - Only visible on mobile when main in-page button is NOT in view */}
      <div 
        className={`lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border py-2 sm:py-2.5 px-3 sm:px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_25px_rgba(0,0,0,0.12)] transform transition-transform duration-300 z-50 ${
          showStickyBar ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-1 sm:px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
            {product.images && product.images[0] && (
              <div className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg overflow-hidden bg-secondary/20 border border-border/50 shadow-xs">
                {/* sizes: without it a `fill` image assumes 100vw, so this
                    40-44px thumbnail fetched a ~1200px photo while the page's
                    LCP image was still loading. */}
                <FallbackImage
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate text-xs sm:text-sm text-foreground leading-tight">{product.name}</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xs sm:text-sm font-extrabold text-primary">{formatAmount(displayPrice * quantity)}</span>
                <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">(ক্যাশ অন ডেলিভারি)</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button
              className="animate-cta-wiggle h-11 sm:h-12 px-5 sm:px-7 rounded-full text-xs sm:text-sm font-bold bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] hover:brightness-110 text-white shadow-md shadow-[#B8245A]/30 transition-all cursor-pointer whitespace-nowrap"
              disabled={!isInStock}
              onClick={() => {
                if (
                  (!selectedSize && isSizeAvailable) ||
                  (!selectedColor && isColorAvailable)
                ) {
                  setDialogAction("buy");
                  setIsDialogOpen(true);
                } else {
                  handleBuyNow();
                }
              }}
            >
              <Zap className="h-4 w-4 mr-1.5" fill="currentColor" />
              {language === "bn" ? "অর্ডার করুন" : t("buyNow")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductPicker;
