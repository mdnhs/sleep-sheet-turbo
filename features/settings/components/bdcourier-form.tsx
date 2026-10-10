"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettingsSecrets, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";

const bdCourierSchema = z.object({
  bdcourier_api_key: z.string().min(1, "API key is required"),
});

type BdCourierFormValues = z.infer<typeof bdCourierSchema>;

export function BdCourierForm() {
  const { data: secrets, isLoading } = useSettingsSecrets();
  const { mutate, isPending } = useUpdateSettings();
  const [showKey, setShowKey] = useState(false);

  const form = useForm<BdCourierFormValues>({
    resolver: zodResolver(bdCourierSchema),
    values: {
      bdcourier_api_key: secrets?.bdcourier_api_key || "",
    },
  });

  function onSubmit(values: BdCourierFormValues) {
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
        <h2 className="text-base font-bold tracking-tight">BD Courier (Fraud Checker)</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          API key from bdcourier.com, used by the Fraud Checker page to look up a customer&apos;s delivery history.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="bdcourier_api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showKey ? "text" : "password"} placeholder="Enter BD Courier API key" {...field} />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
