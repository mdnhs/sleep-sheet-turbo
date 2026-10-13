"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useSettings,
  useSettingsSecrets,
  useTestMediaStorage,
  useUpdateSettings,
} from "@/features/settings/api/use-settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Eye, EyeOff, Loader2, PlugZap, XCircle } from "lucide-react";
import { CdnFormSkeleton } from "./settings-skeletons";

const cdnSchema = z
  .object({
    media_provider: z.enum(["cloudinary", "r2"]),
    cloudinary_cloud_name: z.string().trim(),
    cloudinary_api_key: z.string().trim(),
    cloudinary_api_secret: z.string().trim(),
    r2_account_id: z.string().trim(),
    r2_bucket: z.string().trim(),
    r2_public_url: z.string().trim(),
    r2_access_key_id: z.string().trim(),
    r2_secret_access_key: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    // Only the provider that receives new uploads must be complete; the other
    // one's credentials stay so its existing files can still be deleted.
    const required: [keyof typeof values, string][] =
      values.media_provider === "r2"
        ? [
            ["r2_account_id", "Account ID is required"],
            ["r2_bucket", "Bucket name is required"],
            ["r2_public_url", "Public URL is required"],
            ["r2_access_key_id", "Access key ID is required"],
            ["r2_secret_access_key", "Secret access key is required"],
          ]
        : [
            ["cloudinary_cloud_name", "Cloud name is required"],
            ["cloudinary_api_key", "API key is required"],
            ["cloudinary_api_secret", "API secret is required"],
          ];
    for (const [key, message] of required) {
      if (!values[key]) ctx.addIssue({ code: "custom", path: [key], message });
    }
    if (values.r2_public_url && !/^https:\/\/[^/?#\s]+(\/[^?#\s]*)?$/.test(values.r2_public_url)) {
      ctx.addIssue({ code: "custom", path: ["r2_public_url"], message: "Must be an https URL, e.g. https://media.example.com" });
    }
  });

type CdnFormValues = z.infer<typeof cdnSchema>;
type TextField = Exclude<keyof CdnFormValues, "media_provider">;
type Provider = CdnFormValues["media_provider"];

const PROVIDER_LABELS: Record<Provider, string> = { r2: "Cloudflare R2", cloudinary: "Cloudinary" };

export function CdnForm() {
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  // Raw credentials only exist on the admin-only secrets endpoint.
  const { data: secrets, isLoading: isLoadingSecrets } = useSettingsSecrets();
  const isLoading = isLoadingSettings || isLoadingSecrets;
  const { mutate, isPending } = useUpdateSettings();
  const test = useTestMediaStorage();
  const [shown, setShown] = useState<Partial<Record<TextField, boolean>>>({});
  // null = follow the selected provider until the user picks a tab.
  const [tab, setTab] = useState<Provider | null>(null);

  const form = useForm<CdnFormValues>({
    resolver: zodResolver(cdnSchema),
    values: {
      media_provider: settings?.media_provider === "r2" ? "r2" : "cloudinary",
      cloudinary_cloud_name: settings?.cloudinary_cloud_name || "",
      cloudinary_api_key: secrets?.cloudinary_api_key || "",
      cloudinary_api_secret: secrets?.cloudinary_api_secret || "",
      r2_account_id: secrets?.r2_account_id || "",
      r2_bucket: settings?.r2_bucket || "",
      r2_public_url: settings?.r2_public_url || "",
      r2_access_key_id: secrets?.r2_access_key_id || "",
      r2_secret_access_key: secrets?.r2_secret_access_key || "",
    },
  });

  function onSubmit(values: CdnFormValues) {
    test.reset();
    mutate({ ...values, r2_public_url: values.r2_public_url.replace(/\/+$/, "") });
  }

  // Errors can sit on the tab that isn't open; jump there so they're visible.
  function onInvalid(errors: Partial<Record<keyof CdnFormValues, unknown>>) {
    const first = Object.keys(errors)[0];
    if (first?.startsWith("r2_")) setTab("r2");
    else if (first?.startsWith("cloudinary_")) setTab("cloudinary");
  }

  if (isLoading) {
    return <CdnFormSkeleton />;
  }

  const provider = form.watch("media_provider");
  const dirty = form.formState.isDirty;

  const field = (name: TextField, label: string, placeholder: string, hint?: string, secret = false) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {secret ? (
              <div className="relative">
                <Input type={shown[name] ? "text" : "password"} placeholder={placeholder} {...field} />
                <button
                  type="button"
                  onClick={() => setShown((s) => ({ ...s, [name]: !s[name] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {shown[name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <Input placeholder={placeholder} {...field} />
            )}
          </FormControl>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Media storage</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Where product images, category images and videos are uploaded. Files already uploaded keep working after a switch.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          <FormField
            control={form.control}
            name="media_provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Upload new files to</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setTab(v as Provider);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue>{PROVIDER_LABELS[field.value]}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cloudinary">{PROVIDER_LABELS.cloudinary}</SelectItem>
                    <SelectItem value="r2">{PROVIDER_LABELS.r2}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Tabs value={tab ?? provider} onValueChange={(v) => setTab(v as Provider)}>
            <TabsList className="flex flex-nowrap items-center h-9 w-fit gap-1 bg-slate-100 dark:bg-muted/40 p-1 rounded-full mb-2">
              {(["r2", "cloudinary"] as const).map((p) => (
                <TabsTrigger
                  key={p}
                  value={p}
                  className="shrink-0 rounded-full px-4 h-7 text-xs font-semibold cursor-pointer transition-colors data-active:bg-slate-900 data-active:text-white data-active:hover:text-white dark:data-active:bg-slate-100 dark:data-active:text-slate-900 dark:data-active:hover:text-slate-900"
                >
                  {PROVIDER_LABELS[p]}
                  {provider === p && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="Receives uploads" />}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* keepMounted so validation messages survive a tab switch */}
            <TabsContent value="r2" keepMounted className="space-y-4">
              <TabHeading provider="r2" active={provider === "r2"} />
              {field("r2_account_id", "Account ID", "32-character Cloudflare account ID", "Cloudflare dashboard → R2 → Account details.", true)}
              {field("r2_bucket", "Bucket", "e.g. sleepsheet-media")}
              {field(
                "r2_public_url",
                "Public URL",
                "https://media.example.com",
                "The bucket's custom domain (or r2.dev URL) that serves uploaded files.",
              )}
              {field("r2_access_key_id", "Access key ID", "R2 API token access key ID", "An R2 API token with Object Read & Write on this bucket.", true)}
              {field("r2_secret_access_key", "Secret access key", "R2 API token secret", undefined, true)}
            </TabsContent>

            <TabsContent value="cloudinary" keepMounted className="space-y-4">
              <TabHeading provider="cloudinary" active={provider === "cloudinary"} />
              {field("cloudinary_cloud_name", "Cloud name", "e.g. dhz1oeq0z")}
              {field("cloudinary_api_key", "API key", "Enter API key", "Needs a role that can create and delete assets.", true)}
              {field("cloudinary_api_secret", "API secret", "Enter API secret", undefined, true)}
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={isPending} className="rounded-full text-xs font-semibold">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={dirty || isPending || test.isPending}
              onClick={() => test.mutate()}
              className="rounded-full text-xs font-semibold"
            >
              {test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Test connection
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Save first — the test uses the saved settings.</span>}
          </div>

          {test.error && <p className="text-xs text-destructive">{test.error.message}</p>}
          {test.data && (
            <ul className="space-y-1.5 rounded-xl border p-3 text-xs" aria-live="polite">
              {test.data.steps.map((step) => (
                <li key={step.label} className="flex items-start gap-2">
                  {step.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <span>
                    <span className="font-medium">{step.label}:</span> {step.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </form>
      </Form>
    </div>
  );
}

function TabHeading({ provider, active }: { provider: Provider; active: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      {active ? (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Receives uploads</span>
      ) : (
        <>Not receiving uploads. Credentials kept so existing {PROVIDER_LABELS[provider]} files can still be deleted.</>
      )}
    </p>
  );
}
