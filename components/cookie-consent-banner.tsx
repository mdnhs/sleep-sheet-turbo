"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getStoredConsent,
  saveConsent,
  ACCEPT_ALL_CONSENT,
  REJECT_ALL_CONSENT,
  type StoredConsent,
} from "@/lib/consent";

interface CookieConsentBannerProps {
  /** So the layout can lift the WhatsApp/scroll-top buttons above the banner
   * instead of letting this cover them. */
  onVisibleChange?: (visible: boolean) => void;
}

export default function CookieConsentBanner({ onVisibleChange }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false);

  // Reads the cookie set by components/consent-default-script.tsx (or by an
  // earlier answer here) — only a first-time visitor with no stored choice
  // sees this at all.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the consent cookie isn't available during SSR render, so whether to show the banner can only be decided client-side in an effect.
    if (!getStoredConsent()) setVisible(true);
  }, []);

  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  if (!visible) return null;

  const answer = (consent: StoredConsent) => {
    saveConsent(consent);
    setVisible(false);
  };

  return (
    // Storefront's mobile bottom nav (components/nav-bar.tsx) is `md:hidden`,
    // fixed to the bottom edge, 64px tall, and z-[100].
    // Positioning at bottom-left: bottom-20 on mobile (clearing bottom nav), bottom-5 on desktop.
    <div className="fixed bottom-20 md:bottom-5 left-3 sm:left-5 z-50 max-w-[310px] sm:max-w-[330px] animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md shadow-xl p-3 sm:p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
            <Cookie className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              অভিজ্ঞতা উন্নত করতে ও বিজ্ঞাপন যাচাইয়ে আমরা কুকি ব্যবহার করি।{" "}
              <Link href="/privacy-policy" className="underline hover:text-foreground font-medium">
                গোপনীয়তা নীতি
              </Link>
            </p>
            <div className="flex items-center gap-1.5 mt-2.5">
              <Button
                size="sm"
                onClick={() => answer(ACCEPT_ALL_CONSENT)}
                className="h-7 px-3 text-[11px] rounded-full font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer"
              >
                সব গ্রহণ করুন
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => answer(REJECT_ALL_CONSENT)}
                className="h-7 px-2.5 text-[11px] rounded-full font-medium border-border/70 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                প্রত্যাখ্যান
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
