"use client";
import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { useWebsiteSettings } from "@/hooks/use-website-settings";

const Newsletter = () => {
  const { newsletterTitle, newsletterSubtitle } = useWebsiteSettings();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
  };

  return (
    <section className="bg-foreground dark:bg-slate-950 text-background dark:text-slate-100 py-8 md:py-12 relative overflow-hidden animate-in fade-in duration-300">
      {/* Subtle decorative background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center">
          <div className="mb-4 inline-flex items-center justify-center p-3 bg-white/5 rounded-full ring-1 ring-white/10">
            <Mail className="h-5 w-5 text-white/80" />
          </div>
          
          <h2 className="font-heading text-2xl md:text-4xl font-light tracking-tight text-white mb-3">
            {newsletterTitle}
          </h2>
          
          <p className="text-white/60 text-sm md:text-base leading-relaxed mb-8 max-w-md mx-auto">
            {newsletterSubtitle}
          </p>

          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md mx-auto relative group flex items-center"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              aria-label="Email address"
              required
              className="w-full px-5 sm:px-6 py-3.5 sm:py-4 bg-white/5 border border-white/10 rounded-full text-white placeholder:text-white/40 text-sm outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-300 pr-28 sm:pr-32"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 sm:px-6 bg-white dark:bg-slate-200 text-foreground dark:text-slate-900 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:bg-white/90 dark:hover:bg-slate-300 hover:scale-105 transition-all duration-300 disabled:opacity-60 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {isLoading ? "Wait…" : "Subscribe"}
            </button>
          </form>
          
          {/* data-nosnippet: this exact boilerplate line repeats on every
              page (client-layout.tsx renders this section almost
              everywhere), and Google's sitelinks were picking it as the
              result snippet instead of each page's own, distinct meta
              description. The attribute tells Google not to use this text
              as a snippet source — it stays fully visible on the page. */}
          <p data-nosnippet className="text-[10px] text-white/60 mt-6 uppercase tracking-widest">
            Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
