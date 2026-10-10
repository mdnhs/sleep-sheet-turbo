import 'dotenv/config';
import { db } from '../db';
import { products, categories } from '../db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const mainQuery = await db.select({
      id: products.id,
      variants: products.variants,
      categoryValue: categories.value,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id));
    console.log("Success:", mainQuery.slice(0, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
