import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";

export type Risk = "none" | "low" | "medium" | "high";

// Thresholds are a judgement call, not BD Courier's: with no parcels there is
// nothing to judge, and a few parcels either way isn't a strong signal.
export function getRisk(total: number, ratio: number): Risk {
  if (total === 0) return "none";
  if (ratio >= 80) return "low";
  if (ratio >= 60) return "medium";
  return "high";
}

export const RISK_STYLES: Record<
  Risk,
  {
    /** Outlined pill around the verdict label. */
    pill: string;
    /** Progress arc of the success-rate ring. */
    stroke: string;
    icon: typeof ShieldCheck;
    label: string;
    verdict: string;
  }
> = {
  none: {
    pill: "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300",
    stroke: "stroke-slate-300 dark:stroke-slate-700",
    icon: ShieldQuestion,
    label: "কোনো রেকর্ড নেই (No History)",
    verdict: "এই নম্বরে কোনো কুরিয়ার ডেলিভারির রেকর্ড পাওয়া যায়নি।",
  },
  low: {
    pill: "border-emerald-500 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400",
    stroke: "stroke-emerald-500",
    icon: ShieldCheck,
    label: "নিরাপদ ক্রেতা (Safe Delivery)",
    verdict: "নিরাপদ কাস্টমার! সফল ডেলিভারির হার অনেক ভালো।",
  },
  medium: {
    pill: "border-amber-500 text-amber-600 dark:border-amber-500 dark:text-amber-400",
    stroke: "stroke-amber-500",
    icon: ShieldAlert,
    label: "মাঝারি ঝুঁকি (Medium Risk)",
    verdict: "ডেলিভারির রেকর্ড মিশ্র। পাঠানোর আগে ফোন করে অর্ডারটি কনফার্ম করে নিন।",
  },
  high: {
    pill: "border-red-500 text-red-600 dark:border-red-500 dark:text-red-400",
    stroke: "stroke-red-500",
    icon: ShieldX,
    label: "উচ্চ ঝুঁকি (High Risk)",
    verdict: "ঝুঁকিপূর্ণ কাস্টমার! অগ্রিম পেমেন্ট ছাড়া পার্সেল পাঠাবেন না।",
  },
};
