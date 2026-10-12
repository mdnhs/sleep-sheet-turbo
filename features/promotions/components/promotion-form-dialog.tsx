"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PROMOTION_PAYMENT_METHODS, PROMOTION_ZONES } from "@/lib/promotions";
import { useCreatePromotion, useUpdatePromotion, type PromotionPayload } from "../api/use-promotions";
import type { Promotion } from "../types";
import { DateTimeField } from "./date-time-field";
import { isoToLocalInput, localInputToIso, PAYMENT_METHOD_LABELS, ZONE_LABELS } from "../utils";

// Same rules as promotionInputSchema (features/promotions/server/promotions.ts,
// server-only). Fields stay as the inputs hold them (strings) and are turned
// into the API body on submit.
const promotionFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120, "At most 120 characters"),
    description: z.string().trim().max(1000, "At most 1000 characters"),
    paymentMethods: z.array(z.enum(PROMOTION_PAYMENT_METHODS)).min(1, "Pick at least one payment method"),
    zones: z.array(z.enum(PROMOTION_ZONES)).min(1, "Pick at least one delivery zone"),
    minOrderAmount: z.string().refine((value) => {
      if (value.trim() === "") return true;
      const amount = Number(value);
      return Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000;
    }, "Enter an amount between 0 and 10,000,000"),
    personalWindowHours: z.string().refine((value) => {
      if (value.trim() === "") return true;
      const hours = Number(value);
      return Number.isFinite(hours) && hours * 60 >= 1 && hours <= 168;
    }, "Enter hours between 0.1 and 168 (a week)"),
    startsAt: z.string(),
    endsAt: z.string(),
    isActive: z.boolean(),
  })
  .refine((p) => !p.startsAt || !p.endsAt || new Date(p.startsAt) <= new Date(p.endsAt), {
    message: "End date must be after the start date",
    path: ["endsAt"],
  });

type PromotionFormValues = z.infer<typeof promotionFormSchema>;

function defaultValues(promotion: Promotion | null): PromotionFormValues {
  if (!promotion) {
    return {
      title: "",
      description: "",
      paymentMethods: [],
      zones: [...PROMOTION_ZONES],
      minOrderAmount: "",
      personalWindowHours: "",
      startsAt: "",
      endsAt: "",
      isActive: true,
    };
  }
  return {
    title: promotion.title,
    description: promotion.description ?? "",
    paymentMethods: PROMOTION_PAYMENT_METHODS.filter((m) => promotion.paymentMethods.includes(m)),
    zones: PROMOTION_ZONES.filter((zone) => promotion.zones.includes(zone)),
    minOrderAmount: promotion.minOrderAmount === null ? "" : String(promotion.minOrderAmount),
    personalWindowHours:
      promotion.personalWindowMinutes === null ? "" : String(Math.round((promotion.personalWindowMinutes / 60) * 100) / 100),
    startsAt: isoToLocalInput(promotion.startsAt),
    endsAt: isoToLocalInput(promotion.endsAt),
    isActive: promotion.isActive,
  };
}

function toPayload(values: PromotionFormValues): PromotionPayload {
  const description = values.description.trim();
  const minOrderAmount = values.minOrderAmount.trim();
  const personalWindowHours = values.personalWindowHours.trim();
  return {
    title: values.title.trim(),
    description: description || null,
    paymentMethods: values.paymentMethods,
    zones: values.zones,
    minOrderAmount: minOrderAmount === "" ? null : Number(minOrderAmount),
    personalWindowMinutes:
      personalWindowHours === "" ? null : Math.max(1, Math.round(Number(personalWindowHours) * 60)),
    startsAt: localInputToIso(values.startsAt),
    endsAt: localInputToIso(values.endsAt),
    isActive: values.isActive,
  };
}

/** Toggle `value` in a list, keeping the order of `all`. */
function toggleIn<T extends string>(all: readonly T[], current: T[], value: T, on: boolean): T[] {
  return all.filter((item) => (item === value ? on : current.includes(item)));
}

interface PromotionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The promotion being edited, or null to create one. */
  promotion: Promotion | null;
}

export function PromotionFormDialog({ open, onOpenChange, promotion }: PromotionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{promotion ? "Edit promotion" : "New promotion"}</DialogTitle>
          <DialogDescription>
            Free delivery when the order&apos;s payment method and delivery zone are selected below.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the form starts fresh for each promotion it opens with. */}
        <PromotionForm key={promotion?.id ?? "new"} promotion={promotion} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PromotionForm({ promotion, onDone }: { promotion: Promotion | null; onDone: () => void }) {
  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: defaultValues(promotion),
  });

  const onSubmit = (values: PromotionFormValues) => {
    const json = toPayload(values);
    if (promotion) {
      updateMutation.mutate({ id: promotion.id, json }, { onSuccess: onDone });
    } else {
      createMutation.mutate(json, { onSuccess: onDone });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Free delivery on bKash payments" maxLength={120} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional — shown with the offer" rows={3} maxLength={1000} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="paymentMethods"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment methods</FormLabel>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {PROMOTION_PAYMENT_METHODS.map((method) => (
                  <label key={method} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value.includes(method)}
                      onCheckedChange={(checked) =>
                        field.onChange(toggleIn(PROMOTION_PAYMENT_METHODS, field.value, method, checked === true))
                      }
                    />
                    {PAYMENT_METHOD_LABELS[method]}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="zones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery zones</FormLabel>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {PROMOTION_ZONES.map((zone) => (
                  <label key={zone} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value.includes(zone)}
                      onCheckedChange={(checked) =>
                        field.onChange(toggleIn(PROMOTION_ZONES, field.value, zone, checked === true))
                      }
                    />
                    {ZONE_LABELS[zone]}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="minOrderAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum order amount</FormLabel>
              <FormControl>
                <Input type="number" inputMode="decimal" min={0} step="any" placeholder="No minimum" {...field} />
              </FormControl>
              <FormDescription>Cart subtotal before delivery. Leave empty for no minimum.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="personalWindowHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal time limit (hours)</FormLabel>
              <FormControl>
                <Input type="number" inputMode="decimal" min={0.1} max={168} step="any" placeholder="No limit" {...field} />
              </FormControl>
              <FormDescription>
                Each visitor gets this long from the moment they first see the offer (never past the end date), and
                checkout honours exactly that — so the short countdown they see is real. Leave empty for none.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starts</FormLabel>
                <FormControl>
                  <DateTimeField value={field.value} onChange={field.onChange} placeholder="Right away" defaultTime="00:00" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ends</FormLabel>
                <FormControl>
                  <DateTimeField value={field.value} onChange={field.onChange} placeholder="No end date" defaultTime="23:59" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
            Optional. Leave both empty to run with no date limits.
          </p>
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
              <div className="space-y-0.5">
                <FormLabel>Active</FormLabel>
                <FormDescription className="text-xs">Switch off to pause without deleting.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={(checked) => field.onChange(checked)} />
              </FormControl>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {promotion ? "Save changes" : "Create promotion"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
