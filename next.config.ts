import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on the VPS as a Docker image (see Dockerfile): standalone
  // output ships only the traced files plus a minimal server.js.
  output: "standalone",
  // The git commit being deployed. After a deploy, a browser still holding
  // the previous build's JS gets a full reload instead of requesting chunks
  // that no longer exist.
  // `|| undefined`: an empty string (ARG passed with no value) made Next emit
  // "?dpl=" on some chunk URLs but not others, so every chunk loaded twice.
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  // The Docker build skips Next's type check: typecheck runs in the CI
  // `verify` job, which the image build depends on, and type-checking inside
  // the image build is what runs the VPS out of memory.
  typescript: {
    ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1",
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "@tabler/icons-react"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // A shared video link, /videos?v=<slug>, is served from its own
        // cached page so it can preview as that one video, without /videos
        // reading searchParams (which made the whole route render per
        // request). beforeFiles, because /videos is a page of its own and an
        // ordinary rewrite would never get past it. The browser keeps the
        // ?v= address, which is what opens the viewer client-side.
        {
          source: "/videos",
          has: [{ type: "query", key: "v", value: "(?<v>[^/]+)" }],
          destination: "/videos/share/:v",
        },
      ],
      afterFiles: [
        { source: "/facebook-feed.xml", destination: "/facebook-feed?format=xml" },
        { source: "/facebook-feed.csv", destination: "/facebook-feed?format=csv" },
        { source: "/facebook-feed.json", destination: "/facebook-feed?format=json" },
        { source: "/hero-banner-1.png", destination: "/hero-banner-1.webp" },
        { source: "/hero-banner-2.png", destination: "/hero-banner-2.webp" },
        { source: "/hero-slider-1.png", destination: "/hero-slider-1.webp" },
        { source: "/logo.png", destination: "/logo.webp" },
      ],
      fallback: [],
    };
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
    // Every width in these lists is a separate Cloudflare transformation of
    // each photo, and the free plan allows 5,000 unique ones a month (images
    // and videos together; new ones fail with error 9422 past that). Next's
    // defaults are 15 widths up to 3840px; 94% of visitors are on phones, so
    // keep 8: full-width on a 2–3x phone needs 828/1080, desktop tops out at
    // 1920, and the small ones cover thumbnails and cards.
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [64, 128, 256, 384],
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
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
