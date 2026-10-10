import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

import cuid from "cuid";

/**
 * Find (or create) the customer account behind a phone number.
 *
 * Guest checkout and POS both need this: a customer who never registered
 * still gets a real `users` row, so they persist independently of any single
 * order (delete the order and the customer survives, and still shows on the
 * Customers page) and so repeat orders from the same number land on the same
 * account rather than fragmenting into one row per order.
 *
 * Both call sites used to inline their own check-then-insert with nothing
 * behind it, which raced: two concurrent orders from the same phone could
 * both miss the lookup, and — when neither supplied an email, so both derived
 * the same `<phone>@<domain>` fallback — the loser hit the UNIQUE on email
 * and crashed the whole checkout with a 500. A real order was lost to what
 * should have been a no-op.
 *
 * The insert here is `ON CONFLICT DO NOTHING` against every unique constraint
 * on the table (phone and email both), so the losing writer inserts nothing
 * and re-reads the winner's row instead of throwing. That makes this safe to
 * call concurrently for the same phone.
 */
export async function findOrCreateCustomerByPhone(input: {
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  /** Domain for the derived email when the customer gave none, e.g. "guest.local". */
  emailDomain: string;
}): Promise<string> {
  const phone = input.phone.trim();

  if (phone) {
    const existing = await db.query.users.findFirst({ where: eq(users.phone, phone) });
    if (existing) return existing.id;
  }

  // Only reuse the submitted email if it doesn't already belong to a
  // different account — `users.email` is unique, and a collision there would
  // silently drop this insert and send us to the phone re-read below, which
  // would find nothing.
  let email = input.email?.trim() || "";
  if (email) {
    const emailTaken = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (emailTaken) email = "";
  }

  const fallbackEmail = `${phone || cuid()}@${input.emailDomain}`;
  const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
  const [created] = await db
    .insert(users)
    .values({
      name: input.fullName,
      email: email || fallbackEmail,
      phone: phone || null,
      password: hashedPassword,
      address: input.address || null,
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (created) return created.id;

  // Lost the race: the concurrent insert won, so its row is the customer.
  if (phone) {
    const winner = await db.query.users.findFirst({ where: eq(users.phone, phone) });
    if (winner) return winner.id;
  }

  // Nothing on phone means the conflict came from the derived email instead —
  // an account that already owns `<phone>@<domain>` but carries a different
  // (or no) phone. That row is still this customer.
  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, email || fallbackEmail),
  });
  if (byEmail) return byEmail.id;

  throw new Error(`Could not find or create customer for phone ${phone}`);
}

