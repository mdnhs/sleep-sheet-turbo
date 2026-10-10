"use client";

import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/hooks/use-language";
import { seoConfig } from "@/lib/seo";

// Static store-wide copy shown under every product. Mirrors the policy on
// /shipping-returns — keep the two in sync when the policy changes.
const whyChooseUs = {
  bn: [
    "নরম, আরামদায়ক ও টেকসই কাপড় — প্রতিদিনের ব্যবহারে উপযোগী।",
    "সঠিক মাপ ও নিখুঁত ফিনিশিং — মজবুত সেলাই, দীর্ঘদিন ব্যবহারযোগ্য।",
    "ন্যায্য দামে মানসম্মত পণ্য — ছবিতে যা দেখছেন, হাতে পাবেন সেটাই।",
    "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি — অগ্রিম পেমেন্ট লাগবে না।",
    "ডেলিভারির সময় পণ্য দেখে নেওয়ার সুযোগ।",
    "৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি।",
  ],
  en: [
    "Soft, comfortable and durable fabric made for everyday use.",
    "Accurate sizing and neat finishing — strong stitching that lasts.",
    "Quality products at fair prices — what you see is what you get.",
    "Cash on delivery all over Bangladesh — no advance payment.",
    "Check your parcel when the courier delivers it.",
    "7-day replacement guarantee.",
  ],
};

const returnPolicy = {
  bn: {
    intro:
      "স্লিপ শিট থেকে কেনাকাটার জন্য ধন্যবাদ। আপনি যেন পণ্য নিয়ে পুরোপুরি সন্তুষ্ট থাকেন, তাই আমাদের রিটার্ন ও রিপ্লেসমেন্ট নীতিমালা নিচে দেওয়া হলো।",
    sections: [
      {
        title: "রিপ্লেসমেন্ট পলিসি",
        items: [
          "ডেলিভারির ৭ দিনের মধ্যে রিপ্লেসমেন্টের আবেদন করতে হবে।",
          "ত্রুটিপূর্ণ, ক্ষতিগ্রস্ত বা ভুল পণ্য পেলে বিনামূল্যে পরিবর্তন করে দেওয়া হবে।",
          "আবেদনের সময় অর্ডার নম্বর ও সমস্যার একটি ছবি দিন।",
          "সমাধান না হওয়া পর্যন্ত পণ্য ও মূল প্যাকেজিং সংরক্ষণ করুন।",
        ],
      },
      {
        title: "যেসব ক্ষেত্রে রিপ্লেসমেন্ট প্রযোজ্য নয়",
        items: [
          "ব্যবহৃত বা ধোয়া হয়েছে এমন পণ্য।",
          "ডেলিভারির পরে অসাবধানতায় হওয়া ক্ষতি।",
          "শুধু মত পরিবর্তনের কারণে।",
          "নির্ধারিত ৭ দিন পার হওয়ার পরে আবেদন।",
          "স্ক্রিন ও বাস্তবের কারণে রঙে সামান্য পার্থক্য।",
        ],
      },
    ],
    contact: "রিটার্ন বা রিপ্লেসমেন্ট সংক্রান্ত যেকোনো প্রশ্নে যোগাযোগ করুন:",
    more: "বিস্তারিত পড়ুন: শিপিং ও রিটার্ন",
  },
  en: {
    intro:
      "Thank you for shopping with Sleep Sheet. We want you to be fully happy with your order, so here is our return and replacement policy.",
    sections: [
      {
        title: "Replacement policy",
        items: [
          "Request a replacement within 7 days of delivery.",
          "Defective, damaged or wrong items are replaced free of charge.",
          "Share your order number and a photo of the issue.",
          "Keep the product and its original packaging until the claim is resolved.",
        ],
      },
      {
        title: "Not eligible for replacement",
        items: [
          "Used or washed products.",
          "Damage caused by misuse after delivery.",
          "A simple change of mind.",
          "Requests made after the 7-day window.",
          "Slight colour differences between screen and real product.",
        ],
      },
    ],
    contact: "For any return or replacement question, reach us at:",
    more: "Read more: Shipping & Returns",
  },
};

export function ProductPolicyAccordion() {
  const { language } = useLanguage();
  const lang = language === "bn" ? "bn" : "en";
  const policy = returnPolicy[lang];

  return (
    <section aria-label={lang === "bn" ? "কেন আমরা ও রিটার্ন পলিসি" : "Why choose us and return policy"}>
      <Accordion defaultValue={["why-choose-us"]} className="w-full space-y-3">
        <AccordionItem
          value="why-choose-us"
          className="rounded-2xl border border-border/60 bg-white dark:bg-slate-900 data-open:bg-white dark:data-open:bg-slate-900 overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 text-base font-semibold hover:no-underline">
            <span className="flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-primary shrink-0" aria-hidden />
              {lang === "bn" ? "কেন আমাদের থেকে কিনবেন" : "Why Choose Us"}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-2 border-t border-border/60">
            <ul className="space-y-2 text-[15px] leading-relaxed text-foreground/90">
              {whyChooseUs[lang].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary font-bold" aria-hidden>✔</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="return-policy"
          className="rounded-2xl border border-border/60 bg-white dark:bg-slate-900 data-open:bg-white dark:data-open:bg-slate-900 overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 text-base font-semibold hover:no-underline">
            <span className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" aria-hidden />
              {lang === "bn" ? "রিটার্ন পলিসি" : "Return Policy"}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-2 border-t border-border/60 text-[15px] leading-relaxed text-foreground/90">
            <p>{policy.intro}</p>
            {policy.sections.map((section) => (
              <div key={section.title} className="mt-4">
                <h3 className="font-bold text-foreground mb-1.5">{section.title}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-4">
              {policy.contact}{" "}
              <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a>
              {" / "}
              <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a>
            </p>
            <p className="mt-2">
              <Link href="/shipping-returns">{policy.more}</Link>
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
