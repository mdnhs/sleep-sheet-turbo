import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Heads up when running `db:push`: the production database has the
// pg_stat_statements extension installed, and it puts its views and functions
// in `public` — where this config also looks. It could not be moved to its own
// schema (its objects are owned by Neon's cloud_admin, not by neondb_owner),
// and drizzle-kit's `extensionsFilters` only accepts "postgis", so there is no
// way to declare it here. If a push ever proposes DROP VIEW on
// public.pg_stat_statements, decline it. Nothing depends on the extension —
// it only records query statistics, used to work out which queries keep the
// Neon compute awake — so if it does get dropped, one statement brings it
// back: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
