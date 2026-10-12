CREATE TABLE "promotion_claims" (
	"promotion_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"first_seen_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_claims_promotion_id_visitor_id_pk" PRIMARY KEY("promotion_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "personal_window_minutes" integer;--> statement-breakpoint
ALTER TABLE "promotion_claims" ADD CONSTRAINT "promotion_claims_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;