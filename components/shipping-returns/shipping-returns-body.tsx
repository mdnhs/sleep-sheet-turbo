"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { seoConfig } from "@/lib/seo";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { toBengaliDigits as bn } from "@/lib/utils";

export default function ShippingReturnsBody() {
  const { language, t } = useLanguage();
  // Charges come from the same settings checkout bills from, not hardcoded
  // copy — the page used to say ৳80 inside Dhaka while checkout charged more.
  const { shippingInsideDhaka, shippingOutsideDhaka } = useWebsiteSettings();

  return (
    <div className="max-w-3xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">
          {language === "bn" ? "শিপিং ও রিটার্ন" : "Shipping & Returns"}
        </span>
      </nav>

      <h1 className="text-4xl font-bold mb-2">
        {language === "bn" ? "শিপিং ও রিটার্ন" : "Shipping & Returns"}
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        {language === "bn" ? "সর্বশেষ হালনাগাদ: ১৭ জুলাই, ২০২৬" : "Last updated: July 17, 2026"}
      </p>

      {language === "bn" ? (
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2>ডেলিভারি এলাকা ও সময়</h2>
          <p>আমরা সারা বাংলাদেশে ডেলিভারি দিই। আনুমানিক ডেলিভারি সময় ও চার্জ:</p>
          <ul>
            <li><strong>ঢাকার ভিতরে</strong>: আনুমানিক ১ দিন, ডেলিভারি চার্জ ৳{bn(shippingInsideDhaka)}।</li>
            <li><strong>ঢাকার বাইরে</strong>: আনুমানিক ৩–৪ দিন, ডেলিভারি চার্জ ৳{bn(shippingOutsideDhaka)}।</li>
          </ul>
          <p>
            এগুলো আনুমানিক সময়, গ্যারান্টি নয় — কুরিয়ার বিলম্ব, আবহাওয়া, বা আপনার সঠিক অবস্থানের উপর
            নির্ভর করে প্রকৃত ডেলিভারি সময় ভিন্ন হতে পারে।
          </p>

          <h2>ডেলিভারিতে পেমেন্ট</h2>
          <p>
            আমরা বর্তমানে শুধুমাত্র ক্যাশ অন ডেলিভারি (COD) গ্রহণ করি: কুরিয়ার আপনার অর্ডার হস্তান্তর
            করার সময় আপনি ক্যাশে পেমেন্ট করেন। অর্ডার করতে কোনো অগ্রিম পেমেন্ট প্রয়োজন নেই।
          </p>

          <h2>ডেলিভারির সময় অর্ডার চেক করা</h2>
          <p>
            আপনার প্যাকেজ পৌঁছানোর সাথে সাথে দয়া করে পরীক্ষা করুন। প্যাকেজিং ক্ষতিগ্রস্ত মনে হলে বা
            ভেতরের জিনিস আপনার অর্ডারের সাথে না মিললে, দ্রুত সমাধানের জন্য সাথে সাথে আমাদের সাথে যোগাযোগ
            করুন।
          </p>

          <h2>৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি</h2>
          <p>
            {seoConfig.siteName}-এর প্রতিটি পণ্যে রয়েছে ৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি। আপনার পণ্য
            ত্রুটিপূর্ণ, ক্ষতিগ্রস্ত, বা অর্ডারকৃত পণ্যের সাথে না মিললে, ডেলিভারির ৭ দিনের মধ্যে আমাদের
            সাথে যোগাযোগ করুন, আমরা বিনামূল্যে তা পরিবর্তন করে দেব।
          </p>
          <p>রিপ্লেসমেন্টের জন্য অনুরোধ করতে:</p>
          <ol>
            <li>
              ডেলিভারির ৭ দিনের মধ্যে{" "}
              <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a> অথবা{" "}
              <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a>-এ
              যোগাযোগ করুন, সাথে আপনার অর্ডার নম্বর ও সমস্যার একটি ছবি দিন।
            </li>
            <li>আপনার দাবি সমাধান না হওয়া পর্যন্ত পণ্য ও এর মূল প্যাকেজিং সংরক্ষণ করুন।</li>
            <li>অনুমোদিত হলে, আমরা বিনামূল্যে রিপ্লেসমেন্ট আপনার কাছে পাঠানোর ব্যবস্থা করব।</li>
          </ol>
          <p>
            এই গ্যারান্টি ত্রুটিপূর্ণ, ক্ষতিগ্রস্ত, বা ভুল আইটেম কভার করে। ডেলিভারির পরে অসাবধানতার কারণে
            হওয়া ক্ষতি, বা শুধু মত পরিবর্তনের কারণে এটি প্রযোজ্য নয়।
          </p>

          <h2>প্রশ্ন আছে?</h2>
          <p>
            আমাদের সাথে যোগাযোগ করুন{" "}
            <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a> অথবা{" "}
            <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a>-এ।
          </p>
        </div>
      ) : (
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2>Delivery Areas &amp; Times</h2>
          <p>We deliver anywhere in Bangladesh. Estimated delivery times and charges are:</p>
          <ul>
            <li><strong>Inside Dhaka</strong>: approximately 1 day, ৳{shippingInsideDhaka} delivery charge.</li>
            <li><strong>Outside Dhaka</strong>: approximately 3–4 days, ৳{shippingOutsideDhaka} delivery charge.</li>
          </ul>
          <p>
            These are estimates, not guarantees — actual delivery time can vary due to courier
            delays, weather, or your exact location.
          </p>

          <h2>Payment on Delivery</h2>
          <p>
            We currently accept Cash on Delivery (COD) only: you pay in cash when the courier hands
            over your order. There is no advance payment required to place an order.
          </p>

          <h2>Checking Your Order on Delivery</h2>
          <p>
            Please inspect your package as soon as it arrives. If the packaging looks damaged or the
            contents don&apos;t match what you ordered, contact us right away so we can resolve it
            quickly.
          </p>

          <h2>7-Day Replacement Guarantee</h2>
          <p>
            Every product from {seoConfig.siteName} comes with a 7-day replacement guarantee. If your
            product is defective, damaged, or not what you ordered, contact us within 7 days of
            delivery and we will replace it free of charge.
          </p>
          <p>To request a replacement:</p>
          <ol>
            <li>
              Contact us at{" "}
              <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a> or{" "}
              <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a> within
              7 days of delivery, with your order number and a photo of the issue.
            </li>
            <li>Keep the product and its original packaging until your claim is resolved.</li>
            <li>
              Once approved, we&apos;ll arrange for the replacement to be shipped to you at no extra
              cost.
            </li>
          </ol>
          <p>
            This guarantee covers defective, damaged, or incorrect items. It does not cover damage
            caused by misuse after delivery, or a simple change of mind.
          </p>

          <h2>Questions?</h2>
          <p>
            Reach us at{" "}
            <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a> or{" "}
            <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a>.
          </p>
        </div>
      )}
    </div>
  );
}
