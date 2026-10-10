"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { toBengaliDigits } from "@/lib/utils";
import type { PriceRow } from "@/lib/prefetch-home";

export default function ShopSeoContent({ priceRows }: { priceRows: PriceRow[] }) {
  const { t, language } = useLanguage();
  const taka = (n: number) => `৳${language === "bn" ? toBengaliDigits(n.toLocaleString("en-IN")) : n.toLocaleString("en-IN")}`;

  return (
    <div className="mt-10 pt-8 border-t border-border/50 max-w-3xl">
      <h2 className="font-heading text-xl lg:text-2xl font-semibold tracking-tight text-foreground mb-2">
        {t("shopSeoHeading")}
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-6 text-sm">{t("shopSeoIntro")}</p>

      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground mb-2">
        {t("shopSeoPriceHeading")}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-border/40 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/20 text-left">
              <th className="px-4 py-2.5 font-semibold text-foreground">{t("seoPriceCategoryHeader")}</th>
              <th className="px-4 py-2.5 font-semibold text-foreground">{t("seoPriceRangeHeader")}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-card">
            {priceRows.map((row) => (
              <tr key={row.href} className="border-t border-border/40">
                <td className="px-4 py-2.5">
                  <Link href={row.href} className="hover:underline hover:text-foreground text-muted-foreground">
                    {t(row.labelKey)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {row.min === row.max ? taka(row.min) : `${taka(row.min)} – ${taka(row.max)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground mb-2">
        {t("shopSeoWhyHeading")}
      </h3>
      <ul className="space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>✅ {t("shopSeoWhyPoint1")}</li>
        <li>✅ {t("shopSeoWhyPoint2")}</li>
        <li>✅ {t("shopSeoWhyPoint3")}</li>
        <li>✅ {t("shopSeoWhyPoint4")}</li>
      </ul>

      <p className="text-sm text-muted-foreground">{t("shopSeoCta")}</p>
    </div>
  );
}
