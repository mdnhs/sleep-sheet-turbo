import { z } from "zod";
import { DIMENSION_KEYS, type Dimension, type Filters } from "../lib/dimensions";
import type { Range } from "./filters";

const MAX_RANGE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

const filterShape = Object.fromEntries(
  DIMENSION_KEYS.map((key) => [key, z.string().trim().max(300).optional()]),
) as Record<Dimension, z.ZodOptional<z.ZodString>>;

export const rangeQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  ...filterShape,
});

export const breakdownQuerySchema = rangeQuerySchema.extend({
  dim: z.enum(DIMENSION_KEYS as [Dimension, ...Dimension[]]),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const productsQuerySchema = rangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const draftsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  view: z.enum(["open", "completed"]).default("open"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const draftIdSchema = z.object({ id: z.coerce.number().int().positive() });

export type RangeQuery = z.infer<typeof rangeQuerySchema>;

export function toRangeAndFilters(q: RangeQuery): { range: Range; filters: Filters } | null {
  const start = new Date(q.from);
  const end = new Date(q.to);
  if (!(start <= end) || end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) return null;
  const filters: Filters = {};
  for (const key of DIMENSION_KEYS) {
    const value = q[key];
    if (value) filters[key] = value;
  }
  return { range: { start, end }, filters };
}
