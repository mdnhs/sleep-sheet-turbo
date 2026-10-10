-- BAD-12 (audit 2026-09-21): the storefront's product search does
-- `ILIKE '%term%'` on products.name — a leading wildcard, which a normal
-- B-tree index can't serve, so every search was a sequential scan over the
-- whole table. pg_trgm's trigram GIN index can serve `ILIKE`/`LIKE` with a
-- leading wildcard. `IF NOT EXISTS`: Neon already has several extensions
-- pre-installed project-wide, and this is safe to no-op if so.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("productName" gin_trgm_ops);
