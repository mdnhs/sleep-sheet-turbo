"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { AdFrame } from "@/features/product/components/product-ad-slot";
import { SAMPLE_AD } from "../sample-ad";



/**
 * Admin-only editor for the product page ad (settings product_ad_enabled /
 * product_ad_code), with a live preview at phone and desktop slot sizes.
 */
export function ProductAdSettings() {
  const { data: settings } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  // What this admin typed / saved; the public settings GET can lag behind a save.
  const [draft, setDraft] = useState<string | null>(null);
  const [enabledEdit, setEnabledEdit] = useState<boolean | null>(null);

  const savedCode = settings?.product_ad_code ?? "";
  const code = draft ?? savedCode;
  const enabled = enabledEdit ?? settings?.product_ad_enabled === "true";
  const dirty = (draft !== null && draft !== savedCode) || (enabledEdit !== null && enabledEdit !== (settings?.product_ad_enabled === "true"));

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

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="product-ad-code">Ad code</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDraft(SAMPLE_AD)}>
              Insert sample
            </Button>
          </div>
          <Textarea
            id="product-ad-code"
            value={code}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            rows={14}
            placeholder={'<style>…</style>\n<div>…</div>\n<script>…</script>'}
            className="font-mono text-xs"
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
