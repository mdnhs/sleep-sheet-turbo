import type { FieldErrors, Resolver } from "react-hook-form";
import type { translations } from "@/hooks/use-language";
import type { DeliveryAndPaymentFormValues } from "./schema";

type TranslateFn = (key: keyof typeof translations["en"]) => string;

// Hand-written client resolver for the checkout form. It mirrors
// createDeliveryAndPaymentSchema in ./schema (which the server still uses), but
// without zod: zodResolver pulled a 163 KB zod chunk into the checkout page's
// first load just to check a handful of required fields. Keep the two in sync.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRY_RE = /^(0[1-9]|1[0-2])\/\d{2}$/;

export function validateDeliveryAndPayment(
  values: DeliveryAndPaymentFormValues,
  t: TranslateFn,
): Partial<Record<keyof DeliveryAndPaymentFormValues, string>> {
  const errors: Partial<Record<keyof DeliveryAndPaymentFormValues, string>> = {};
  const blank = (v: unknown) => typeof v !== "string" || v.trim().length === 0;

  if (blank(values.fullName)) errors.fullName = t("errorFullNameRequired");
  if (blank(values.phone)) errors.phone = t("errorPhoneRequired");
  if (values.email && !EMAIL_RE.test(values.email)) errors.email = t("errorInvalidEmail");
  if (blank(values.address)) errors.address = t("errorAddressRequired");
  if (values.shippingZone !== "inside_dhaka" && values.shippingZone !== "outside_dhaka") {
    errors.shippingZone = t("errorSelectZone");
  }

  if (values.paymentMethod === "card") {
    if (!values.cardNumber || values.cardNumber.length !== 16) {
      errors.cardNumber = t("errorCardNumberLength");
    }
    if (!values.expirationDate || !EXPIRY_RE.test(values.expirationDate)) {
      errors.expirationDate = t("errorExpiryFormat");
    } else {
      const [m, y] = values.expirationDate.split("/");
      const expMonth = parseInt(m, 10);
      const expYear = parseInt(`20${y}`, 10);
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      if (expYear < year || (expYear === year && expMonth < month)) {
        errors.expirationDate = t("errorCardExpired");
      }
    }
    if (!values.cvv || values.cvv.length !== 3) errors.cvv = t("errorCvvLength");
    if (blank(values.nameOnCard)) errors.nameOnCard = t("errorNameOnCardRequired");
  }

  return errors;
}

export function deliveryAndPaymentResolver(t: TranslateFn): Resolver<DeliveryAndPaymentFormValues> {
  return async (values) => {
    const messages = validateDeliveryAndPayment(values, t);
    const keys = Object.keys(messages) as (keyof DeliveryAndPaymentFormValues)[];
    if (keys.length === 0) {
      // Match zod's .trim() on the text fields so submitted values are clean.
      return {
        values: {
          ...values,
          fullName: values.fullName.trim(),
          phone: values.phone.trim(),
          address: values.address.trim(),
        },
        errors: {},
      };
    }
    const errors: FieldErrors<DeliveryAndPaymentFormValues> = {};
    for (const key of keys) {
      errors[key] = { type: "validation", message: messages[key] };
    }
    return { values: {}, errors };
  };
}
