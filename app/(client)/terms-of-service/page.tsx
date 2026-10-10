import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import TermsOfServiceBody from "@/components/terms-of-service/terms-of-service-body";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "Terms of Service",
    description: `Read the terms and conditions for shopping at ${store.name} — orders, payment, delivery, and our replacement guarantee.`,
    canonical: "/terms-of-service",
  }));

const TermsOfServicePage = async () => {
  const store = await getStoreProfile();

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Terms of Service",
          `Terms and conditions for shopping at ${store.name}.`,
          `${seoConfig.siteUrl}/terms-of-service`,
          store,
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
