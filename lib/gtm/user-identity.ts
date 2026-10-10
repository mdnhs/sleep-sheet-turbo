import { getCapturedFbc } from "@/lib/meta-fbc";
import { hashIdentifiers } from "./index";
import type { GtmUserData } from "./events";

/**
 * The identifiers Meta matches on, held ready for any event to attach.
 *
 * Only Purchase used to carry them, because only Purchase had somewhere to
 * get them from — the order it had just fetched. Every other event fired
 * with nothing but an IP and a user agent, which is the weakest match Meta
 * accepts, and it is the server-side copies of those events that suffer for
 * it: the browser Pixel can at least fall back on its own cookies.
 *
 * Caching matters because the hashing is asynchronous. A click on "add to
 * cart" is not going to await a digest before it pushes, so the digest is
 * computed once when the signed-in user resolves and read synchronously
 * afterwards.
 */
let cached: Omit<GtmUserData, "fbc"> | undefined;

export interface GtmIdentityInput {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Computes and stores the identity for the signed-in user or guest customer.
 * Safe to call repeatedly — unchanged identifiers are not re-hashed.
 */
export async function primeGtmIdentity(user: GtmIdentityInput | null | undefined): Promise<void> {
  if (!user || (!user.id && !user.phone?.trim() && !user.email?.trim())) {
    cached = undefined;
    return;
  }

  const phone = user.phone?.trim() || undefined;
  const email = user.email?.trim() || undefined;

  // If the same identity is already primed, skip hashing
  if (
    cached &&
    ((user.id && cached.external_id === user.id) ||
      (!user.id && phone && cached.phone_number === phone && (!email || cached.email === email)))
  ) {
    return;
  }

  const { email_sha256, phone_sha256 } = await hashIdentifiers({
    email,
    phone,
  });

  cached = {
    external_id: user.id || cached?.external_id || undefined,
    email: email || cached?.email || undefined,
    phone_number: phone || cached?.phone_number || undefined,
    email_sha256: email_sha256 || cached?.email_sha256 || undefined,
    phone_sha256: phone_sha256 || cached?.phone_sha256 || undefined,
  };
}

/**
 * The identity to attach to an outgoing event, or undefined when there is
 * nothing to say. `fbc` is read fresh rather than cached: the click id can
 * be written after this module was primed — a visitor can land, browse, and
 * only then have the Pixel set its cookie.
 */
export function getGtmIdentity(): GtmUserData | undefined {
  const fbc = getCapturedFbc();
  if (!cached && !fbc) return undefined;
  return { ...cached, ...(fbc ? { fbc } : {}) };
}

/** Test seam, and what a sign-out should call. */
export function clearGtmIdentity(): void {
  cached = undefined;
}
