import {
  generateMetadata as buildMetadata,
  seoConfig,
  webpageSchema,
  breadcrumbSchema,
  structuredDataScript,
} from "@/lib/seo";
import AboutBody from "@/components/about/about-body";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "About Us",
  description:
    "Sleep Sheet is Bangladesh's online destination for premium comforter sets, bed sheets, and pillow covers — 100% twill cotton fabric with cash on delivery nationwide.",
  canonical: `${seoConfig.siteUrl}/about`,
});

const AboutPage = () => {
  const aboutUrl = `${seoConfig.siteUrl}/about`;

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "About Sleep Sheet",
          "Sleep Sheet is Bangladesh's online destination for premium comforter sets, bed sheets, and pillow covers.",
          aboutUrl,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]),
      )}

      {/* Visible copy is bn/en translated client-side (useLanguage), same
          split as the homepage's SeoContent/SeoContentBody — the JSON-LD
          above stays static English, matching that existing convention. */}
      <AboutBody />
    </div>
  );
};

export default AboutPage;
