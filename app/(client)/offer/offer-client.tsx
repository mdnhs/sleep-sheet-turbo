"use client";

import type { ComponentType, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  CreditCard,
  MapPin,
  ShoppingBag,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrustBadges } from "@/components/trust-badges";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { toBengaliDigits } from "@/lib/utils";
import { PROMOTION_PAYMENT_METHODS, PROMOTION_ZONES } from "@/lib/promotions";
import type { Promotion } from "@/features/promotions/types";

type Translate = ReturnType<typeof useLanguage>["t"];
type Language = ReturnType<typeof useLanguage>["language"];

const PAYMENT_LABELS = {
  cod: "cashOnDelivery",
  bkash: "bkashPayment",
  card: "cardPayment",
} as const;

const ZONE_LABELS = {
  inside_dhaka: "insideDhaka",
  outside_dhaka: "outsideDhaka",
} as const;

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

const DAY_MS = 86_400_000;
// Bangladesh is UTC+6 all year (no DST).
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * "15 October 2026" / "১৫ অক্টোবর ২০২৬" in Dhaka time. Formatted by hand, not
 * with Intl, so the server and browser render the exact same string. An end
 * at Dhaka midnight means "through the previous day", so that day is shown.
 */
function formatEndDate(iso: string, language: Language) {
  let at = new Date(iso).getTime();
  if ((at + DHAKA_OFFSET_MS) % DAY_MS === 0) at -= 1;
  const dhaka = new Date(at + DHAKA_OFFSET_MS);
  const text = `${dhaka.getUTCDate()} ${MONTHS[language][dhaka.getUTCMonth()]} ${dhaka.getUTCFullYear()}`;
  return language === "bn" ? toBengaliDigits(text) : text;
}

function PaymentIcon({ method }: { method: keyof typeof PAYMENT_LABELS }) {
  if (method === "bkash") {
    return (
      <Image src="/bkash-icon.png" alt="" width={16} height={16} className="h-4 w-4 rounded-sm object-contain" />
    );
  }
  const Icon = method === "cod" ? Truck : CreditCard;
  return <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-slate-900">
      {children}
    </span>
  );
}

function Condition({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary dark:bg-slate-900">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className="mt-1 text-sm font-semibold text-foreground">{children}</div>
      </div>
    </li>
  );
}

function OfferCard({
  promotion,
  t,
  language,
  money,
}: {
  promotion: Promotion;
  t: Translate;
  language: Language;
  money: (value: number) => string;
}) {
  // Canonical order, unknown values dropped.
  const methods = PROMOTION_PAYMENT_METHODS.filter((m) => promotion.paymentMethods.includes(m));
  const zones = PROMOTION_ZONES.filter((z) => promotion.zones.includes(z));
  const minOrder = promotion.minOrderAmount ?? 0;

  return (
    <article className="flex flex-col rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Truck className="h-3.5 w-3.5" aria-hidden />
        {t("freeDelivery")}
      </span>

      <h2 className="mt-3 text-lg font-bold leading-snug text-foreground sm:text-xl">{promotion.title}</h2>
      {promotion.description && (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {promotion.description}
        </p>
      )}

      <ul className="mt-4 space-y-3 rounded-xl bg-[#F4F4F4] p-3.5 dark:bg-slate-800/60">
        {methods.length > 0 && (
          <Condition icon={Wallet} label={t("offerPaymentLabel")}>
            <div className="flex flex-wrap gap-1.5">
              {methods.map((method) => (
                <Chip key={method}>
                  <PaymentIcon method={method} />
                  {t(PAYMENT_LABELS[method])}
                </Chip>
              ))}
            </div>
          </Condition>
        )}
        {zones.length > 0 && (
          <Condition icon={MapPin} label={t("offerZoneLabel")}>
            <div className="flex flex-wrap gap-1.5">
              {zones.map((zone) => (
                <Chip key={zone}>{t(ZONE_LABELS[zone])}</Chip>
              ))}
            </div>
          </Condition>
        )}
        <Condition icon={ShoppingBag} label={t("offerMinOrderLabel")}>
          {minOrder > 0 ? t("offerMinOrder").replace("{amount}", money(minOrder)) : t("offerAnyAmount")}
        </Condition>
        {(promotion.endsAt || promotion.personalWindowMinutes) && (
          <Condition icon={CalendarClock} label={t("offerValidityLabel")}>
            {/* A personal time limit runs per visitor from their first sight
                of it (the ad's countdown); the end date is the outer limit. */}
            {promotion.personalWindowMinutes ? (
              <span className="block">
                {t("offerPersonalWindow").replace("{hours}", personalHours(promotion.personalWindowMinutes, language))}
              </span>
            ) : null}
            {promotion.endsAt && t("offerValidUntil").replace("{date}", formatEndDate(promotion.endsAt, language))}
          </Condition>
        )}
      </ul>

      <p className="mt-4 flex items-start gap-2 text-xs font-medium text-primary">
        <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("offerAutoApplied")}
      </p>
    </article>
  );
}

/** Minutes as hours ("1.5"), in Bangla digits on the Bangla site. */
function personalHours(minutes: number, language: Language): string {
  const hours = String(Math.round((minutes / 60) * 10) / 10);
  return language === "bn" ? toBengaliDigits(hours) : hours;
}

export default function OfferClient({ promotions }: { promotions: Promotion[] }) {
  const { t, language } = useLanguage();
  const { formatAmount } = useCurrency();
  const money = (value: number) => (language === "bn" ? toBengaliDigits(formatAmount(value)) : formatAmount(value));

  return (
    <div className="min-h-[60vh] w-full bg-[#F4F4F4] dark:bg-gray-800">
      <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">{t("home")}</Link>
          <span className="text-border">•</span>
          <span className="text-foreground" aria-current="page">{t("offers")}</span>
        </nav>

        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BadgePercent className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("offerPageHeading")}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("offerPageSubtitle")}</p>
        </div>

        {promotions.length > 0 ? (
          <>
            <div
              className={
                promotions.length === 1 ? "mx-auto max-w-xl" : "grid grid-cols-1 gap-4 md:grid-cols-2"
              }
            >
              {promotions.map((promotion) => (
                <OfferCard key={promotion.id} promotion={promotion} t={t} language={language} money={money} />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Button size="lg" className="rounded-full px-8" nativeButton={false} render={<Link href="/shop" />}>
                {t("offerShopNow")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-10 text-center shadow-sm dark:bg-slate-900">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F4F4] text-muted-foreground dark:bg-slate-800">
              <BadgePercent className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-xl font-bold text-foreground">{t("offerEmptyTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("offerEmptyDesc")}</p>
            <Button size="lg" className="mt-6 rounded-full px-8" nativeButton={false} render={<Link href="/shop" />}>
              {t("offerShopNow")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}

        <TrustBadges className="mx-auto mt-10 max-w-xl" />
      </div>
    </div>
  );
}
