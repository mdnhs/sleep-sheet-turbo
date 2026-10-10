CREATE TYPE "public"."SaleType" AS ENUM('POS', 'WEBSITE');--> statement-breakpoint
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'DUE';--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" double precision NOT NULL,
	"categoryId" text NOT NULL,
	"date" timestamp(3) DEFAULT now() NOT NULL,
	"note" text,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "paymentMethod" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "Category" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "costPrice" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "saleType" "SaleType" DEFAULT 'WEBSITE' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "showLowestPriceAsDefault" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "defaultVariantName" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_expense_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;