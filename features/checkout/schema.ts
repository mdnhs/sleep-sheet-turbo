import { z } from "zod";
import type { translations } from "@/hooks/use-language";

type TranslateFn = (key: keyof typeof translations["en"]) => string;

export const SHIPPING_ZONES = {
  inside_dhaka: { label: "Inside Dhaka", cost: 60 },
  outside_dhaka: { label: "Outside Dhaka", cost: 120 },
} as const;

export type ShippingZone = keyof typeof SHIPPING_ZONES;

export function createShippingInformationSchema(t: TranslateFn) {
  return z.object({
    fullName: z.string().trim().min(1, t("errorFullNameRequired")),
    phone: z.string().trim().min(1, t("errorPhoneRequired")),
    email: z.string().email(t("errorInvalidEmail")).optional().or(z.literal("")),
    address: z.string().trim().min(1, t("errorAddressRequired")),
    shippingZone: z.enum(["inside_dhaka", "outside_dhaka"], {
      error: t("errorSelectZone"),
    }),
    notes: z.string().optional(),
  });
}

function addPaymentIssues(data: { paymentMethod: string; cardNumber?: string; expirationDate?: string; cvv?: string; nameOnCard?: string }, ctx: z.RefinementCtx, t: TranslateFn) {
  if (data.paymentMethod !== "card") return;

  if (!data.cardNumber || data.cardNumber.length !== 16) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("errorCardNumberLength"), path: ["cardNumber"] });
  }

  if (!data.expirationDate || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.expirationDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("errorExpiryFormat"), path: ["expirationDate"] });
  } else {
    const [monthStr, yearStr] = data.expirationDate.split("/");
    const expMonth = parseInt(monthStr, 10);
    const expYear = parseInt(`20${yearStr}`, 10);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("errorCardExpired"), path: ["expirationDate"] });
    }
  }

  if (!data.cvv || data.cvv.length !== 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("errorCvvLength"), path: ["cvv"] });
  }

  if (!data.nameOnCard || data.nameOnCard.trim().length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("errorNameOnCardRequired"), path: ["nameOnCard"] });
  }
}

export function createPaymentInformationSchema(t: TranslateFn) {
  return z.object({
    paymentMethod: z.enum(["card", "cod", "bkash"]),
    cardNumber: z.string().optional(),
    expirationDate: z.string().optional(),
    cvv: z.string().optional(),
    nameOnCard: z.string().optional(),
  }).superRefine((data, ctx) => addPaymentIssues(data, ctx, t));
}

export function createConfirmationInformationSchema(t: TranslateFn) {
  return z.object({
    agreedToTerms: z.boolean().refine((val) => val === true, t("errorAgreeToTerms")),
  });
}

export function createDeliveryAndPaymentSchema(t: TranslateFn) {
  return createShippingInformationSchema(t).and(
    z.object({
      paymentMethod: z.enum(["card", "cod", "bkash"]),
      cardNumber: z.string().optional(),
      expirationDate: z.string().optional(),
      cvv: z.string().optional(),
      nameOnCard: z.string().optional(),
    }).superRefine((data, ctx) => addPaymentIssues(data, ctx, t))
  );
}

export type ShippingInformationFormValues = z.infer<ReturnType<typeof createShippingInformationSchema>>;
export type PaymentInformationFormValues = z.infer<ReturnType<typeof createPaymentInformationSchema>>;
export type DeliveryAndPaymentFormValues = z.infer<ReturnType<typeof createDeliveryAndPaymentSchema>>;
export type ConfirmationInformationSchemaFormValues = z.infer<ReturnType<typeof createConfirmationInformationSchema>>;
