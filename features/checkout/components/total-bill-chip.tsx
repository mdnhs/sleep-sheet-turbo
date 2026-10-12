"use client";

import * as React from "react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { cn } from "@/lib/utils";

export const ORDER_SUMMARY_ID = "order-summary";

const COUNT_MS = 600;
// Changes this soon after mount are the page settling (cart hydrating, the
// zone's delivery charge and live promotions arriving) — shown, not animated.
const SETTLE_MS = 1200;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Mobile-only total in the delivery card's header, where the order summary
 * (below the form on phones) is out of sight. When the total changes — e.g.
 * bKash makes delivery free — it pops and counts to the new amount, with the
 * difference flashed beside it. Turns green while a promotion (free
 * delivery) applies. Tapping it scrolls to the order summary.
 */
export function TotalBillChip({ offerApplied = false }: { offerApplied?: boolean }) {
  const userItems = useCartStore((state) => state.items);
  const guestItems = useCartStore((state) => state.guestItems);
  const shipping = useCartStore((state) => state.shipping);
  const { formatAmount } = useCurrency();
  const { t } = useLanguage();

  const total =
    [...userItems, ...guestItems].reduce((acc, item) => acc + item.price * item.quantity, 0) + shipping;

  const [shown, setShown] = React.useState(total);
  const [change, setChange] = React.useState<{ id: number; delta: number } | null>(null);
  const previous = React.useRef(total);
  const mountedAt = React.useRef(0);

  React.useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  React.useEffect(() => {
    const from = previous.current;
    previous.current = total;
    if (from === total) return;

    const settling = performance.now() - mountedAt.current < SETTLE_MS;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (settling) {
      setShown(total);
      return;
    }
    setChange({ id: Date.now(), delta: total - from });
    if (reduced) {
      setShown(total);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      setShown(Math.round(from + (total - from) * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [total]);

  const scrollToSummary = () => {
    document.getElementById(ORDER_SUMMARY_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={scrollToSummary}
      aria-label={`${t("totalBill")} ${formatAmount(total)}`}
      // Pink = the order button's gradient, so the eye links the two; green
      // while an offer applies.
      className={cn(
        "relative flex shrink-0 flex-col items-end rounded-2xl px-3 py-1.5 text-white transition-transform active:scale-95 lg:hidden",
        offerApplied
          ? "bg-[linear-gradient(135deg,#34F08F,#16C172_50%,#0B9A58)]"
          : "bg-[linear-gradient(135deg,#FF6FA5,#B8245A)]",
      )}
    >
      <span className="text-[10px] font-medium leading-none opacity-90">{t("totalBill")}</span>
      {/* key re-mounts the number so the pop replays on every change */}
      <span key={change?.id ?? 0} className={cn("mt-0.5 text-base font-extrabold tabular-nums leading-none", change && "bill-pop")}>
        {formatAmount(shown)}
      </span>
      {change && change.delta !== 0 && (
        <span
          key={`delta-${change.id}`}
          aria-hidden
          className={cn(
            "bill-delta pointer-events-none absolute -bottom-4 right-1 text-[11px] font-bold tabular-nums",
            change.delta < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {change.delta < 0 ? "−" : "+"}
          {formatAmount(Math.abs(change.delta))}
        </span>
      )}
    </button>
  );
}
