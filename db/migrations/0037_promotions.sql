CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'free_delivery' NOT NULL,
	"payment_methods" text[] NOT NULL,
	"zones" text[] NOT NULL,
	"min_order_amount" numeric(12, 2),
	"starts_at" timestamp (3) with time zone,
	"ends_at" timestamp (3) with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "promotions_active_idx" ON "promotions" USING btree ("is_active");