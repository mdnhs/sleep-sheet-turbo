"use client";

import { getVisitorId } from "@/lib/visitor-id";
import { loadSession, resolveSession, saveSession, type StoredSession } from "./session";
import type { CollectPayload, CollectType } from "./types";

const ENDPOINT = "/api/t";
const SESSION_KEY = "ss_session";

// Sends by default so the landing page view isn't lost while settings load;
// TrafficTracker turns it off once settings say analytics_enabled = "false".
// The server is the real gate and drops anything that arrives while off.
let enabled = true;
// Fallback when localStorage is blocked: one session per page lifetime.
let memorySession: StoredSession | null = null;

export function setCollectorEnabled(value: boolean): void {
  enabled = value;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function currentSession(now: number): StoredSession {
  const store = storage();
  const prev = loadSession(store, SESSION_KEY) ?? memorySession;
  const next = resolveSession(prev, now, window.location.href, document.referrer, newId);
  memorySession = next;
  saveSession(store, SESSION_KEY, next);
  return next;
}

export interface CollectExtra {
  label?: string | null;
  productId?: string | null;
  value?: number | null;
}

export function buildPayload(
  type: CollectType,
  path: string,
  session: StoredSession,
  visitorId: string,
  hostname: string,
  extra: CollectExtra = {},
): CollectPayload {
  const value = extra.value;
  return {
    type,
    path: path.split(/[?#]/)[0].slice(0, 300) || "/",
    hostname: hostname.slice(0, 100) || null,
    visitorId,
    sessionId: session.id,
    ...session.landing,
    label: extra.label ? extra.label.slice(0, 300) : null,
    productId: extra.productId ? extra.productId.slice(0, 64) : null,
    value: typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null,
  };
}

/** Fire-and-forget beacon to /api/t. Never throws. */
export function collect(type: CollectType, path: string, extra?: CollectExtra): void {
  try {
    if (!enabled || typeof window === "undefined") return;
    if (path.startsWith("/dashboard") || window.location.pathname.startsWith("/dashboard")) return;
    const body = JSON.stringify(
      buildPayload(type, path, currentSession(Date.now()), getVisitorId(), window.location.hostname, extra),
    );
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => {});
  } catch {
    // Analytics must never break the page.
  }
}

/** The ids the checkout request carries so the server can attribute the order. */
export function getAnalyticsIds(): { visitorId: string; sessionId: string } | null {
  try {
    const session = loadSession(storage(), SESSION_KEY) ?? memorySession;
    return session ? { visitorId: getVisitorId(), sessionId: session.id } : null;
  } catch {
    return null;
  }
}
