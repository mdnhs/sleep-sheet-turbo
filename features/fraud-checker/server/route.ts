import { Hono } from "hono";
import { sessionMiddleware } from "@/lib/session-middleware";
import { can } from "@/lib/permissions";
import { BdCourierError, checkCourier, getMyPlan } from "@/lib/bdcourier";
import { normalizeBdPhone } from "@/features/fraud-checker/phone";

// GET on purpose: the activity log skips successful GETs, and a lookup is a
// read — a POST here would write a "Created fraud check" row per search.
const app = new Hono()
  // Registered before "/:phone" so "plan" isn't taken as a phone number.
  .get("/plan", sessionMiddleware, async (c) => {
    if (!can(c.get("user"), "orders", "read")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    try {
      return c.json(await getMyPlan(), 200);
    } catch (err) {
      if (err instanceof BdCourierError) {
        return c.json({ error: err.message }, 502);
      }
      console.error("[fraud-checker] plan lookup failed", err);
      return c.json({ error: "প্ল্যান লোড করা যায়নি" }, 500);
    }
  })

  .get("/:phone", sessionMiddleware, async (c) => {
    if (!can(c.get("user"), "orders", "read")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const phone = normalizeBdPhone(c.req.param("phone"));
    if (!phone) {
      return c.json({ error: "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" }, 400);
    }

    try {
      const result = await checkCourier(phone);
      return c.json({ phone, ...result }, 200);
    } catch (err) {
      if (err instanceof BdCourierError) {
        return c.json({ error: err.message }, 502);
      }
      console.error("[fraud-checker] lookup failed", err);
      return c.json({ error: "ফ্রড চেক ব্যর্থ হয়েছে" }, 500);
    }
  });

export default app;
