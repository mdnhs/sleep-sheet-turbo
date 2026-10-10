import { describe, it, expect, vi, beforeEach } from "vitest";

// The helper talks to the real db module, so stand in a fake that models the
// one thing worth testing here: the UNIQUE constraints, and what the insert
// returns when ON CONFLICT DO NOTHING swallows a row.
const rows: { id: string; email: string; phone: string | null }[] = [];
let nextId = 1;
/** Rows a concurrent writer inserts between our lookup and our insert. */
let raceInsert: (() => void) | null = null;

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(async ({ where }: { where: { col: string; value: string } }) =>
          rows.find((r) => r[where.col as "email" | "phone"] === where.value),
        ),
      },
    },
    insert: () => ({
      values: (v: { email: string; phone: string | null }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            raceInsert?.();
            raceInsert = null;
            const conflict = rows.some(
              (r) => r.email === v.email || (v.phone && r.phone === v.phone),
            );
            if (conflict) return [];
            const row = { id: `u${nextId++}`, email: v.email, phone: v.phone };
            rows.push(row);
            return [{ id: row.id }];
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({ users: { email: "email", phone: "phone" } }));
vi.mock("drizzle-orm", () => ({
  eq: (col: string, value: string) => ({ col, value }),
}));
vi.mock("bcryptjs", () => ({ default: { hash: async () => "hashed" } }));

const { findOrCreateCustomerByPhone } = await import("./customers");

const guest = (over: Partial<Parameters<typeof findOrCreateCustomerByPhone>[0]> = {}) =>
  findOrCreateCustomerByPhone({
    fullName: "Rabbi",
    phone: "01711111111",
    emailDomain: "guest.local",
    ...over,
  });

describe("findOrCreateCustomerByPhone", () => {
  beforeEach(() => {
    rows.length = 0;
    nextId = 1;
    raceInsert = null;
  });

  it("creates a customer when the phone is unknown", async () => {
    const id = await guest();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, phone: "01711111111", email: "01711111111@guest.local" });
  });

  it("reuses the existing account on a repeat order from the same phone", async () => {
    const first = await guest();
    const second = await guest({ fullName: "Rabbi Again" });
    expect(second).toBe(first);
    expect(rows).toHaveLength(1);
  });

  it("uses the submitted email when it is free", async () => {
    await guest({ email: "rabbi@example.com" });
    expect(rows[0].email).toBe("rabbi@example.com");
  });

  it("falls back to the derived email when the submitted one is taken", async () => {
    rows.push({ id: "other", email: "taken@example.com", phone: "01799999999" });
    await guest({ email: "taken@example.com" });
    expect(rows[1].email).toBe("01711111111@guest.local");
  });

  // The regression this helper exists for: two checkouts for the same phone
  // where neither supplied an email. Both derive the same address, so the
  // loser's insert conflicts. It must return the winner's id, not throw —
  // that throw used to surface as a 500 and lose a real order.
  it("returns the winner's id when a concurrent insert takes the phone first", async () => {
    raceInsert = () => {
      rows.push({ id: "winner", email: "01711111111@guest.local", phone: "01711111111" });
    };
    const id = await guest();
    expect(id).toBe("winner");
    expect(rows).toHaveLength(1);
  });

  // Same race, but the winner's row carries no phone (an older account that
  // already owns the derived address). The email lookup is the only way back
  // to it.
  it("falls back to the derived email when the conflict was not on phone", async () => {
    raceInsert = () => {
      rows.push({ id: "byEmail", email: "01711111111@guest.local", phone: null });
    };
    const id = await guest();
    expect(id).toBe("byEmail");
  });

  it("trims the phone before matching", async () => {
    const first = await guest();
    expect(await guest({ phone: "  01711111111  " })).toBe(first);
  });
});
