ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierStatus" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierStatusAt" timestamp(3);
