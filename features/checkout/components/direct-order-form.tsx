"use client";

import React, { useState, useId } from "react";
import { Product } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { useCurrent } from "@/features/auth/api/use-current";
import { UseCheckout } from "@/features/checkout/api/use-checkout";
import { isValidBdMobile11, normalizeBdPhone } from "@/features/fraud-checker/phone";
import { useCurrency } from "@/hooks/use-currency";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import {
  Truck,
  ShieldCheck,
  Sparkles,
  Phone,
  User,
  MapPin,
  Loader2,
} from "lucide-react";

interface DirectOrderFormProps {
  product: Product;
  selectedColor?: string;
  selectedSize?: string;
  selectedAddOns?: Record<string, number>;
  quantity: number;
  onQuantityChange?: (qty: number) => void;
  baseDisplayPrice: number;
  addOnsTotalPerUnit?: number;
  shippingRates?: { insideDhaka: number; outsideDhaka: number };
}

export function DirectOrderForm({
  product,
  selectedColor = "",
  selectedSize = "",
  selectedAddOns = {},
  quantity,
  onQuantityChange,
  baseDisplayPrice,
  addOnsTotalPerUnit = 0,
  shippingRates: propShippingRates,
}: DirectOrderFormProps) {
  const { formatAmount } = useCurrency();
  const { shippingInsideDhaka, shippingOutsideDhaka } = useWebsiteSettings();

  const insideDhakaRate = propShippingRates?.insideDhaka ?? shippingInsideDhaka;
  const outsideDhakaRate = propShippingRates?.outsideDhaka ?? shippingOutsideDhaka;
  const nameInputId = useId();
  const phoneInputId = useId();
  const addressInputId = useId();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shippingZone, setShippingZone] = useState<"outside_dhaka" | "inside_dhaka">("outside_dhaka");
  const [touched, setTouched] = useState({ name: false, phone: false, address: false });

  const { mutate, isPending } = UseCheckout();
  const { data: user } = useCurrent();
  const addToCart = useCartStore((state) => state.addToCart);
  const clearGuestCart = useCartStore((state) => state.clearGuestCart);

  // Derive bundle mode directly from quantity prop (single source of truth, no cascading renders)
  const selectedBundle: 1 | 2 = quantity >= 2 ? 2 : 1;
  const isBundle = selectedBundle === 2;
  const currentQty = isBundle ? 2 : 1;
  const unitPrice = baseDisplayPrice + addOnsTotalPerUnit;

  const rawProductTotal = unitPrice * currentQty;
  const productTotal = rawProductTotal;

  const normalDeliveryFee = shippingZone === "inside_dhaka" ? insideDhakaRate : outsideDhakaRate;
  const deliveryFee = isBundle ? 0 : normalDeliveryFee;
  const grandTotal = productTotal + deliveryFee;

  // Fixed prices for display in combo option card:
  const comboPrice = unitPrice * 2;
  const comboOriginalWithDelivery = comboPrice + normalDeliveryFee;

  // Phone Validation
  const normalizedPhone = normalizeBdPhone(phone);
  const isPhoneValid = isValidBdMobile11(phone);

  const handleBundleChange = (bundle: 1 | 2) => {
    triggerHaptic("selection");
    if (onQuantityChange) {
      onQuantityChange(bundle);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || fullName.trim().length < 2) {
      triggerHaptic("error");
      setTouched((prev) => ({ ...prev, name: true }));
      toast.error("দয়া করে আপনার পুরো নাম লিখুন");
      return;
    }

    if (!isPhoneValid || !normalizedPhone) {
      triggerHaptic("error");
      setTouched((prev) => ({ ...prev, phone: true }));
      toast.error("দয়া করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন");
      return;
    }

    if (!address.trim() || address.trim().length < 5) {
      triggerHaptic("error");
      setTouched((prev) => ({ ...prev, address: true }));
      toast.error("দয়া করে আপনার জেলা, থানা ও সম্পূর্ণ ঠিকানা লিখুন");
      return;
    }

    if (product.sizes?.length && !selectedSize) {
      triggerHaptic("error");
      toast.error("দয়া করে সাইজ নির্বাচন করুন");
      return;
    }

    triggerHaptic("medium");

    // Clear previous items and put this exact configuration into cart
    clearGuestCart();

    const addOnsSummary = Object.entries(selectedAddOns)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => `${name} x${qty}`)
      .join(", ");

    const finalVariantLabel = [
      selectedColor,
      selectedSize,
      addOnsSummary ? `পর্দা: ${addOnsSummary}` : "",
      isBundle ? "২ সেট স্পেশাল কম্বো" : "",
    ]
      .filter(Boolean)
      .join(" / ");

    addToCart({
      productId: product.id,
      quantity: currentQty,
      size: selectedSize || undefined,
      color: selectedColor || undefined,
      isAuthenticated: !!user?.id,
      guestProduct: {
        id: `guest-${product.id}-${Date.now()}`,
        productId: product.id,
        slug: product.slug,
        quantity: currentQty,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        name: product.name,
        price: unitPrice,
        image: product.images[0] ?? "",
        description: product.description,
      },
    });

    mutate({
      shippingInfo: {
        fullName: fullName.trim(),
        phone: normalizedPhone,
        email: "",
        address: address.trim(),
        shippingZone: shippingZone,
        notes: finalVariantLabel || (isBundle ? "২ সেট স্পেশাল কম্বো অফার (ফ্রি ডেলিভারি)" : ""),
      },
      paymentMethod: "cod",
      paymentInfo: { paymentMethod: "cod" },
    });
  };

  return (
    <section
      id="direct-order-form"
      data-order-cta="true"
      aria-label="ক্যাশ অন ডেলিভারি অর্ডার ফর্ম"
      className="mt-3 rounded-2xl sm:rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/40 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/10"
    >
      {/* Header Banner */}
      <div className="mb-3.5 border-b border-emerald-100/80 pb-3 dark:border-emerald-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
              ⚡ সহজ অর্ডার
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              ক্যাশ অন ডেলিভারি
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            পণ্য দেখে পেমেন্ট
          </span>
        </div>
        <h2 className="mt-1.5 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
          অর্ডার কনফার্ম করতে নিচের তথ্যগুলো দিন
        </h2>

        {/* Selected Variant Chip Indicator */}
        {(selectedColor || selectedSize) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">নির্বাচিত:</span>
            {selectedColor && (
              <span className="inline-flex items-center rounded-md bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                ডিজাইন: {selectedColor}
              </span>
            )}
            {selectedSize && (
              <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                সাইজ: {selectedSize}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Special Bundle Offer Cards */}
      <div className="mb-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* 1 Set Option */}
          <button
            type="button"
            onClick={() => handleBundleChange(1)}
            className={`relative flex items-center justify-between rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
              selectedBundle === 1
                ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedBundle === 1
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {selectedBundle === 1 && <span className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">১ সেট (রেগুলার)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">+ ডেলিভারি চার্জ</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {formatAmount(unitPrice)}
            </span>
          </button>

          {/* 2 Sets Bundle Option - Free Delivery */}
          <button
            type="button"
            onClick={() => handleBundleChange(2)}
            className={`relative flex items-center justify-between rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
              selectedBundle === 2
                ? "border-orange-500 bg-orange-50/80 dark:bg-orange-950/40 shadow-xs"
                : "border-orange-200 dark:border-orange-900/50 bg-orange-50/20 dark:bg-orange-950/10 hover:border-orange-300"
            }`}
          >
            <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
              <Sparkles className="h-3 w-3" /> ফ্রি ডেলিভারি 🔥
            </span>
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedBundle === 2
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {selectedBundle === 2 && <span className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">২ সেট (ডেলিভারি ফ্রি)</p>
                <p className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">ডেলিভারি চার্জ ০৳</p>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-xs font-bold text-orange-600 dark:text-orange-400">
                {formatAmount(comboPrice)}
              </span>
              <span className="text-[10px] line-through text-slate-400">
                {formatAmount(comboOriginalWithDelivery)}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* The Order Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Full Name */}
        <div>
          <label htmlFor={nameInputId} className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <User className="h-3.5 w-3.5 text-emerald-600" />
            <span>আপনার নাম <span className="text-rose-500">*</span></span>
          </label>
          <Input
            id={nameInputId}
            type="text"
            required
            autoComplete="name"
            placeholder="আপনার পুরো নাম লিখুন"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
            className="h-11 rounded-xl bg-white dark:bg-slate-900 text-sm border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500"
          />
          {touched.name && !fullName.trim() && (
            <p className="mt-1 text-[11px] text-rose-500">আপনার নামটি লিখুন</p>
          )}
        </div>

        {/* Mobile Number with 11-digit Live Feedback */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor={phoneInputId} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span>মোবাইল নম্বর <span className="text-rose-500">*</span></span>
            </label>
            {phone.length > 0 && (
              <span
                className={`text-[11px] font-bold ${
                  isPhoneValid ? "text-emerald-600" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {isPhoneValid ? "✓ সঠিক ১১ ডিজিট" : `${phone.replace(/\D/g, "").length}/১১ ডিজিট`}
              </span>
            )}
          </div>
          <Input
            id={phoneInputId}
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
            className={`h-11 rounded-xl bg-white dark:bg-slate-900 text-sm ${
              touched.phone && !isPhoneValid
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-400"
                : isPhoneValid
                ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500"
                : "border-slate-200 dark:border-slate-800"
            }`}
          />
          {touched.phone && !isPhoneValid && (
            <p className="mt-1 text-[11px] text-rose-500">
              ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন (যেমন: 018XXXXXXXX)
            </p>
          )}
        </div>

        {/* Delivery Zone Toggle */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Truck className="h-3.5 w-3.5 text-emerald-600" />
            <span>ডেলিভারি এলাকা <span className="text-rose-500">*</span></span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShippingZone("outside_dhaka");
              }}
              className={`flex items-center justify-between rounded-xl border-2 p-2.5 text-xs font-bold transition-all cursor-pointer ${
                shippingZone === "outside_dhaka"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 hover:border-slate-300"
              }`}
            >
              <div className="text-left">
                <span className="block leading-tight">ঢাকার বাইরে</span>
                <span className="text-[10px] font-normal text-slate-500">২-৩ দিন</span>
              </div>
              <span className={isBundle ? "text-emerald-600 font-extrabold" : "text-slate-700 dark:text-slate-300"}>
                {isBundle ? "ফ্রি" : formatAmount(outsideDhakaRate)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setShippingZone("inside_dhaka");
              }}
              className={`flex items-center justify-between rounded-xl border-2 p-2.5 text-xs font-bold transition-all cursor-pointer ${
                shippingZone === "inside_dhaka"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 hover:border-slate-300"
              }`}
            >
              <div className="text-left">
                <span className="block leading-tight">ঢাকার ভিতরে</span>
                <span className="text-[10px] font-normal text-slate-500">১ দিন</span>
              </div>
              <span className={isBundle ? "text-emerald-600 font-extrabold" : "text-slate-700 dark:text-slate-300"}>
                {isBundle ? "ফ্রি" : formatAmount(insideDhakaRate)}
              </span>
            </button>
          </div>
        </div>

        {/* Full Delivery Address */}
        <div>
          <label htmlFor={addressInputId} className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            <span>সম্পূর্ণ ঠিকানা <span className="text-rose-500">*</span></span>
          </label>
          <Textarea
            id={addressInputId}
            required
            rows={2}
            autoComplete="street-address"
            placeholder="আপনার জেলা, থানা/উপজেলা ও এলাকার নাম লিখুন..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, address: true }))}
            className="rounded-xl bg-white dark:bg-slate-900 text-sm border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500 resize-none"
          />
          {touched.address && !address.trim() && (
            <p className="mt-1 text-[11px] text-rose-500">আপনার সম্পূর্ণ ঠিকানাটি লিখুন</p>
          )}
        </div>

        {/* Bill Summary Card */}
        <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>পণ্য ({currentQty} সেট):</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatAmount(rawProductTotal)}</span>
          </div>

          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>ডেলিভারি চার্জ:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {deliveryFee === 0 ? (
                <span className="text-emerald-600 font-bold">সম্পূর্ণ ফ্রি (০৳)</span>
              ) : (
                formatAmount(deliveryFee)
              )}
            </span>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-baseline">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">সর্বমোট প্রদেয় বিল:</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatAmount(grandTotal)}
            </span>
          </div>
        </div>

        {/* Animated Big Submit Button */}
        <Button
          type="submit"
          data-order-cta="true"
          disabled={isPending}
          className={`w-full h-13 sm:h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base sm:text-lg shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.99] cursor-pointer ${
            !isPending ? "animate-cta-wiggle" : ""
          }`}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>অর্ডার প্রসেস হচ্ছে...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>অর্ডার কনফার্ম করুন — {formatAmount(grandTotal)}</span>
            </span>
          )}
        </Button>

        {/* Single Strong COD Reassurance Note */}
        <div className="pt-0.5 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span><strong>ক্যাশ অন ডেলিভারি:</strong> পার্সেল খুলে দেখে চেক করে টাকা পরিশোধ করবেন।</span>
          </p>
        </div>
      </form>
    </section>
  );
}
