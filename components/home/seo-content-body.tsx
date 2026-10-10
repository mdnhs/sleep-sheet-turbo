"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { toBengaliDigits } from "@/lib/utils";
import FaqAccordion from "./faq-accordion";
import type { PriceRow } from "@/lib/prefetch-home";

export default function SeoContentBody({ priceRows }: { priceRows: PriceRow[] }) {
  const { t, language } = useLanguage();
  const { shippingInsideDhaka, shippingOutsideDhaka } = useWebsiteSettings();
  const num = (n: number) => (language === "bn" ? toBengaliDigits(n) : String(n));

  const faqs = [
    { question: t("faqQ1"), answer: t("faqA1") },
    { question: t("faqQ2"), answer: t("faqA2") },
    {
      question: t("faqQ3"),
      answer: t("faqA3")
        .replace("{insideDhaka}", num(shippingInsideDhaka))
        .replace("{outsideDhaka}", num(shippingOutsideDhaka)),
    },
    { question: t("faqQ4"), answer: t("faqA4") },
    { question: t("faqQ5"), answer: t("faqA5") },
    { question: t("faqQ6"), answer: t("faqA6") },
    { question: t("faqQ7"), answer: t("faqA7") },
  ];

  const taka = (n: number) => `৳${language === "bn" ? toBengaliDigits(n.toLocaleString("en-IN")) : n.toLocaleString("en-IN")}`;

  return (
    <div className="max-w-3xl mx-auto">
      <h2
        id="about-products-heading"
        className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight text-foreground mb-4"
      >
        {t("seoAboutHeading")}
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-3">{t("seoAboutPara1")}</p>
      <p className="text-muted-foreground leading-relaxed mb-4">{t("seoAboutPara2")}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/categories/comforters" className="underline underline-offset-2 hover:text-foreground text-muted-foreground">
          {t("seoBrowseComforters")}
        </Link>
        <Link href="/categories/bedsheet" className="underline underline-offset-2 hover:text-foreground text-muted-foreground">
          {t("seoBrowseBedSheets")}
        </Link>
      </div>

      <div className="mt-5 pt-5 md:mt-6 md:pt-6 border-t border-border/40">
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-3">
          {t("seoPopularSearches")}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/categories/comforters"
            className="px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors"
          >
            কম্ফোর্টারের দাম
          </Link>
          <Link
            href="/categories/bedsheet"
            className="px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors"
          >
            বেডশিটের দাম
          </Link>
          <Link
            href="/categories/comforter-set"
            className="px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors"
          >
            ৫ পিস কম্ফোর্টার সেট
          </Link>
          <Link
            href="/categories/twill-bedsheet"
            className="px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors"
          >
            টুইল কটন বেডশিট
          </Link>
          <Link
            href="/shop?search=king"
            className="px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors"
          >
            কিং সাইজ বেডশিট
          </Link>
          <Link
            href="/shop"
            className="px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors"
          >
            ক্যাশ অন ডেলিভারি বেডিং
          </Link>
        </div>
      </div>

      <div className="mt-8 pt-5 md:mt-10 md:pt-6 border-t border-border/40">
        <h2 className="font-heading text-xl lg:text-2xl font-semibold tracking-tight text-foreground mb-2">
          {t("seoPriceHeading")}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4 text-sm">{t("seoPriceIntro")}</p>
        <div className="overflow-x-auto rounded-xl border border-border/40">
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
        <Link href="/shop" className="inline-block mt-3 text-sm underline underline-offset-2 hover:text-foreground text-muted-foreground">
          {t("seoPriceSeeMore")}
        </Link>
      </div>

      <div className="mt-8 pt-5 md:mt-10 md:pt-6 border-t border-border/40">
        <h2 className="font-heading text-xl lg:text-2xl font-semibold tracking-tight text-foreground mb-4">
          {t("seoWhyHeading")}
        </h2>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li>✅ {t("seoWhyPoint1")}</li>
          <li>✅ {t("seoWhyPoint2")}</li>
          <li>✅ {t("seoWhyPoint3")}</li>
          <li>✅ {t("seoWhyPoint4")}</li>
        </ul>
      </div>

      <h2 className="font-heading text-xl lg:text-2xl font-semibold tracking-tight text-foreground mt-8 mb-3 md:mt-10 md:mb-4">
        {t("seoFaqHeading")}
      </h2>
      <FaqAccordion faqs={faqs} />
    </div>
  );
}
