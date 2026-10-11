CREATE TABLE "payment_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text,
	"orderNumber" text,
	"provider" text DEFAULT 'BKASH' NOT NULL,
	"endpoint" text NOT NULL,
	"paymentId" text,
	"trxId" text,
	"amount" numeric(12, 2),
	"request" jsonb,
	"response" jsonb,
	"statusCode" text,
	"statusMessage" text,
	"isSuccess" boolean DEFAULT false NOT NULL,
	"clientIp" text,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_logs_orderId_idx" ON "payment_logs" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "payment_logs_orderNumber_idx" ON "payment_logs" USING btree ("orderNumber");--> statement-breakpoint
CREATE INDEX "payment_logs_paymentId_idx" ON "payment_logs" USING btree ("paymentId");--> statement-breakpoint
CREATE INDEX "payment_logs_trxId_idx" ON "payment_logs" USING btree ("trxId");--> statement-breakpoint
CREATE INDEX "payment_logs_createdAt_idx" ON "payment_logs" USING btree ("createdAt");