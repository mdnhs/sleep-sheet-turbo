import { faqSchema, structuredDataScript } from "@/lib/seo";
import { getPublicSettings, getPriceRanges, type PriceRow } from "@/lib/prefetch-home";
import { SHIPPING_ZONES } from "@/features/checkout/constants";
import { storeProfileFromSettings } from "@/lib/settings/store-profile";
import SeoContentBody from "./seo-content-body";

// Server component: the FAQPage JSON-LD below is emitted in English always,
// regardless of the site's bn/en language toggle. It targets the
// Bangladesh-intent English commercial queries this section was built for
// (see components/home/seo-content-body.tsx for the visible, translated
// copy). Keeping the schema static avoids the rich-result target flipping
// to Bengali on first server render, since useLanguage() defaults to "bn"
// before it reads localStorage client-side.
const buildFaqs = (insideDhaka: number, outsideDhaka: number, storeName: string) => [
  {
    question: `What is included in the ${storeName} 5-piece comforter set?`,
    answer:
      "Each 5-piece comforter set includes 1 comforter, 1 bed sheet, 2 pillow covers, and 1 kolbalish (bolster) cover, made from premium twill cotton fabric.",
  },
  {
    question: "Do you offer cash on delivery in Bangladesh?",
    answer:
      "Yes. You can order any comforter or bed sheet with zero advance payment and pay in cash when the product is delivered to your home, anywhere in Bangladesh.",
  },
  {
    question: "How long does delivery take?",
    answer:
      `Delivery inside Dhaka takes 1 day (৳${insideDhaka} delivery charge). Outside Dhaka, delivery takes 3-4 days (৳${outsideDhaka} delivery charge).`,
  },
  {
    question: "Is there a replacement guarantee?",
    answer:
      `Yes, every ${storeName} product comes with a 7-day replacement guarantee. If there is any defect, we will replace the product free of charge.`,
  },
  {
    question: `What fabric are ${storeName} products made of?`,
    answer:
      "All our bed sheets and comforters are made from 100% twill cotton — a diagonal-weave cotton that stays soft, breathable, and color-fast through years of washing.",
  },
  {
    question: "How do I know what size to order?",
    answer:
      "Each product page lists exact single, double, and king size dimensions. Measure your mattress and match it to the closest size before ordering — message us on WhatsApp if you're unsure.",
  },
  {
    question: "Do you take bulk or wholesale orders?",
    answer:
      "Yes, we supply bulk orders for hotels, hostels, and resellers. Contact us on WhatsApp with your quantity and requirements for a custom quote.",
  },
];

export default async function SeoContent() {
  // Delivery charges in the FAQ rich result must match what checkout bills.
  const [settings, priceRows] = await Promise.all([
    getPublicSettings().catch(() => null),
    getPriceRanges().catch(() => [] as PriceRow[]),
  ]);
  const faqs = buildFaqs(
    Number(settings?.shipping_inside_dhaka ?? SHIPPING_ZONES.inside_dhaka.cost),
    Number(settings?.shipping_outside_dhaka ?? SHIPPING_ZONES.outside_dhaka.cost),
    storeProfileFromSettings(settings).name,
  );

  return (
    <section
      aria-labelledby="about-products-heading"
      className="bg-[#F4F4F4] dark:bg-background py-6 md:py-8"
    >
      <div className="container mx-auto px-4">
        {structuredDataScript("faq", faqSchema(faqs))}
        <SeoContentBody priceRows={priceRows} />
      </div>
    </section>
  );
}
