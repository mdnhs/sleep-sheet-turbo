"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { SUPPORTED_CURRENCIES } from "@/hooks/use-currency";
import { Loader2 } from "lucide-react";

const currencySchema = z.object({
  currency: z.string().min(1),
});

type CurrencyFormValues = z.infer<typeof currencySchema>;

export function CurrencyForm() {
  const { data, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();

  const form = useForm<CurrencyFormValues>({
    resolver: zodResolver(currencySchema),
    defaultValues: { currency: "BDT" },
  });

  useEffect(() => {
    if (data) {
      form.reset({ currency: data.currency ?? "BDT" });
    }
  }, [data, form]);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutate(values))}
        className="space-y-4"
      >
        <FormField
          name="currency"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold">Store Currency</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(({ code, label }) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Currency
          </Button>
        </div>
      </form>
    </Form>
  );
}
