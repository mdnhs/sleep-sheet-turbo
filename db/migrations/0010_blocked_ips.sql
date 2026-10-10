CREATE TABLE IF NOT EXISTS "blocked_ips" (
	"id" text PRIMARY KEY NOT NULL,
	"ipAddress" text NOT NULL,
	"reason" text,
	"orderId" text,
	"blockedById" text,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_ips_ipAddress_unique" UNIQUE("ipAddress")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_blockedById_User_id_fk" FOREIGN KEY ("blockedById") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
