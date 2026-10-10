import "dotenv/config";
import { db } from "../db/index";
import { orders, orderTimelineEvents } from "../db/schema";
import { eq } from "drizzle-orm";

async function run() {
  try {
    console.log("Fetching orders with trackingNumber starting with SFR or non-numeric...");
    const allOrders = await db.query.orders.findMany();
    
    const targetOrders = allOrders.filter(o => 
      o.trackingNumber && 
      (o.trackingNumber.startsWith("SFR") || !/^\d+$/.test(o.trackingNumber))
    );
    
    console.log(`Found ${targetOrders.length} orders targeting update.`);
    
    for (const order of targetOrders) {
      console.log(`Processing Order #${order.orderNumber} (current tracking: ${order.trackingNumber})...`);
      try {
        const events = await db.query.orderTimelineEvents.findMany({
          where: eq(orderTimelineEvents.orderId, order.id),
        });
        
        let consignmentId: string | null = null;
        for (const event of events) {
          if (event.message) {
            const match = event.message.match(/Consignment ID:\s*(\d+)/i);
            if (match) {
              consignmentId = match[1];
              break;
            }
          }
        }
        
        if (consignmentId) {
          console.log(`  Found Consignment ID from timeline: ${consignmentId}. Updating database...`);
          await db.update(orders)
            .set({ trackingNumber: consignmentId })
            .where(eq(orders.id, order.id));
          console.log(`  Successfully updated Order #${order.orderNumber}.`);
        } else {
          console.log(`  No consignment ID found in timeline events for Order #${order.orderNumber}.`);
        }
      } catch (err) {
        console.error(`  Error processing Order #${order.orderNumber}:`, err);
      }
    }
    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration script failed:", error);
    process.exit(1);
  }
}

run();
