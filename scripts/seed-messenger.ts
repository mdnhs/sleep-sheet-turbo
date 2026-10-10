import "dotenv/config";
import { db } from "../db";
import { testimonials, TestimonialUserRole } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Adding screenshot column to Testimonial table if it doesn't exist...");
    await db.execute(sql`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "screenshot" text;`);
    console.log("Column added successfully.");
  } catch (err) {
    console.log("Column might already exist or error occurred:", err);
  }
  const messengerTestimonial = {
    id: "demo-messenger-review-1",
    name: "Ayesha Siddiqua",
    message: "I usually don't write reviews, but the bedsheet is so soft! Here is the picture of it in my room. Thanks for the quick delivery.",
    rating: 5,
    role: TestimonialUserRole.CUSTOMER,
    screenshot: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop", // placeholder image mimicking a screenshot
  };

  const messengerTestimonial2 = {
    id: "demo-messenger-review-2",
    name: "Kamrul Islam",
    message: "", // Empty message since screenshot has the context
    rating: 5,
    role: TestimonialUserRole.CUSTOMER,
    screenshot: "https://images.unsplash.com/photo-1616627547584-bf28cee262db?q=80&w=600&auto=format&fit=crop", // Valid placeholder image
  };

  const data = [messengerTestimonial, messengerTestimonial2];

  for (const testimonial of data) {
    const existing = await db.query.testimonials.findFirst({
      where: eq(testimonials.id, testimonial.id),
    });

    if (existing) {
      await db.update(testimonials)
        .set({ ...testimonial, updatedAt: new Date() })
        .where(eq(testimonials.id, testimonial.id));
    } else {
      await db.insert(testimonials).values(testimonial);
    }
  }

  console.log("Successfully inserted demo messenger screenshot reviews!");
}

main().catch((error) => {
  console.error("Failed to seed messenger reviews:", error);
  process.exitCode = 1;
});
