import { Eye, RotateCcw, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  { icon: Truck, title: "ক্যাশ অন ডেলিভারি", note: "পণ্য পেয়ে টাকা দিন" },
  { icon: Eye, title: "দেখে নেওয়ার সুযোগ", note: "খুলে চেক করে নিন" },
  { icon: RotateCcw, title: "সহজ রিপ্লেসমেন্ট", note: "৭ দিনের গ্যারান্টি" },
];

/** Cash on delivery / check before paying / easy replacement. Shown on the product page and at checkout. */
export function TrustBadges({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl text-center border-none! shadow-none! ring-0!",
        className,
      )}
    >
      {BADGES.map(({ icon: Icon, title, note }, i) => (
        <div
          key={title}
          className={cn("flex flex-col items-center justify-center p-1", i === 1 && "border-x border-border/60")}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-1" />
          <span className="text-[11px] sm:text-xs font-bold text-foreground leading-tight">{title}</span>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{note}</span>
        </div>
      ))}
    </div>
  );
}
