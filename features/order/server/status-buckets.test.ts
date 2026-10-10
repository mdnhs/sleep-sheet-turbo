import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { orders } from "@/db/schema";
import {
  isPendingSql,
  isConfirmedSql,
  isDeliveredSql,
  isCancelledSql,
  isReturnedSql,
  isTodaySqlFor,
  todayRange,
  bucketFor,
} from "./status-buckets";

// Run against a real Postgres (PGlite, in-memory). The bucket expressions are
// raw SQL whose correctness is mostly about SQL semantics — three-valued
// logic around NULL, ILIKE, coalesce — and a mock would happily agree with a
// wrong answer. The schema below is the subset of `orders` these expressions
// touch.
let client: PGlite;
let db: ReturnType<typeof drizzle>;

type Row = {
  id: string;
  status?: string;
  saleType?: string;
  trackingNumber?: string | null;
  courierStatus?: string | null;
  refundedAmount?: number;
  shippingAddress?: string;
  createdAt?: Date;
  confirmedAt?: Date | null;
  costPrice?: number | null;
};

async function seed(rows: Row[]) {
  await db.execute(sql`delete from order_items`);
  await db.execute(sql`delete from orders`);
  for (const r of rows) {
    await db.execute(sql`
      insert into orders (id, "orderNumber", status, "saleType", "trackingNumber",
        "courierStatus", "refundedAmount", "shippingAddress", "createdAt", "confirmedAt")
      values (${r.id}, ${`N-${r.id}`}, ${r.status ?? "PENDING"}, ${r.saleType ?? "WEBSITE"},
        ${r.trackingNumber ?? null}, ${r.courierStatus ?? null}, ${r.refundedAmount ?? 0},
        ${r.shippingAddress ?? "somewhere"}, ${r.createdAt ?? new Date("2026-06-01T12:00:00Z")},
        ${r.confirmedAt ?? null})`);

    const isPendingFixture = (r.status ?? "PENDING") === "PENDING" && (!r.trackingNumber || r.trackingNumber === "") && !r.confirmedAt && !r.shippingAddress?.toLowerCase().includes("in-store pickup");
    const cost = r.costPrice !== undefined
      ? r.costPrice
      : (isPendingFixture ? null : 100);
    if (cost !== null) {
      await db.execute(sql`
        insert into order_items (id, "orderId", "costPrice")
        values (${`it-${r.id}`}, ${r.id}, ${cost})`);
    }
  }
}

/** Ids matching a bucket expression. */
async function idsIn(expr: Parameters<typeof isPendingSql.append>[0] | typeof isPendingSql) {
  const res = await db
    .select({ id: orders.id })
    .from(orders)
    .where(expr as never)
    .orderBy(orders.id);
  return res.map((r) => r.id);
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await db.execute(sql`
    create table orders (
      id text primary key,
      "orderNumber" text not null,
      status text not null,
      "saleType" text not null,
      "trackingNumber" text,
      "courierStatus" text,
      "refundedAmount" numeric(12,2) not null default 0,
      "shippingAddress" text not null,
      "createdAt" timestamp(3) not null,
      "confirmedAt" timestamp(3)
    )`);
  await db.execute(sql`
    create table order_items (
      id text primary key,
      "orderId" text not null,
      "costPrice" numeric(12,2)
    )`);
});

afterAll(async () => { await client.close(); });

describe("cancelled", () => {
  it("matches the order status and both courier cancellation values", async () => {
    await seed([
      { id: "a", status: "CANCELLED" },
      { id: "b", trackingNumber: "T1", courierStatus: "cancelled" },
      { id: "c", trackingNumber: "T2", courierStatus: "cancelled_approval_pending" },
      { id: "d", status: "PENDING" },
    ]);
    expect(await idsIn(isCancelledSql)).toEqual(["a", "b", "c"]);
  });
});

describe("returned", () => {
  it("matches REFUNDED, any refunded amount, and the courier's return values", async () => {
    await seed([
      { id: "a", status: "REFUNDED" },
      { id: "b", refundedAmount: 0.01 },
      { id: "c", trackingNumber: "T", courierStatus: "returned" },
      { id: "d", trackingNumber: "T", courierStatus: "partial-return" },
      { id: "e", trackingNumber: "T", courierStatus: "not_delivered" },
      { id: "f", trackingNumber: "T", courierStatus: "partial-not-delivered" },
      { id: "g", status: "PENDING" },
    ]);
    expect(await idsIn(isReturnedSql)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  // mapSteadfastStatus had no slot for these, so before courierStatus was
  // stored raw they were being folded away and the orders misfiled.
  it("does not treat a partial return as a delivery", async () => {
    await seed([{ id: "a", trackingNumber: "T", courierStatus: "partial-return" }]);
    expect(await idsIn(isDeliveredSql)).toEqual([]);
    expect(await idsIn(isReturnedSql)).toEqual(["a"]);
  });
});

describe("delivered", () => {
  it("matches DELIVERED and the four courier delivery values", async () => {
    await seed([
      { id: "a", status: "DELIVERED" },
      { id: "b", trackingNumber: "T", courierStatus: "delivered" },
      { id: "c", trackingNumber: "T", courierStatus: "partial_delivered" },
      { id: "d", trackingNumber: "T", courierStatus: "delivered_approval_pending" },
      { id: "e", trackingNumber: "T", courierStatus: "partial_delivered_approval_pending" },
      { id: "f", status: "PENDING" },
    ]);
    expect(await idsIn(isDeliveredSql)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("yields to cancelled and returned", async () => {
    await seed([
      { id: "a", status: "DELIVERED", refundedAmount: 50 },
      { id: "b", status: "CANCELLED" },
    ]);
    expect(await idsIn(isDeliveredSql)).toEqual([]);
  });
});

describe("confirmed", () => {
  it("matches a POS showroom sale by its in-store pickup address, case-insensitively", async () => {
    await seed([
      { id: "a", saleType: "POS", shippingAddress: "POS - In-store pickup" },
      { id: "b", saleType: "POS", shippingAddress: "pos - IN-STORE PICKUP" },
      { id: "c", saleType: "POS", shippingAddress: "Online Delivery (POS)" },
    ]);
    expect(await idsIn(isConfirmedSql)).toEqual(["a", "b"]);
  });

  it("matches anything with a tracking number and bought price", async () => {
    await seed([
      { id: "a", trackingNumber: "T" },
      { id: "b", status: "PROCESSING", trackingNumber: "T" },
      { id: "c", status: "SHIPPED", trackingNumber: "T" },
      { id: "d", status: "PENDING" },
    ]);
    expect(await idsIn(isConfirmedSql)).toEqual(["a", "b", "c"]);
  });

  it("treats an empty tracking number as no tracking number", async () => {
    await seed([{ id: "a", trackingNumber: "" }]);
    expect(await idsIn(isConfirmedSql)).toEqual([]);
    expect(await idsIn(isPendingSql)).toEqual(["a"]);
  });

  it("requires a tracking number even if confirmedAt is set", async () => {
    await seed([
      { id: "a", status: "PENDING", trackingNumber: "T", confirmedAt: new Date() },
      { id: "b", status: "PENDING", trackingNumber: null, confirmedAt: new Date() },
    ]);
    expect(await idsIn(isConfirmedSql)).toEqual(["a"]);
    expect(await idsIn(isPendingSql)).toEqual(["b"]);
  });

  // Documented on purpose: the buckets are not a partition, and a POS
  // showroom sale legitimately appears under both.
  it("overlaps with delivered for a POS showroom sale", async () => {
    await seed([{ id: "a", saleType: "POS", status: "DELIVERED", shippingAddress: "POS - In-store pickup" }]);
    expect(await idsIn(isConfirmedSql)).toEqual(["a"]);
    expect(await idsIn(isDeliveredSql)).toEqual(["a"]);
  });
});

describe("pending", () => {
  it("is what is left over once every other bucket has had its say", async () => {
    await seed([
      { id: "a", status: "PENDING" },
      { id: "b", status: "PENDING", trackingNumber: "T" },      // confirmed
      { id: "c", status: "PENDING", refundedAmount: 5 },         // returned
      { id: "d", status: "DELIVERED", trackingNumber: "T" },     // delivered
    ]);
    expect(await idsIn(isPendingSql)).toEqual(["a"]);
  });
});

// The trap the module comment calls out: `NULL IN (...)` is NULL, and
// `NOT NULL` is NULL, which drops the row rather than keeping it. Every
// courier test is wrapped in coalesce(..., false) for this reason — these
// cases fail loudly if that wrapping is ever removed.
describe("NULL courier status", () => {
  it("keeps a never-synced order in pending rather than dropping it", async () => {
    await seed([{ id: "a", status: "PENDING", trackingNumber: null, courierStatus: null }]);
    expect(await idsIn(isPendingSql)).toEqual(["a"]);
  });

  it("keeps a tracked but unsynced order in confirmed", async () => {
    await seed([{ id: "a", status: "PENDING", trackingNumber: "T", courierStatus: null }]);
    expect(await idsIn(isConfirmedSql)).toEqual(["a"]);
  });

  it("files every row into at least one bucket", async () => {
    await seed([
      { id: "a", status: "PENDING" },
      { id: "b", status: "PROCESSING", trackingNumber: "T" },
      { id: "c", status: "DELIVERED", trackingNumber: "T" },
      { id: "d", status: "CANCELLED" },
      { id: "e", status: "REFUNDED" },
      { id: "f", status: "SHIPPED", trackingNumber: "T", courierStatus: "hold" },
    ]);
    const all = new Set([
      ...(await idsIn(isPendingSql)),
      ...(await idsIn(isConfirmedSql)),
      ...(await idsIn(isDeliveredSql)),
      ...(await idsIn(isCancelledSql)),
      ...(await idsIn(isReturnedSql)),
    ]);
    expect([...all].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("courier status is ignored once an order is finished", () => {
  // The dashboard only ever fetched courier state for tracked, unfinished
  // orders. Mirroring that here is what keeps the server's classification
  // identical to the one the page used to compute.
  it("does not let a stale courier value move a delivered order", async () => {
    await seed([{ id: "a", status: "DELIVERED", trackingNumber: "T", courierStatus: "cancelled" }]);
    expect(await idsIn(isCancelledSql)).toEqual([]);
    expect(await idsIn(isDeliveredSql)).toEqual(["a"]);
  });

  it("does not let a stale courier value move a cancelled order", async () => {
    await seed([{ id: "a", status: "CANCELLED", trackingNumber: "T", courierStatus: "delivered" }]);
    expect(await idsIn(isDeliveredSql)).toEqual([]);
    expect(await idsIn(isCancelledSql)).toEqual(["a"]);
  });
});

describe("todayRange", () => {
  const now = new Date("2026-09-16T02:00:00Z").getTime(); // 08:00 in UTC+6

  // Dhaka is UTC+6, so getTimezoneOffset() returns -360. At 02:00 UTC it is
  // already the 16th locally, and a UTC day boundary would hide the morning's
  // orders — the range has to start at 2026-09-15T18:00Z.
  it("always brackets Dhaka's local day (UTC+6)", () => {
    const { from, to } = todayRange("-360", now);
    expect(from.toISOString()).toBe("2026-09-15T18:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-16T18:00:00.000Z");
  });

  it("always uses Dhaka day even when no offset is sent", () => {
    const { from, to } = todayRange(undefined, now);
    expect(from.toISOString()).toBe("2026-09-15T18:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-16T18:00:00.000Z");
  });

  it("always uses Dhaka day even on unparseable offset", () => {
    expect(todayRange("abc", now).from.toISOString()).toBe("2026-09-15T18:00:00.000Z");
  });

  it("selects only orders confirmed inside the viewer's day", async () => {
    await seed([
      { id: "before", trackingNumber: "T", confirmedAt: new Date("2026-09-15T17:59:00Z") },
      { id: "inside", trackingNumber: "T", confirmedAt: new Date("2026-09-15T18:30:00Z") },
      { id: "after", trackingNumber: "T", confirmedAt: new Date("2026-09-16T18:30:00Z") },
      { id: "pending_unconfirmed", trackingNumber: "T", createdAt: new Date("2026-09-15T18:30:00Z"), confirmedAt: null },
    ]);
    expect(await idsIn(isTodaySqlFor(todayRange("-360", now)))).toEqual(["inside"]);
  });
});

describe("bucketFor", () => {
  const today = isTodaySqlFor(todayRange(undefined));

  it("maps each filter value to its bucket", () => {
    expect(bucketFor("PENDING", today)).toBe(isPendingSql);
    expect(bucketFor("CONFIRMED", today)).toBe(isConfirmedSql);
    expect(bucketFor("DELIVERED", today)).toBe(isDeliveredSql);
    expect(bucketFor("CANCELLED", today)).toBe(isCancelledSql);
    expect(bucketFor("RETURNED", today)).toBe(isReturnedSql);
    expect(bucketFor("TODAY", today)).toBe(today);
  });

  it("returns undefined for no filter, so the query is unrestricted", () => {
    expect(bucketFor(undefined, today)).toBeUndefined();
    expect(bucketFor("", today)).toBeUndefined();
    expect(bucketFor("NONSENSE", today)).toBeUndefined();
  });
});

describe("bought price and steadfast booking requirement", () => {
  it("forces an order without bought price into pending even if status is PROCESSING or tracked", async () => {
    await seed([
      { id: "no_cost_processing", status: "PROCESSING", trackingNumber: "T1", costPrice: null },
      { id: "no_cost_tracked", trackingNumber: "T1", costPrice: null },
      { id: "with_cost_processing", status: "PROCESSING", trackingNumber: "T2", costPrice: 150 },
    ]);
    expect(await idsIn(isPendingSql)).toEqual(["no_cost_processing", "no_cost_tracked"]);
    expect(await idsIn(isConfirmedSql)).toEqual(["with_cost_processing"]);
  });

  it("forces an order without steadfast booking into pending even if bought price is set", async () => {
    await seed([
      { id: "cost_no_booking", status: "PROCESSING", trackingNumber: null, costPrice: 150 },
      { id: "cost_with_booking", status: "PROCESSING", trackingNumber: "T", costPrice: 150 },
    ]);
    expect(await idsIn(isPendingSql)).toEqual(["cost_no_booking"]);
    expect(await idsIn(isConfirmedSql)).toEqual(["cost_with_booking"]);
  });

  it("never includes an order without bought price in today confirmed", async () => {
    const now = new Date("2026-09-16T02:00:00Z").getTime();
    await seed([
      { id: "with_cost_today", trackingNumber: "T", confirmedAt: new Date("2026-09-15T18:30:00Z"), costPrice: 200 },
      { id: "no_cost_today", trackingNumber: "T", confirmedAt: new Date("2026-09-15T18:30:00Z"), costPrice: null },
    ]);
    expect(await idsIn(isTodaySqlFor(todayRange("-360", now)))).toEqual(["with_cost_today"]);
  });

  it("never includes an order without steadfast booking in today confirmed", async () => {
    const now = new Date("2026-09-16T02:00:00Z").getTime();
    await seed([
      { id: "with_both_today", trackingNumber: "T", confirmedAt: new Date("2026-09-15T18:30:00Z"), costPrice: 200 },
      { id: "no_booking_today", trackingNumber: null, confirmedAt: new Date("2026-09-15T18:30:00Z"), costPrice: 200 },
    ]);
    expect(await idsIn(isTodaySqlFor(todayRange("-360", now)))).toEqual(["with_both_today"]);
  });
});
