"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  IconChartBar,
  IconShoppingCart,
  IconCashRegister,
  IconPackage,
  IconReceipt2,
} from "@tabler/icons-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: <IconChartBar className="size-5" />,
    },
    {
      title: "Orders",
      url: "/dashboard/orders",
      icon: <IconShoppingCart className="size-5" />,
    },
    {
      title: "POS",
      url: "/dashboard/pos",
      icon: <IconCashRegister className="size-6 text-white" />,
      isFloating: true,
    },
    {
      title: "Products",
      url: "/dashboard/products",
      icon: <IconPackage className="size-5" />,
    },
    {
      title: "Expenses",
      url: "/dashboard/expenses",
      icon: <IconReceipt2 className="size-5" />,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/90 backdrop-blur-lg border-t border-border/80 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] px-4 h-16 flex items-center justify-between pb-safe">
      <div className="flex w-full items-center justify-around relative">
        {navItems.map((item) => {
          const isActive = pathname === item.url;

          if (item.isFloating) {
            return (
              <div key={item.title} className="relative -top-5 flex flex-col items-center">
                <Link
                  href={item.url}
                  className="flex items-center justify-center size-14 rounded-full bg-[#00bfa5] text-white shadow-lg shadow-teal-500/30 hover:bg-[#00a87e] hover:shadow-xl active:scale-95 transition-all duration-200 border-4 border-background dark:border-slate-900"
                >
                  {item.icon}
                </Link>
                <span className="text-[10px] font-semibold text-muted-foreground mt-1.5">
                  {item.title}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.url}
              className={cn(
                "flex flex-col items-center gap-1.5 py-1.5 text-muted-foreground transition-all duration-200 active:scale-95 hover:text-foreground",
                isActive && "text-[#00bfa5] dark:text-[#00bfa5] font-semibold"
              )}
            >
              <div className={cn("transition-transform duration-200", isActive && "scale-110")}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium leading-none">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
