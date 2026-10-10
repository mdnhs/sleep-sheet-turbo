-- Money columns were doublePrecision (binary float), which can accumulate
-- rounding drift under repeated updates (e.g. orders.refundedAmount summing
-- partial refunds). numeric(12,2) stores an exact decimal instead. The
-- explicit ::numeric(12,2) cast rounds any existing float drift to 2 places
-- on the way in, so this also cleans up values already skewed by float
-- storage (e.g. 19.990000000000002 -> 19.99).
--
-- products.discount is a PERCENTAGE, not a currency amount — intentionally
-- left as doublePrecision.
ALTER TABLE products ALTER COLUMN "productPrice" TYPE numeric(12,2) USING "productPrice"::numeric(12,2);

ALTER TABLE orders ALTER COLUMN "totalAmount" TYPE numeric(12,2) USING "totalAmount"::numeric(12,2);
ALTER TABLE orders ALTER COLUMN "subtotal" TYPE numeric(12,2) USING "subtotal"::numeric(12,2);
ALTER TABLE orders ALTER COLUMN "shippingCost" TYPE numeric(12,2) USING "shippingCost"::numeric(12,2);
ALTER TABLE orders ALTER COLUMN "tax" TYPE numeric(12,2) USING "tax"::numeric(12,2);
ALTER TABLE orders ALTER COLUMN "refundedAmount" TYPE numeric(12,2) USING "refundedAmount"::numeric(12,2);

ALTER TABLE order_items ALTER COLUMN "price" TYPE numeric(12,2) USING "price"::numeric(12,2);
ALTER TABLE order_items ALTER COLUMN "costPrice" TYPE numeric(12,2) USING "costPrice"::numeric(12,2);

ALTER TABLE payments ALTER COLUMN "amount" TYPE numeric(12,2) USING "amount"::numeric(12,2);

ALTER TABLE shipping_methods ALTER COLUMN "cost" TYPE numeric(12,2) USING "cost"::numeric(12,2);

ALTER TABLE expenses ALTER COLUMN "amount" TYPE numeric(12,2) USING "amount"::numeric(12,2);
