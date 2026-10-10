"use client";

import { CreditCard, Tag, ShieldCheck, Truck } from "lucide-react";
import React from "react";
import { useWebsiteSettings } from "@/hooks/use-website-settings";

const ICONS = [CreditCard, Tag, ShieldCheck, Truck];
const COLORS = [
  { color: "text-yellow-600", bgColor: "bg-yellow-100" },
  { color: "text-purple-600", bgColor: "bg-purple-100" },
  { color: "text-green-600", bgColor: "bg-green-100" },
  { color: "text-primary", bgColor: "bg-primary/10" },
];

const Features = () => {
  const { features } = useWebsiteSettings();

  return (
    <section className="py-10 md:py-16 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:gap-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {features.map((feature, index) => {
            const Icon = ICONS[index];
            const { color, bgColor } = COLORS[index];
            return (
              <div key={index} className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 lg:px-8 group cursor-default">
                <div
                  className={`flex-shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 shadow-sm ${bgColor} ${color}`}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-1.5 items-center sm:items-start pt-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm md:text-base tracking-tight transition-colors group-hover:text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
