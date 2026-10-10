import type { Metadata } from "next";
import ContactBody from "@/components/contact/contact-body";
import {
  generateMetadata as buildMetadata,
  seoConfig,
  webpageSchema,
  breadcrumbSchema,
  structuredDataScript,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description:
    "Get in touch with our team. Send us a message or reach out by phone or email — we'd love to hear from you.",
  canonical: "/contact",
});

const ContactPage = () => {
  const contactUrl = `${seoConfig.siteUrl}/contact`;

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Contact Sleep Sheet",
          "Get in touch with the Sleep Sheet team. Send us a message or reach out by phone or email.",
          contactUrl,
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
