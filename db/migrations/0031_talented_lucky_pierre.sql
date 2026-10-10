CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ts" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"route" text NOT NULL,
	"hostname" text,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"ad_click" text,
	"country" text,
	"device" text,
	"browser" text,
	"os" text,
	"label" text,
	"product_id" text,
	"value" numeric(12, 2),
	"order_id" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_ts_idx" ON "analytics_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_type_ts_idx" ON "analytics_events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_order_id_idx" ON "analytics_events" USING btree ("order_id") WHERE "analytics_events"."order_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "rawKey" text;
