// ISR with a short window: a promotion's date window opens and closes on its
// own (no admin write to invalidate on), so the page re-reads every 5 minutes.
// Admin edits still show up immediately — invalidatePromotions() revalidates
// this path along with the "promotions" tag.
export const revalidate = 300;

import OfferClient from "./offer-client";
import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import { getLivePromotions } from "@/features/promotions/server/promotions";

const offerUrl = `${seoConfig.siteUrl}/offer`;

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "Offers",
    description: `Current offers at ${store.name} — free delivery deals on comforter sets, bed sheets and pillow covers, applied automatically at checkout.`,
    canonical: offerUrl,
  }));

export default async function OfferPage() {
  const [store, promotions] = await Promise.all([getStoreProfile(), getLivePromotions()]);

  return (
    <>
      {structuredDataScript(
        "offers-page",
        webpageSchema(
          `Offers | ${store.name}`,
          `Current offers and free delivery deals at ${store.name}.`,
          offerUrl,
          store,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Offers", url: "/offer" },
        ]),
      )}
      <OfferClient promotions={promotions} />
    </>
  );
}
