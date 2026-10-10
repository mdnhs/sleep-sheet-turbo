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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Loader2 } from "lucide-react";

const shippingSchema = z.object({
  shipping_inside_dhaka: z.number({ error: "Must be a number" }).min(0, "Must be ≥ 0"),
  shipping_outside_dhaka: z.number({ error: "Must be a number" }).min(0, "Must be ≥ 0"),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

export function ShippingForm() {
  const { data, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      shipping_inside_dhaka: 60,
      shipping_outside_dhaka: 120,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        shipping_inside_dhaka: Number(data.shipping_inside_dhaka ?? 60),
        shipping_outside_dhaka: Number(data.shipping_outside_dhaka ?? 120),
      });
    }
  }, [data, form]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutate(values))}
        className="space-y-4"
      >
        <FormField
          name="shipping_inside_dhaka"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold">Inside Dhaka</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="shipping_outside_dhaka"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold">Outside Dhaka</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} className="gap-2 rounded-full text-xs font-semibold">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Shipping
          </Button>
        </div>
      </form>
    </Form>
  );
}
