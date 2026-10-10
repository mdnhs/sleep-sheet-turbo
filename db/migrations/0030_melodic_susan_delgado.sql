ALTER TABLE "orders" ADD COLUMN "confirmedAt" timestamp (3);--> statement-breakpoint
CREATE INDEX "orders_confirmedAt_idx" ON "orders" USING btree ("confirmedAt");