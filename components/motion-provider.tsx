"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { afterLoadIdle } from "@/lib/after-load-idle";

// Storefront motion: Lenis smooth scrolling (desktop only) and GSAP
// ScrollTrigger reveals for page sections below the fold.
//
// Built so it can't cost the Core Web Vitals work:
// - Nothing loads until the window has loaded and gone idle, and the libraries
//   are dynamic imports, so they're never in the initial bundle or on the LCP
//   critical path.
// - Only sections that are still below the viewport when the scan runs are
//   animated. Anything already on screen (the hero, the LCP element) is never
//   hidden or moved, so it can't delay LCP or cause a layout shift.
// - Only transform and opacity animate (compositor-only), and the inline
//   styles are cleared afterwards so a lingering transform can't break
//   position: fixed / sticky children.
// - Lenis runs only with a fine pointer (mouse/trackpad); touch devices keep
//   native scrolling, which is smoother there. prefers-reduced-motion turns
//   everything off.
type Cleanup = () => void;

// Page sections plus anything opted in with data-reveal. Sections inside the
// header, footer, navigation or a dialog are left alone.
const REVEAL_SELECTOR = "section, [data-reveal]";
const SKIP_SELECTOR = 'header, footer, nav, [role="dialog"], [data-motion-skip]';

export function MotionProvider() {
  const pathname = usePathname();
  const scanRef = useRef<(() => void) | null>(null);
  const lenisRef = useRef<{ resize: () => void } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const cleanups: Cleanup[] = [];

    const cancelIdle = afterLoadIdle(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const { default: Lenis } = await import("lenis");
        if (cancelled) return;
        const lenis = new Lenis({
          smoothWheel: true,
          syncTouch: false,
          anchors: true,
          // Dialogs, sheets and inner scroll areas keep native scrolling.
          prevent: (node) =>
            !!node.closest(
              '[role="dialog"], [data-lenis-prevent], [data-radix-scroll-area-viewport], [data-vaul-drawer]',
            ),
        });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        lenisRef.current = lenis;

        // Radix dialogs/sheets lock the page by marking <body>; Lenis would
        // otherwise keep scrolling the page behind an open modal.
        const syncLock = () =>
          document.body.hasAttribute("data-scroll-locked") ? lenis.stop() : lenis.start();
        const lockObserver = new MutationObserver(syncLock);
        lockObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["data-scroll-locked"],
        });

        cleanups.push(() => {
          lockObserver.disconnect();
          gsap.ticker.remove(tick);
          lenis.destroy();
          lenisRef.current = null;
        });
      }

      const scan = () => {
        const viewportBottom = window.innerHeight;
        let added = 0;
        // Triggers left behind by a previous page's sections.
        ScrollTrigger.getAll().forEach((t) => {
          const trigger = t.trigger as Element | undefined;
          if (trigger && !trigger.isConnected) t.kill();
        });
        document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
          if (el.dataset.motion) return;
          el.dataset.motion = "seen";
          if (el.closest(SKIP_SELECTOR)) return;
          // Only the outermost section animates; nested ones ride along.
          if (el.parentElement?.closest("[data-motion='reveal']")) return;
          // Already on screen: leave it exactly as it is.
          if (el.getBoundingClientRect().top < viewportBottom) return;
          el.dataset.motion = "reveal";
          added++;
          gsap.fromTo(
            el,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: "power2.out",
              clearProps: "opacity,transform",
              scrollTrigger: { trigger: el, start: "top 90%", once: true },
            },
          );
        });
        // refresh() re-measures every trigger, so only pay for it when a new
        // section was actually added.
        if (added > 0) ScrollTrigger.refresh();
      };
      scanRef.current = scan;
      scan();

      // Sections that render after the scan (client-fetched carousels,
      // skeletons swapped for content) get picked up as they appear.
      let pending = 0;
      const domObserver = new MutationObserver(() => {
        window.clearTimeout(pending);
        pending = window.setTimeout(scan, 150);
      });
      domObserver.observe(document.body, { childList: true, subtree: true });

      cleanups.push(() => {
        domObserver.disconnect();
        window.clearTimeout(pending);
        ScrollTrigger.getAll().forEach((t) => t.kill());
        scanRef.current = null;
      });
    });

    return () => {
      cancelled = true;
      cancelIdle();
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // Client-side navigation swaps the page content: re-measure and pick up the
  // new page's sections.
  useEffect(() => {
    lenisRef.current?.resize();
    const id = window.setTimeout(() => scanRef.current?.(), 100);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
