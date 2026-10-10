"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettingsSecrets, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";

const googleSheetsSchema = z.object({
  google_sheets_client_email: z.string(),
  google_sheets_private_key: z.string(),
  google_sheets_spreadsheet_id: z.string(),
});

type GoogleSheetsFormValues = z.infer<typeof googleSheetsSchema>;

export function GoogleSheetsForm() {
  // Raw credentials only exist on the admin-only secrets endpoint.
  const { data: secrets, isLoading } = useSettingsSecrets();
  const { mutate, isPending } = useUpdateSettings();
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const form = useForm<GoogleSheetsFormValues>({
    resolver: zodResolver(googleSheetsSchema),
    values: {
      google_sheets_client_email: secrets?.google_sheets_client_email || "",
      google_sheets_private_key: secrets?.google_sheets_private_key || "",
      google_sheets_spreadsheet_id: secrets?.google_sheets_spreadsheet_id || "",
    },
  });

  function onSubmit(values: GoogleSheetsFormValues) {
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
        <h2 className="text-base font-bold tracking-tight">Google Sheets Order Log</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect a Google service account so &quot;Book to Google Sheet&quot; can append order rows to your spreadsheet.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="google_sheets_client_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Account Email</FormLabel>
                <FormControl>
                  <Input placeholder="my-service-account@my-project.iam.gserviceaccount.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="google_sheets_private_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Account Private Key</FormLabel>
                <FormControl>
                  <div className="relative">
                    {showPrivateKey ? (
                      <Textarea
                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                        className="font-mono text-xs min-h-32 pr-10"
                        {...field}
                      />
                    ) : (
                      <Input type="password" placeholder="Paste the private key from your service account JSON" {...field} />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormDescription>
                  The full &quot;private_key&quot; value from the service account&apos;s JSON key file, including the BEGIN/END lines.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="google_sheets_spreadsheet_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spreadsheet ID</FormLabel>
                <FormControl>
                  <Input placeholder="160tQDJJWsZz5uiwbPabhY_7qx5YXZV3kB9Dpfh3bTrg" {...field} />
                </FormControl>
                <FormDescription>
                  The long ID in the sheet&apos;s URL: docs.google.com/spreadsheets/d/<strong>this-part</strong>/edit
                </FormDescription>
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
