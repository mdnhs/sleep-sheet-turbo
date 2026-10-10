import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import AboutBody from "@/components/about/about-body";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "About Us",
    description: `${store.name} is Bangladesh's online destination for premium comforter sets, bed sheets, and pillow covers — 100% twill cotton fabric with cash on delivery nationwide.`,
    canonical: `${seoConfig.siteUrl}/about`,
  }));

const AboutPage = async () => {
  const store = await getStoreProfile();
  const aboutUrl = `${seoConfig.siteUrl}/about`;

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          `About ${store.name}`,
          `${store.name} is Bangladesh's online destination for premium comforter sets, bed sheets, and pillow covers.`,
          aboutUrl,
          store,
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
