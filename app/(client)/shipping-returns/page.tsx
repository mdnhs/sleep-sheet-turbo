import type { Metadata } from "next";
import {
  seoConfig,
  generateMetadata as buildMetadata,
  webpageSchema,
  breadcrumbSchema,
  structuredDataScript,
} from "@/lib/seo";
import ShippingReturnsBody from "@/components/shipping-returns/shipping-returns-body";

export const metadata: Metadata = buildMetadata({
  title: "Shipping & Returns",
  description: `Delivery times, delivery charges, and our 7-day replacement guarantee at ${seoConfig.siteName}.`,
  canonical: "/shipping-returns",
});

const ShippingReturnsPage = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Shipping & Returns",
          "Delivery times, delivery charges, and our replacement guarantee.",
          `${seoConfig.siteUrl}/shipping-returns`,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Shipping & Returns", url: "/shipping-returns" },
        ]),
      )}

      <ShippingReturnsBody />
    </div>
  );
};

export default ShippingReturnsPage;
