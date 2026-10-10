import Script from "next/script";
import { COOKIE_CONSENT_NAME } from "@/lib/consent";

/**
 * Google Consent Mode v2 default — must run before gtag/GTM's own script
 * (hence `beforeInteractive`, the one strategy Next.js only allows in the
 * root layout) so Google's tags never fire even once without a consent
 * signal attached. Reads the same cookie cookie-consent-banner.tsx writes,
 * so a returning visitor who already answered doesn't see tags denied for
 * an instant before the banner's own update call catches up.
 *
 * Plain string template, not a TS import, because this has to ship as a
 * literal inline <script> — nothing here can depend on module resolution
 * happening first.
 */
export default function ConsentDefaultScript() {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- this rule predates App Router support; Next's own docs (node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md) say beforeInteractive scripts belong in the root layout for App Router, which is exactly where this is.
    <Script id="consent-default" strategy="beforeInteractive">
      {`
(function() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };
  var denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  var granted = { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' };
  var defaults = granted;
  try {
    var match = document.cookie.match(/(?:^|; )${COOKIE_CONSENT_NAME}=([^;]*)/);
    if (match) {
      var stored = JSON.parse(decodeURIComponent(match[1]));
      if (stored && stored.analytics && stored.ads) {
        defaults = {
          analytics_storage: stored.analytics,
          ad_storage: stored.ads,
          ad_user_data: stored.ads,
          ad_personalization: stored.ads
        };
      }
    }
  } catch (e) {}
  defaults.functionality_storage = 'granted';
  defaults.personalization_storage = defaults.ad_storage;
  defaults.security_storage = 'granted';
  defaults.wait_for_update = 500;
  window.gtag('consent', 'default', defaults);
})();
      `}
    </Script>
  );
}
