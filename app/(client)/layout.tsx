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

  if (!settings) {
    // Settings unavailable (e.g. DB hiccup): fall back to client-side fetching.
    return <ClientLayout>{children}</ClientLayout>;
  }

  const seeded = (
    <SettingsSeed settings={settings}>
      <ClientLayout>{children}</ClientLayout>
    </SettingsSeed>
  );

  return testimonials ? (
    <TestimonialsSeed testimonials={testimonials}>{seeded}</TestimonialsSeed>
  ) : (
    seeded
  );
}
