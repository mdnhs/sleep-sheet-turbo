// The namespace import, zod 4's documented form: `import { z }` binds the `z`
// re-export object, which drags every locale table (~157KB) into the
// checkout's client JS; this lets the bundler keep only what's used.
import * as z from "zod";
import type { translations } from "@/hooks/use-language";
import { isValidBdMobile11 } from "@/features/fraud-checker/phone";

type TranslateFn = (key: keyof typeof translations["en"]) => string;

// Defined in ./constants so client code can use them without importing zod.
export { SHIPPING_ZONES, type ShippingZone } from "./constants";

export function createShippingInformationSchema(t: TranslateFn) {
  return z.object({
    fullName: z.string().trim().min(1, t("errorFullNameRequired")),
    phone: z.string().trim().min(1, t("errorPhoneRequired")).refine(isValidBdMobile11, t("errorPhoneInvalid")),
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
