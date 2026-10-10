CREATE TABLE "checkout_drafts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checkout_drafts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"full_name" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"shipping_zone" text,
	"items" jsonb NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"referrer_host" text,
	"utm_source" text,
	"status" text DEFAULT 'open' NOT NULL,
	"order_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_drafts_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE INDEX "checkout_drafts_status_updated_idx" ON "checkout_drafts" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "checkout_drafts_phone_idx" ON "checkout_drafts" USING btree ("phone");