ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "metaPurchaseEventSentAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotencyKey_unique" ON "orders" ("idempotencyKey");--> statement-breakpoint
