/**
 * Client-side idempotency key store, backing both checkout
 * (lib/checkout-idempotency.ts) and POS (lib/pos-idempotency.ts).
 *
 * One UUID per submit attempt, persisted in sessionStorage under a
 * caller-chosen key so every retry of the SAME attempt — a double-click, a
 * re-click after a slow network, a back-then-resubmit — sends the same
 * value. The server treats a repeat key as "return the existing order"
 * instead of creating a second row (see orders.idempotencyKey's unique
 * index), which is what actually prevents the duplicate.
 *
 * Each caller gets its own sessionStorage slot (`storageKey`) so a stalled
 * checkout attempt and a stalled POS sale can't ever share or clobber one
 * another's key.
 */
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createIdempotencyKeyStore(storageKey: string) {
  return {
    /** Read the current key, creating and persisting one if none exists yet. */
    getOrCreate(): string | undefined {
      if (typeof window === "undefined") return undefined;
      try {
        let key = sessionStorage.getItem(storageKey);
        if (!key) {
          key = uuid();
          sessionStorage.setItem(storageKey, key);
        }
        return key;
      } catch {
        // sessionStorage unavailable (private mode / disabled) — degrade gracefully.
        return undefined;
      }
    },
    /** Drop the current key so the next attempt gets a fresh one. */
    clear(): void {
      if (typeof window === "undefined") return;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
  };
}
