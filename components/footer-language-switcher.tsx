"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

const FooterLanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-2 ml-4">
      <span className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> {t("language")}
      </span>
      <div className="flex gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
        <button
          onClick={() => setLanguage("bn")}
          className={`text-[11px] font-bold px-4 py-2 rounded-md cursor-pointer transition-all ${
            language === "bn"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-white/70 hover:text-white"
          }`}
        >
          BN
        </button>
        <button
          onClick={() => setLanguage("en")}
          className={`text-[11px] font-bold px-4 py-2 rounded-md cursor-pointer transition-all ${
            language === "en"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-white/70 hover:text-white"
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
};

export default FooterLanguageSwitcher;
