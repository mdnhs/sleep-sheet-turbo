import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "@tabler/icons-react"],
  },
  async rewrites() {
    return [
      { source: "/facebook-feed.xml", destination: "/facebook-feed?format=xml" },
      { source: "/facebook-feed.csv", destination: "/facebook-feed?format=csv" },
      { source: "/facebook-feed.json", destination: "/facebook-feed?format=json" },
      { source: "/hero-banner-1.png", destination: "/hero-banner-1.webp" },
      { source: "/hero-banner-2.png", destination: "/hero-banner-2.webp" },
      { source: "/hero-slider-1.png", destination: "/hero-slider-1.webp" },
      { source: "/logo.png", destination: "/logo.webp" },
    ];
  },
  // No security headers were set anywhere before this (BAD-7, audit
  // 2026-09-21). These are defense-in-depth: lib/sanitize.ts is what
  // actually stops the stored HTML (blog posts, product descriptions) from
  // carrying script — X-Frame-Options/CSP don't replace that, they're what
  // catches a sanitizer bypass or a clickjacking attempt on the dashboard.
  // CSP itself is deliberately not included here yet: this app renders
  // sanitized rich-text HTML, inline styles from the theme system, and
  // several third-party embeds (Google Analytics/GTM, Cloudinary, Looker
  // Studio) — a CSP needs to be staged as Content-Security-Policy-Report-Only
  // first to find every legitimate source before it can enforce, which is
  // follow-up work, not something to guess at here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing in this app needs to be framed by another site — this
          // is what actually stops a dashboard page (or the login form)
          // from being loaded in a clickjacking iframe. Doesn't affect this
          // app framing OTHER sites (the Looker Studio embed on the
          // analytics page), only being framed itself.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops a browser from re-interpreting a response as a different
          // content type than what was served (e.g. treating an uploaded
          // "image" as HTML/script because it sniffed the content).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Full URL only sent same-origin; cross-origin requests (e.g. an
          // outbound link, an analytics beacon) get just the origin, not
          // the full path/query — order ids and search terms don't leak
          // into a third party's Referer header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Forces HTTPS for a year including subdomains, once a browser
          // has seen it once. No effect over plain HTTP (the header itself
          // requires HTTPS to be honored), so this is a no-op in local dev.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        source: "/:path*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // CORS for /api/** (the Hono catch-all) is handled per-request in
  // app/api/[[...route]]/route.ts against a trusted-origin allowlist. This
  // used to also set `Access-Control-Allow-Origin: *` with
  // `-Allow-Credentials: true` here — a wildcard origin combined with
  // credentials is a real hole (any site could read a logged-in visitor's
  // cookie-authenticated API responses in their browser), not just spec-
  // invalid; browsers actually reject that exact combination, so it was
  // silently doing nothing anyway. /api/mcp isn't browser-called (MCP
  // clients are server-to-server), so it doesn't need CORS headers either.
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "luxstore.lenishmagar.me",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
