"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { seoConfig } from "@/lib/seo";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { toBengaliDigits as bn } from "@/lib/utils";

export default function TermsOfServiceBody() {
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
          {language === "bn" ? "সেবার শর্তাবলী" : "Terms of Service"}
        </span>
      </nav>

      <h1 className="text-4xl font-bold mb-2">
        {language === "bn" ? "সেবার শর্তাবলী" : "Terms of Service"}
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        {language === "bn" ? "সর্বশেষ হালনাগাদ: ১৭ জুলাই, ২০২৬" : "Last updated: July 17, 2026"}
      </p>

      {language === "bn" ? (
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>
            {seoConfig.siteName}-এ স্বাগতম। এই সেবার শর্তাবলী (&quot;শর্তাবলী&quot;)
            {" "}{seoConfig.siteUrl.replace(/^https?:\/\//, "")} (&quot;সাইট&quot;) ব্যবহার এবং এর মাধ্যমে
            আপনার করা যেকোনো ক্রয় নিয়ন্ত্রণ করে। সাইট ব্যবহার করা বা অর্ডার করার মাধ্যমে, আপনি এই
            শর্তাবলীতে সম্মত হচ্ছেন। আপনি সম্মত না হলে, দয়া করে সাইট ব্যবহার করবেন না।
          </p>

          <h2>১. সাইট ব্যবহার</h2>
          <p>
            অর্ডার করতে হলে আপনার আইনগতভাবে বাধ্যতামূলক চুক্তি করার সক্ষমতা থাকতে হবে — আপনি নাবালক হলে,
            অনুগ্রহ করে আপনার পক্ষে অর্ডার দিতে অভিভাবককে বলুন। আপনি সম্মত হচ্ছেন যে সাইটটি কোনো অবৈধ
            উদ্দেশ্যে ব্যবহার করবেন না, এর নিরাপত্তা বা স্বাভাবিক কার্যক্রমে হস্তক্ষেপ করবেন না, এবং
            আমাদের সিস্টেম বা অন্য ব্যবহারকারীদের অ্যাকাউন্টে অননুমোদিত প্রবেশের চেষ্টা করবেন না।
          </p>

          <h2>২. পণ্য, মূল্য ও প্রাপ্যতা</h2>
          <p>
            সকল মূল্য বাংলাদেশি টাকায় (৳) তালিকাভুক্ত এবং পূর্ব নোটিশ ছাড়াই পরিবর্তনসাপেক্ষ। আমরা পণ্যের
            রঙ ও বিবরণ যথাসম্ভব সঠিকভাবে প্রদর্শনের চেষ্টা করি, তবে আপনার স্ক্রিনের উপর নির্ভর করে প্রকৃত
            রঙে সামান্য পার্থক্য হতে পারে। পণ্যের প্রাপ্যতা সাপেক্ষ, এবং আমরা যেকোনো সময় পরিমাণ সীমিত
            করার বা যেকোনো পণ্য বন্ধ করার অধিকার সংরক্ষণ করি।
          </p>

          <h2>৩. অর্ডার ও পেমেন্ট</h2>
          <p>
            আমরা বর্তমানে শুধুমাত্র ক্যাশ অন ডেলিভারি (COD) গ্রহণ করি — ডেলিভারির সময় ক্যাশে পেমেন্ট
            সংগ্রহ করা হয়। অর্ডার দেওয়া মানে ক্রয়ের একটি প্রস্তাব, যা আমরা গ্রহণ বা প্রত্যাখ্যান করতে
            পারি — যেমন, পণ্য স্টকে না থাকলে, প্রতারণার সন্দেহ হলে, অথবা প্রদর্শিত মূল্য বা পণ্যের তথ্যে
            ভুল থাকলে।
          </p>

          <h2>৪. শিপিং ও ডেলিভারি</h2>
          <p>আমরা বর্তমানে সারা বাংলাদেশে ডেলিভারি দিই। আনুমানিক ডেলিভারি সময় ও চার্জ:</p>
          <ul>
            <li>ঢাকার ভিতরে: আনুমানিক ১ দিন, ডেলিভারি চার্জ ৳{bn(shippingInsideDhaka)}।</li>
            <li>ঢাকার বাইরে: আনুমানিক ৩–৪ দিন, ডেলিভারি চার্জ ৳{bn(shippingOutsideDhaka)}।</li>
          </ul>
          <p>
            ডেলিভারির সময়সীমা আনুমানিক এবং কুরিয়ার বিলম্ব, আবহাওয়া, বা আমাদের নিয়ন্ত্রণের বাইরের অন্যান্য
            পরিস্থিতির কারণে পরিবর্তিত হতে পারে।
          </p>

          <h2>৫. রিপ্লেসমেন্ট গ্যারান্টি</h2>
          <p>
            {seoConfig.siteName}-এর প্রতিটি পণ্যে রয়েছে ৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি। আপনি যদি ত্রুটিপূর্ণ
            বা ক্ষতিগ্রস্ত পণ্য পান, ডেলিভারির ৭ দিনের মধ্যে আমাদের সাথে যোগাযোগ করুন, আমরা বিনামূল্যে তা
            পরিবর্তন করে দেব। দয়া করে পণ্য ও প্যাকেজিং সংরক্ষণ করুন যতক্ষণ না রিপ্লেসমেন্ট সম্পন্ন হয়, কারণ
            আপনার দাবি প্রক্রিয়া করতে আমরা ছবি বা পণ্যটি নিজে চাইতে পারি।
          </p>

          <h2>৬. বুদ্ধিবৃত্তিক সম্পত্তি</h2>
          <p>
            সাইটের সকল কনটেন্ট — টেক্সট, গ্রাফিক্স, লোগো ও ছবিসহ — {seoConfig.siteName} বা এর লাইসেন্সদাতার
            সম্পত্তি এবং প্রযোজ্য বুদ্ধিবৃত্তিক সম্পত্তি আইন দ্বারা সুরক্ষিত। আমাদের পূর্ব লিখিত সম্মতি ছাড়া
            আপনি আমাদের কনটেন্ট কপি, পুনরুৎপাদন বা বাণিজ্যিক উদ্দেশ্যে ব্যবহার করতে পারবেন না।
          </p>

          <h2>৭. নিষিদ্ধ ব্যবহার</h2>
          <p>
            আপনি সম্মত হচ্ছেন যে সাইটটি ক্ষতিকর কোড পাঠাতে, অন্য ব্যবহারকারীদের হয়রানি বা প্রতারণা করতে,
            প্রতিযোগিতামূলক ব্যবহারের জন্য কনটেন্ট স্ক্র্যাপ বা কপি করতে, অথবা আমাদের সার্ভার বা নেটওয়ার্কে
            ব্যাঘাত বা বোঝা সৃষ্টি করে এমন কোনো কার্যক্রমে ব্যবহার করবেন না।
          </p>

          <h2>৮. দায়ের সীমাবদ্ধতা</h2>
          <p>
            আইন দ্বারা অনুমোদিত সর্বোচ্চ সীমা পর্যন্ত, {seoConfig.siteName} সাইট ব্যবহার বা এর মাধ্যমে কেনা
            কোনো পণ্য থেকে উদ্ভূত পরোক্ষ, আকস্মিক বা পরিণামগত ক্ষতির জন্য দায়ী নয়, উপরে বর্ণিত রিপ্লেসমেন্ট
            গ্যারান্টিতে উল্লেখিত প্রতিকার ব্যতীত।
          </p>

          <h2>৯. এই শর্তাবলীতে পরিবর্তন</h2>
          <p>
            আমরা মাঝে মাঝে এই শর্তাবলী আপডেট করতে পারি। এই পেজে প্রকাশিত হওয়ার সাথে সাথে পরিবর্তনগুলো
            কার্যকর হয়ে যায়, এবং পরিবর্তন প্রকাশের পর সাইট ব্যবহার চালিয়ে যাওয়ার অর্থ হলো আপডেট করা
            শর্তাবলী মেনে নেওয়া।
          </p>

          <h2>১০. প্রযোজ্য আইন</h2>
          <p>
            এই শর্তাবলী গণপ্রজাতন্ত্রী বাংলাদেশের আইন দ্বারা পরিচালিত, এর দ্বন্দ্ব-আইন বিধান বিবেচনা না করে।
          </p>

          <h2>১১. যোগাযোগ করুন</h2>
          <p>
            এই শর্তাবলী নিয়ে প্রশ্ন আছে? আমাদের সাথে যোগাযোগ করুন{" "}
            <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a> অথবা{" "}
            <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a> নম্বরে, অথবা
            লিখুন {seoConfig.address.streetAddress}, {seoConfig.address.addressLocality}, বাংলাদেশ ঠিকানায়।
          </p>
        </div>
      ) : (
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>
            Welcome to {seoConfig.siteName}. These Terms of Service (&quot;Terms&quot;) govern your
            access to and use of {seoConfig.siteUrl.replace(/^https?:\/\//, "")} (the
            &quot;Site&quot;) and any purchase you make through it. By using the Site or placing an
            order, you agree to these Terms. If you do not agree, please do not use the Site.
          </p>

          <h2>1. Use of the Site</h2>
          <p>
            You must be able to form a legally binding contract to place an order — if you are a
            minor, please have a parent or guardian place the order on your behalf. You agree not to
            use the Site for any unlawful purpose, to interfere with its security or normal
            operation, or to attempt unauthorized access to our systems or other users&apos; accounts.
          </p>

          <h2>2. Products, Pricing &amp; Availability</h2>
          <p>
            All prices are listed in Bangladeshi Taka (৳) and are subject to change without notice.
            We make every effort to display product colors and details accurately, but actual colors
            may vary slightly depending on your screen. Products are subject to availability, and we
            reserve the right to limit quantities or discontinue any product at any time.
          </p>

          <h2>3. Orders &amp; Payment</h2>
          <p>
            We currently accept Cash on Delivery (COD) only — payment is collected in cash at the
            time of delivery. Placing an order is an offer to purchase, which we may accept or
            decline — for example, if a product is out of stock, if we suspect fraud, or if there is
            an error in the price or product information displayed.
          </p>

          <h2>4. Shipping &amp; Delivery</h2>
          <p>
            We currently deliver anywhere in Bangladesh. Estimated delivery times and charges are:
          </p>
          <ul>
            <li>Inside Dhaka: approximately 1 day, ৳{shippingInsideDhaka} delivery charge.</li>
            <li>Outside Dhaka: approximately 3–4 days, ৳{shippingOutsideDhaka} delivery charge.</li>
          </ul>
          <p>
            Delivery timelines are estimates and may vary due to courier delays, weather, or other
            circumstances beyond our control.
          </p>

          <h2>5. Replacement Guarantee</h2>
          <p>
            Every product from {seoConfig.siteName} comes with a 7-day replacement guarantee. If you
            receive a defective or damaged product, contact us within 7 days of delivery and we will
            replace it free of charge. Please retain the product and packaging until the replacement
            is resolved, as we may ask for photos or the item itself to process your claim.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            All content on the Site — including text, graphics, logos, and images — is the property
            of {seoConfig.siteName} or its licensors and is protected by applicable intellectual
            property laws. You may not copy, reproduce, or use our content for commercial purposes
            without our prior written consent.
          </p>

          <h2>7. Prohibited Uses</h2>
          <p>
            You agree not to use the Site to transmit malicious code, harass or defraud other users,
            scrape or copy content for competing use, or engage in any activity that disrupts or
            burdens our servers or networks.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, {seoConfig.siteName} is not liable for any
            indirect, incidental, or consequential damages arising from your use of the Site or from
            any product purchased through it, beyond the remedies described in our Replacement
            Guarantee above.
          </p>

          <h2>9. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Changes take effect once posted on this
            page, and your continued use of the Site after changes are posted constitutes acceptance
            of the updated Terms.
          </p>

          <h2>10. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the People&apos;s Republic of Bangladesh, without
            regard to its conflict of law provisions.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            Questions about these Terms? Reach us at{" "}
            <a href={`mailto:${seoConfig.contact.email}`}>{seoConfig.contact.email}</a> or{" "}
            <a href={`tel:${seoConfig.contact.telephone}`}>{seoConfig.contact.telephone}</a>, or write
            to us at {seoConfig.address.streetAddress}, {seoConfig.address.addressLocality},
            Bangladesh.
          </p>
        </div>
      )}
    </div>
  );
}
