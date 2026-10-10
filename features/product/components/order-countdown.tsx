"use client";

import React, { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export function OrderCountdown() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isSameDay, setIsSameDay] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(19, 0, 0, 0); // 7:00 PM

      let diff = target.getTime() - now.getTime();
      let sameDay = true;

      // If past 7:00 PM, set target to 7:00 PM tomorrow
      if (diff < 0) {
        target.setDate(target.getDate() + 1);
        diff = target.getTime() - now.getTime();
        sameDay = false;
      }

      setIsSameDay(sameDay);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ hours, minutes, seconds });
      if (!isReady) setIsReady(true);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [isReady]);

  if (!isReady) {
    return (
      <div className="mb-2 lg:mb-4 inline-flex items-center gap-2 border border-transparent rounded-full px-2.5 py-1.5 w-fit max-w-full animate-pulse">
        <div className="h-3.5 w-3.5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex h-[15px] sm:h-4 items-center">
          <div className="h-3 sm:h-3.5 w-40 sm:w-52 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 lg:mb-4 inline-flex items-center gap-2 border border-primary/30 rounded-full px-2.5 py-1.5 bg-primary/10 w-fit max-w-full">
      <Truck className="text-primary shrink-0 h-3.5 w-3.5" />
      <p className="text-[10px] sm:text-xs text-foreground truncate">
        <span className="font-bold text-primary">
          {timeLeft.hours} {t("hour")} {timeLeft.minutes} {t("min")}
        </span>{" "}
        {t("toGet")}{" "}
        <span className="font-bold text-primary">
          {isSameDay ? t("sameDayShipment") : t("shipmentTomorrow")}
        </span>
      </p>
    </div>
  );
}
