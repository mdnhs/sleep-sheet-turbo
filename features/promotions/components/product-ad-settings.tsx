"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { AdFrame } from "@/features/product/components/product-ad-slot";
import { cn } from "@/lib/utils";
import { SAMPLE_AD } from "../sample-ad";
import { composeAdCode, splitAdCode, type AdFiles } from "../ad-files";

const AdCodeEditor = dynamic(() => import("./code-editor").then((module) => module.AdCodeEditor), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-xl bg-neutral-900" />,
});



/**
 * Admin-only editor for the product page ad (settings product_ad_enabled /
 * product_ad_code), with a live preview at phone and desktop slot sizes.
 */
export function ProductAdSettings() {
  const { data: settings } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  // What this admin typed / saved; the public settings GET can lag behind a save.
  const [draft, setDraft] = useState<AdFiles | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [enabledEdit, setEnabledEdit] = useState<boolean | null>(null);

  const savedCode = settings?.product_ad_code ?? "";
  const files = draft ?? splitAdCode(savedCode);
  const code = composeAdCode(files);
  const enabled = enabledEdit ?? settings?.product_ad_enabled === "true";
  const dirty = (draft !== null && code !== composeAdCode(splitAdCode(savedCode))) || (enabledEdit !== null && enabledEdit !== (settings?.product_ad_enabled === "true"));

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const save = () =>
    mutate({ product_ad_enabled: enabled ? "true" : "false", product_ad_code: code });

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 dark:bg-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Product page ad</p>
            <p className="text-sm text-muted-foreground">
              Shown in the blurred space beside a product video. Paste HTML with its own &lt;style&gt; and
              &lt;script&gt;; it runs in a sandbox and cannot touch the rest of the shop. Links open when the
              customer taps them. Style each place with <code className="text-xs">html[data-slot=&quot;compact&quot;]</code>{" "}
              (phone: fill ~160px of height) and <code className="text-xs">html[data-slot=&quot;full&quot;]</code> (tablet /
              desktop) and read the product&apos;s price from <code className="text-xs">html[data-price]</code>. On the product
              page the whole ad is that product&apos;s Order Now button, so the code needs no click handling.
            </p>
          </div>
        </div>
        <Switch aria-label="Show product page ad" checked={enabled} onCheckedChange={(checked) => setEnabledEdit(checked)} />
      </div>

      <div
        className={cn(
          "grid gap-4 lg:grid-cols-[1fr_auto]",
          fullscreen && "fixed inset-0 z-50 grid-rows-[minmax(0,1fr)] overflow-auto bg-background p-4",
        )}
      >
        <div className={cn("min-w-0 space-y-2", fullscreen && "flex min-h-0 flex-col")}>
          <div className="flex items-center justify-between">
            <Label>Ad code</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDraft(splitAdCode(SAMPLE_AD))}>
              Insert sample
            </Button>
          </div>
          <AdCodeEditor
            files={files}
            onChange={setDraft}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((value) => !value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="flex items-end gap-3">
            {[
              // Typical slot sizes: the phone strip is filled top to bottom, on
              // desktop the ad is as tall as its content.
              { label: "Phone", slot: "compact" as const, fill: true, className: "h-[176px] w-[128px] !rounded-[1.75rem]" },
              { label: "Desktop", slot: "full" as const, fill: false, className: "max-h-[480px] w-[160px]" },
            ].map((size) => (
              <div key={size.label} className="space-y-1 text-center">
                <div className={`flex min-h-16 flex-col justify-center overflow-hidden rounded-2xl bg-neutral-800 p-2 ${size.className}`}>
                  {code.trim() ? (
                    <AdFrame
                      code={code}
                      slot={size.slot}
                      fill={size.fill}
                      price={3190}
                      className={size.fill ? "rounded-[1.25rem]" : "rounded-xl"}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-6 text-[10px] text-neutral-400">Empty</div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{size.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || isPending} className="rounded-full px-5">
          {isPending ? "Saving…" : "Save ad"}
        </Button>
      </div>
    </div>
  );
}
