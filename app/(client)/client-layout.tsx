"use client";

import Footer from "@/components/footer";
import Navbar, { NavbarSkeleton } from "@/components/nav-bar";
import { TrafficTracker } from "@/components/traffic-tracker";
import { MotionProvider } from "@/components/motion-provider";
import { CartProvider } from "@/provider/cart-provider";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { ChevronUp, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import dynamic from "next/dynamic";
import Link from "next/link";
import CookieConsentBanner from "@/components/cookie-consent-banner";
import { WhenVisible } from "@/components/when-visible";

// Below-fold, storefront-home-only sections — kept out of the initial JS
// bundle for every other page since they're conditionally rendered anyway.
// Each gets a same-height `loading` placeholder: with ssr:false, Next.js
// renders nothing at all until the chunk loads and the section itself
// finishes fetching, and an unreserved 0-height gap here would otherwise
// pop in a few hundred px of content above the footer on every page load.
//
// They also wait until the visitor scrolls near them (WhenVisible): until
// then the same placeholders hold their space, and neither the chunks nor the
// testimonial images and autoplaying carousel compete with the page above.

// Mirrors components/home/testimonials.tsx: same section/container/header
// classes, and the Carousel's -ml-4 / pl-4 gutter with the same responsive
// item widths (3/4 → 1/2 → 1/3 → 1/4 → 1/5) and aspect-[9/16] cards.
function TestimonialsSkeleton() {
  return (
    <section className="py-4 md:py-6 bg-background border-t border-slate-100 dark:border-slate-800" aria-hidden="true">
      <div className="container mx-auto px-4">
        <div className="flex flex-row items-end justify-between mb-3 md:mb-4">
          <div className="h-7 w-40 md:h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
        </div>
        <div className="w-full overflow-hidden">
          <div className="-ml-4 flex">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`min-w-0 shrink-0 grow-0 pl-4 basis-3/4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 ${
                  i === 1 ? "hidden sm:block" : i === 2 ? "hidden md:block" : i === 3 ? "hidden lg:block" : i === 4 ? "hidden xl:block" : ""
                }`}
              >
                <div className="aspect-[9/16] w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Mirrors components/home/newsletter.tsx: py-8 md:py-12, max-w-2xl column,
// and the real margins between blocks (icon mb-4, title mb-3, subtitle mb-8,
// then the ~50/54px form and the mt-6 fine print) instead of a flat gap.
function NewsletterSkeleton() {
  return (
    <section className="bg-foreground dark:bg-slate-950 py-8 md:py-12" aria-hidden="true">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto flex flex-col items-center">
          <div className="mb-4 h-11 w-11 rounded-full bg-white/10 animate-pulse" />
          <div className="mb-3 h-8 md:h-10 w-64 bg-white/10 animate-pulse rounded-lg" />
          <div className="mb-8 flex h-[46px] md:h-[52px] w-full max-w-md flex-col items-center justify-center gap-1.5">
            <div className="h-3.5 w-full bg-white/10 animate-pulse rounded-lg" />
            <div className="h-3.5 w-2/3 bg-white/10 animate-pulse rounded-lg" />
          </div>
          <div className="h-[50px] sm:h-[54px] w-full max-w-md bg-white/10 animate-pulse rounded-full" />
          <div className="mt-6 h-[15px] w-36 bg-white/10 animate-pulse rounded" />
        </div>
      </div>
    </section>
  );
}

const Testimonials = dynamic(() => import("@/components/home/testimonials"), {
  ssr: false,
  loading: () => <TestimonialsSkeleton />,
});
const Newsletter = dynamic(() => import("@/components/home/newsletter"), {
  ssr: false,
  loading: () => <NewsletterSkeleton />,
});

// Its own component so its scroll state re-renders just this button: kept in
// ClientLayout, every crossing of the 400px mark re-rendered the whole
// storefront chrome (navbar, footer, testimonials) inside the scroll task.
function ScrollTopButton({ hidden }: { hidden: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      data-scroll-top
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        // bg-foreground flips between near-black (light mode) and
        // near-white (dark mode), so the gradient is built from that same
        // token at two opacity levels rather than hardcoded hex stops —
        // that would have broken the dark-mode inversion.
        "fixed bottom-34 sm:bottom-20 right-4 sm:right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-foreground to-foreground/70 text-background shadow-lg transition-all duration-300 hover:opacity-90",
        hidden ? "hidden" : show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      )}
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}

interface ClientLayoutProps {
  children: React.ReactNode;
}

function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  // While the cookie banner is up, the WhatsApp/scroll-top buttons hide
  // rather than shift position — simpler than guessing the banner's
  // rendered height across breakpoints, and it's only up for a few seconds
  // for a first-time visitor.
  const [cookieBannerVisible, setCookieBannerVisible] = useState(false);
  const {
    footerBrandDesc,
    footerEmail,
    footerPhone,
    footerAddress,
    footerAddressLink,
    socialFacebook,
    socialInstagram,
    socialTwitter,
    socialYoutube,
    socialTiktok,
    footerCopyright,
  } = useWebsiteSettings();

  // Product detail (/shop/[slug]) and checkout are where a customer is
  // actually trying to buy something. On mobile the WhatsApp button just
  // duplicates the page's own bottom-right CTA, so it drops there entirely
  // (still shown on desktop). The cookie banner is worse than a duplicate
  // button, though: product-picker.tsx's sticky Add to Cart/Buy Now bar is
  // also `fixed bottom-0 ... z-50`, and — mounted later in the tree — the
  // banner would render on top of it and block the buy button outright,
  // on any breakpoint, the moment a first-time visitor scrolls. It's
  // suppressed on both pages entirely; Consent Mode's default-denied state
  // (set before either page's tags fire) already protects them regardless
  // of whether the banner itself shows here — the visitor sees it, and can
  // answer it, on whatever page they land on or browse to next instead.
  const isConversionCriticalPage =
    (pathname.startsWith("/shop/") && pathname !== "/shop") ||
    pathname.startsWith("/checkout");

  // Back to the top on route changes — but not on the first run: that one
  // fires at hydration, which on a slow phone comes seconds after the page
  // is already readable, and it threw a visitor who had started scrolling
  // back to the top.
  const isFirstPathname = useRef(true);
  useEffect(() => {
    if (isFirstPathname.current) {
      isFirstPathname.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    // The banner unmounts outright on these pages (see isConversionCriticalPage
    // above) rather than just hiding, so nothing else clears this flag —
    // without this, navigating here while it was showing would leave the
    // WhatsApp/scroll-top buttons stuck hidden for a banner that's gone.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears a flag the (now-unmounted) banner child can no longer clear itself; it isn't derivable at render time since it tracks the child's last reported state before it disappeared.
    if (isConversionCriticalPage) setCookieBannerVisible(false);
  }, [isConversionCriticalPage]);

  return (
    <CartProvider>
      <TrafficTracker />
      <MotionProvider />
      <div className="flex flex-col min-h-screen">
        <React.Suspense fallback={<NavbarSkeleton />}>
          <Navbar />
        </React.Suspense>
        <main className="flex-1 bg-[#F4F4F4] dark:bg-gray-800">{children}</main>
        {!pathname.includes("/checkout") && !pathname.includes("/account") && !pathname.includes("/signin") && !pathname.includes("/signup") && !pathname.includes("/orders") && (
          <>
            <WhenVisible placeholder={<TestimonialsSkeleton />}>
              <Testimonials />
            </WhenVisible>
            <WhenVisible placeholder={<NewsletterSkeleton />}>
              <Newsletter />
            </WhenVisible>
          </>
        )}
        <Footer
          footerBrandDesc={footerBrandDesc}
          footerEmail={footerEmail}
          footerPhone={footerPhone}
          footerAddress={footerAddress}
          footerAddressLink={footerAddressLink}
          socialFacebook={socialFacebook}
          socialInstagram={socialInstagram}
          socialTwitter={socialTwitter}
          socialYoutube={socialYoutube}
          socialTiktok={socialTiktok}
          footerCopyright={footerCopyright}
        />
      </div>
      <Link
        href={`https://wa.me/${footerPhone.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          // Same diagonal gradient treatment as the Filter/Shop buttons
          // (products-sidebar.tsx, nav-bar.tsx), but built from WhatsApp's
          // own green (#25D366) and its existing hover-darken shade
          // (#20bd5a) — not a new color, just this one turned into a gradient.
          "fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#25D366,#20bd5a)] text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:scale-110 active:scale-95 hover:brightness-110",
          cookieBannerVisible ? "hidden" : isConversionCriticalPage ? "hidden sm:flex" : "flex"
        )}
        aria-label="Contact us on WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </Link>
      <ScrollTopButton hidden={cookieBannerVisible} />
      {!isConversionCriticalPage && (
        <CookieConsentBanner onVisibleChange={setCookieBannerVisible} />
      )}
    </CartProvider>
  );
}

export default ClientLayout;
