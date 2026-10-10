-- Indexes for every column the app filters, sorts or joins on. The schema had
-- none, so each dashboard load, report and public product listing ran full
-- table scans — the single largest avoidable source of database compute time.
CREATE INDEX IF NOT EXISTS "orders_createdAt_idx" ON "orders" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON "orders" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_guestPhone_idx" ON "orders" ("guestPhone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items" ("orderId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_productId_idx" ON "order_items" ("productId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_orderId_idx" ON "payments" ("orderId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_timeline_events_orderId_idx" ON "order_timeline_events" ("orderId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_userId_idx" ON "activity_logs" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products" ("productCategory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON "products" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_reviews_productId_idx" ON "product_reviews" ("productId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_reviews_userId_idx" ON "product_reviews" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_specifications_productId_idx" ON "product_specifications" ("productId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_productId_idx" ON "campaigns" ("productId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "carts_userId_idx" ON "carts" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_categoryId_idx" ON "expenses" ("categoryId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User" ("roleId");
