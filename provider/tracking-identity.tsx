"use client";

import { useEffect } from "react";
import { captureFbclid } from "@/lib/meta-fbc";
import { captureLandingSource } from "@/lib/traffic-source";
import { primeGtmIdentity } from "@/lib/gtm";
import { useCurrent } from "@/features/auth/api/use-current";

/**
 * Everything the app itself contributes to Meta tracking, which is two
 * things — it fires no events of its own; the GTM web container owns all six
 * (see the Meta Pixel tags in GTM-PQ667JWQ).
 *
 * The click id, because GTM cannot recover `fbclid` from the landing URL
 * when the Pixel's `_fbc` cookie has not been set yet, which is what left it
 * missing from conversions.
 *
 * The landing source (gclid, UTM parameters, referrer — see
 * lib/traffic-source.ts), because that is what lets an order later say
 * whether it came from a Facebook ad, a YouTube ad, or a normal visitor;
 * none of that is recoverable once the visitor has clicked through a few
 * internal pages, so it has to be captured here, on the very first one.
 *

 * The signed-in identity, because matching an event to a person needs
 * identifiers and the hashing is asynchronous — no click handler is going to
 * await a digest before pushing add_to_cart. Priming it once here, as soon
 * as the current user resolves, is what lets every later event read it
 * synchronously. Signing out clears it: primeGtmIdentity(null) drops the
 * cache, so the next visitor's events do not inherit the last one's.
 */
export function TrackingIdentity() {
  const { data: currentUser } = useCurrent();

  useEffect(() => {
    captureFbclid();
    captureLandingSource();
  }, []);

  const userId = currentUser?.id;
  const userEmail = currentUser?.email;
  const userPhone = currentUser?.phone;

  useEffect(() => {
    void primeGtmIdentity(
      userId ? { id: userId, email: userEmail, phone: userPhone } : null,
    );
  }, [userId, userEmail, userPhone]);

  return null;
}
