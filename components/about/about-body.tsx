"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/hooks/use-language";
import { StoreLocationMap } from "@/components/store-location-map";
import { seoConfig } from "@/lib/seo";

export default function AboutBody() {
  const { t } = useLanguage();

  const categories = [
    { label: t("aboutCatComforters"), href: "/categories/comforters" },
    { label: t("aboutCatBedsheet"), href: "/categories/bedsheet" },
    { label: t("aboutCatAcQuilt"), href: "/categories/ac-quilt" },
    { label: t("aboutCatMattressTopper"), href: "/categories/mattress-topper" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">{t("aboutBreadcrumbLabel")}</span>
      </nav>

      <h1 className="text-4xl font-bold mb-6">{t("aboutHeading")}</h1>

      <div className="prose prose-lg dark:prose-invert">
        <p className="text-xl text-muted-foreground mb-8">{t("aboutIntro")}</p>

        <h2 className="text-2xl font-semibold mt-12 mb-6">{t("aboutStoryHeading")}</h2>
        <p className="mb-6">{t("aboutStoryPara1")}</p>
        <p className="mb-12">{t("aboutStoryPara2")}</p>

        <Separator className="my-8" />

        <h2 className="text-2xl font-semibold mt-12 mb-6">{t("aboutValuesHeading")}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="text-xl font-medium mb-3">{t("aboutValueQualityTitle")}</h3>
            <p>{t("aboutValueQualityDesc")}</p>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-3">{t("aboutValuePricingTitle")}</h3>
            <p>{t("aboutValuePricingDesc")}</p>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-3">{t("aboutValueDeliveryTitle")}</h3>
            <p>{t("aboutValueDeliveryDesc")}</p>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-3">{t("aboutValueCareTitle")}</h3>
            <p>
              {t("aboutValueCarePrefix")} {seoConfig.contact.telephone} {t("orWord")}{" "}
              {seoConfig.contact.email}.
            </p>
          </div>
        </div>

        <Separator className="my-8" />

        <h2 className="text-2xl font-semibold mt-12 mb-6">{t("aboutVisitHeading")}</h2>
        <p className="mb-8">{t("aboutVisitPara")}</p>
        <StoreLocationMap className="not-prose" />

        <Separator className="my-8" />

        <h2 className="text-2xl font-semibold mt-12 mb-6">{t("aboutShopByCategoryHeading")}</h2>
        <div className="flex flex-wrap gap-2 not-prose">
          {categories.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 rounded-full bg-secondary/20 hover:bg-secondary/40 text-foreground border border-border/40 transition-colors text-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
