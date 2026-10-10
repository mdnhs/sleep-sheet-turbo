"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Product } from "@/lib/types";
import { Package, Truck, Tag, CalendarClock } from "lucide-react";

interface ProductAccordionProps {
  product: Product;
}

import { useSettings } from "@/features/settings/api/use-settings";
import React, { useSyncExternalStore } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";

export function ProductAccordion({ product }: ProductAccordionProps) {
  const { data: settings, isLoading: isSettingsLoading } = useSettings();
  const { formatAmount } = useCurrency();
  const { t } = useLanguage();

  const insideCost = Number(settings?.shipping_inside_dhaka ?? 60);
  const outsideCost = Number(settings?.shipping_outside_dhaka ?? 120);

  // Calculate automatic delivery dates
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  // The dates come from the visitor's clock, so they are only computed in the
  // browser. The product page is cached HTML (ISR) generated up to a day
  // earlier, on a server in UTC: rendering "today" there produced a different
  // date than the visitor's whenever the two days differed, and that text
  // mismatch makes React throw away the server HTML and re-render the page on
  // the client. During SSR and hydration these render empty instead.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const today = new Date();

  // Inside Dhaka: 1 day (tomorrow)
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = isClient ? `${tomorrow.getDate()} ${months[tomorrow.getMonth()]}` : "";

  // Outside Dhaka: 3-4 days
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 3);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 4);
  const outsideRangeStr = isClient
    ? `${minDate.getDate()} ${months[minDate.getMonth()]} - ${maxDate.getDate()} ${months[maxDate.getMonth()]}`
    : "";

  return (
    <div className="w-full space-y-4">
      <Accordion
        defaultValue={["shipping"]}
        className="w-full border-none space-y-4"
      >
        <AccordionItem
          value="shipping"
          className="rounded-2xl p-1 bg-white dark:bg-slate-900 data-open:bg-white dark:data-open:bg-slate-900"
        >
          <AccordionTrigger className="text-sm font-bold hover:no-underline py-3">
            {t("shippingAndDelivery")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Inside Dhaka */}
              <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary p-1.5 rounded-lg shrink-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold leading-tight mb-0">
                      {t("insideDhaka")}
                    </span>
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {t("oneDayDelivery")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                    {t("shippingCost")}
                  </span>
                  {isSettingsLoading ? (
                    <span className="h-[13px] w-10 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  ) : (
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                      {formatAmount(insideCost)}
                    </span>
                  )}
                </div>

                <div className="mt-2 bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t("estDelivery")}: {tomorrowStr}
                </div>
              </div>

              {/* Outside Dhaka */}
              <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-orange-500/50 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-orange-500/10 text-orange-600 dark:text-orange-400 p-1.5 rounded-lg shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold leading-tight mb-0">
                      {t("outsideDhaka")}
                    </span>
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {t("threeToFourDaysDelivery")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                    {t("shippingCost")}
                  </span>
                  {isSettingsLoading ? (
                    <span className="h-3.25 w-10 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  ) : (
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                      {formatAmount(outsideCost)}
                    </span>
                  )}
                </div>

                <div className="mt-2 bg-orange-500/10 text-orange-800 dark:text-orange-400 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t("estDelivery")}: {outsideRangeStr}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
