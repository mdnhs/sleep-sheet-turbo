"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryState } from "nuqs";
import {
  ArrowUpRight,
  Heart,
  Loader2,
  LockKeyhole,
  LayoutDashboard,
  MapPin,
  Package2,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrent } from "@/features/auth/api/use-current";
import { landingPath } from "@/lib/permissions";
import { useUpdateProfile } from "@/features/auth/api/use-update-profile";
import { useGetOrder } from "@/features/order/api/use-get-order";
import { useDeleteFromWishlist } from "@/features/wishlist/api/use-delete-from-wishlist";
import { useWishlist } from "@/features/wishlist/api/use-wishlist";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { cn, formatDate } from "@/lib/utils";
import FallbackImage from "@/components/ui/fallback-image";

interface AccountClientPageProps {
  name: string;
}

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(6, "Min 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

// Doubles as the account's tab switcher — the stat card *is* the nav item,
// so there's no separate duplicate-looking nav list beside the stats.
function StatTabTrigger({
  value,
  icon: Icon,
  label,
  statValue,
  hint,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  statValue: string;
  hint?: string;
}) {
  return (
    <TabsTrigger
      value={value}
      style={{ height: "auto", width: "100%" }}
      className="h-auto w-full min-w-0 flex-none basis-full! flex-col items-stretch justify-start gap-0 self-stretch overflow-hidden rounded-2xl border-2 border-transparent bg-white p-0 text-left text-foreground transition-all duration-200 after:hidden hover:border-foreground/15 hover:text-foreground data-active:scale-[1.01] data-active:border-primary data-active:bg-primary/5 data-active:text-foreground dark:bg-slate-900 dark:hover:border-white/15 dark:data-active:bg-primary/10 sm:rounded-[22px] lg:rounded-2xl"
    >
      {/* mobile tile */}
      <div className="flex w-full flex-col p-2.5 sm:p-3 lg:hidden">
        <div className="flex items-center justify-between gap-1.5 sm:mb-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background sm:size-auto sm:rounded-2xl sm:px-2 sm:py-1.5">
            <Icon className="size-3.5 sm:size-4" />
          </span>
          <span className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.22em]">
            {label}
          </span>
        </div>
        <div className="mt-2 space-y-0.5 sm:mt-0">
          <p className="text-base font-semibold tracking-tight sm:text-xl">{statValue}</p>
          {hint && (
            <p className="hidden text-xs leading-5 text-muted-foreground sm:block">{hint}</p>
          )}
        </div>
      </div>

      {/* desktop row */}
      <div className="hidden w-full items-center justify-between gap-2 px-3.5 py-2.5 lg:flex">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F4] dark:bg-gray-700">
            <Icon className="size-3.5" />
          </span>
          {label}
        </span>
        <span className="text-sm font-semibold">{statValue}</span>
      </div>
    </TabsTrigger>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </label>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] bg-white dark:bg-slate-900 px-6 py-14 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-border/70 bg-muted/40">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {cta ? <div className="mt-6 flex justify-center">{cta}</div> : null}
    </div>
  );
}

function getStatusClasses(status: string) {
  switch (status) {
    case "DELIVERED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "SHIPPED":
    case "SHIPPING":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "PROCESSING":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-border bg-muted/50 text-foreground/70";
  }
}

const ACCOUNT_TABS = ["orders", "wishlist", "addresses", "settings"] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

function AccountClientPage({ name }: AccountClientPageProps) {
  const { t } = useLanguage();
  // Deep-linkable so the navbar/bottom-nav wishlist and profile icons can
  // land directly on the right tab (?tab=wishlist, ?tab=settings) instead of
  // always opening the orders tab.
  const [tabParam, setTabParam] = useQueryState("tab", { defaultValue: "orders" });
  const activeTab: AccountTab = ACCOUNT_TABS.includes(tabParam as AccountTab)
    ? (tabParam as AccountTab)
    : "orders";
  const { data: orders } = useGetOrder();
  const { data: wishlist } = useWishlist();
  const { data: currentUser } = useCurrent();
  const { formatAmount } = useCurrency();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { mutate: deleteWishlist, isPending: deletingWishlist } =
    useDeleteFromWishlist();

  const ordersList = orders?.order ?? [];
  const wishlistItems = wishlist?.items ?? [];
  const latestOrder = ordersList[0];
  const hasAddress = Boolean(currentUser?.address?.trim());
  const displayName = currentUser?.name || name || t("accCustomerFallback");
  // Role-aware entry point: first dashboard route this user can actually open.
  const dashboardPath = landingPath(currentUser ?? null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "", address: "" },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (currentUser) {
      profileForm.reset({
        name: currentUser.name ?? "",
        phone: currentUser.phone ?? "",
        address: currentUser.address ?? "",
      });
    }
  }, [currentUser, profileForm]);

  const onProfileSubmit = (values: ProfileValues) => {
    updateProfile(values);
  };

  const onPasswordSubmit = (values: PasswordValues) => {
    updateProfile(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      { onSuccess: () => passwordForm.reset() },
    );
  };

  const handleDeleteWishlist = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteWishlist({ productId: id });
  };

  return (
    <div className="relative min-h-screen bg-[#F4F4F4] dark:bg-gray-800">
      <div className="container mx-auto px-3 py-6 sm:px-4 md:py-8">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setTabParam(value === "orders" ? null : value)}
          className="gap-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-6"
        >
          {/* Sidebar / mobile header column — single nav instance, restyled per breakpoint */}
          <div className="space-y-4 lg:sticky lg:top-16 lg:flex lg:flex-col lg:gap-3 lg:space-y-0">
            <div className="rounded-[24px] bg-white dark:bg-slate-900 p-4 lg:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background lg:size-12 lg:rounded-[20px]">
                  <UserRound className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-tight">
                    {displayName}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {currentUser?.email}
                  </p>
                </div>
              </div>
              {dashboardPath && (
                <Link
                  href={dashboardPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2 rounded-full">
                    <LayoutDashboard className="size-4" />
                    {t("accGoToAdminPanel")}
                  </Button>
                </Link>
              )}
            </div>

            <TabsList
              style={{ height: "auto" }}
              className="grid w-full grid-cols-2 items-stretch gap-2 bg-transparent lg:flex lg:w-full lg:flex-col lg:items-stretch"
            >
              <StatTabTrigger
                value="orders"
                icon={Package2}
                label={t("accOrders")}
                statValue={String(ordersList.length)}
                hint={
                  latestOrder
                    ? `${t("accLatestPrefix")} ${formatDate(latestOrder.createdAt)}`
                    : t("accNoPurchasesYet")
                }
              />
              <StatTabTrigger
                value="wishlist"
                icon={Heart}
                label={t("accWishlist")}
                statValue={String(wishlistItems.length)}
                hint={
                  wishlistItems.length ? t("accSavedForLater") : t("accNoSavedItemsYet")
                }
              />
              <StatTabTrigger
                value="addresses"
                icon={MapPin}
                label={t("accAddress")}
                statValue={hasAddress ? t("accReady") : t("accMissing")}
                hint={
                  hasAddress
                    ? t("accDeliveryInfoAvailable")
                    : t("accAddAddressHint")
                }
              />
              <StatTabTrigger
                value="settings"
                icon={LockKeyhole}
                label={t("accSettings")}
                statValue={t("accManage")}
                hint={t("accProfileSecurity")}
              />
            </TabsList>
          </div>

          <div className="min-w-0">
            <TabsContent value="orders" className="mt-0">
              <div className="rounded-[28px] bg-white dark:bg-slate-900 p-4 sm:rounded-[32px] sm:p-6 xl:p-7">
                <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t("accOrdersEyebrow")}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {t("accPurchaseTimeline")}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {t("accPurchaseTimelineDesc")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#F4F4F4] dark:bg-gray-700 px-4 py-3 text-sm text-muted-foreground">
                    {latestOrder
                      ? `${t("accLatestOrderOn")} ${formatDate(latestOrder.createdAt)}`
                      : t("accNoOrderActivityYet")}
                  </div>
                </div>

                {ordersList.length > 0 ? (
                  <div className="space-y-4">
                    {ordersList.map((order) => (
                      <Card
                        key={order.id}
                        className="gap-0 bg-[#F4F4F4] dark:bg-gray-700 py-0 shadow-none"
                      >
                        <CardHeader className="border-b border-border/60 py-4 sm:py-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                {t("accOrderNumberPrefix")}{order.orderNumber}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {t("accPlacedOn")} {formatDate(order.createdAt)}
                              </CardDescription>
                            </div>
                            <Badge
                              className={cn(
                                "h-auto rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em]",
                                getStatusClasses(order.status),
                              )}
                              variant="outline"
                            >
                              {order.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:gap-5 sm:py-5 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-center">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {t("accItems")}
                            </p>
                            <p className="mt-2 text-base font-semibold">
                              {order.items.length}{" "}
                              {order.items.length === 1 ? t("accItemSingular") : t("accItemPlural")}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {t("accTotal")}
                            </p>
                            <p className="mt-2 text-base font-semibold">
                              {formatAmount(order.totalAmount)}
                            </p>
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {t("accNextStep")}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {order.status === "DELIVERED"
                                ? t("accDeliveredCompleted")
                                : t("accOpenDetailsHint")}
                            </p>
                          </div>
                          <div className="col-span-2 md:col-span-1 md:justify-self-end">
                            <Button
                              nativeButton={false}
                              variant="outline"
                              render={<Link href={`/orders/${order.id}`} />}
                              className="w-full gap-2 sm:w-auto"
                            >
                              {t("accViewDetails")}
                              <ArrowUpRight className="size-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Package2}
                    title={t("accNoOrdersYet")}
                    description={t("accNoOrdersDesc")}
                    cta={
                      <Button
                        nativeButton={false}
                        render={<Link href="/shop" />}
                      >
                        {t("accStartShopping")}
                      </Button>
                    }
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="wishlist" className="mt-0">
              <div className="rounded-[28px] bg-white dark:bg-slate-900 p-4 sm:rounded-[32px] sm:p-6 xl:p-7">
                <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t("accWishlistEyebrow")}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {t("accSavedForLaterHeading")}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {t("accSavedForLaterDesc")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#F4F4F4] dark:bg-gray-700 px-4 py-3 text-sm text-muted-foreground">
                    {wishlistItems.length}{" "}
                    {wishlistItems.length === 1 ? t("accSavedItemSingular") : t("accSavedItemPlural")}
                  </div>
                </div>

                {wishlistItems.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {wishlistItems.map((item) => (
                      <Card
                        key={item.id}
                        className="gap-0 overflow-hidden bg-[#F4F4F4] dark:bg-gray-700 py-0 shadow-none"
                      >
                        <CardContent className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 p-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
                          <div className="relative aspect-square overflow-hidden rounded-[18px] bg-muted/50 sm:rounded-[22px]">
                            <FallbackImage
                              src={item.product.images[0]}
                              alt={item.product.name}
                              fill
                              sizes="(min-width: 640px) 112px, 84px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {t("accSavedItemLabel")}
                            </p>
                            <h3 className="mt-2 truncate text-lg font-semibold">
                              {item.product.name}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatAmount(item.product.price)}
                            </p>
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button
                                nativeButton={false}
                                variant="outline"
                                render={
                                  <Link href={`/shop/${item.product.slug || item.product.id}`} />
                                }
                                className="w-full sm:w-auto"
                              >
                                {t("accViewProduct")}
                              </Button>
                              <Button
                                onClick={(e) =>
                                  handleDeleteWishlist(e, item.product.id)
                                }
                                disabled={deletingWishlist}
                                variant="secondary"
                                className="w-full sm:w-auto"
                              >
                                {t("accRemove")}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Heart}
                    title={t("accWishlistEmpty")}
                    description={t("accWishlistEmptyDesc")}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="addresses" className="mt-0">
              <div className="rounded-[28px] bg-white dark:bg-slate-900 p-4 sm:rounded-[32px] sm:p-6 xl:p-7">
                <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t("accAddressEyebrow")}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {t("accDeliveryDetails")}
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t("accDeliveryDetailsDesc")}
                  </p>
                </div>

                <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <Card className="bg-gray-50 dark:bg-gray-700 shadow-none">
                    <CardHeader>
                      <CardTitle>{t("accDefaultAddress")}</CardTitle>
                      <CardDescription>
                        {t("accDefaultAddressDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...profileForm}>
                        <form
                          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                          className="space-y-5"
                        >
                          <FormField
                            name="phone"
                            control={profileForm.control}
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FieldLabel>{t("accPhoneNumber")}</FieldLabel>
                                <FormControl>
                                  <Input
                                    placeholder="01XXXXXXXXX"
                                    className="h-11 rounded-2xl"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="address"
                            control={profileForm.control}
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FieldLabel>{t("accFullAddress")}</FieldLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="House/Flat, Road, Area, District, City"
                                    rows={4}
                                    className="rounded-2xl"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              disabled={isPending}
                              className="w-full gap-2 sm:w-auto"
                            >
                              {isPending && (
                                <Loader2 className="size-4 animate-spin" />
                              )}
                              {t("accSaveAddress")}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>

                  <Card className="bg-foreground py-4 text-background shadow-none sm:py-6">
                    <CardHeader>
                      <CardTitle className="text-background">
                        {t("accDeliveryReadiness")}
                      </CardTitle>
                      <CardDescription className="text-background/70">
                        {t("accDeliveryReadinessDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5 sm:space-y-3">
                      <div className="rounded-2xl bg-white/8 px-3.5 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-background/60">
                          {t("accAddressStatus")}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {hasAddress ? t("accSaved") : t("accNeedsAttention")}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/8 px-3.5 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-background/60">
                          {t("accContactNumber")}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {currentUser?.phone || t("accMissing")}
                        </p>
                      </div>
                      <p className="text-sm leading-6 text-background/72">
                        {t("accDeliveryReadinessNote")}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <div className="rounded-[28px] bg-white dark:bg-slate-900 p-4 sm:rounded-[32px] sm:p-6 xl:p-7">
                <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t("accSettingsEyebrow")}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {t("accPersonalInfoSecurity")}
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t("accPersonalInfoSecurityDesc")}
                  </p>
                </div>

                <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
                  <Card className="bg-gray-50 dark:bg-gray-700 shadow-none">
                    <CardHeader>
                      <CardTitle>{t("accPersonalInformation")}</CardTitle>
                      <CardDescription>
                        {t("accPersonalInformationDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...profileForm}>
                        <form
                          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                          className="space-y-5"
                        >
                          <FormField
                            name="name"
                            control={profileForm.control}
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FieldLabel>{t("accFullName")}</FieldLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Your full name"
                                    className="h-11 rounded-2xl"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <FieldLabel>{t("accEmail")}</FieldLabel>
                            <Input
                              value={currentUser?.email ?? ""}
                              disabled
                              className="h-11 cursor-not-allowed rounded-2xl opacity-65"
                            />
                            <p className="text-xs text-muted-foreground">
                              {t("accEmailCannotChange")}
                            </p>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              disabled={isPending}
                              className="w-full gap-2 sm:w-auto"
                            >
                              {isPending && (
                                <Loader2 className="size-4 animate-spin" />
                              )}
                              {t("accSaveChanges")}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-50 dark:bg-gray-700 shadow-none">
                    <CardHeader>
                      <CardTitle>{t("accChangePassword")}</CardTitle>
                      <CardDescription>
                        {t("accChangePasswordDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...passwordForm}>
                        <form
                          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                          className="space-y-5"
                        >
                          <FormField
                            name="currentPassword"
                            control={passwordForm.control}
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FieldLabel>{t("accCurrentPassword")}</FieldLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-11 rounded-2xl"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="newPassword"
                            control={passwordForm.control}
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FieldLabel>{t("accNewPassword")}</FieldLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-11 rounded-2xl"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name="confirmPassword"
                            control={passwordForm.control}
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FieldLabel>{t("accConfirmNewPassword")}</FieldLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-11 rounded-2xl"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              disabled={isPending}
                              className="w-full gap-2 sm:w-auto"
                            >
                              {isPending && (
                                <Loader2 className="size-4 animate-spin" />
                              )}
                              {t("accUpdatePassword")}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default AccountClientPage;
