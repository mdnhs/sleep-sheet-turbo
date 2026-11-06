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
import { BdCourierFormSkeleton } from "./settings-skeletons";

const geminiSchema = z.object({
  gemini_api_key: z.string().min(1, "API key is required"),
});

type GeminiFormValues = z.infer<typeof geminiSchema>;

export function GeminiForm() {
  const { data: secrets, isLoading } = useSettingsSecrets();
  const { mutate, isPending } = useUpdateSettings();
  const [showKey, setShowKey] = useState(false);

  const form = useForm<GeminiFormValues>({
    resolver: zodResolver(geminiSchema),
    values: {
      gemini_api_key: secrets?.gemini_api_key || "",
    },
  });

  function onSubmit(values: GeminiFormValues) {
    mutate(values);
  }

  if (isLoading) {
    return <BdCourierFormSkeleton />;
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Gemini AI (POS Screenshot Fill)</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Google Gemini API key (free from aistudio.google.com). Used by POS to read a customer&apos;s name, phone and address from a screenshot. The screenshot is never stored.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="gemini_api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showKey ? "text" : "password"} placeholder="Enter Gemini API key" {...field} />
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
