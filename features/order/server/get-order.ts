import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getOrderById(orderId: string) {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        user: { columns: { id: true, name: true, email: true, phone: true } },
        items: { with: { product: true } },
        OrderTimelineEvent: { orderBy: (events, { asc }) => [asc(events.createdAt)] },
      },
    });
    return order;
  } catch (error) {
    console.error("Failed to fetch order by ID:", error);
    return null;
  }
}
