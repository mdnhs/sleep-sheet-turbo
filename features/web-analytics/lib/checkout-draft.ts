"use client";

import React from "react";
import { normalizeBdPhone } from "@/features/fraud-checker/phone";
import type { CartItem } from "@/features/cart/type";
import { collect, getAnalyticsIds, isCollectorEnabled } from "./collector";
import type { CheckoutField } from "./types";

const ENDPOINT = "/api/t/draft";
const DEBOUNCE_MS = 1500;

export interface CheckoutDraftFields {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  shippingZone?: string;
}

/** Field → filled? Phone counts only once it is a valid BD number. */
function filledFields(fields: CheckoutDraftFields): CheckoutField[] {
  const filled: CheckoutField[] = [];
  if (fields.fullName?.trim()) filled.push("fullName");
  if (fields.phone && normalizeBdPhone(fields.phone)) filled.push("phone");
  if (fields.address?.trim()) filled.push("address");
  return filled;
}

export function buildDraftBody(fields: CheckoutDraftFields, items: CartItem[]): string | null {
  const ids = getAnalyticsIds();
  const phone = fields.phone ? normalizeBdPhone(fields.phone) : null;
  if (!ids || !phone || items.length === 0) return null;
  return JSON.stringify({
    sessionId: ids.sessionId,
    visitorId: ids.visitorId,
    fullName: fields.fullName?.slice(0, 150) || null,
    phone,
    email: fields.email?.slice(0, 200) || null,
    address: fields.address?.slice(0, 500) || null,
    shippingZone: fields.shippingZone || null,
    items: items.slice(0, 50).map((item) => ({
      productId: item.productId || item.id,
      name: item.name.slice(0, 200),
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      size: item.size || null,
      color: item.color || null,
    })),
  });
}

function send(body: string, unloading: boolean): void {
  try {
    if (unloading && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }))) return;
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(
      () => {},
    );
  } catch {
    // Autosave must never break checkout.
  }
}

/**
 * Autosaves the checkout form (debounced, and once more when the page is
 * hidden) so an abandoned checkout can be followed up, and reports each field
 * the first time it is filled for the funnel. Nothing is saved until the
 * phone is a valid BD number, and card fields are never read. Call `pause`
 * on submit so a beacon racing the order can't leave a false lead behind,
 * and `resume` if the order fails.
 */
export function useCheckoutDraft(
  fields: CheckoutDraftFields,
  items: CartItem[],
): { pause: () => void; resume: () => void } {
  const pending = React.useRef<string | null>(null);
  const lastSent = React.useRef<string | null>(null);
  const reported = React.useRef(new Set<CheckoutField>());
  const stopped = React.useRef(false);

  const flush = React.useCallback((unloading: boolean) => {
    const body = pending.current;
    pending.current = null;
    if (stopped.current || !body || body === lastSent.current || !isCollectorEnabled()) return;
    lastSent.current = body;
    send(body, unloading);
  }, []);

  const { fullName, phone, email, address, shippingZone } = fields;

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const field of filledFields({ fullName, phone, address })) {
        if (reported.current.has(field)) continue;
        reported.current.add(field);
        collect("checkout_field", "/checkout", { label: field });
      }
      pending.current = buildDraftBody({ fullName, phone, email, address, shippingZone }, items);
      flush(false);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [fullName, phone, email, address, shippingZone, items, flush]);

  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      pending.current = buildDraftBody({ fullName, phone, email, address, shippingZone }, items);
      flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [fullName, phone, email, address, shippingZone, items, flush]);

  const pause = React.useCallback(() => {
    stopped.current = true;
    pending.current = null;
  }, []);
  const resume = React.useCallback(() => {
    stopped.current = false;
    lastSent.current = null;
  }, []);
  return { pause, resume };
}
