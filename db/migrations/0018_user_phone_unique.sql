-- One customer per phone number.
--
-- Guest checkout and POS both identify a walk-in/guest customer by phone:
-- each looks the phone up, and inserts a new User row when it finds nothing.
-- That check-then-insert had no constraint behind it, so two concurrent
-- orders from the same phone could both miss the lookup and both insert.
-- Worse, when neither supplied an email both fell back to the same derived
-- address (`<phone>@guest.local` / `<phone>@pos.local`), so the losing insert
-- hit the UNIQUE on email instead and surfaced as a 500 — a real order lost
-- rather than a duplicate customer created.
--
-- A unique index makes the phone itself the conflict target, which lets both
-- paths use ON CONFLICT DO NOTHING and re-read the winner's row. Partial so
-- the 5 existing rows with no phone (and any staff account created without
-- one) stay exempt: NULLs are excluded from uniqueness anyway, but the
-- explicit predicate also keeps '' from ever becoming a single shared
-- "customer" if a write path starts sending empty strings.
--
-- Verified against production before adding: 257 users, 252 with a phone,
-- 0 duplicate phone values, 0 empty strings.
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key"
  ON "User" ("phone")
  WHERE "phone" IS NOT NULL AND "phone" <> '';
