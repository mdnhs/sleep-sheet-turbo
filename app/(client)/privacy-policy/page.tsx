import type { Metadata } from "next";
import {
  seoConfig,
  generateMetadata as buildMetadata,
  webpageSchema,
  breadcrumbSchema,
  structuredDataScript,
} from "@/lib/seo";
import PrivacyPolicyBody from "@/components/privacy-policy/privacy-policy-body";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: `How ${seoConfig.siteName} collects, uses, and protects your personal information.`,
  canonical: "/privacy-policy",
});

const PrivacyPolicyPage = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Privacy Policy",
          "How Sleep Sheet collects, uses, and protects your personal information.",
          `${seoConfig.siteUrl}/privacy-policy`,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Privacy Policy", url: "/privacy-policy" },
        ]),
      )}

      {/* Visible copy (full bn/en translation, not just the shared UI
          strings) lives in the client component below, switching with
          useLanguage() the same way About/Contact/Blog do. */}
      <PrivacyPolicyBody />
    </div>
  );
};

export default PrivacyPolicyPage;
