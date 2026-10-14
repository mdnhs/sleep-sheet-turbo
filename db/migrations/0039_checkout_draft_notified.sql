ALTER TABLE "checkout_drafts" ADD COLUMN "notified_at" timestamp (3) with time zone;--> statement-breakpoint
-- Drafts captured before the idle alert existed are handled by hand from the
-- dashboard; mark them announced so the first run doesn't page about them.
UPDATE "checkout_drafts" SET "notified_at" = now() WHERE "notified_at" IS NULL;
