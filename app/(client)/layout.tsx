import { getPublicSettings, getPublicTestimonials } from "@/lib/prefetch-home";
import { SettingsSeed } from "@/provider/settings-seed";
import { TestimonialsSeed } from "@/provider/testimonials-seed";
import ClientLayout from "./client-layout";

// Storefront pages regenerate daily. This is a floor for the whole group: per
// the route-segment docs, the lowest revalidate across a route's layout and
// page decides the frequency for that entire route, so a page that needs to be
// fresher sets its own lower value (blog and testimonials do).
//
// The window is long because it is not the refresh mechanism, it is the
// fallback. Settings, products and categories all invalidate by tag the moment
// they are written (see lib/prefetch-home.ts and lib/meta-catalog/cache.ts), so
// nothing waits out the clock. What the clock does control is how often an
// otherwise idle site wakes the database: every expiry turns the next visitor
// or crawler into a fresh set of queries, and with ~100 storefront routes an
// hourly window is ~2,400 regenerations a day, spread thinly enough to keep the
// compute from ever suspending. Neon bills awake time, not query time — the
// project has spent 67 hours awake to do 28 seconds of actual SQL — so the
// spacing of queries is the cost, and this is the lever on it.
export const revalidate = 86400;

// Server layout: fetches the public site settings once (cached server-side)
// and seeds the ["settings"] React Query cache BEFORE the client layout
// renders, so Navbar/Footer/Hero render real content in the server HTML.
export default async function ClientGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, testimonials] = await Promise.all([
    getPublicSettings().catch(() => null),
    getPublicTestimonials().catch(() => null),
  ]);

  const hasValidSettings = Boolean(
    settings &&
    typeof settings === "object" &&
    Object.keys(settings).length > 0 &&
    (settings.site_name || settings.hero_slides || settings.logo_url)
  );

  const hasValidTestimonials = Boolean(
    testimonials &&
    typeof testimonials === "object" &&
    "data" in testimonials &&
    Array.isArray((testimonials as { data?: unknown[] }).data) &&
    (testimonials as { data: unknown[] }).data.length > 0
  );

  const content = <ClientLayout>{children}</ClientLayout>;
  const seeded = (hasValidSettings && settings) ? (
    <SettingsSeed settings={settings}>{content}</SettingsSeed>
  ) : (
    content
  );

  return hasValidTestimonials ? (
    <TestimonialsSeed testimonials={testimonials}>{seeded}</TestimonialsSeed>
  ) : (
    seeded
  );
}
