-- decrement_stock_or_fail now reports which products it took to zero.
--
-- Every sale called invalidateStockCache(), which fires
-- revalidateTag("products") and revalidateTag("categories") — throwing away
-- the cached home, shop, category, product and feed pages so the next visitor
-- regenerates all of them. For a stock count going from 10 to 9.
--
-- The storefront never shows the number. It uses `stock > 0` for the
-- in/out-of-stock state and caps the quantity picker at `stock`, and the
-- picker's cap is enforced again server-side by this very function, so a
-- stale cap cannot oversell. The only cache-visible change a sale can make is
-- crossing to zero.
--
-- So the function returns the ids it zeroed, and the caller invalidates only
-- when that list is non-empty. Returned as jsonb (rather than raising or an
-- out-param) so it still runs as one statement inside the same db.batch as
-- the order insert, with no extra round trip.
--
-- The return type changes, so the old signature has to go first: CREATE OR
-- REPLACE cannot change a function's return type.
DROP FUNCTION IF EXISTS decrement_stock_or_fail(jsonb);--> statement-breakpoint

CREATE FUNCTION decrement_stock_or_fail(items jsonb)
RETURNS jsonb AS $$
DECLARE
  item jsonb;
  remaining int;
  updated_rows int;
  sold_out text[] := ARRAY[]::text[];
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Cleared each pass: RETURNING ... INTO is documented to assign NULL when
    -- nothing matched, but leaving a previous iteration's value in scope is
    -- the kind of thing that only shows up on the second line of a two-line
    -- order.
    remaining := NULL;

    UPDATE products
    SET "productStock" = "productStock" - (item->>'quantity')::int
    WHERE id = (item->>'productId')::text
      AND "productStock" >= (item->>'quantity')::int
    RETURNING "productStock" INTO remaining;

    -- Failure is decided by ROW_COUNT, exactly as before this function started
    -- reporting sold-out ids. A sale that legitimately lands on zero must not
    -- be mistaken for one that found no stock.
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    IF updated_rows = 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', item->>'productId';
    END IF;

    IF remaining = 0 THEN
      sold_out := sold_out || (item->>'productId')::text;
    END IF;
  END LOOP;

  RETURN to_jsonb(sold_out);
END;
$$ LANGUAGE plpgsql;
