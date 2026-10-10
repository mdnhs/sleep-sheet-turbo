CREATE TABLE "product_video_stats" (
	"productId" text PRIMARY KEY NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"watchSeconds" integer DEFAULT 0 NOT NULL,
	"orderClicks" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_video_stats" ADD CONSTRAINT "product_video_stats_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;