ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp(3);
