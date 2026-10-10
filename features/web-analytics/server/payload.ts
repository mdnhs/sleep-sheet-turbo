import { z } from "zod";
import { COLLECT_TYPES, type CollectPayload } from "../lib/types";

export const MAX_BODY_BYTES = 2048;

// Optional text: trimmed, length-capped, blank or missing becomes null.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const id = z.string().trim().min(1).max(64);

export const collectPayloadSchema = z.object({
  type: z.enum(COLLECT_TYPES),
  path: z.string().trim().min(1).max(300).startsWith("/"),
  hostname: text(100),
  visitorId: id,
  sessionId: id,
  referrerHost: text(100),
  utmSource: text(150),
  utmMedium: text(150),
  utmCampaign: text(150),
  utmTerm: text(150),
  utmContent: text(150),
  adClick: z
    .enum(["google", "facebook"])
    .nullish()
    .transform((value) => value ?? null),
  label: text(300),
  productId: text(64),
  value: z
    .number()
    .finite()
    .min(0)
    .max(100_000_000)
    .nullish()
    .transform((value) => value ?? null),
});

/** The beacon body as a validated payload, or null for anything else. */
export function parseCollectBody(raw: string): CollectPayload | null {
  if (raw.length > MAX_BODY_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = collectPayloadSchema.safeParse(json);
  return result.success ? result.data : null;
}
