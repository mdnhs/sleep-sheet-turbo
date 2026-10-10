import ContactBody from "@/components/contact/contact-body";
import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";

export const generateMetadata = () =>
  pageMetadata(() => ({
    title: "Contact Us",
    description:
      "Get in touch with our team. Send us a message or reach out by phone or email — we'd love to hear from you.",
    canonical: "/contact",
  }));

const ContactPage = async () => {
  const store = await getStoreProfile();
  const contactUrl = `${seoConfig.siteUrl}/contact`;

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          `Contact ${store.name}`,
          `Get in touch with the ${store.name} team. Send us a message or reach out by phone or email.`,
          contactUrl,
          store,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Contact", url: "/contact" },
        ]),
      )}

      {/* Visible copy is bn/en translated client-side (useLanguage), same
          split used on the About page. */}
      <ContactBody />
    </div>
  );
};

export default ContactPage;
