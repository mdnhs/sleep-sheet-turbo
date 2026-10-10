-- Backfill from the first logged "Shipping cost" edit (its `from` is what the customer was charged); unedited orders still hold it in shippingCost.
ALTER TABLE "orders" ADD COLUMN "deliveryCharge" numeric(12, 2);--> statement-breakpoint
UPDATE "orders" o SET "deliveryCharge" = COALESCE(
  (
    SELECT (c->>'from')::numeric
    FROM "activity_logs" a, json_array_elements(a."changes") c
    WHERE a."targetName" = '#' || o."orderNumber"
      AND c->>'label' = 'Shipping cost'
      AND c->>'from' ~ '^[0-9]+(\.[0-9]+)?$'
    ORDER BY a."createdAt" ASC
    LIMIT 1
  ),
  o."shippingCost"
);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "deliveryCharge" SET NOT NULL;
