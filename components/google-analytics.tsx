"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/features/settings/api/use-settings";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}

const DEFAULT_GTM_ID = "GTM-PQ667JWQ";
// First-party GTM: the server container on the Mumbai VPS serves gtm.js and
// ns.html from our own subdomain, so blockers that match googletagmanager.com
// no longer drop the container.
const GTM_HOST = "https://ss.sleepsheetbd.com";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const { data: settings } = useSettings();

  // Prevent GTM container from loading on dashboard and its subroutes
  const isDashboard = pathname?.startsWith("/dashboard");
  // The order-success page exists to report the Purchase, and nothing else
  // does: there is no server-side Purchase sender, so a buyer who closes the
  // tab before the idle/interaction trigger below fires was never counted by
  // GA4, Ads or Meta. It has no paint to protect either, so load right away.
  const isOrderSuccess = pathname?.startsWith("/order-success");

  // GTM Web Container ID from DB settings (fallback to env or production default)
  const gtmWebId =
    settings?.gtm_web_id?.trim() ||
    process.env.NEXT_PUBLIC_GTM_ID ||
    DEFAULT_GTM_ID;

  // The single place the container is loaded.
  //
  // This used to run alongside a <Script> carrying the stock GTM snippet, and
  // the two could not see each other: this one skipped only when it found its
  // own `gtm-script-<id>` element, and the snippet — which tags its script
  // with nothing — had no guard at all. So both always ran: two requests for
  // gtm.js and two `gtm.start`/`gtm.js` pushes into the dataLayer. The Meta
  // PageView tag survived that only because its event id is cached on
  // `window`, which made the second copy a duplicate Meta collapses; GA4 has
  // no such protection and counted the page twice.
  //
  // An effect rather than <Script> because the id can arrive late: it comes
  // from settings (gtm_web_id) and falls back to the constant until that
  // query resolves. The guard matches on the src, so a re-render, a route
  // change, or a late settings value cannot load the same container twice.
  //
  // The container brings GA, Ads and Meta with it. Loading that work while
  // the checkout's form is trying to render cost 341 KiB of unused JS in the
  // mobile Lighthouse run and delayed LCP. A dataLayer accepts events before
  // GTM is fetched, so the network request waits for the visitor's first
  // scroll, tap or keypress.
  useEffect(() => {
    if (isDashboard || typeof window === "undefined" || !gtmWebId) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      // `arguments`, not rest parameters: GTM tells a gtag() call apart from
      // an ordinary dataLayer push by the pushed value being an Arguments
      // object. A real array is not one, and the command would be ignored.
      function () {
        // eslint-disable-next-line prefer-rest-params
        (window.dataLayer as unknown as unknown[]).push(arguments);
      };

    const src = `${GTM_HOST}/gtm.js?id=${gtmWebId}`;

    const loadContainer = () => {
      if (document.querySelector(`script[src="${src}"]`)) return;

      window.dataLayer.push({
        "gtm.start": new Date().getTime(),
        event: "gtm.js",
      });
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
    };

    if (isOrderSuccess) {
      loadContainer();
      return;
    }

    const loadOnInteraction = () => {
      loadContainer();
      removeInteractionListeners();
    };
    const interactionEvents: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    const removeInteractionListeners = () => {
      interactionEvents.forEach((event) =>
        window.removeEventListener(event, loadOnInteraction),
      );
    };

    // Interaction only — no idle/timer fallback. The ~1 MB of GA/Ads/Meta
    // script was the largest remaining cost in mobile Lighthouse (TBT and
    // unused JS), and the business accepted that a visitor who leaves without
    // ever scrolling, tapping or typing goes untracked. Events pushed to the
    // dataLayer before then are still delivered once the container loads.
    interactionEvents.forEach((event) =>
      window.addEventListener(event, loadOnInteraction, { once: true, passive: true }),
    );

    return () => {
      removeInteractionListeners();
    };
  }, [isDashboard, isOrderSuccess, gtmWebId]);

  if (isDashboard) return null;

  return (
    <>
      {/* The container itself is loaded by the effect above; this only covers
          browsers running without JavaScript. */}
      <noscript>
        <iframe
          src={`${GTM_HOST}/ns.html?id=${gtmWebId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
