import { after } from "next/server";

/** Fire-and-forget notification to n8n for realtime Telegram order alerts.
 * No-op unless N8N_ORDER_WEBHOOK_URL is set. Never awaited by callers so a
 * slow/down n8n instance can't add latency to checkout or fail the order.
 * Runs inside after() so Vercel keeps the function alive to finish sending
 * it instead of freezing the instance the moment the response goes out. */

interface OrderNotifyPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  paymentMethod: string;
  totalAmount: number;
  items: { productId: string; name: string; quantity: number; price: number }[];
}

export function notifyNewOrder(payload: OrderNotifyPayload): void {
  const webhookUrl = process.env.N8N_ORDER_WEBHOOK_URL;
  if (!webhookUrl) return;

  after(() =>
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Bounds how long the deferred after() task can be kept alive by a
      // hung n8n instance — this already runs off the response path, but an
      // unbounded fetch here still ties up the after() execution window.
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      console.error("n8n order notify failed:", error);
    })
  );
}
