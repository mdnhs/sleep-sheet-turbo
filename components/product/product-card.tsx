"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Heart, Star, ChevronUp, ShoppingCart, X, Tag, ArrowUpCircle, Zap } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { ProductSummary } from "@/lib/types";
import { useWishlistToggle } from "@/lib/helpers";
import { useLanguage } from "@/hooks/use-language";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { useCurrent } from "@/features/auth/api/use-current";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackEvent } from "@/lib/traffic-tracker";
import { trackGtmAddToCart, trackGtmBeginCheckout } from "@/lib/gtm";
import { afterNextPaint } from "@/lib/after-next-paint";
import OptimizedImage from "@/components/ui/optimized-image";
import { floorToNearest50 } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummary & {
    discountTag?: string;
  };
  priority?: boolean;
}

const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const { t } = useLanguage();
  const { handleWishlistToggle, isAdding, isRemoving, isInWishlist } =
    useWishlistToggle({
      productId: product.id,
    });
  const { formatAmount } = useCurrency();
  const addToCart = useCartStore((state) => state.addToCart);
  const { data: user } = useCurrent();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"cart" | "buy" | null>(null);
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || "");
  const [selectedColor, setSelectedColor] = useState(product.defaultVariantName || product.colors?.[0]?.name || "");
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);

  const hasColors = product.colors && product.colors.length > 0;
  const hasSizes = product.sizes && product.sizes.length > 0;
  const hasAddOns = product.addOns && product.addOns.length > 0;
  const hasVariants = hasColors || hasSizes || hasAddOns;

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
      return addOn ? `${name} x${qty} (${formatAmount(addOn.price)})` : `${name} x${qty}`;
    })
    .join(", ");

  const colorWithAddOns = selectedColor
    ? (selectedAddOnsSummary ? `${selectedColor} (+ ${selectedAddOnsSummary})` : selectedColor)
    : (selectedAddOnsSummary ? `Add-ons: ${selectedAddOnsSummary}` : "");

  const dispatchAddToCart = () => {
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
        quantity,
        size: selectedSize || undefined,
        color: finalColor || undefined,
        name: product.name,
        price: displayPrice,
        image: product.images?.[0] ?? "",
        description: product.description || "",
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

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      setDialogAction("buy");
      setIsDrawerOpen(!isDrawerOpen);
    } else {
      dispatchAddToCart();
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
          },
        ],
      });
      trackEvent("buy_now", `/shop/${product.slug}`, product.name, {
        productId: product.id,
        quantity,
        price: displayPrice,
      });
      // The toast (sonner mounts it with flushSync) and the navigation go
      // through the same after-paint queue as the tracking pushes above: the
      // tap paints first, and the pushes reach GTM while the URL is still
      // this page's, before /checkout commits.
      afterNextPaint(() => {
        toast.success("Added to cart successfully");
        router.push("/checkout");
      });
    }
  };

  const handleAddToCartVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (hasSizes && !selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (hasColors && !selectedColor) {
      toast.error("Please select a color");
      return;
    }
    
    dispatchAddToCart();
    toast.success("Added to cart successfully");
    setIsDrawerOpen(false);
  };

  const handleBuyNowVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (hasSizes && !selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (hasColors && !selectedColor) {
      toast.error("Please select a color");
      return;
    }
    
    dispatchAddToCart();
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
          item_variant: [selectedSize, selectedColor].filter(Boolean).join(" / ") || undefined,
        },
      ],
    });
    trackEvent("buy_now", `/shop/${product.slug}`, product.name, {
      productId: product.id,
      quantity,
      price: displayPrice,
    });
    setIsDrawerOpen(false);
    // After the tracking pushes, as in the quick-buy handler above.
    afterNextPaint(() => {
      toast.success("Added to cart successfully");
      router.push("/checkout");
    });
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If it has variants and not fully selected or drawer closed, open drawer
    if (hasVariants && (!isDrawerOpen || (hasSizes && !selectedSize) || (hasColors && !selectedColor))) {
      setDialogAction("cart");
      setIsDrawerOpen(true);
      return;
    }

    dispatchAddToCart();
    toast.success("Added to cart successfully");
    setIsDrawerOpen(false);
  };

  const updateQuantity = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setQuantity(Math.max(1, quantity + delta));
  };

  return (
    <div className="group relative w-full h-full flex flex-col rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 p-1.5 sm:p-3 overflow-hidden transition-all duration-300">
      
      {/* Product Image */}
      <div
        onClick={() => {
          if (!isDrawerOpen) {
            router.push(`/shop/${product.slug}`);
          }
        }}
        className="relative w-full aspect-[4/3] rounded-xl sm:rounded-[20px] overflow-hidden bg-[#f4f4f5] dark:bg-slate-800 mb-2 sm:mb-4 shrink-0 z-0 cursor-pointer"
      >
        <OptimizedImage
          src={product.images?.[0]}
          width={400}
          alt={product.name}
          fill
          // Product cards occupy a full-width carousel item on mobile, then
          // two, three and four columns as the viewport grows. The previous
          // 33vw desktop hint made Cloudinary serve 750px images into roughly
          // 300px cards on wide screens.
          sizes="(max-width: 1200px) 50vw, 25vw"
          priority={priority}
          quality={55}
          className={`w-full h-full object-cover transition-all duration-700 ${isDrawerOpen ? 'blur-md scale-110 opacity-40' : 'group-hover:scale-105'}`}
        />
        
        {/* Top actions: Discount tag */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex justify-between items-start z-10 w-[calc(100%-16px)] sm:w-[calc(100%-24px)]" onClick={(e) => e.stopPropagation()}>
          {product.discount && product.discount > 0 ? (
            // Same iOS-style liquid-glass treatment as the hero carousel's
            // "Order Now" CTA (components/home/hero.tsx) — translucent white,
            // blurred/saturated backdrop, and a soft inset rim instead of a
            // hard border, rather than a flat/gradient fill.
            <div className="bg-white/15 text-black px-2.5 py-1.5 rounded-lg text-[10px] font-bold backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-1px_1px_rgba(0,0,0,0.08),0_8px_20px_rgba(0,0,0,0.16)] flex items-center gap-1.5 uppercase tracking-wider">
              <Tag className="h-3 w-3 text-black" /> {Math.round(product.discount)}% OFF
            </div>
          ) : (
            <div />
          )}

          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleWishlistToggle(e);
            }}
            className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-sm hover:bg-white dark:hover:bg-slate-700 hover:scale-110 transition-all duration-300 active:scale-95"
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-4 w-4 transition-colors ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-slate-600 dark:text-slate-400 hover:text-red-500'}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col px-0.5 sm:px-1 flex-1 relative z-10 bg-white dark:bg-slate-900">
        
        {/* Title */}
        <Link href={`/shop/${product.slug}`} className="flex-1" onClick={(e) => { if (isDrawerOpen) e.preventDefault(); }}>
          <h3 className="font-medium text-sm sm:text-[15px] text-slate-800 dark:text-slate-200 leading-snug truncate mb-1 sm:mb-3" title={product.name}>
            {product.name}
          </h3>
        </Link>
        
        {/* Price and Rating Row */}
        {/* On mobile the old price always gets its own line (an empty one when
            there is no discount), so every card's price block is the same
            height. Cards in a carousel stretch to the tallest one, and a
            price that wrapped to two lines on a single card used to leave a
            big gap between the title and the price on all the others. */}
        <div className="flex justify-between items-end sm:items-center min-h-12 sm:min-h-0 mb-1.5 sm:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 sm:flex-wrap">
            {product.discount > 0 ? (
              <span className="text-sm leading-5 line-through text-slate-500 dark:text-slate-400 font-medium">
                {formatAmount(floorToNearest50(displayPrice / (1 - product.discount / 100)))}
              </span>
            ) : (
              <span className="h-5 sm:hidden" aria-hidden="true" />
            )}
            <p className="font-bold text-lg sm:text-[20px] text-slate-800 dark:text-slate-200">
              {formatAmount(displayPrice)}
            </p>
          </div>
          
          {(product.reviewCount ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[14px] text-slate-600 dark:text-slate-400 font-medium">
                {product.rating}{" "}
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  ({product.reviewCount})
                </span>
              </span>
              <div className="bg-[#f59e0b] p-1 rounded-md">
                <Star className="h-3.5 w-3.5 fill-white text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Quantity & Cart Row */}
        <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-4">
          {/* Quantity Selector — same stepper as the add-on selector below:
              bordered pill, tinted square −/+ buttons, "N পিস" label. */}
          <div className="flex-1 flex items-center justify-between gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 h-10 sm:h-12" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <button
              type="button"
              onClick={(e) => updateQuantity(e, -1)}
              className="h-8 w-7 sm:h-9 sm:w-9 shrink-0 flex items-center justify-center rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-700"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="text-center text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
              {quantity} {t("piece")}
            </span>
            <button
              type="button"
              onClick={(e) => updateQuantity(e, 1)}
              className="h-8 w-7 sm:h-9 sm:w-9 shrink-0 flex items-center justify-center rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Quick Add to Cart Button */}
          <button
            onClick={handleQuickAdd}
            className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-[linear-gradient(135deg,#2d2d2d,#1a1a1a)] hover:brightness-110 rounded-xl flex items-center justify-center text-white transition-colors active:scale-95"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Dialog for Variants */}
      {isDrawerOpen && (
      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("selectOption")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {hasSizes && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Size</span>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedSize(size); }}
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

            {hasColors && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t("variants")}</span>
                <div className="flex flex-wrap gap-2">
                  {product.colors?.map((color) => (
                    <button
                      key={color.name}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedColor(color.name); }}
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

            {hasAddOns && (
              <div className="flex flex-col gap-2.5 mt-2 border-t pt-3 border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t("addOns")}
                </span>
                <div className="flex flex-col gap-2">
                  {product.addOns?.map((addOn) => {
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
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <div className="flex flex-col justify-center min-w-0 pr-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {addOn.name} ({formatAmount(addOn.price)} {t("perPiece")})
                          </span>
                          {qty > 0 && (
                            <span className="text-[11px] font-medium text-primary mt-0.5">
                              {t("totalLabel")}: {formatAmount(addOn.price * qty)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shrink-0">
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
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
                            {qty} {t("piece")}
                          </span>
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
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
          </div>
          <div className="flex gap-2 w-full mt-4">
            {dialogAction === "cart" && (
              <button
                onClick={handleAddToCartVariant}
                className="flex-1 flex items-center justify-center gap-1 sm:gap-2 bg-[#f8f9fa] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-3 sm:py-3.5 px-2 sm:px-3 rounded-[14px] font-bold text-xs sm:text-sm transition-all active:scale-[0.98]"
              >
                <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t("cart")}
              </button>
            )}
            {dialogAction === "buy" && (
              <button
                onClick={handleBuyNowVariant}
                className="animate-cta-wiggle flex-1 flex items-center justify-center gap-1 sm:gap-2 bg-primary text-primary-foreground hover:bg-primary/90 py-3 sm:py-3.5 px-2 sm:px-3 rounded-[14px] font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98]"
              >
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" />
                {t("buyNow")}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Action Button */}
      <div className="relative z-40 px-1 shrink-0 bg-white dark:bg-slate-900">
        <button
          onClick={handleActionClick}
          className="animate-cta-wiggle w-full flex items-center justify-between bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] sm:bg-none sm:bg-primary text-white sm:text-primary-foreground hover:brightness-110 sm:hover:bg-primary/90 py-3 sm:py-3.5 px-4 sm:px-5 rounded-[14px] font-medium text-xs sm:text-[14px] transition-all active:scale-[0.98]"
        >
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" /> {t("buyNow")}</span>
          <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5 opacity-80 rotate-90" />
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
