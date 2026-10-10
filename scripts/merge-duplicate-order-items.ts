import "dotenv/config";
import { db } from "../db/index";
import { orderItems } from "../db/schema";
import { eq, inArray, sql } from "drizzle-orm";

function groupKey(item: typeof orderItems.$inferSelect): string {
  return [item.orderId, item.productId, item.color ?? "", item.size ?? "", item.costPrice ?? ""].join("::");
}

async function run() {
  const allItems = await db.query.orderItems.findMany();

  const groups = new Map<string, (typeof orderItems.$inferSelect)[]>();
  for (const item of allItems) {
    const key = groupKey(item);
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.values()].filter((list) => list.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate order-item groups across ${allItems.length} total items.`);

  let mergedGroups = 0;
  let deletedRows = 0;

  for (const group of duplicateGroups) {
    const [keep, ...rest] = group.sort((a, b) => a.id.localeCompare(b.id));
    const totalQuantity = group.reduce((sum, i) => sum + i.quantity, 0);

    console.log(
      `Order ${keep.orderId}: merging ${group.length} rows (qty ${group.map((i) => i.quantity).join("+")}) into qty ${totalQuantity} on item ${keep.id}`
    );

    await db.update(orderItems)
      .set({ quantity: totalQuantity })
      .where(eq(orderItems.id, keep.id));

    await db.delete(orderItems)
      .where(inArray(orderItems.id, rest.map((i) => i.id)));

    mergedGroups++;
    deletedRows += rest.length;
  }

  console.log(`Done. Merged ${mergedGroups} groups, deleted ${deletedRows} duplicate rows.`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
