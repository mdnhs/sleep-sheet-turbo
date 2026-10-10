"use client";

import { useLanguage } from "@/hooks/use-language";

const MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.818320343149!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c1002097bec1%3A0xdef08a52b6e4a629!2sSleep%20Sheet!5e0!3m2!1sen!2sbd!4v1790670144105!5m2!1sen!2sbd";

export function StoreLocationMap({ className = "" }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <div className={`overflow-hidden rounded-3xl border border-border/40 bg-muted ${className}`}>
      <iframe
        src={MAP_EMBED_URL}
        title={t("contactMapTitle")}
        className="block h-80 w-full border-0 md:h-96"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
