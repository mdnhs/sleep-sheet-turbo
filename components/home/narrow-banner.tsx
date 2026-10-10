import React from "react";
import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";

const NarrowBanner = () => {
  return (
    <section className="py-1.5 md:py-2 bg-[#F4F4F4] dark:bg-background">
      <div className="container mx-auto px-4">
        <Link
          href="/track-order"
          className="flex items-center justify-between gap-3 rounded-full bg-white dark:bg-slate-900/60 px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all duration-300 group"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Icon badge — a small live-pulse dot reinforces "real-time" from the copy */}
            <span className="relative shrink-0 flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-linear-to-br from-primary/20 to-primary/5">
              <Truck
                className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary"
                strokeWidth={2.25}
              />
              <span className="absolute top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping" />
              </span>
            </span>
            <p className="text-foreground text-xs sm:text-sm font-medium truncate">
              Already placed an order?{" "}
              <span className="text-muted-foreground font-normal">
                Track it in real-time.
              </span>
            </p>
          </div>

          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-bold px-3 py-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            Track
            <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </div>
    </section>
  );
};

export default NarrowBanner;
