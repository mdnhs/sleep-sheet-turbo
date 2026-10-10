CREATE TABLE "product_video_likes" (
	"productId" text NOT NULL,
	"visitorId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "product_video_likes_productId_visitorId_pk" PRIMARY KEY("productId","visitorId")
);
--> statement-breakpoint
ALTER TABLE "product_video_likes" ADD CONSTRAINT "product_video_likes_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;