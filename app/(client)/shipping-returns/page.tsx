import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import ShippingReturnsBody from "@/components/shipping-returns/shipping-returns-body";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "Shipping & Returns",
    description: `Delivery times, delivery charges, and our 7-day replacement guarantee at ${store.name}.`,
    canonical: "/shipping-returns",
  }));

const ShippingReturnsPage = async () => {
  const store = await getStoreProfile();

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          "Shipping & Returns",
          "Delivery times, delivery charges, and our replacement guarantee.",
          `${seoConfig.siteUrl}/shipping-returns`,
          store,
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
