"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React, { useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ChevronRight, CreditCard, Truck, Lock, User, Calendar, Zap, Phone, MapPin, Mail } from "lucide-react";
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
    { fullName: draftName, phone: draftPhone, email: draftEmail, address: draftAddress, shippingZone: draftZone },
    draftItems,
  );

  const selectedPaymentMethod = useWatch({
    control: form.control,
    name: "paymentMethod",
    defaultValue: defaultMethod,
  });

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
    const initialZone = form.getValues("shippingZone") || "inside_dhaka";
    if (zoneCosts[initialZone] !== undefined) {
      setShipping(zoneCosts[initialZone]);
    }
  }, [zoneCosts, setShipping, form]);

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
            nameOnCard: values.nameOnCard,
          };

    mutate({
      shippingInfo: {
        fullName: values.fullName,
        // Send the canonical 01XXXXXXXXX form (validation already guaranteed it
        // normalizes) so the courier and fraud checker get ASCII digits.
        phone: values.phone ? (normalizeBdPhone(values.phone) ?? values.phone) : (values.phone ?? ""),
        email: values.email,
        address: values.address,
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
          <Card className="bg-card rounded-2xl gap-3 p-3.5 sm:p-5 w-full ring-0">
            <CardHeader className="p-0 sm:mb-2.5">
              <CardTitle className="text-lg sm:text-xl font-bold text-foreground">{t(bkashEnabled ? "deliveryInfoTitle" : "deliveryTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 w-full space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField name="fullName" control={form.control} render={({ field }) => (
                  <FormItem className="gap-0.5 space-y-0">
                    <div className="relative">
                      <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <FormControl>
                        <Input type="text" placeholder={`${t("fullNameLabel")} *`} className="h-10 rounded-xl border border-border/40 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/40 pt-1 pb-0 pr-3 pl-10 text-sm shadow-inner placeholder:text-muted-foreground/50 focus-visible:bg-white dark:focus-visible:bg-slate-700 dark:focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-primary/20" {...field} />
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
                    <MapPin aria-hidden="true" className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground/60" />
                    <FormControl>
                      <Textarea placeholder={`${t("addressLabel")} *`} rows={2} className="min-h-[44px] resize-none rounded-xl border border-border/40 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/40 py-2 pr-3 pl-10 text-sm shadow-inner placeholder:text-muted-foreground/50 focus-visible:bg-white dark:focus-visible:bg-slate-700 dark:focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-primary/20" {...field} />
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
                          field.onChange(val);
                          if (zoneCosts[val] !== undefined) {
                            setShipping(zoneCosts[val]);
                          }
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
                      className="grid grid-cols-2 gap-2"
                    >
                      {cardEnabled && (
                        <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${selectedPaymentMethod === "card" ? "border-foreground bg-muted/20" : "border-border/40"}`}>
                          <Label className="flex items-center justify-between p-3 cursor-pointer w-full m-0">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${selectedPaymentMethod === "card" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>
                                <CreditCard className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-bold text-xs sm:text-sm">{t("cardPayment")}</span>
                            </div>
                            <RadioGroupItem value="card" className={selectedPaymentMethod === "card" ? "border-foreground text-foreground" : "opacity-50"} />
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
                                      <Input placeholder=" " className="h-10 bg-background border border-border/40 rounded-xl px-3 pl-9 text-sm" {...field} />
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
                        <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${selectedPaymentMethod === "cod" ? "border-foreground bg-muted/20" : "border-border/40"}`}>
                          <Label className="flex items-center justify-between p-3 cursor-pointer w-full m-0">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${selectedPaymentMethod === "cod" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>
                                <Truck className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-bold text-xs sm:text-sm">{t("cashOnDelivery")}</span>
                            </div>
                            <RadioGroupItem value="cod" className={selectedPaymentMethod === "cod" ? "border-foreground text-foreground" : "opacity-50"} />
                          </Label>
                        </div>
                      )}
                      {bkashEnabled && (
                        <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${selectedPaymentMethod === "bkash" ? "border-[#E2136E] bg-[#E2136E]/5" : "border-border/40"}`}>
                          <Label className="flex items-center justify-between p-3 cursor-pointer w-full m-0">
                            <div className="flex items-center gap-2.5">
                              <Image src="/bkash-logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-bold text-xs sm:text-sm">{t("bkashPayment")}</span>
                                <span className="text-[11px] text-muted-foreground font-normal">{t("bkashPaymentDesc")}</span>
                              </div>
                            </div>
                            <RadioGroupItem value="bkash" className={selectedPaymentMethod === "bkash" ? "border-[#E2136E] text-[#E2136E]" : "opacity-50"} />
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

            {/* Reassurance Badges */}
            <div className="p-3 rounded-2xl bg-secondary/30 dark:bg-slate-900/60 border border-border/40 grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center">
                <Truck className="h-4 w-4 text-primary mb-0.5" />
                <span className="text-[11px] font-bold text-foreground">ক্যাশ অন ডেলিভারি</span>
                <span className="text-[9px] text-muted-foreground">অগ্রিম পেমেন্ট নেই</span>
              </div>
              <div className="flex flex-col items-center border-x border-border/40">
                <CheckCircle2 className="h-4 w-4 text-primary mb-0.5" />
                <span className="text-[11px] font-bold text-foreground">দেখে নেওয়ার সুযোগ</span>
                <span className="text-[9px] text-muted-foreground">খুলে চেক করুন</span>
              </div>
              <div className="flex flex-col items-center">
                <Lock className="h-4 w-4 text-primary mb-0.5" />
                <span className="text-[11px] font-bold text-foreground">নিরাপদ অর্ডার</span>
                <span className="text-[9px] text-muted-foreground">৭ দিনের গ্যারান্টি</span>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default ShippingInformationCard;
