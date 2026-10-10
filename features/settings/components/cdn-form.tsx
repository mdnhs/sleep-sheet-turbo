"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettings, useSettingsSecrets, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";

const cdnSchema = z.object({
  cloudinary_cloud_name: z.string().min(1, "Cloud name is required"),
  cloudinary_api_key: z.string().min(1, "API key is required"),
  cloudinary_api_secret: z.string().min(1, "API secret is required"),
});

type CdnFormValues = z.infer<typeof cdnSchema>;

export function CdnForm() {
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  // Raw credentials only exist on the admin-only secrets endpoint.
  const { data: secrets, isLoading: isLoadingSecrets } = useSettingsSecrets();
  const isLoading = isLoadingSettings || isLoadingSecrets;
  const { mutate, isPending } = useUpdateSettings();
  const [showSecret, setShowSecret] = useState(false);

  const form = useForm<CdnFormValues>({
    resolver: zodResolver(cdnSchema),
    values: {
      cloudinary_cloud_name: settings?.cloudinary_cloud_name || "",
      cloudinary_api_key: secrets?.cloudinary_api_key || "",
      cloudinary_api_secret: secrets?.cloudinary_api_secret || "",
    },
  });

  function onSubmit(values: CdnFormValues) {
    mutate(values);
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <Skeleton className="h-6 w-40 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-xl" />
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Cloudinary CDN</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your Cloudinary API credentials for image uploads.</p>
      </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cloudinary_cloud_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cloud Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. dhz1oeq0z" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Leave empty to use the value from environment variables.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cloudinary_api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter API key" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Leave empty to use the value from environment variables.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cloudinary_api_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Secret</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showSecret ? "text" : "password"} placeholder="Enter API secret" {...field} />
                      <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Leave empty to use the value from environment variables.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="rounded-full text-xs font-semibold">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
    </div>
  );
}
