// Client-safe helpers for the admin promotions page: labels, status and the
// API body built from an existing promotion.

import {
  isPromotionLive,
  PROMOTION_PAYMENT_METHODS,
  PROMOTION_ZONES,
  type PromotionPaymentMethod,
  type PromotionZone,
} from "@/lib/promotions";
import type { PromotionPayload } from "./api/use-promotions";
import type { Promotion } from "./types";

export const PAYMENT_METHOD_LABELS: Record<PromotionPaymentMethod, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  card: "Card",
};

export const ZONE_LABELS: Record<PromotionZone, string> = {
  inside_dhaka: "Inside Dhaka",
  outside_dhaka: "Outside Dhaka",
};

export const paymentMethodLabel = (value: string) =>
  PAYMENT_METHOD_LABELS[value as PromotionPaymentMethod] ?? value;

export const zoneLabel = (value: string) => ZONE_LABELS[value as PromotionZone] ?? value;

export type PromotionStatus = "live" | "scheduled" | "ended" | "off";

/** Off (switched off) wins; otherwise where `now` falls in the date window. */
export function promotionStatus(promo: Promotion, now = new Date()): PromotionStatus {
  if (!promo.isActive) return "off";
  if (isPromotionLive(promo, now)) return "live";
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now.getTime()) return "scheduled";
  return "ended";
}

const onlyKnown = <T extends string>(allowed: readonly T[], values: string[]) =>
  values.filter((value): value is T => (allowed as readonly string[]).includes(value));

/** Full PATCH body from a stored promotion, with optional overrides (e.g. isActive). */
export function toPayload(promo: Promotion, overrides: Partial<PromotionPayload> = {}): PromotionPayload {
  return {
    title: promo.title,
    description: promo.description,
    paymentMethods: onlyKnown(PROMOTION_PAYMENT_METHODS, promo.paymentMethods),
    zones: onlyKnown(PROMOTION_ZONES, promo.zones),
    minOrderAmount: promo.minOrderAmount,
    personalWindowMinutes: promo.personalWindowMinutes,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    isActive: promo.isActive,
    ...overrides,
  };
}

/** ISO string -> value for <input type="datetime-local"> in the browser's time zone. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) -> ISO string, or null when empty. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
