/** A promotion as the API and pages see it: dates are ISO strings. */
export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  type: "free_delivery";
  paymentMethods: string[];
  zones: string[];
  minOrderAmount: number | null;
  /** Per-visitor time limit in minutes, from when they first saw it; null = none. */
  personalWindowMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
