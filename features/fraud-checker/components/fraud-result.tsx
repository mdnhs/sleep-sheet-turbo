"use client";

import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Info,
  Loader2,
  Package,
  Truck,
} from "lucide-react";
import {
  EMPTY_SUMMARY,
  IDLE_COURIERS,
} from "@/features/fraud-checker/couriers";
import { getRisk, RISK_STYLES, type Risk } from "@/features/fraud-checker/risk";
import type { CourierCheckResult } from "@/lib/bdcourier";
import { cn } from "@/lib/utils";

export type FraudResultData = CourierCheckResult & { phone: string };

// The theme's `muted` reads pink on this dashboard, so the neutral surfaces
// here name slate explicitly.
const SURFACE = "bg-slate-50 dark:bg-slate-900/40";

function RiskRing({
  ratio,
  risk,
  total,
}: {
  ratio: number;
  risk: Risk;
  total: number;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = total === 0 ? 0 : Math.min(100, Math.max(0, ratio));
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth={14}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-700",
            RISK_STYLES[risk].stroke,
          )}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight tabular-nums">
          {total === 0 ? "—" : `${ratio}%`}
        </span>
        <span className="text-[11px] text-muted-foreground">সফলতার হার</span>
      </div>
    </div>
  );
}

const STAT_TONES = {
  neutral:
    "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400",
  emerald:
    "border-emerald-200 bg-emerald-50/70 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
  red: "border-red-200 bg-red-50/70 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 text-center", STAT_TONES[tone])}>
      <Icon className="mx-auto h-5 w-5" />
      <p className="mt-2 text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
        <span className="ml-1 text-base font-semibold">টি</span>
      </p>
    </div>
  );
}

/**
 * Indeterminate, on purpose: a single fetch reports no real progress, so the
 * bar slides rather than showing a percentage it would have to invent.
 */
function CheckProgress() {
  return (
    <div className="mb-5 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
        কুরিয়ার ডেটা চেক করা হচ্ছে…
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="animate-indeterminate h-full w-1/4 rounded-full bg-indigo-500" />
      </div>
    </div>
  );
}

/**
 * The whole verdict view. Renders its full shape with zeros before anything
 * has been checked, so a search only swaps the numbers in — used by both the
 * Fraud Checker page and the dialog on the Orders page.
 */
export function FraudResult({
  data,
  isFetching,
  dataUpdatedAt,
}: {
  data?: FraudResultData;
  isFetching?: boolean;
  dataUpdatedAt?: number;
}) {
  const idle = !data;
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const risk: Risk = getRisk(summary.total_parcel, summary.success_ratio);
  const riskStyle = RISK_STYLES[risk];
  const RiskIcon = riskStyle.icon;

  // Couriers that actually carried parcels first; the empty ones still show,
  // dimmed, so it's clear they were checked and had nothing.
  const couriers = data
    ? Object.entries(data.couriers)
        .map(([key, courier]) => ({ key, ...courier }))
        .sort((a, b) => b.total_parcel - a.total_parcel)
    : IDLE_COURIERS;

  return (
    <>
      {isFetching && <CheckProgress />}

      <div
        className={cn(
          "space-y-6 transition-opacity duration-200",
          isFetching && "pointer-events-none opacity-40",
        )}
      >
        {/* Verdict */}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <RiskRing
            ratio={summary.success_ratio}
            risk={risk}
            total={summary.total_parcel}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border-2 bg-transparent px-3 py-1.5 text-xs font-bold",
                  idle ? RISK_STYLES.none.pill : riskStyle.pill,
                )}
              >
                <RiskIcon className="h-3.5 w-3.5" />
                {idle ? "চেক করা হয়নি" : riskStyle.label}
              </span>
              <span className="text-xs text-muted-foreground">
                নম্বর:{" "}
                <span className="font-mono text-sm font-bold text-foreground">
                  {data?.phone ?? "—"}
                </span>
              </span>
            </div>

            <div
              className={cn(
                "flex items-start gap-2.5 rounded-xl px-4 py-3.5",
                SURFACE,
              )}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <p className="text-sm">
                {idle
                  ? "উপরে কাস্টমারের মোবাইল নম্বর দিয়ে চেক করুন।"
                  : riskStyle.verdict}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                সার্চ টাইম:{" "}
                <span className="font-semibold text-foreground">
                  {data && dataUpdatedAt
                    ? format(dataUpdatedAt, "hh:mm a")
                    : "—"}
                </span>
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {couriers.length}টি কুরিয়ার সিঙ্ক সক্রিয়
              </span>
            </div>
          </div>
        </div>

        <div className="border-t" />

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            icon={Package}
            label="মোট অর্ডার"
            value={summary.total_parcel}
            tone="neutral"
          />
          <StatCard
            icon={CircleCheck}
            label="সফল ডেলিভারি"
            value={summary.success_parcel}
            tone="emerald"
          />
          <StatCard
            icon={CircleX}
            label="বাতিল / রিটার্ন"
            value={summary.cancelled_parcel}
            tone="red"
          />
        </div>

        {/* Per courier */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold tracking-tight">
              কুরিয়ার অনুযায়ী ডেলিভারি ব্রেকডাউন
            </h3>
          </div>

          <div className="space-y-2">
            {couriers.map((courier) => {
              const isEmpty = courier.total_parcel === 0;
              return (
                <div
                  key={courier.key}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3",
                    SURFACE,
                    isEmpty && "opacity-60",
                  )}
                >
                  {/* Wordmark logos, so a wide box with a left anchor rather than
                    a square that letterboxes them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={courier.logo}
                    alt=""
                    className="h-8 w-20 shrink-0 object-contain object-left"
                  />
                  <span className="text-sm font-semibold">{courier.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({courier.total_parcel} পার্সেল)
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                    সফল: {courier.success_parcel}
                  </span>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      courier.cancelled_parcel > 0
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    রিটার্ন: {courier.cancelled_parcel}
                  </span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums">
                    {courier.success_ratio}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Merchant reports */}
        {data && data.reports.length > 0 && (
          <div className="space-y-3 border-t pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-bold tracking-tight">
                মার্চেন্ট রিপোর্ট
                <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                  {data.reports.length}
                </span>
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              BD Courier-এ অন্য মার্চেন্টদের করা অভিযোগ। এগুলো দাবি, প্রমাণ নয়।
            </p>
            <div className="space-y-2">
              {data.reports.map((report, i) => {
                // BD Courier's payload is typed but never validated, so treat
                // every field as possibly missing: parseISO(undefined) throws
                // and would take the whole dialog down.
                const filed =
                  typeof report.created_at === "string"
                    ? parseISO(report.created_at)
                    : null;
                return (
                  <div
                    key={report.id ?? i}
                    className="rounded-xl bg-red-50/60 px-4 py-3 text-sm dark:bg-red-950/20"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={report.courierLogo}
                        alt=""
                        className="h-5 w-12 shrink-0 object-contain object-left"
                      />
                      <span className="font-semibold">
                        {report.name || "অজানা"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {report.courierName} থেকে
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {filed && !Number.isNaN(filed.getTime())
                          ? format(filed, "dd MMM yyyy")
                          : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {report.details}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
