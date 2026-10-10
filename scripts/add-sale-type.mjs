import { neon } from "@neondatabase/serverless";
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set in .env");
const sql = neon(connectionString);

try {
  await sql`CREATE TYPE "SaleType" AS ENUM ('POS', 'WEBSITE')`;
} catch (e) {
  if (!e.message?.includes('already exists')) throw e;
}

await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "saleType" "SaleType" DEFAULT 'WEBSITE' NOT NULL`;
console.log("Done");
