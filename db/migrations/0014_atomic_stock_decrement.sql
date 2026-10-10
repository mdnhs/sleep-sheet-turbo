-- Atomic, oversell-proof stock decrement.
--
-- The previous decrement ran as a plain UPDATE after a separate "is there
-- enough stock" SELECT, in application code — two concurrent checkouts could
-- both pass the check and both decrement, taking stock negative. This
-- function does the check-and-decrement as one statement per item inside a
-- single DB round trip, and raises so the whole calling transaction/batch
-- (order + order_items + payment inserts) rolls back together if any item
-- doesn't have enough stock.
CREATE OR REPLACE FUNCTION decrement_stock_or_fail(items jsonb)
RETURNS void AS $$
DECLARE
  item jsonb;
  updated_rows int;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    UPDATE products
    SET "productStock" = "productStock" - (item->>'quantity')::int
    WHERE id = (item->>'productId')::text
      AND "productStock" >= (item->>'quantity')::int;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    IF updated_rows = 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', item->>'productId';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
