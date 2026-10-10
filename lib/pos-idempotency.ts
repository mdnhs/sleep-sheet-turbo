/**
 * Sale-creation idempotency key (browser side) for the POS terminal.
 * See lib/idempotency-key.ts for how the key store works.
 *
 * POS is exactly the interface where a busy staff member double-clicks
 * "Complete Sale" or re-clicks on a slow connection — unlike checkout it had
 * no idempotency key at all, so a repeat submit created a second order, a
 * second stock decrement, and double-counted revenue (BAD-9, 2026-09-21
 * audit). The key is cleared once a sale succeeds so the next sale starts
 * fresh.
 */
import { createIdempotencyKeyStore } from "./idempotency-key";

const store = createIdempotencyKeyStore("pos_sale_idempotency_key");

export const getOrCreatePosIdempotencyKey = store.getOrCreate;
export const clearPosIdempotencyKey = store.clear;
