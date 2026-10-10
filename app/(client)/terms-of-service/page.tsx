import type { Metadata } from "next";
import {
  seoConfig,
  generateMetadata as buildMetadata,
  webpageSchema,
  breadcrumbSchema,
  structuredDataScript,
} from "@/lib/seo";
import TermsOfServiceBody from "@/components/terms-of-service/terms-of-service-body";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: `Read the terms and conditions for shopping at ${seoConfig.siteName} — orders, payment, delivery, and our replacement guarantee.`,
  canonical: "/terms-of-service",
});

const TermsOfServicePage = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Terms of Service",
          "Terms and conditions for shopping at Sleep Sheet.",
          `${seoConfig.siteUrl}/terms-of-service`,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Terms of Service", url: "/terms-of-service" },
        ]),
      )}

      <TermsOfServiceBody />
    </div>
  );
};

export default TermsOfServicePage;
