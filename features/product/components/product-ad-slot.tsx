"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSettings } from "@/features/settings/api/use-settings";
import { cn } from "@/lib/utils";
import { getVisitorId } from "@/lib/visitor-id";

// Reset the frame so the ad's own markup decides the look: no margin, a
// transparent background over the blurred glow, nothing scrolling. No fixed
// height: the ad is as tall as its content (or fills the slot, see `fill`).
const FRAME_BASE = "<style>html,body{margin:0;width:100%;background:transparent;overflow:hidden}</style>";

const HEIGHT_MESSAGE = "sleepsheet-ad-height";
const MEASURE_MESSAGE = "sleepsheet-ad-measure";
// Window event the product picker listens for: the same Order Now as its own
// button, with whatever size / colour / quantity is selected.
export const ORDER_NOW_EVENT = "sleepsheet:order-now";

// The sandboxed frame is cross-origin, so the page can't measure it; it
// reports its own content height instead: whenever it changes, and when the
// page asks (on the frame's load event), so a report sent before the page was
// listening is never the last word. Nothing is reported until the ad's fonts
// have loaded (or 2.5s pass): a height measured in the fallback font would
// jump when the real one swaps in. It reads the root's own height, not
// scrollHeight: that is never below the frame's current height, so a taller
// first measurement would leave empty space under the ad for good.
const FRAME_REPORTER = `<script>(function(){var ok=0;function s(){if(ok)parent.postMessage({type:"${HEIGHT_MESSAGE}",h:document.documentElement.getBoundingClientRect().height},"*")}function go(){ok=1;s()}new ResizeObserver(s).observe(document.documentElement);addEventListener("load",function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(go)});setTimeout(go,2500);addEventListener("message",function(e){if(e.source===parent&&e.data&&e.data.type==="${MEASURE_MESSAGE}")s()})})()</script>`;

export type AdSlotSize = "compact" | "full";

/**
 * Admin-written ad code (HTML with its own <style>/<script>) in a sandboxed
 * iframe. No allow-same-origin: the code runs on an opaque origin, so it can
 * animate and link out but cannot read the shop's cookies, storage or page.
 * The only thing it can tell the page is its height.
 *
 * `slot` tells the ad where it is, as <html data-slot="compact|full">, so its
 * CSS can lay out for it: "compact" is the phone strip (~110–160px wide,
 * ~160px tall, filled top to bottom), "full" the tablet/desktop strip
 * (~130–260px wide, up to ~330–480px tall, as tall as the ad). Width alone
 * can't tell them apart. `price` (the product's price, data-price) lets it
 * state an offer's minimum only where the product falls short of it.
 * `visitor` (data-visitor) lets it read the live promotions as this visitor
 * sees them: /api/promotions/live?visitor=<id>, personal time limits applied. `fill`
 * makes the frame the slot's full height instead of the ad's own.
 */
export function AdFrame({
  code,
  slot = "compact",
  fill = false,
  price,
  visitor,
  onReady,
  onHeight,
  className,
}: {
  code: string;
  slot?: AdSlotSize;
  fill?: boolean;
  price?: number;
  visitor?: string;
  onReady?: () => void;
  onHeight?: (height: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  // Layout effect, not a plain effect: it runs before the frame's document can
  // load, so the frame's first message is never missed.
  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only this frame's own messages; any other window's are ignored.
      if (event.source !== ref.current?.contentWindow) return;
      const data = event.data as { type?: string; h?: number } | null;
      if (data?.type === HEIGHT_MESSAGE && typeof data.h === "number" && data.h > 0) {
        setHeight(Math.ceil(data.h));
        onHeight?.(Math.ceil(data.h));
        if (!fill) onReady?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fill, onReady, onHeight]);

  return (
    <iframe
      ref={ref}
      title="Advertisement"
      srcDoc={
        `<!doctype html><html data-slot="${slot}"` +
        (price ? ` data-price="${Math.round(price)}"` : "") +
        // Random letters and digits from lib/visitor-id.ts; stripped anyway.
        (visitor ? ` data-visitor="${visitor.replace(/[^\w-]/g, "")}"` : "") +
        ">" +
        FRAME_BASE +
        code +
        FRAME_REPORTER
      }
      // Content height, capped by the space it sits in; hidden until measured.
      style={fill ? undefined : { height: height ?? 0 }}
      onLoad={() => {
        ref.current?.contentWindow?.postMessage({ type: MEASURE_MESSAGE }, "*");
        if (fill) onReady?.();
      }}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      referrerPolicy="no-referrer"
      loading="lazy"
      // The ad document is light; a dark page would otherwise give the frame an opaque white canvas.
      className={cn("block w-full border-0 bg-transparent [color-scheme:light]", fill ? "h-full" : "max-h-full", className)}
    />
  );
}

const SM_QUERY = "(min-width: 640px)";
const subscribeNothing = () => () => {};
const subscribeSm = (onChange: () => void) => {
  const query = window.matchMedia(SM_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export interface ProductAd {
  code: string;
  slot: AdSlotSize;
  visitor: string;
}

/**
 * The product page ad to show, or null. Browser only, after hydration: a
 * server-rendered frame would load (and report its height) before the page
 * listens, and could keep the server's guess of the slot size, since React
 * doesn't patch attributes while hydrating.
 */
export function useProductAd(): ProductAd | null {
  const { data: settings } = useSettings();
  // The gallery frame is h-44 below sm (a short strip), taller from sm up.
  const slot = useSyncExternalStore<AdSlotSize>(
    subscribeSm,
    () => (window.matchMedia(SM_QUERY).matches ? "full" : "compact"),
    () => "compact",
  );
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const code = (settings?.product_ad_code ?? "").trim();
  if (!mounted || settings?.product_ad_enabled !== "true" || !code) return null;
  return { code, slot, visitor: getVisitorId() };
}

/**
 * The blurred strip to the right of the gallery's 9:16 centre column (a video,
 * or a photo shown reels-style). The column is centred in a frame of fixed
 * height (h-44 / sm:h-100 / lg:h-137.5, see switch-image.tsx), so the strip is
 * half the frame minus half the column's width: 50% - height * 9/32.
 *
 * On phones the ad fills the strip top to bottom (the video's control bar is
 * kept clear of it by switch-image); from sm up it stops above the control
 * bar and is as tall as the ad. Corners are concentric with the frame's:
 * rounded-[1.75rem] frame - p-2 inset = 1.25rem on phones.
 *
 * The whole ad is the product's Order Now: a transparent button of the page's
 * own sits over the frame (which takes no pointer events), so a tap never
 * depends on reaching into a sandboxed, cross-origin iframe, and can never
 * fall through to the video underneath.
 */
export function ProductAdSlot({ ad, price }: { ad: ProductAd; price?: number }) {
  const compact = ad.slot === "compact";
  const [revealed, setRevealed] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0);
  // A beat after the frame has its final size, so its first paint is not part of the unroll.
  const reveal = useCallback(() => void setTimeout(() => setRevealed(true), 200), []);

  // The timeout covers a frame that never reports.
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const rounded = compact ? "rounded-[1.25rem]" : "rounded-2xl";

  return (
    <div
      className={cn(
        "pointer-events-auto absolute top-0 right-0 z-10 overflow-hidden [--frame-h:17rem] sm:[--frame-h:25rem] lg:[--frame-h:34.375rem]",
        compact ? "bottom-0 p-2" : "bottom-12 flex flex-col justify-center p-3",
      )}
      style={{ width: "calc(50% - var(--frame-h) * 9 / 32)" }}
    >
      {/* The card keeps its final size (so the strip never re-centres it); inside, a box
          grows from 0 to that height like a banner being unrolled. The roll bar sits on
          that box's bottom edge, so it can never come apart from the ad. */}
      <div
        className={cn("relative max-h-full overflow-hidden", rounded, compact && "h-full [container-type:size]")}
        style={compact ? undefined : { height: frameHeight }}
      >
        <div
          className={cn(
            "relative overflow-hidden transition-[height] duration-1000 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            revealed ? "h-full" : "h-0",
          )}
        >
          <div className={cn("relative", compact && "h-[100cqh]")}>
            <AdFrame
              code={ad.code}
              slot={ad.slot}
              fill={compact}
              price={price}
              visitor={ad.visitor}
              onReady={reveal}
              onHeight={setFrameHeight}
              className={cn("pointer-events-none", rounded)}
            />
            <button
              type="button"
              aria-label="অর্ডার করুন"
              onClick={() => window.dispatchEvent(new Event(ORDER_NOW_EVENT))}
              className={cn(
                "absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white",
                rounded,
              )}
            />
          </div>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 rounded-full bg-linear-to-b from-white/80 via-white/30 to-black/40 shadow-lg motion-reduce:hidden",
              revealed && "opacity-0 transition-opacity delay-900 duration-300",
            )}
          />
        </div>
      </div>
    </div>
  );
}
