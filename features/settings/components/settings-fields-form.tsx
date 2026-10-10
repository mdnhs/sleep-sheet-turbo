"use client";

import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { toSettingsPatch, type SettingsSection } from "@/features/settings/settings-fields";
import type { SettingsPatch } from "@/lib/settings/registry";

/** A settings page built from a field list. The server validates every value against the registry. */
export function SettingsFieldsForm({ sections, submitLabel }: { sections: SettingsSection[]; submitLabel: string }) {
  const { data, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const fields = sections.flatMap((section) => section.fields);

  const form = useForm<Record<string, string>>({
    values: Object.fromEntries(fields.map((field) => [field.key, data?.[field.key] ?? ""])),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <Skeleton key={section.title} className="h-40 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutate(toSettingsPatch(fields, values) as SettingsPatch))}
        className="space-y-6"
      >
        {sections.map((section) => (
          <div key={section.title} className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold tracking-tight">{section.title}</h2>
              {section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((setting) => (
                <FormField
                  key={setting.key}
                  control={form.control}
                  name={setting.key}
                  render={({ field }) => (
                    <FormItem className={setting.multiline ? "md:col-span-2" : undefined}>
                      <FormLabel>{setting.label}</FormLabel>
                      <FormControl>
                        {setting.options ? (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Default" />
                            </SelectTrigger>
                            <SelectContent>
                              {setting.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : setting.multiline ? (
                          <Textarea rows={3} placeholder={setting.placeholder} {...field} />
                        ) : (
                          <Input placeholder={setting.placeholder} {...field} />
                        )}
                      </FormControl>
                      {!setting.options && setting.placeholder && (
                        <FormDescription className="text-xs">Empty uses: {setting.placeholder}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
