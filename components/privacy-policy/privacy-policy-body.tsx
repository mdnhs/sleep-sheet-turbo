"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import { useStoreProfile } from "@/hooks/use-store-profile";
import { seoConfig } from "@/lib/seo";

export default function PrivacyPolicyBody() {
  const { language, t } = useLanguage();
  const store = useStoreProfile();

  return (
    <div className="max-w-3xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">
          {language === "bn" ? "প্রাইভেসি পলিসি" : "Privacy Policy"}
        </span>
      </nav>

      <h1 className="text-4xl font-bold mb-2">
        {language === "bn" ? "প্রাইভেসি পলিসি" : "Privacy Policy"}
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        {language === "bn" ? "সর্বশেষ হালনাগাদ: ১৭ জুলাই, ২০২৬" : "Last updated: July 17, 2026"}
      </p>

      {language === "bn" ? (
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>
            এই প্রাইভেসি পলিসিতে ব্যাখ্যা করা হয়েছে যে আপনি {seoConfig.siteUrl.replace(/^https?:\/\//, "")}
            {" "}ভিজিট বা শপিং করার সময় {store.name} কী ধরনের ব্যক্তিগত তথ্য সংগ্রহ করে, কীভাবে তা
            ব্যবহার করে, এবং এ ব্যাপারে আপনার কী কী পছন্দ আছে।
          </p>

          <h2>১. আমরা যে তথ্য সংগ্রহ করি</h2>
          <p>আমরা নিম্নলিখিত ধরনের তথ্য সংগ্রহ করি:</p>
          <ul>
            <li>
              <strong>অ্যাকাউন্ট ও অর্ডার তথ্য</strong>: নাম, ফোন নম্বর, ইমেইল (ঐচ্ছিক), এবং ডেলিভারি
              ঠিকানা, যা আপনি অ্যাকাউন্ট তৈরি বা অর্ডার করার সময় প্রদান করেন।
            </li>
            <li>
              <strong>অর্ডারের বিস্তারিত</strong>: আপনার অর্ডারের পণ্য, পরিমাণ ও মূল্য, আপনার বেছে নেওয়া
              ডেলিভারি জোন, এবং পেমেন্ট পদ্ধতি (বর্তমানে শুধু ক্যাশ অন ডেলিভারি)।
            </li>
            <li>
              <strong>ব্যবহারের তথ্য</strong>: আপনি কোন পেজ ভিজিট করেছেন, কোন পণ্য দেখেছেন, এবং কার্টে
              যোগ করা বা চেকআউট শুরু করার মতো কার্যক্রম — এগুলো স্বয়ংক্রিয়ভাবে সংগ্রহ করা হয় যাতে আমরা
              সাইটের ব্যবহার বুঝতে ও শপিং অভিজ্ঞতা উন্নত করতে পারি।
            </li>
          </ul>
          <p>
            আমরা বর্তমানে অনলাইন কার্ড পেমেন্ট গ্রহণ করি না, তাই কোনো কার্ড নম্বর, মেয়াদ উত্তীর্ণের তারিখ
            বা সিভিভি (CVV) সংগ্রহ বা সংরক্ষণ করি না।
          </p>

          <h2>২. আমরা কীভাবে আপনার তথ্য ব্যবহার করি</h2>
          <p>আমরা সংগৃহীত তথ্য নিম্নলিখিত কাজে ব্যবহার করি:</p>
          <ul>
            <li>আপনার অর্ডার প্রসেস ও ডেলিভারি করতে, এবং অর্ডারের অবস্থা সম্পর্কে যোগাযোগ করতে।</li>
            <li>কাস্টমার সাপোর্ট দিতে ও আপনার প্রশ্নের উত্তর দিতে।</li>
            <li>আমাদের ওয়েবসাইট, পণ্য ও ডেলিভারি সেবা উন্নত করতে।</li>
            <li>আপনাকে প্রাসঙ্গিক অফার দেখাতে ও আমাদের বিজ্ঞাপনের পারফরম্যান্স পরিমাপ করতে (ধারা ৩ দেখুন)।</li>
          </ul>

          <h2>৩. কুকিজ ও বিজ্ঞাপন</h2>
          <p>
            সাইট চালাতে ও বিজ্ঞাপনের পারফরম্যান্স পরিমাপ করতে আমরা অল্প কিছু কুকি ও ব্রাউজার স্টোরেজ
            ব্যবহার করি:
          </p>
          <ul>
            <li>
              <strong>সেশন কুকি</strong>: আপনাকে আপনার অ্যাকাউন্টে সাইন ইন রাখে।
            </li>
            <li>
              <strong>গেস্ট কার্ট / ভাষা পছন্দ</strong>: আপনার ব্রাউজারে (localStorage) সংরক্ষিত থাকে, যাতে
              আপনার কার্ট এবং বাংলা/ইংরেজি ভাষার পছন্দ পরবর্তী ভিজিটেও বজায় থাকে।
            </li>
            <li>
              <strong>মেটা (ফেসবুক) পিক্সেল</strong>: আপনি যদি ফেসবুক বা ইনস্টাগ্রামের বিজ্ঞাপন থেকে আসেন,
              তাহলে আমরা একটি অ্যাট্রিবিউশন কুকি (<code>_mp_attr</code>, ৩০ দিন পর মেয়াদ শেষ হয়) সংরক্ষণ
              করি যাতে বোঝা যায় কোন বিজ্ঞাপন আপনার ভিজিট এবং প্রযোজ্য ক্ষেত্রে আপনার কেনাকাটার কারণ হয়েছে।
              এটি{" "}
              <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
                মেটার প্রাইভেসি পলিসি
              </a>
              {" "}অনুযায়ী Meta Platforms, Inc.-এর সাথে শেয়ার করা হয়। আপনি আপনার ফেসবুক/ইনস্টাগ্রাম
              অ্যাকাউন্ট সেটিংস থেকে বিজ্ঞাপন পার্সোনালাইজেশন নিয়ন্ত্রণ করতে পারেন।
            </li>
          </ul>
          <p>
            আপনি চাইলে ব্রাউজার সেটিংস থেকে কুকি বন্ধ করতে পারেন, তবে এতে সাইটের কিছু অংশ (যেমন সাইন ইন
            অবস্থা বজায় রাখা) ঠিকভাবে কাজ নাও করতে পারে।
          </p>

          <h2>৪. আমরা কীভাবে আপনার তথ্য শেয়ার করি</h2>
          <p>আমরা আপনার ব্যক্তিগত তথ্য বিক্রি করি না। ব্যবসা পরিচালনার জন্য প্রয়োজন অনুযায়ী শুধু শেয়ার করি:</p>
          <ul>
            <li>আপনার অর্ডার ঠিকানায় পৌঁছে দিতে আমাদের ডেলিভারি/কুরিয়ার পার্টনারদের সাথে।</li>
            <li>ধারা ৩-এ উল্লেখিত অ্যাড অ্যাট্রিবিউশন ও পরিমাপের জন্য Meta Platforms, Inc.-এর সাথে।</li>
            <li>পণ্য ও কনটেন্ট ছবির জন্য আমাদের ইমেজ হোস্টিং প্রোভাইডার Cloudinary-এর সাথে।</li>
            <li>
              আইন অনুযায়ী প্রয়োজন হলে, অথবা {store.name} ও আমাদের গ্রাহকদের অধিকার, নিরাপত্তা ও
              সম্পত্তি রক্ষার জন্য।
            </li>
          </ul>

          <h2>৫. ডেটা সংরক্ষণ</h2>
          <p>
            আপনার অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত অথবা অর্ডার পূরণ, বিরোধ নিষ্পত্তি এবং আমাদের আইনি ও
            হিসাবরক্ষণ সংক্রান্ত বাধ্যবাধকতা পূরণের জন্য প্রয়োজনীয় সময় পর্যন্ত আমরা আপনার অ্যাকাউন্ট ও
            অর্ডার তথ্য সংরক্ষণ করি। নিচে দেওয়া যোগাযোগের তথ্য ব্যবহার করে আপনি যেকোনো সময় আপনার অ্যাকাউন্ট
            ডেটা মুছে ফেলার অনুরোধ করতে পারেন, তবে আইনি বা হিসাবরক্ষণ সংক্রান্ত কারণে আমাদের সংরক্ষণ করতে
            হয় এমন রেকর্ড সাপেক্ষে।
          </p>

          <h2>৬. আপনার অধিকার</h2>
          <p>
            যেকোনো সময় আমাদের সাথে যোগাযোগ করে আপনি আপনার ব্যক্তিগত তথ্য দেখতে, সংশোধন করতে বা মুছে ফেলার
            অনুরোধ করতে পারেন। আপনার অ্যাকাউন্ট থাকলে, আপনি সরাসরি আপনার অ্যাকাউন্ট পেজ থেকে নাম, ফোন ও
            ঠিকানা আপডেট করতে পারবেন।
          </p>

          <h2>৭. নিরাপত্তা</h2>
          <p>
            আপনার ব্যক্তিগত তথ্য রক্ষা করতে আমরা যুক্তিসঙ্গত প্রযুক্তিগত ও সাংগঠনিক ব্যবস্থা গ্রহণ করি।
            কোনো ট্রান্সমিশন বা স্টোরেজ পদ্ধতিই ১০০% নিরাপদ নয়, তাই আমরা সম্পূর্ণ নিরাপত্তার নিশ্চয়তা দিতে
            পারি না।
          </p>

          <h2>৮. শিশুদের গোপনীয়তা</h2>
          <p>
            আমাদের সেবা ১৩ বছরের কম বয়সী শিশুদের জন্য নয়, এবং আমরা জেনেশুনে তাদের কাছ থেকে ব্যক্তিগত তথ্য
            সংগ্রহ করি না।
          </p>

          <h2>৯. এই পলিসিতে পরিবর্তন</h2>
          <p>
            আমরা মাঝে মাঝে এই প্রাইভেসি পলিসি আপডেট করতে পারি। এই পেজে প্রকাশিত হওয়ার সাথে সাথে পরিবর্তনগুলো
            কার্যকর হয়ে যায়।
          </p>

          <h2>১০. যোগাযোগ করুন</h2>
          <p>
            এই প্রাইভেসি পলিসি বা আপনার ব্যক্তিগত তথ্য নিয়ে প্রশ্ন আছে? আমাদের সাথে যোগাযোগ করুন{" "}
            <a href={`mailto:${store.email}`}>{store.email}</a> অথবা{" "}
            <a href={`tel:${store.phone}`}>{store.phone}</a> নম্বরে, অথবা
            লিখুন {store.address}, {store.city}, বাংলাদেশ ঠিকানায়।
          </p>
        </div>
      ) : (
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>
            This Privacy Policy explains what personal information {store.name} collects when
            you visit or shop at {seoConfig.siteUrl.replace(/^https?:\/\//, "")}, how we use it, and
            the choices you have.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We collect the following types of information:</p>
          <ul>
            <li>
              <strong>Account &amp; order information</strong>: name, phone number, email (optional),
              and delivery address, provided when you create an account or place an order.
            </li>
            <li>
              <strong>Order details</strong>: the products, quantities, and prices in your order, your
              chosen delivery zone, and your payment method (currently Cash on Delivery only).
            </li>
            <li>
              <strong>Usage information</strong>: pages you visit, products you view, and actions like
              adding to cart or starting checkout, collected automatically to help us understand site
              usage and improve the shopping experience.
            </li>
          </ul>
          <p>
            We do not currently accept online card payments, so we do not collect or store any card
            number, expiry date, or CVV.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Process and deliver your orders, and contact you about their status.</li>
            <li>Provide customer support and respond to your inquiries.</li>
            <li>Improve our website, products, and delivery service.</li>
            <li>Show you relevant offers and measure the performance of our ads (see Section 3).</li>
          </ul>

          <h2>3. Cookies &amp; Advertising</h2>
          <p>
            We use a small number of cookies and browser storage to run the site and measure
            advertising performance:
          </p>
          <ul>
            <li>
              <strong>Session cookie</strong>: keeps you signed in to your account.
            </li>
            <li>
              <strong>Guest cart / language preference</strong>: stored in your browser (localStorage)
              so your cart and bn/en language choice persist between visits.
            </li>
            <li>
              <strong>Meta (Facebook) Pixel</strong>: if you arrive from a Facebook or Instagram ad, we
              store an attribution cookie (<code>_mp_attr</code>, expires after 30 days) to measure
              which ad led to your visit and, where applicable, your purchase. This is shared with
              Meta Platforms, Inc. in accordance with{" "}
              <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
                Meta&apos;s Privacy Policy
              </a>
              . You can control ad personalization through your Facebook/Instagram account settings.
            </li>
          </ul>
          <p>
            You can disable cookies in your browser settings, though some parts of the site (like
            staying signed in) may not work correctly without them.
          </p>

          <h2>4. How We Share Your Information</h2>
          <p>
            We do not sell your personal information. We share it only as needed to run our business:
          </p>
          <ul>
            <li>With our delivery/courier partners, to deliver your order to your address.</li>
            <li>
              With Meta Platforms, Inc., for ad attribution and measurement as described in Section 3.
            </li>
            <li>With Cloudinary, our image hosting provider, for product and content images.</li>
            <li>When required by law, or to protect the rights, safety, and property of {store.name} and our customers.</li>
          </ul>

          <h2>5. Data Retention</h2>
          <p>
            We keep your account and order information for as long as your account is active or as
            needed to fulfil orders, resolve disputes, and meet our legal and accounting obligations.
            You can ask us to delete your account data at any time using the contact details below,
            subject to records we&apos;re required to keep for legal or accounting purposes.
          </p>

          <h2>6. Your Rights</h2>
          <p>
            You can access, correct, or request deletion of your personal information at any time by
            contacting us. If you have an account, you can update your name, phone, and address
            directly from your account page.
          </p>

          <h2>7. Security</h2>
          <p>
            We take reasonable technical and organizational measures to protect your personal
            information. No method of transmission or storage is 100% secure, so we cannot guarantee
            absolute security.
          </p>

          <h2>8. Children&apos;s Privacy</h2>
          <p>
            Our services are not directed at children under 13, and we do not knowingly collect
            personal information from them.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes take effect once posted on
            this page.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            Questions about this Privacy Policy or your personal information? Contact us at{" "}
            <a href={`mailto:${store.email}`}>{store.email}</a> or{" "}
            <a href={`tel:${store.phone}`}>{store.phone}</a>, or write
            to us at {store.address}, {store.city},
            Bangladesh.
          </p>
        </div>
      )}
    </div>
  );
}
