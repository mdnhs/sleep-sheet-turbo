ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
UPDATE "products"
SET "slug" = trim(both '-' from regexp_replace(lower(trim("productName")), '[^a-z0-9]+', '-', 'g'))
  || '-' || lower("productSKU")
WHERE "slug" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_unique" ON "products" ("slug");
