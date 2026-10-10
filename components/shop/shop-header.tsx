"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";

export default function ShopHeader() {
  const { t } = useLanguage();

  return (
    <>
      {/* Visually hidden on mobile — it just ate space above the filter row
          there and added little on a page one tap from home; kept for
          screen readers and restored visually from sm: up. */}
      <nav aria-label="Breadcrumb" className="sr-only sm:not-sr-only sm:flex items-center gap-2 mb-3 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">{t("shop")}</span>
      </nav>
      <h1 className="sr-only">{t("shopPageHeading")}</h1>
    </>
  );
}
