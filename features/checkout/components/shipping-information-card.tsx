"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { capitalizeWords } from "@/lib/capitalize-words";
import React, { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import type { DeliveryAndPaymentFormValues } from "../schema";
import { SHIPPING_ZONES, type ShippingZone } from "../constants";
import { deliveryAndPaymentResolver } from "../delivery-resolver";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Truck, Lock, User, Calendar, Zap, Phone, MapPin, Mail } from "lucide-react";
import { TrustBadges } from "@/components/trust-badges";
import { TotalBillChip } from "./total-bill-chip";
import { useLivePromotions } from "@/features/promotions/api/use-live-promotions";
import { findFreeDelivery } from "@/lib/promotions";
import { burstConfetti } from "@/lib/confetti-burst";
import { OFFER_TOASTER_ID } from "./offer-toaster";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { useSettings } from "@/features/settings/api/use-settings";
import { useCurrency } from "@/hooks/use-currency";
import { useCurrent } from "@/features/auth/api/use-current";
import { UseCheckout } from "../api/use-checkout";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { normalizeBdPhone } from "@/features/fraud-checker/phone";
import { primeGtmIdentity } from "@/lib/gtm";
import { triggerHaptic } from "@/lib/haptics";
import { useCheckoutDraft } from "@/features/web-analytics/lib/checkout-draft";

function scheduleGtmIdentity(data: { phone?: string; email?: string }) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      void primeGtmIdentity(data);
    }, { timeout: 1000 });
  } else {
    setTimeout(() => {
      void primeGtmIdentity(data);
    }, 50);
  }
}

interface ShippingInformationCardProps {
  initialSettings?: Record<string, string> | null;
}

function ShippingInformationCard({ initialSettings }: ShippingInformationCardProps = {}) {
  const setShipping = useCartStore((state) => state.setShipping);
  const { data: fetchedSettings } = useSettings();
  const settings = fetchedSettings || initialSettings;
  const { formatAmount } = useCurrency();
  const { data: currentUser } = useCurrent();
  const { mutate, isPending } = UseCheckout();
  const { t, language } = useLanguage();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deliveryAndPaymentSchema = useMemo(() => deliveryAndPaymentResolver(t), [language]);

  // Hard-disabled regardless of the payment_method_card setting: there is no
  // real payment gateway integrated, so this option must not be offered
  // until one is (see features/checkout/server/route.ts).
  const cardEnabled = false;
  const codEnabled = settings ? settings.payment_method_cod !== "false" : true;
  // Offered when the admin has switched bKash on in Settings → Payments (the
  // switch only unlocks once every credential is saved, and the server
  // re-checks that when an order is placed).
  const bkashEnabled = !!settings && settings.payment_method_bkash === "true";
  const paymentMethodsCount = [cardEnabled, codEnabled, bkashEnabled].filter(Boolean).length;
  const defaultMethod = cardEnabled ? "card" : codEnabled || !bkashEnabled ? "cod" : "bkash";

  const zoneCosts: Record<string, number> = useMemo(() => ({
    inside_dhaka: Number(settings?.shipping_inside_dhaka ?? SHIPPING_ZONES.inside_dhaka.cost),
    outside_dhaka: Number(settings?.shipping_outside_dhaka ?? SHIPPING_ZONES.outside_dhaka.cost),
  }), [settings?.shipping_inside_dhaka, settings?.shipping_outside_dhaka]);

  const form = useForm<DeliveryAndPaymentFormValues>({
    resolver: deliveryAndPaymentSchema,
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: currentUser?.name ?? "",
      phone: currentUser?.phone ?? "",
      email: currentUser?.email ?? "",
      address: currentUser?.address ?? "",
      shippingZone: "inside_dhaka",
      paymentMethod: defaultMethod,
      cardNumber: "",
      cvv: "",
      expirationDate: "",
      nameOnCard: "",
    },
  });

  // Coming back from a failed/cancelled bKash payment (see features/bkash):
  // say so once, then drop the query param so a refresh doesn't repeat it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const outcome = url.searchParams.get("payment");
    const message = url.searchParams.get("message");
    if (outcome !== "failed" && outcome !== "cancelled") return;
    toast.error(message || (outcome === "cancelled" ? t("bkashPaymentCancelled") : t("bkashPaymentFailed")));
    url.searchParams.delete("payment");
    if (message) url.searchParams.delete("message");
    window.history.replaceState(null, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abandoned-checkout autosave: contact fields only, never card details.
  const [draftName, draftPhone, draftEmail, draftAddress, draftZone] = useWatch({
    control: form.control,
    name: ["fullName", "phone", "email", "address", "shippingZone"],
  });
  const cartItems = useCartStore((state) => state.items);
  const guestCartItems = useCartStore((state) => state.guestItems);
  const draftItems = useMemo(() => [...cartItems, ...guestCartItems], [cartItems, guestCartItems]);
  const draft = useCheckoutDraft(
    {
      fullName: draftName && capitalizeWords(draftName),
      phone: draftPhone,
      email: draftEmail,
      address: draftAddress && capitalizeWords(draftAddress),
      shippingZone: draftZone,
    },
    draftItems,
  );

  const selectedPaymentMethod = useWatch({
    control: form.control,
    name: "paymentMethod",
    defaultValue: defaultMethod,
  });

  // Free delivery from a live promotion, with the same rule the server
  // applies when the order is placed (lib/promotions.ts).
  const { data: livePromotions } = useLivePromotions();
  const subtotal = useMemo(() => draftItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [draftItems]);
  const zone = draftZone || "inside_dhaka";
  const freeDeliveryFor = (paymentMethod: string) =>
    findFreeDelivery(livePromotions ?? [], { paymentMethod, zone, subtotal }) !== null;
  const deliveryIsFree = freeDeliveryFor(selectedPaymentMethod);

  useEffect(() => {
    const errorFields = Object.keys(form.formState.errors);
    if (errorFields.length > 0) {
      form.trigger(errorFields as (keyof DeliveryAndPaymentFormValues)[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.name && !form.getValues("fullName")) form.setValue("fullName", currentUser.name);
    if (currentUser.email && !form.getValues("email")) form.setValue("email", currentUser.email);
    if (currentUser.phone && !form.getValues("phone")) form.setValue("phone", currentUser.phone);
    if (currentUser.address && !form.getValues("address")) form.setValue("address", currentUser.address);
  }, [currentUser, form]);

  useEffect(() => {
    if (zoneCosts[zone] !== undefined) setShipping(deliveryIsFree ? 0 : zoneCosts[zone]);
  }, [zoneCosts, zone, deliveryIsFree, setShipping]);

  // Confetti from behind the delivery card when an offer starts to apply (the
  // customer picked bKash, changed zone, …). Not while the page is still
  // settling (cart, settings and promotions loading), so it never fires on load.
  const deliveryCardRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(0);
  const wasFree = useRef(deliveryIsFree);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);
  useEffect(() => {
    const was = wasFree.current;
    wasFree.current = deliveryIsFree;
    if (!deliveryIsFree || was || performance.now() - mountedAt.current < 1200) return;
    const rect = deliveryCardRef.current?.getBoundingClientRect();
    if (rect) burstConfetti(rect);
    // Phones and tablets only (below lg), where the order summary is out of
    // sight; on desktop it sits beside the form and already shows the saving.
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    toast.custom(
      () => (
        <div className="flex w-full justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/10 dark:bg-white dark:text-neutral-900">
            <span aria-hidden>🎉</span>
            {t("offerClaimed")}
          </div>
        </div>
      ),
      { id: "offer-claimed", toasterId: OFFER_TOASTER_ID, duration: 2500 },
    );
    // t only changes with the language; firing again for that would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryIsFree]);

  const onSubmit = (values: DeliveryAndPaymentFormValues) => {
    triggerHaptic("medium");
    draft.pause();
    const basePaymentInfo = { paymentMethod: values.paymentMethod };
    const paymentPayload =
      values.paymentMethod !== "card"
        ? basePaymentInfo
        : {
            ...basePaymentInfo,
            cardNumber: values.cardNumber,
            expirationDate: values.expirationDate,
            cvv: values.cvv,
            nameOnCard: values.nameOnCard && capitalizeWords(values.nameOnCard),
          };

    mutate({
      shippingInfo: {
        fullName: capitalizeWords(values.fullName),
        // Send the canonical 01XXXXXXXXX form (validation already guaranteed it
        // normalizes) so the courier and fraud checker get ASCII digits.
        phone: values.phone ? (normalizeBdPhone(values.phone) ?? values.phone) : (values.phone ?? ""),
        email: values.email,
        address: capitalizeWords(values.address),
        shippingZone: values.shippingZone,
        notes: values.notes,
      },
      paymentMethod: values.paymentMethod,
      paymentInfo: paymentPayload,
    }, { onError: draft.resume });
  };

  const onInvalid = () => {
    triggerHaptic("error");
  };

  return (
    <div className="w-full">
      <Form {...form}>
        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          <Card ref={deliveryCardRef} className="bg-card rounded-2xl gap-3 p-3.5 sm:p-5 w-full ring-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 p-0 sm:mb-2.5">
              <CardTitle className="min-w-0 truncate text-base sm:text-xl font-bold text-foreground">{t(bkashEnabled ? "deliveryInfoTitle" : "deliveryTitle")}</CardTitle>
              <TotalBillChip offerApplied={deliveryIsFree} />
            </CardHeader>
            <CardContent className="p-0 w-full space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField name="fullName" control={form.control} render={({ field }) => (
                  <FormItem className="gap-0.5 space-y-0">
                    <div className="relative">
                      <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <FormControl>
                        <Input type="text" placeholder={`${t("fullNameLabel")} *`} className="capitalize h-10 rounded-xl border border-border/40 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/40 pt-1 pb-0 pr-3 pl-10 text-sm shadow-inner placeholder:text-muted-foreground/50 focus-visible:bg-white dark:focus-visible:bg-slate-700 dark:focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-primary/20" {...field} />
                      </FormControl>
                      <FormLabel className="sr-only">{t("fullNameLabel")} *</FormLabel>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField name="phone" control={form.control} render={({ field }) => (
                  <FormItem className="gap-0.5 space-y-0">
                    <div className="relative">
                      <Phone aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder={`${t("phoneLabel")} *`}
                          className="h-10 rounded-xl border border-border/40 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/40 pt-1 pb-0 pr-3 pl-10 text-sm shadow-inner placeholder:text-muted-foreground/50 focus-visible:bg-white dark:focus-visible:bg-slate-700 dark:focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-primary/20"
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            const val = e.target.value?.trim();
                            if (val) {
                              scheduleGtmIdentity({ phone: val });
                            }
                          }}
                        />
                      </FormControl>
                      <FormLabel className="sr-only">{t("phoneLabel")} *</FormLabel>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField name="email" control={form.control} render={({ field }) => (
                <FormItem className="gap-0.5 space-y-0">
                  <div className="relative">
                    <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={`${t("emailLabel")}`}
                        className="h-10 rounded-xl border border-border/40 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/40 pt-1 pb-0 pr-3 pl-10 text-sm shadow-inner placeholder:text-muted-foreground/50 focus-visible:bg-white dark:focus-visible:bg-slate-700 dark:focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-primary/20"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          const val = e.target.value?.trim();
                          if (val && !form.getFieldState("email").invalid) {
                            scheduleGtmIdentity({ email: val });
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="sr-only">{t("emailLabel")}</FormLabel>
                  </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField name="address" control={form.control} render={({ field }) => (
                <FormItem className="gap-0.5 space-y-0">
                  <div className="relative">
                    <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <FormControl>
                      <Input type="text" placeholder={`${t("addressLabel")} *`} className="capitalize h-10 rounded-xl border border-border/40 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/40 pt-1 pb-0 pr-3 pl-10 text-sm shadow-inner placeholder:text-muted-foreground/50 focus-visible:bg-white dark:focus-visible:bg-slate-700 dark:focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-primary/20" {...field} />
                    </FormControl>
                    <FormLabel className="sr-only">{t("addressLabel")} *</FormLabel>
                  </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <p className="sr-only">{t("checkoutDraftNotice")}</p>

              <FormField name="shippingZone" control={form.control} render={({ field }) => {
                const zoneError = form.formState.errors.shippingZone;
                const hasError = !!zoneError;
                return (
                  <FormItem className="pt-0.5 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("deliveryZoneLabel")} *</label>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={(val) => {
                          triggerHaptic("selection");
                          // The delivery charge follows from the zone (see the effect above).
                          field.onChange(val);
                        }}
                        className="grid grid-cols-2 gap-2.5"
                      >
                        {(Object.entries(SHIPPING_ZONES) as [ShippingZone, { label: string; cost: number }][]).map(
                          ([key, { label }]) => {
                            const zoneLabels: Record<string, string> = {
                              inside_dhaka: t("insideDhaka"),
                              outside_dhaka: t("outsideDhaka"),
                            };
                            const isSelected = field.value === key;
                            return (
                              <label key={key} htmlFor={key}
                                className={`relative flex items-center justify-between rounded-xl border-2 p-3 cursor-pointer transition-all duration-300 select-none ${
                                  isSelected
                                    ? "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] scale-[1.02]"
                                    : hasError
                                      ? "border-red-500 bg-red-500/5 hover:border-red-400 active:scale-[0.98]"
                                      : "border-border/60 bg-background hover:border-foreground/40 hover:bg-muted/30 hover:shadow-md active:scale-[0.98]"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
                                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                                  }`}>
                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-sm text-foreground">{zoneLabels[key] || label}</span>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">{formatAmount(zoneCosts[key])}</p>
                                  </div>
                                </div>
                                <RadioGroupItem value={key} id={key} className="sr-only" />
                              </label>
                            );
                          }
                        )}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }} />
            </CardContent>
          </Card>

          {paymentMethodsCount > 1 && (
            <Card className="bg-card rounded-2xl gap-2 sm:gap-3 p-3.5 sm:p-5 w-full ring-0">
              <CardHeader className="p-0 sm:mb-2.5">
                <CardTitle className="text-lg sm:text-xl font-bold text-foreground">{t("paymentTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <RadioGroup
                      onValueChange={(val) => {
                        triggerHaptic("selection");
                        field.onChange(val);
                      }}
                      value={field.value}
                      className="grid grid-cols-2 gap-2 sm:gap-2.5"
                    >
                      {cardEnabled && (
                        <div
                          className={`relative border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                            selectedPaymentMethod === "card"
                              ? "border-foreground bg-muted/20 shadow-xs col-span-2"
                              : "border-border/60 hover:border-border hover:bg-muted/10"
                          }`}
                        >
                          <Label htmlFor="payment-card" className="flex items-center justify-between p-2.5 sm:p-3 cursor-pointer w-full m-0 gap-2">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  selectedPaymentMethod === "card"
                                    ? "bg-foreground text-background"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                <CreditCard className="h-4 w-4" />
                              </div>
                              <span className="font-bold text-xs sm:text-sm text-foreground leading-tight">
                                {t("cardPayment")}
                              </span>
                            </div>
                            <RadioGroupItem
                              id="payment-card"
                              value="card"
                              className={`shrink-0 ${
                                selectedPaymentMethod === "card"
                                  ? "border-foreground text-foreground"
                                  : "opacity-50"
                              }`}
                            />
                          </Label>
                          {selectedPaymentMethod === "card" && (
                            <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                              <FormField name="cardNumber" control={form.control} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("cardNumberLabel")}</label>
                                  <FormControl>
                                    <div className="relative">
                                      <Input placeholder="0000 0000 0000 0000" className="h-10 bg-background border border-border/40 rounded-xl px-3 pl-9 text-sm font-mono tracking-widest" {...field} />
                                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField name="nameOnCard" control={form.control} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("cardholderNameLabel")}</label>
                                  <FormControl>
                                    <div className="relative">
                                      <Input placeholder=" " className="capitalize h-10 bg-background border border-border/40 rounded-xl px-3 pl-9 text-sm" {...field} />
                                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <div className="grid grid-cols-2 gap-3">
                                <FormField name="expirationDate" control={form.control} render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("expiryLabel")}</label>
                                    <FormControl>
                                      <div className="relative">
                                        <Input placeholder="MM/YY" className="h-10 bg-background border border-border/40 rounded-xl px-3 pl-9 text-sm font-mono tracking-widest" {...field} />
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField name="cvv" control={form.control} render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("cvvLabel")}</label>
                                    <FormControl>
                                      <div className="relative">
                                        <Input placeholder="123" className="h-10 bg-background border border-border/40 rounded-xl px-3 pl-9 text-sm font-mono tracking-widest" {...field} />
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {codEnabled && (
                        <div
                          className={`relative border-2 rounded-xl overflow-hidden transition-all duration-200 h-full min-h-[58px] flex flex-col justify-center ${
                            selectedPaymentMethod === "cod"
                              ? "border-foreground bg-muted/20 shadow-xs"
                              : "border-border/60 hover:border-border hover:bg-muted/10"
                          }`}
                        >
                          <Label htmlFor="payment-cod" className="flex items-center justify-between p-2.5 sm:p-3 cursor-pointer w-full h-full m-0 gap-2">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  selectedPaymentMethod === "cod"
                                    ? "bg-foreground text-background"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                <Truck className="h-4 w-4" />
                              </div>
                              <span className="flex flex-col font-bold text-xs sm:text-sm text-foreground leading-tight">
                                {t("cashOnDelivery")}
                                {freeDeliveryFor("cod") && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{t("freeDelivery")}</span>
                                )}
                              </span>
                            </div>
                            <RadioGroupItem
                              id="payment-cod"
                              value="cod"
                              className={`shrink-0 ${
                                selectedPaymentMethod === "cod"
                                  ? "border-foreground text-foreground"
                                  : "opacity-50"
                              }`}
                            />
                          </Label>
                        </div>
                      )}
                      {bkashEnabled && (
                        <div
                          className={`relative border-2 rounded-xl overflow-hidden transition-all duration-200 h-full min-h-[58px] flex flex-col justify-center ${
                            selectedPaymentMethod === "bkash"
                              ? "border-[#E2136E] bg-[#E2136E]/5 shadow-xs"
                              : "border-border/60 hover:border-border hover:bg-muted/10"
                          }`}
                        >
                          <Label htmlFor="payment-bkash" className="flex items-center justify-between p-2.5 sm:p-3 cursor-pointer w-full h-full m-0 gap-2">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                <Image
                                  src="/bkash-icon.png"
                                  alt="bKash"
                                  width={32}
                                  height={32}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                              <span className="flex flex-col font-bold text-xs sm:text-sm text-foreground leading-tight">
                                {t("bkashPayment")}
                                {freeDeliveryFor("bkash") && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{t("freeDelivery")}</span>
                                )}
                              </span>
                            </div>
                            <RadioGroupItem
                              id="payment-bkash"
                              value="bkash"
                              className={`shrink-0 ${
                                selectedPaymentMethod === "bkash"
                                  ? "border-[#E2136E] text-[#E2136E]"
                                  : "opacity-50"
                              }`}
                            />
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {/* In normal document flow, not pinned to the viewport — a fixed
              bar sat on top of the delivery-zone cards instead of after
              them once the page was long enough that they hadn't scrolled
              out of the way yet. Getting the button on screen without
              scrolling is instead handled by shortening the form above:
              this card, the payment card and the zone picker all lost
              padding, and the delivery card's descriptive line under the
              heading is gone, since the field labels beneath it already say
              what to fill in. */}
          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={isPending}
              id="checkout-purchase-button"
              data-testid="checkout-purchase-button"
              className={cn(
                "w-full h-14 rounded-full text-sm lg:text-base font-semibold tracking-wide bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white hover:bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] hover:brightness-110 transition-all shadow-md shadow-[#B8245A]/30 cursor-pointer",
                !isPending && "animate-cta-wiggle"
              )}
            >
              {isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" fill="currentColor" />
                  {selectedPaymentMethod === "cod" ? t("placeOrder") : selectedPaymentMethod === "bkash" ? t("bkashPay") : t("confirmAndPay")}
                </div>
              )}
            </Button>

            <TrustBadges />
          </div>
        </form>
      </Form>
    </div>
  );
}

export default ShippingInformationCard;
