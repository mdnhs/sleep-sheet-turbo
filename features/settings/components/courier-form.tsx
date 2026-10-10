"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettingsSecrets, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";

const courierSchema = z.object({
  steadfast_api_key: z.string().min(1, "API key is required"),
  steadfast_secret_key: z.string().min(1, "Secret key is required"),
});

type CourierFormValues = z.infer<typeof courierSchema>;

export function CourierForm() {
  // Raw credentials only exist on the admin-only secrets endpoint.
  const { data: secrets, isLoading } = useSettingsSecrets();
  const { mutate, isPending } = useUpdateSettings();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const form = useForm<CourierFormValues>({
    resolver: zodResolver(courierSchema),
    values: {
      steadfast_api_key: secrets?.steadfast_api_key || "",
      steadfast_secret_key: secrets?.steadfast_secret_key || "",
    },
  });

  function onSubmit(values: CourierFormValues) {
    mutate(values);
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Steadfast Courier</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your Steadfast courier API credentials for order shipping.</p>
      </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="steadfast_api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showApiKey ? "text" : "password"} placeholder="Enter API key" {...field} />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="steadfast_secret_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showSecretKey ? "text" : "password"} placeholder="Enter secret key" {...field} />
                      <button type="button" onClick={() => setShowSecretKey(!showSecretKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                        {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
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
