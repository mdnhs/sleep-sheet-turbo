/**
 * Order-creation idempotency key (browser side) for the storefront checkout.
 * See lib/idempotency-key.ts for how the key store works.
 *
 * The key is cleared on a successful order so the next checkout starts fresh.
 */
import { createIdempotencyKeyStore } from "./idempotency-key";

const store = createIdempotencyKeyStore("checkout_idempotency_key");

export const getOrCreateCheckoutIdempotencyKey = store.getOrCreate;
export const clearCheckoutIdempotencyKey = store.clear;
