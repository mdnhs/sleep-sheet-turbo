import { db } from "@/db";
import { paymentLogs } from "@/db/schema";

export interface LogPaymentParams {
  orderId?: string | null;
  orderNumber?: string | null;
  provider?: string;
  endpoint: string;
  paymentId?: string | null;
  trxId?: string | null;
  amount?: number | string | null;
  request?: unknown;
  response?: unknown;
  statusCode?: string | null;
  statusMessage?: string | null;
  isSuccess?: boolean;
  clientIp?: string | null;
  userAgent?: string | null;
}

/**
 * Persists an API interaction (request/response/callback) with a payment provider to the database.
 * Safe and non-blocking: logging failures are caught to guarantee checkout is never interrupted.
 */
export async function recordPaymentLog(params: LogPaymentParams): Promise<void> {
  try {
    await db.insert(paymentLogs).values({
      orderId: params.orderId || null,
      orderNumber: params.orderNumber || null,
      provider: params.provider || "BKASH",
      endpoint: params.endpoint,
      paymentId: params.paymentId || null,
      trxId: params.trxId || null,
      amount: params.amount != null ? String(params.amount) : null,
      request: params.request ? JSON.parse(JSON.stringify(params.request)) : null,
      response: params.response ? JSON.parse(JSON.stringify(params.response)) : null,
      statusCode: params.statusCode ? String(params.statusCode) : null,
      statusMessage: params.statusMessage ? String(params.statusMessage) : null,
      isSuccess: params.isSuccess ?? false,
      clientIp: params.clientIp || null,
      userAgent: params.userAgent || null,
    });
  } catch (error) {
    console.error("[PaymentLogger] Failed to write payment log:", error);
  }
}
