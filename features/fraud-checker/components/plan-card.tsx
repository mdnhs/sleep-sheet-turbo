"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowRight, CircleCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFraudCheckPlan } from "@/features/fraud-checker/api/use-fraud-check";
import { cn } from "@/lib/utils";

const SHELL =
  "relative w-full max-w-md rounded-3xl border-2 border-emerald-500/70 bg-white dark:bg-card p-7 pt-8";

function Meter({
  label,
  remaining,
  limit,
  tone,
}: {
  label: string;
  remaining: number;
  limit: number;
  tone: "emerald" | "indigo";
}) {
  // A zero limit means the plan doesn't include this bucket at all.
  const pct = limit > 0 ? Math.min(100, Math.max(0, (remaining / limit) * 100)) : 0;
  const depleted = remaining <= 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            depleted && "text-red-600 dark:text-red-400"
          )}
        >
          {remaining}
          <span className="font-normal text-muted-foreground"> / {limit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            depleted ? "bg-red-500" : tone === "emerald" ? "bg-emerald-500" : "bg-indigo-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      <span className="text-foreground/80">{children}</span>
    </li>
  );
}

function Ribbon({ children, tone }: { children: React.ReactNode; tone: "emerald" | "amber" }) {
  return (
    <span
      className={cn(
        "absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm",
        tone === "emerald" ? "bg-emerald-500" : "bg-amber-500"
      )}
    >
      {children}
    </span>
  );
}

function safeDate(value?: string | null) {
  if (!value) return null;
  // BD Courier sends both "2025-12-31" and "2025-12-31 23:59:59".
  const parsed = parseISO(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function PlanCard() {
  const { data: plan, isLoading, error } = useFraudCheckPlan();

  if (isLoading) {
    return (
      <div className={cn(SHELL, "space-y-4 border-border")}>
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-7 w-44 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(SHELL, "border-red-300 dark:border-red-900 space-y-2")}>
        <p className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
          প্ল্যান লোড হয়নি
        </p>
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  if (!plan.has_subscription) {
    return (
      <div className={cn(SHELL, "border-amber-400/70 space-y-4")}>
        <Ribbon tone="amber">সাবস্ক্রিপশন নেই</Ribbon>
        <div className="space-y-1.5">
          <h3 className="text-2xl font-bold tracking-tight">FraudChecker API</h3>
          <p className="text-sm text-muted-foreground">
            কোনো সক্রিয় প্ল্যান নেই, তাই এখন কোনো নম্বর চেক করা যাবে না।
            bdcourier.com এ একটি প্ল্যান নিন।
          </p>
        </div>
        <a
          href="https://bdcourier.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
        >
          প্ল্যান নিন
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  const freeLimit = plan.call_limit ?? 0;
  const paidLimit = plan.paid_limit ?? 0;
  const freeLeft = plan.remaining_free_calls ?? 0;
  const paidLeft = plan.remaining_paid_calls ?? 0;
  const totalLeft = freeLeft + paidLeft;
  const renews = safeDate(plan.next_due_date ?? plan.expires_at);
  const isActive = (plan.status ?? "").toLowerCase() === "active";
  const expiringSoon = plan.days_remaining != null && plan.days_remaining <= 7;

  return (
    <div className={cn(SHELL, !isActive && "border-amber-400/70")}>
      <Ribbon tone={isActive ? "emerald" : "amber"}>
        {isActive ? "সক্রিয় প্ল্যান" : `প্ল্যান ${plan.status ?? "নিষ্ক্রিয়"}`}
      </Ribbon>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          আপনার প্ল্যান
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {plan.is_free ? "ফ্রি" : "পেইড"}
        </span>
      </div>

      <h3 className="mt-3 text-2xl font-bold tracking-tight">
        {plan.plan_name ?? "FraudChecker API"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        ৭টি কুরিয়ারের ডেলিভারি হিস্ট্রি দেখে কাস্টমার যাচাই করুন — পার্সেল পাঠানোর আগেই।
      </p>

      <div className="mt-5 flex items-end gap-1.5">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          ৳{plan.price ?? 0}
        </span>
        {plan.frequency && (
          <span className="pb-1.5 text-sm text-muted-foreground">/{plan.frequency}</span>
        )}
      </div>
      {renews && (
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            expiringSoon ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
          )}
        >
          মেয়াদ {format(renews, "dd MMM yyyy")} পর্যন্ত
          {plan.days_remaining != null && ` · ${plan.days_remaining} দিন বাকি`}
        </p>
      )}

      <div className="my-6 border-t" />

      <div className="flex items-end gap-2">
        <span
          className={cn(
            "text-3xl font-bold tracking-tight tabular-nums",
            totalLeft === 0 && "text-red-600 dark:text-red-400"
          )}
        >
          {totalLeft}
        </span>
        <span className="pb-1 text-xs text-muted-foreground">টি চেক বাকি</span>
      </div>

      <div className="mt-4 space-y-3">
        <Meter label="ফ্রি কল" remaining={freeLeft} limit={freeLimit} tone="emerald" />
        <Meter label="পেইড কল" remaining={paidLeft} limit={paidLimit} tone="indigo" />
      </div>

      <ul className="mt-6 space-y-3">
        <Feature>রিয়েল-টাইম কুরিয়ার ডেটা</Feature>
        <Feature>৭টি কুরিয়ার সিঙ্ক</Feature>
        {plan.api_calls != null && <Feature>মোট {plan.api_calls} টি কল ব্যবহৃত</Feature>}
        <Feature>অন্য মার্চেন্টদের রিপোর্ট</Feature>
      </ul>

      <a
        href="https://bdcourier.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
      >
        প্ল্যান ম্যানেজ করুন
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}
