import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import PrivacyPolicyBody from "@/components/privacy-policy/privacy-policy-body";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "Privacy Policy",
    description: `How ${store.name} collects, uses, and protects your personal information.`,
    canonical: "/privacy-policy",
  }));

const PrivacyPolicyPage = async () => {
  const store = await getStoreProfile();

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Privacy Policy",
          `How ${store.name} collects, uses, and protects your personal information.`,
          `${seoConfig.siteUrl}/privacy-policy`,
          store,
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
