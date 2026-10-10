"use client";

import { useSettings } from "@/features/settings/api/use-settings";

export default function SeoVerification() {
  const { data: settings } = useSettings();

  const googleVerification = settings?.seo_google_verification;
  const bingVerification = settings?.seo_bing_verification;

  if (!googleVerification && !bingVerification) return null;

  return (
    <>
      {googleVerification && (
        <meta name="google-site-verification" content={googleVerification} />
      )}
      {bingVerification && (
        <meta name="msvalidate.01" content={bingVerification} />
      )}
    </>
  );
}
